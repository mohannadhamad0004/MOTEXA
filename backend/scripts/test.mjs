// npm test: the backend suite on its own database, never on the development one.
//   1. NODE_ENV=test, always (set here, not by the caller).
//   2. A fresh `motexa_test` (or TEST_DATABASE_URL): dropped, migrated, then filled with a READ-ONLY copy of the dev data (the tests
//      need real cars, part maps and models). The dev database is only SELECTed from.
//   3. Meshy / Sketchfab can't be reached: no key, paid generation off, mock mode, a fetch guard; src/prisma.ts and the Meshy client
//      refuse a non-*_test database / a live call under NODE_ENV=test on their own too.
// Usage: npm test [-- tests/one.test.ts ...]
import 'dotenv/config';
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:net';
import pg from 'pg';

const dev = new URL(process.env.DATABASE_URL ?? '');
const test = new URL(process.env.TEST_DATABASE_URL ?? dev.href);
if (!process.env.TEST_DATABASE_URL) test.pathname = '/motexa_test';
const dbOf = u => decodeURIComponent(u.pathname.slice(1));
const devDb = dbOf(dev), testDb = dbOf(test);
if (!/^[a-z0-9_]+_test$/.test(testDb) || testDb === devDb) { console.error(`Refusing to run: the test database must be a separate *_test database (got "${testDb}").`); process.exit(1); }
const q = s => '"' + s.replaceAll('"', '""') + '"';

// 1) fresh test database
const admin = new URL(test.href); admin.pathname = '/postgres';
const root = new pg.Client({ connectionString: admin.href }); await root.connect();
await root.query(`DROP DATABASE IF EXISTS ${q(testDb)} WITH (FORCE)`);
await root.query(`CREATE DATABASE ${q(testDb)}`);
await root.end();

// 2) schema from the migrations (same as every other environment)
const env = { ...process.env, NODE_ENV: 'test', DATABASE_URL: test.href };
const migrate = spawnSync('npx prisma migrate deploy', { env, stdio: 'inherit', shell: true });
if (migrate.status !== 0) { console.error('prisma migrate deploy failed on the test database.'); process.exit(1); }

// 3) read-only copy of the dev rows (FK / trigger checks off while loading)
const from = new pg.Client({ connectionString: dev.href }), to = new pg.Client({ connectionString: test.href });
await from.connect(); await to.connect();
await from.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
const { rows: tables } = await from.query("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> '_prisma_migrations' ORDER BY tablename");
await to.query("SET session_replication_role = replica");
// data migrations insert defaults (fit zones...): replace them with the dev rows
await to.query(`TRUNCATE ${tables.map(t => 'public.' + q(t.tablename)).join(', ')} CASCADE`);
let copied = 0;
for (const { tablename: t } of tables) {
  const { rows: [{ data }] } = await from.query(`SELECT coalesce(json_agg(r), '[]'::json)::text AS data FROM public.${q(t)} r`);
  const r = await to.query(`INSERT INTO public.${q(t)} SELECT * FROM json_populate_recordset(NULL::public.${q(t)}, $1::json)`, [data]);
  copied += r.rowCount;
}
await to.query("SET session_replication_role = DEFAULT");
await from.query('COMMIT'); await from.end(); await to.end();
console.log(`Test database "${testDb}" ready (${tables.length} tables, ${copied} rows copied read-only from "${devDb}").`);

// 4) a backend of its own for the tests that call the HTTP API (never the dev server on :PORT), on the test database, with a
//    throwaway JWT secret so no test token is valid anywhere else
const devPort = Number(process.env.PORT) || 5000;
const port = await new Promise(res => { const s = createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const childEnv = { ...env, OTP_HASH_SECRET: randomBytes(32).toString('hex'), JWT_SECRET: randomBytes(32).toString('hex'), VEHICLE3D_MODE: 'mock',
  MESHY_ALLOW_PAID_GENERATION: '0', MESHY_API_KEY: '', SKETCHFAB_API_TOKEN: '', API_URL: `http://127.0.0.1:${port}/api`, MOTEXA_DEV_PORT: String(devPort) };
const cwd = new URL('../', import.meta.url);
const server = spawn(process.execPath, ['--import', './scripts/register-typescript.mjs', '--import', './scripts/test-no-paid-provider.mjs', 'src/server.ts'],
  { cwd, env: { ...childEnv, PORT: String(port) }, stdio: ['ignore', 'ignore', 'inherit'], windowsHide: true });
let up = false;
for (let i = 0; i < 120 && !up; i++) { try { up = (await fetch(`http://127.0.0.1:${port}/api/health`)).ok; } catch { await new Promise(r => setTimeout(r, 500)); } }
if (!up) { server.kill(); console.error('The test backend did not start.'); process.exit(1); }
console.log(`Test backend on :${port} (dev port :${devPort} is blocked for tests).`);

// 5) the tests: serial (shared fixtures), no provider keys, live provider hosts and the dev server blocked
const files = process.argv.slice(2);
const child = spawn(process.execPath, ['--import', './scripts/register-typescript.mjs', '--import', './scripts/test-no-paid-provider.mjs', '--test', '--test-concurrency=1',
  ...(files.length ? files : ['tests/*.test.ts', 'tests/*.test.mjs'])], { cwd, stdio: 'inherit', windowsHide: true, env: childEnv });
child.on('close', code => { server.kill(); process.exitCode = code ?? 1; });
