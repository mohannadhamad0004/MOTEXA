// What a customer may see of a tow driver and his company ("driver card"), built from real data only.
// Never: phone, email, licence, exact position outside an active job. Plate: masked until the job is assigned.
import { prisma } from "../prisma.js";
import { haversineKm, round3, cityCentre } from "../geo.js";
import { driverStatus } from "./tow-dispatch.js";

export const maskPlate = (p: string) => `•••• ${p.replace(/\s/g, "").slice(-2)}`;
/** "Ahmad K." */
export const shortName = (full: string) => {
  const w = full.trim().split(/\s+/);
  return w.length > 1 ? `${w[0]} ${w[w.length - 1][0]}.` : w[0] || full;
};
const pub = (id: string) => `/files/public/${id}`;
const avg1 = (n: number | null) => (n === null ? null : Math.round(n * 10) / 10);

export type DriverCard = Awaited<ReturnType<typeof driverCards>> extends Map<string, infer V> ? V : never;

/** Cards for these drivers. `fullPlate` ids = jobs already assigned to the viewer (plate in full). */
export async function driverCards(ids: string[], fullPlate: Set<string> = new Set()) {
  const unique = [...new Set(ids)];
  const out = new Map<string, Awaited<ReturnType<typeof build>>>();
  if (!unique.length) return out;
  const rows = await prisma.towDriver.findMany({
    where: { id: { in: unique } },
    include: {
      user: { select: { fullName: true } },
      company: { select: { id: true, companyName: true, city: true, verificationStatus: true } },
      truck: { select: { truckType: true, make: true, model: true, plateNumber: true, files: { where: { purpose: "TRUCK_PHOTO", visibility: "PUBLIC" }, select: { id: true } } } },
      files: { where: { purpose: "DRIVER_PHOTO", visibility: "PUBLIC" }, select: { id: true } },
    },
  });
  const [done, drv, cmp] = await Promise.all([
    prisma.towRequest.groupBy({ by: ["driverId"], where: { driverId: { in: unique }, status: "COMPLETED" }, _count: { _all: true } }),
    prisma.towReview.groupBy({ by: ["driverId"], where: { driverId: { in: unique } }, _avg: { stars: true }, _count: { _all: true } }),
    prisma.towReview.groupBy({ by: ["companyId"], where: { companyId: { in: [...new Set(rows.map((r) => r.companyId))] } }, _avg: { stars: true }, _count: { _all: true } }),
  ]);
  async function build(d: (typeof rows)[number]) {
    const dr = drv.find((x) => x.driverId === d.id);
    const cr = cmp.find((x) => x.companyId === d.companyId);
    return {
      id: d.id,
      name: shortName(d.user.fullName),
      photoUri: d.files[0] ? pub(d.files[0].id) : null,
      rating: { avg: avg1(dr?._avg.stars ?? null), count: dr?._count._all ?? 0 }, // avg null = "New"
      completedTows: done.find((x) => x.driverId === d.id)?._count._all ?? 0,
      truck: d.truck ? { type: d.truck.truckType, make: d.truck.make, model: d.truck.model, photoUri: d.truck.files[0] ? pub(d.truck.files[0].id) : null, plate: fullPlate.has(d.id) ? d.truck.plateNumber : maskPlate(d.truck.plateNumber) } : null,
      company: { id: d.company.id, name: d.company.companyName, city: d.company.city, verified: d.company.verificationStatus === "APPROVED", rating: { avg: avg1(cr?._avg.stars ?? null), count: cr?._count._all ?? 0 } },
    };
  }
  for (const d of rows) out.set(d.id, await build(d));
  return out;
}

/** Where a FREE driver is shown on the map before a job: his truck's base (else the company base, else the city centre), rounded to ~110 m. There is no idle tracking. */
export function restingPoint(d: { truck: { baseLat: number | null; baseLng: number | null } | null; company: { baseLat: number | null; baseLng: number | null; city: string } }) {
  if (d.truck?.baseLat != null && d.truck.baseLng != null) return { lat: d.truck.baseLat, lng: d.truck.baseLng };
  if (d.company.baseLat != null && d.company.baseLng != null) return { lat: d.company.baseLat, lng: d.company.baseLng };
  return cityCentre(d.company.city) ?? null;
}

/** Every FREE driver of an APPROVED company with his card, rounded pin and distance from `from` (km, 1 decimal), nearest first. */
export async function freeDriversNear(from: { lat: number; lng: number } | null, companyId?: string) {
  const all = await prisma.towDriver.findMany({
    where: { approval: "APPROVED", offline: false, user: { status: "ACTIVE" }, company: { verificationStatus: "APPROVED", ...(companyId ? { id: companyId } : {}) } },
    include: { truck: { select: { baseLat: true, baseLng: true } }, company: { select: { baseLat: true, baseLng: true, city: true } } },
  });
  const free: typeof all = [];
  for (const d of all) if ((await driverStatus(prisma, d)) === "FREE") free.push(d);
  const cards = await driverCards(free.map((d) => d.id));
  return free
    .map((d) => {
      const p = restingPoint(d);
      return { ...cards.get(d.id)!, pin: p ? { lat: round3(p.lat)!, lng: round3(p.lng)! } : null, distanceKm: from && p ? Math.round(haversineKm(from, p) * 10) / 10 : null, _companyId: d.companyId };
    })
    .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity) || a.id.localeCompare(b.id));
}
