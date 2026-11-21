// Live audit helper: real backend login; SQL connections are read-only.
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '../../../..');
const { createRequire } = require('node:module');
const backend = createRequire(path.join(ROOT, 'backend/package.json'));
const mobile = createRequire(path.join(ROOT, 'mobile/package.json'));
backend('dotenv').config({ path: path.join(ROOT, 'backend/.env') });
const API = 'http://127.0.0.1:5000/api';
const password = fs.readFileSync(path.join(ROOT, 'backend/src/seed/test-accounts.ts'), 'utf8').match(/const DEV_PASSWORD = "([^"]+)"/)[1];
async function login(persona) {
  const r = await fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: persona + '@motexa.test', password }) });
  const b = await r.json();
  if (!r.ok) throw new Error(`Login ${persona}: HTTP ${r.status}`);
  return { token: b.accessToken, user: b.user };
}
async function api(session, route, method='GET', body) {
  const r = await fetch(API + route, { method, headers: { Authorization: `Bearer ${session.token}`, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(45000) });
  return { status: r.status, body: await r.json().catch(() => null) };
}
async function db() {
  const c = new (backend('pg').Client)({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis:7000, options:'-c default_transaction_read_only=on', query_timeout:15000 });
  await c.connect(); return c;
}
function save(name, value) { fs.writeFileSync(path.join(__dirname, name + '.json'), JSON.stringify(value,null,2)); }
module.exports = { fs, path, ROOT, backend, mobile, API, login, api, db, save };
