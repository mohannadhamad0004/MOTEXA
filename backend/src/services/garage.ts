import type { CustomerGarageCar, Prisma } from "../generated/prisma/client.js";
import {activeModels} from "./vehicle3d-catalog.js";
import { prisma } from "../prisma.js";

export const MAX_GARAGE_CARS = 10;
export const MAX_GARAGE_NICKNAME = 40;
export const GEN_FIELDS = { id: true, code: true, nameEn: true, nameAr: true, yearFrom: true, yearTo: true, photoUrl: true, photoCredit: true, photoLicense: true, model3dKey: true } as const;
export class GarageError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
const invalid = (message: string): never => { throw new GarageError(400, "GARAGE_INVALID_CAR", message); };
const missing = (): never => { throw new GarageError(404, "GARAGE_CAR_NOT_FOUND", "Car not found."); };
const norm = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");
const order: Prisma.CustomerGarageCarOrderByWithRelationInput[] = [
  { isActive: "desc" }, { lastSelectedAt: { sort: "desc", nulls: "last" } }, { updatedAt: "desc" }, { createdAt: "asc" }, { id: "asc" },
];
type Tx = Prisma.TransactionClient;
type Run = <T>(work: (tx: Tx) => Promise<T>) => Promise<T>;
type Input = Record<string, unknown>;

function body(input: unknown, compatibility: boolean): Input {
  if (!input || typeof input !== "object" || Array.isArray(input)) return invalid("Provide a car object.");
  const allowed = new Set(["make", "model", "year", "color", "generationId", ...(compatibility ? [] : ["nickname"])]);
  for (const key of Object.keys(input)) if (!allowed.has(key)) invalid(`Unsupported car field: ${key}.`);
  return input as Input;
}

async function validate(tx: Tx, input: Input, existing?: CustomerGarageCar) {
  const value = { ...existing, ...input };
  const { make, model, year, color } = value;
  if (typeof make !== "string" || !make.trim() || make.length > 60 || typeof model !== "string" || !model.trim() || model.length > 60 || !Number.isInteger(year)) return invalid("Choose a make, a model and a year.");
  if (color != null && (typeof color !== "string" || !/^#[0-9a-f]{6}$/i.test(color))) return invalid("Choose a colour from the list.");
  const nickname = value.nickname;
  if (nickname != null && (typeof nickname !== "string" || nickname.trim().length > MAX_GARAGE_NICKNAME || /[\x00-\x1f\x7f]/.test(nickname))) return invalid(`Nickname must be at most ${MAX_GARAGE_NICKNAME} characters without control characters.`);
  const unchanged=existing&&make===existing.make&&model===existing.model&&year===existing.year&&(input.generationId===undefined||input.generationId===existing.generationId);
  if(unchanged)return {make:existing.make,model:existing.model,year:existing.year,generationId:existing.generationId,color:typeof color==="string"?color.toLowerCase():null,nickname:typeof nickname==="string"?nickname.trim()||null:null};
  const vehicle = await tx.vehicle.findUnique({ where: { makeNormalized_modelNormalized: { makeNormalized: norm(make), modelNormalized: norm(model) } }, include: { brand:true,generations: true } });
  if (!vehicle) return invalid("Choose a car from the list.");
  const keys=new Set(activeModels().map(m=>m.key));
  if(!vehicle.isActive||!vehicle.brand?.isActive)return invalid("This vehicle is no longer selectable. Request your car instead.");
  const carYear = year as number;
  if (carYear < vehicle.yearFrom || carYear > vehicle.yearTo) return invalid(`The ${vehicle.make} ${vehicle.model} is listed for ${vehicle.yearFrom}-${vehicle.yearTo}.`);
  const matches = vehicle.generations.filter(g => g.isActive&&g.isPublished&&g.model3dKey&&keys.has(g.model3dKey)&&g.yearFrom <= carYear && g.yearTo >= carYear);
  if(!matches.length)return invalid("This year has no published supported generation. Request your car instead.");
  // Explicit null means Not sure. Omission on create auto-selects only an unambiguous generation.
  // On PATCH the existing choice is revalidated, even when only make/model/year changed.
  const asked = value.generationId;
  if (asked != null && (typeof asked !== "string" || !matches.some(g => g.id === asked))) return invalid("Choose a generation of this car for that year.");
  const generationId = asked === undefined ? (matches.length === 1 ? matches[0]!.id : null) : asked as string | null;
  return { make: vehicle.make, model: vehicle.model, year: carYear, color: typeof color === "string" ? color.toLowerCase() : null, nickname: typeof nickname === "string" ? nickname.trim() || null : null, generationId };
}

/** Same fields as the existing mobile contract; null stays Not sure rather than resolving on read. */
async function myCarShape(tx: Tx, car: CustomerGarageCar | null) {
  if (!car) return null;
  const vehicle = await tx.vehicle.findUnique({ where: { makeNormalized_modelNormalized: { makeNormalized: norm(car.make), modelNormalized: norm(car.model) } }, select: { bodyType: true } });
  const generation = car.generationId ? await tx.vehicleGeneration.findUnique({ where: { id: car.generationId }, select: GEN_FIELDS }) : null;
  return { make: car.make, model: car.model, year: car.year, color: car.color, bodyType: vehicle?.bodyType ?? null, generation };
}

/** A runner can be supplied by integration tests to roll the entire test session back. */
export function createGarageService(run: Run = work => prisma.$transaction(work, { isolationLevel: "ReadCommitted" })) {
  const owned = async (tx: Tx, userId: string, id: string) => await tx.customerGarageCar.findFirst({ where: { id, userId } }) ?? missing();
  const active = (tx: Tx, userId: string) => tx.customerGarageCar.findFirst({ where: { userId, isActive: true } });
  const audit = (tx: Tx, userId: string, action: string, targetId: string) => tx.auditLog.create({ data: { actorId: userId, action: `GARAGE_${action}`, targetId } });
  const mutate = <T>(userId: string, work: (tx: Tx) => Promise<T>) => run(async tx => {
    // Serialize ALL garage writes for this account, including empty garages and compatibility PUT.
    // Read committed ensures a waiter sees the previous writer's committed count and active selection.
    const users = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
    if (!users.length) return missing();
    return work(tx);
  });
  const add = async (tx: Tx, userId: string, input: Input) => {
    const count = await tx.customerGarageCar.count({ where: { userId } });
    if (count >= MAX_GARAGE_CARS) throw new GarageError(409, "GARAGE_LIMIT_REACHED", `You can save up to ${MAX_GARAGE_CARS} cars.`);
    const data = await validate(tx, input);
    const car = await tx.customerGarageCar.create({ data: { userId, ...data, isActive: count === 0, lastSelectedAt: count === 0 ? new Date() : null } });
    await audit(tx, userId, "CREATE", car.id);
    return car;
  };
  const remove = async (tx: Tx, userId: string, car: CustomerGarageCar) => {
    if (await tx.vehicle3DSubmission.count({ where: { garageCarId: car.id } })) throw new GarageError(409, "GARAGE_3D_HISTORY", "Delete this car's unapproved 3D submissions first. Cars with approved catalog history must be retained.");
    await tx.customerGarageCar.delete({ where: { id: car.id, userId } });
    await audit(tx, userId, "DELETE", car.id);
    if (car.isActive) {
      // Most recently selected; never-selected ties use updatedAt, createdAt, then stable ID.
      const next = await tx.customerGarageCar.findFirst({ where: { userId }, orderBy: order });
      if (next) {
        await tx.customerGarageCar.update({ where: { id: next.id, userId }, data: { isActive: true, lastSelectedAt: new Date() } });
        await audit(tx, userId, "ACTIVATE", next.id);
      }
    }
  };
  return {
    list: (userId: string) => run(tx => tx.customerGarageCar.findMany({ where: { userId }, orderBy: order, select: {
      id: true, nickname: true, make: true, model: true, year: true, color: true, generationId: true,
      generation: { select: GEN_FIELDS }, isActive: true, lastSelectedAt: true, createdAt: true, updatedAt: true,
    } })),
    create: (userId: string, input: unknown) => mutate(userId, tx => add(tx, userId, body(input, false))),
    update: (userId: string, id: string, input: unknown) => mutate(userId, async tx => {
      const car = await owned(tx, userId, id);
      const data = await validate(tx, body(input, false), car);
      const saved = await tx.customerGarageCar.update({ where: { id, userId }, data });
      await audit(tx, userId, "UPDATE", id);
      return saved;
    }),
    activate: (userId: string, id: string) => mutate(userId, async tx => {
      await owned(tx, userId, id);
      await tx.customerGarageCar.updateMany({ where: { userId, isActive: true }, data: { isActive: false } });
      const car = await tx.customerGarageCar.update({ where: { id, userId }, data: { isActive: true, lastSelectedAt: new Date() } });
      await audit(tx, userId, "ACTIVATE", id);
      return car;
    }),
    delete: (userId: string, id: string) => mutate(userId, async tx => remove(tx, userId, await owned(tx, userId, id))),
    getMyCar: (userId: string) => run(async tx => myCarShape(tx, await active(tx, userId))),
    putMyCar: (userId: string, input: unknown) => mutate(userId, async tx => {
      const parsed = body(input, true);
      const current = await active(tx, userId);
      // PUT retains replacement semantics for car fields, but does not erase a garage nickname.
      const car = current
        ? await tx.customerGarageCar.update({ where: { id: current.id, userId }, data: { ...await validate(tx, parsed), nickname: current.nickname } })
        : await add(tx, userId, parsed);
      if (current) await audit(tx, userId, "UPDATE", car.id);
      return myCarShape(tx, car);
    }),
    deleteMyCar: (userId: string) => mutate(userId, async tx => {
      const car = await active(tx, userId);
      if (car) await remove(tx, userId, car);
      return myCarShape(tx, await active(tx, userId));
    }),
  };
}
