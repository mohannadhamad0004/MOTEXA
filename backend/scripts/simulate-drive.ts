// Simulates a driver's drive so the live map can be tested without driving (dev only).
//   npx tsx scripts/simulate-drive.ts <driver email> <job id> [--password=...] [--api=http://127.0.0.1:5000/api] [--steps=20] [--interval=5200]
// Signs in as the driver, then posts points along pickup -> destination (straight line + a little wobble) every `interval` ms.
// The server accepts a point at most every 5 s, so keep interval > 5000. It works on any job that is ACCEPTED / EN_ROUTE / IN_PROGRESS.
const [email, jobId, ...rest] = process.argv.slice(2);
const opt = (k: string, d: string) => rest.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const API = opt("api", "http://127.0.0.1:5000/api"), PASS = opt("password", "Motexa-Dev-1234!");
const steps = Number(opt("steps", "20")), interval = Number(opt("interval", "5200"));
if (!email || !jobId) { console.error("usage: simulate-drive.ts <driver email> <job id>"); process.exit(1); }
const json = async (r: Response) => ({ status: r.status, body: await r.json().catch(() => ({})) as any });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const login = await json(await fetch(`${API}/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password: PASS }) }));
const token = login.body.accessToken as string;
if (!token) { console.error("login failed", login.status); process.exit(1); }
const auth = { authorization: `Bearer ${token}`, "content-type": "application/json" };
const job = (await json(await fetch(`${API}/driver/jobs/${jobId}`, { headers: auth }))).body.job;
if (!job?.pickup) { console.error("job not found or has no pickup point"); process.exit(1); }
const from = job.driver?.live ?? { lat: job.pickup.lat - 0.01, lng: job.pickup.lng - 0.01 };
const to = job.status === "IN_PROGRESS" && job.dropoff ? job.dropoff : job.pickup;
for (let i = 0; i <= steps; i++) {
  const f = i / steps, w = Math.sin(i) * 0.00008;
  const p = { lat: from.lat + (to.lat - from.lat) * f + w, lng: from.lng + (to.lng - from.lng) * f - w };
  const r = await json(await fetch(`${API}/driver/jobs/${jobId}/location`, { method: "POST", headers: auth, body: JSON.stringify(p) }));
  console.log(`${i}/${steps}`, p.lat.toFixed(5), p.lng.toFixed(5), r.status);
  if (r.status !== 200) break;
  if (i < steps) await sleep(interval);
}
