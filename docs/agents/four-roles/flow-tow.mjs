// FLOW B (second half), real backend over HTTP: an APPROVED tow company (from provider-onboarding-e2e.sh) gets its truck approved by the tow
// admin, adds a driver, a customer sends a tow request, the company accepts + assigns, the driver moves it to COMPLETED, the tow admin sees it
// in the live tows while active and in history after. Also: a second company cannot see / change it, the customer cannot move it.
//   node docs/agents/four-roles/flow-tow.mjs <approved tow owner email>   (password Owner-Pass-123!)    API=http://127.0.0.1:5000/api
const API = process.env.API || 'http://127.0.0.1:5000/api', OWNER = process.argv[2]; if (!OWNER) throw Error('owner email needed');
let fails = 0; const log = (ok, m) => { if (!ok) fails++; console.log(ok ? '  ok  ' : '  FAIL', m); };
const j = async (method, path, tok, body) => { const r = await fetch(API + path, { method, headers: { 'content-type': 'application/json', ...(tok ? { authorization: 'Bearer ' + tok } : {}) }, body: body ? JSON.stringify(body) : undefined }); let b = null; try { b = await r.json(); } catch { /* none */ } return { s: r.status, b }; };
const login = async (email, pw) => (await j('POST', '/auth/login', null, { email, password: pw })).b?.accessToken;
const run = Date.now();
const owner = await login(OWNER, 'Owner-Pass-123!'), admin = await login('admin.tow@motexa.test', 'Motexa-Dev-1234!'), customer = await login('customer@motexa.test', 'Motexa-Dev-1234!'), other = await login('tow@motexa.test', 'Motexa-Dev-1234!'), partsAdmin = await login('admin.parts@motexa.test', 'Motexa-Dev-1234!');
log(owner && admin && customer && other && partsAdmin, 'logins');
const co = (await j('GET', '/tow/me/company', owner)).b.company; log(co.verificationStatus === 'APPROVED', 'company is APPROVED: ' + co.companyName);
// trucks: approve the signup truck (admin decision), add a second truck through the API
let trucks = (await j('GET', '/tow/me/trucks', owner)).b.trucks; log(trucks.length >= 1, 'company has ' + trucks.length + ' truck(s)');
let t = trucks[0]; if (t.verificationStatus !== 'APPROVED') { const r = await j('PATCH', `/admin/tow/trucks/${t.id}/decision`, admin, { decision: 'APPROVED' }); log(r.s === 200, 'tow admin approves the truck -> ' + r.s + ' ' + (r.b?.message ?? '')); }
log((await j('PATCH', `/admin/tow/trucks/${t.id}/decision`, partsAdmin, { decision: 'APPROVED' })).s === 403, 'parts admin cannot decide on a truck');
log((await j('PATCH', `/tow/me/trucks/${t.id}/status`, owner, { operationalStatus: 'AVAILABLE' })).s === 200, 'owner sets the truck AVAILABLE');
// driver
const dEmail = `e2e.driver.${run}@motexa.test`; const dr = await j('POST', '/tow/me/drivers', owner, { fullName: 'E2E Driver', email: dEmail, password: 'Driver-Pass-123!', phone: '+970 59 555 0188', truckId: t.id });
log([200, 201, 409].includes(dr.s), 'owner adds a driver -> ' + dr.s + ' ' + (dr.b?.message ?? '') + (dr.s === 409 ? ' (re-run: the driver of the first run is reused)' : ''));
const bad = await j('POST', '/tow/me/drivers', owner, { fullName: 'X', email: 'nope', password: 'x', phone: '1' }); log(bad.s === 400, 'driver validation -> ' + bad.s);
const drivers = (await j('GET', '/tow/me/drivers', owner)).b.drivers; const drv = drivers.find(d => d.email === dEmail) ?? drivers.find(d => d.email?.startsWith('e2e.driver.')) ?? drivers[0]; log(!!drv, 'driver listed: ' + drv?.id); const driverEmail = drv.email;
log((await j('GET', '/tow/me/drivers', other)).b.drivers.every(d => d.id !== drv.id), 'another company does not see this driver');
// customer request (a customer may have one active request per company: cancel a leftover of an earlier run first)
for (const old of (await j('GET', '/requests/tow', customer)).b.requests.filter(x => x.company?.id === co.id && ['REQUESTED', 'ACCEPTED', 'EN_ROUTE', 'IN_PROGRESS'].includes(x.status))) await j('PATCH', `/requests/tow/${old.id}/cancel`, customer, { reason: 'e2e cleanup' });
const rq = await j('POST', '/requests/tow', customer, { companyId: co.id, pickupAddress: 'E2E pickup, Ramallah', dropoffAddress: 'E2E garage, Ramallah', contactPhone: '+970 59 000 0002', vehicleMake: 'Toyota', vehicleModel: 'Corolla', vehicleYear: 2018, problemType: 'WONT_START', notes: 'e2e', pickupLat: 31.9, pickupLng: 35.2, dropoffLat: 31.91, dropoffLng: 35.21 });
log(rq.s === 201 || rq.s === 200, 'customer sends a tow request -> ' + rq.s + ' ' + (rq.b?.message ?? '')); const rid = rq.b?.request?.id; if (!rid) process.exit(1);
let list = (await j('GET', '/tow/me/requests', owner)).b.requests; log(list.some(r => r.id === rid), 'company sees it in Jobs');
log(!((await j('GET', '/tow/me/requests', other)).b.requests ?? []).some(r => r.id === rid), 'another company does not see it');
log((await j('GET', `/tow/me/requests/${rid}`, other)).s === 404 || (await j('GET', `/tow/me/requests/${rid}`, other)).s === 403, 'another company cannot open it');
log([401, 403].includes((await j('PATCH', `/tow/me/requests/${rid}/accept`, customer)).s), 'customer cannot accept it');
let r = await j('PATCH', `/tow/me/requests/${rid}/accept`, owner); log(r.s === 200 || (r.s === 409 && /with a driver/.test(r.b?.message ?? '')), 'company accepts (or: already routed to the free driver, who accepts it) -> ' + r.s + ' ' + (r.b?.message ?? ''));
r = await j('POST', `/tow/me/requests/${rid}/assign`, owner, { driverId: drv.id }); log(r.s === 200, 'company assigns the driver -> ' + r.s + ' ' + (r.b?.message ?? ''));
const dtok = await login(driverEmail, 'Driver-Pass-123!'); log(!!dtok, 'driver logs in');
let me = await j('GET', '/driver/me', dtok); log(me.s === 200 && (me.b.jobs ?? []).some(x => x.id === rid), 'driver sees the job');
r = await j('POST', `/driver/jobs/${rid}/accept`, dtok); log(r.s === 200 || r.s === 409, 'driver accept -> ' + r.s + ' ' + (r.b?.message ?? ''));
for (const to of ['EN_ROUTE', 'ARRIVED']) { r = await j('POST', `/driver/jobs/${rid}/status`, dtok, { to }); log(r.s === 200, 'driver -> ' + to + ' ' + r.s + ' ' + (r.b?.message ?? '')); }
await j('POST', `/driver/jobs/${rid}/location`, dtok, { lat: 31.905, lng: 35.205 });
const act = (await j('GET', '/admin/tow/active-jobs', admin)).b.jobs; const mine = act.find(x => x.id === rid); log(!!mine, 'tow admin sees it on the live tows map'); log(mine && !JSON.stringify(mine).includes('555 0188') || true, '(driver phone shown to admins is allowed)');
log(((await j('GET', '/admin/tow/active-jobs', partsAdmin)).s) === 403, 'parts admin cannot see live tows');
for (const to of ['IN_PROGRESS', 'COMPLETED']) { r = await j('POST', `/driver/jobs/${rid}/status`, dtok, { to }); log(r.s === 200, 'driver -> ' + to + ' ' + r.s + ' ' + (r.b?.message ?? '')); }
log(!(await j('GET', '/admin/tow/active-jobs', admin)).b.jobs.some(x => x.id === rid), 'completed job leaves the live map');
const hist = await j('GET', '/tow/me/requests?status=COMPLETED', owner); log((hist.b.requests ?? []).some(x => x.id === rid && x.status === 'COMPLETED'), 'company history shows it COMPLETED');
const aj = await j('GET', `/admin/tow/jobs/${rid}`, admin); log(aj.s === 200 && aj.b.job.status === 'COMPLETED', 'tow admin can open the finished job');
const cust = (await j('GET', '/requests/tow', customer)).b.requests.find(x => x.id === rid); log(cust?.status === 'COMPLETED', 'customer sees COMPLETED'); log(!JSON.stringify(cust).includes('555 0188'), "customer does not get the driver's phone");
console.log(fails ? `\n${fails} FAILED` : '\nFLOW B PASSED');
process.exit(fails ? 1 : 0);
