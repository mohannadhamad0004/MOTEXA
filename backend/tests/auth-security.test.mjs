// Auth redesign stage C (docs/agents/AUTH-REDESIGN.md): where accounts get their role.
// 1. Source scan: a user write (prisma / tx / db .user.create|createMany|update|updateMany|upsert, or a nested `user: { create }`) that
//    sets `role` to anything but the literal "CUSTOMER" must be in ALLOWED (file -> the role values it may write). Signup only ever
//    writes CUSTOMER; a provider role comes only from the department admin's approval.
//    ponytail: reads object literals only; a role hidden in a spread (`data: { ...input }`) is not seen. No such write exists today.
// 2. The removed registration endpoints answer 404 on the real server.
// Signup / apply / approval behaviour: customer-signup.test.mjs, apply.test.mjs, mechanic-onboarding.test.mjs.
import { test } from 'node:test'; import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
const API = process.env.API_URL || 'http://127.0.0.1:5000/api';

/** file (relative to backend/, "/" separators; a trailing "/" = a whole folder) -> role values it may write ("*" = any). */
const ALLOWED = {
  'src/routes/auth.routes.ts': ['"ADMIN"'], // administrator activation: super admin's invitation + emailed OTP
  'src/services/applications.ts': ['role'], // promoteApplicant, inside the department admin's approval transaction
  'src/services/tow-dispatch.ts': ['"TOW_DRIVER"'], // a tow company adds its drivers
  'src/seed/': ['*'], // dev seed, refuses to run without ALLOW_DEV_SEED
};

const skipString = (s, i) => { const q = s[i]; for (let j = i + 1; j < s.length; j++) { if (s[j] === '\\') j++; else if (s[j] === q) return j; } return s.length; };
/** s[i] is "{" or "(": the index just after its matching close. */
function blockEnd(s, i) {
  const open = s[i], close = open === '{' ? '}' : ')';
  for (let j = i, depth = 0; j < s.length; j++) {
    const c = s[j];
    if (c === '"' || c === "'" || c === '`') j = skipString(s, j);
    else if (c === '/' && s[j + 1] === '/') j = s.indexOf('\n', j) === -1 ? s.length : s.indexOf('\n', j);
    else if (c === open) depth++;
    else if (c === close && --depth === 0) return j + 1;
  }
  return s.length;
}
/** Every role a user write sets in `src`, except the literal "CUSTOMER": [{ line, value }]. */
function privilegedRoleWrites(src) {
  const out = [];
  const calls = [...src.matchAll(/\.user\s*\.\s*(?:create|createMany|update|updateMany|upsert)\s*\(/g)].map((m) => m.index + m[0].length - 1);
  const nested = [...src.matchAll(/\buser\s*:\s*\{\s*(?:create|connectOrCreate|upsert)\s*:\s*\{/g)].map((m) => m.index + m[0].length - 1);
  for (const start of [...calls, ...nested]) {
    const region = src.slice(start, blockEnd(src, start));
    // only what is written (data / create / update), never a `where` filter such as { role: "CUSTOMER" }
    const bodies = nested.includes(start) ? [region] : [...region.matchAll(/\b(?:data|create|update)\s*:\s*\{/g)].map((m) => { const b = m.index + m[0].length - 1; return region.slice(b, blockEnd(region, b)); });
    for (const body of bodies)
      for (const m of body.matchAll(/(?:^|[{,\s])role\s*(?::\s*([^,}\n]+?)\s*(?=[,}\n])|(?=\s*[,}]))/g)) {
        const value = (m[1] ?? 'role').trim();
        if (value !== '"CUSTOMER"' && value !== "'CUSTOMER'") out.push({ line: src.slice(0, start).split('\n').length, value });
      }
  }
  return out;
}

test('source scan: the scanner itself finds role writes and ignores where-filters and CUSTOMER', () => {
  assert.deepEqual(privilegedRoleWrites('await prisma.user.create({ data: { email, role: "ADMIN", status: "ACTIVE" } })').map((w) => w.value), ['"ADMIN"']);
  assert.deepEqual(privilegedRoleWrites('tx.user\n  .updateMany({ where: { id, role: "CUSTOMER" }, data: { role, sessionVersion: 1 } })').map((w) => w.value), ['role']);
  assert.deepEqual(privilegedRoleWrites('db.user.upsert({ where: { email }, update: { role: x.role }, create: { role: "MECHANIC" } })').map((w) => w.value), ['x.role', '"MECHANIC"']);
  assert.deepEqual(privilegedRoleWrites('prisma.towCompanyProfile.create({ data: { user: { create: { email, role: "TOW_PROVIDER" } } } })').map((w) => w.value), ['"TOW_PROVIDER"']);
  assert.deepEqual(privilegedRoleWrites('prisma.user.create({ data: { fullName, role: "CUSTOMER", status: "PENDING" } })'), []);
  assert.deepEqual(privilegedRoleWrites('prisma.user.updateMany({ where: { role: "ADMIN" }, data: { status: "SUSPENDED" } })'), []);
});

test('source scan: only the allowed files give an account ADMIN, SUPER_ADMIN or a provider role', () => {
  const walk = (d) => readdirSync(d).flatMap((n) => { const p = path.join(d, n); return n === 'generated' ? [] : statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') ? [p] : []; });
  const files = walk('src').map((f) => f.split(path.sep).join('/'));
  const allowedFor = (f) => Object.entries(ALLOWED).find(([k]) => (k.endsWith('/') ? f.startsWith(k) : f === k))?.[1];
  const offending = [], used = new Set();
  for (const f of files)
    for (const w of privilegedRoleWrites(readFileSync(f, 'utf8'))) {
      const allowed = allowedFor(f);
      if (allowed && (allowed.includes('*') || allowed.includes(w.value))) used.add(Object.keys(ALLOWED).find((k) => (k.endsWith('/') ? f.startsWith(k) : f === k)));
      else offending.push(`${f}:${w.line} sets role ${w.value}`);
    }
  assert.deepEqual(offending, [], 'a role can only be granted by the files in ALLOWED');
  assert.deepEqual([...used].sort(), Object.keys(ALLOWED).sort(), 'every ALLOWED entry still writes a role (no stale exceptions)');
  // and signup writes only CUSTOMER
  assert.match(readFileSync('src/routes/auth.routes.ts', 'utf8'), /\.create\(\{ data: \{ fullName, email, phone, passwordHash, role: "CUSTOMER", status: "PENDING" \} \}\)/);
});

test('the removed registration endpoints answer 404 (Work with MOTEXA is the only way to a provider role)', async () => {
  const body = JSON.stringify({ fullName: 'Removed Endpoint', email: 'removed.endpoint@example.invalid', password: 'Removed-Endpoint-1!', phoneNumber: '0599000000', city: 'Nablus', kind: 'TOW', businessName: 'X', acceptTerms: true });
  for (const p of ['/auth/mechanic/register', '/auth/provider/register', '/auth/provider/tow-signup', '/auth/provider/parts-signup']) {
    const r = await fetch(API + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body });
    assert.equal(r.status, 404, p);
  }
  const { prisma } = await import('../src/prisma.js');
  assert.equal(await prisma.user.count({ where: { email: 'removed.endpoint@example.invalid' } }), 0, 'nothing was created');
});
