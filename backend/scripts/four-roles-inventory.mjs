// FOUR-ROLES inventory (static analysis, no network): every route of the 4 roles -> the feature files it renders (imports followed inside
// mobile/src/features) -> every tappable element (onPress / href) with its label and handler, and every API call -> the backend route + guard.
//   node backend/scripts/four-roles-inventory.mjs   -> docs/agents/four-roles/inventory.json (the verified statuses live in FOUR-ROLES.md)
import { readFileSync, readdirSync, statSync, existsSync, writeFileSync, mkdirSync } from 'node:fs'; import { resolve, dirname, relative, join } from 'node:path';
import { ROOT } from './vehicle-audit-lib.mjs';
const M = resolve(ROOT, 'mobile/src'), APP = resolve(M, 'app'), B = resolve(ROOT, 'backend/src');
const walk = d => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const rel = p => relative(ROOT, p).replace(/\\/g, '/');
const ROLE = r => /^provider\/(tow|tow-signup)\//.test(r) ? 'tow-company' : /^provider\/(parts|parts-signup)\//.test(r) ? 'parts-shop' : /^provider\/(onboarding|register)/.test(r) ? 'both-providers'
  : /^dept\/(tows|edit\/(company|truck))|^dept\/review\/\[kind\]/.test(r) ? 'tow-admin (+parts for shop reviews)' : /^dept\/(orders|edit\/(shop|product)|accessory|3d-sub|vehicle|accessory-zones)/.test(r) ? 'parts-admin' : r.startsWith('dept/') ? 'both-admins' : null;
const routes = walk(APP).filter(f => /\.tsx$/.test(f)).map(f => ({ file: f, route: '/' + relative(APP, f).replace(/\\/g, '/').replace(/\.tsx$/, '').replace(/\/index$/, '').replace(/\(tabs\)\//, '') })).filter(r => ROLE(r.route.slice(1)));
const resolveImp = (from, spec) => { if (!spec.startsWith('.')) return null; const b = resolve(dirname(from), spec); for (const c of [b + '.tsx', b + '.ts', join(b, 'index.tsx'), join(b, 'index.ts')]) if (existsSync(c)) return c; return null; };
const closure = (f, seen = new Set()) => { if (seen.has(f)) return seen; seen.add(f); const src = readFileSync(f, 'utf8');
  for (const m of src.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)) { const r = resolveImp(f, m[1]); if (r && r.startsWith(resolve(M, 'features')) ) closure(r, seen); else if (r && r.startsWith(APP) && r !== f) closure(r, seen); } return seen; };
const clean = s => s.replace(/\s+/g, ' ').trim();
const elements = src => { const out = [];
  for (const m of src.matchAll(/<(\w+)\b((?:[^<>{}]|\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\})*?)\bonPress=\{((?:[^{}]|\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\})*)\}/gs)) {
    const attrs = m[2], h = clean(m[3]), lab = /label=\{?[`"']?([^`"'}]{1,60})|(?:title|accessibilityLabel|a11y)=\{?[`"']?([^`"'}]{1,60})/.exec(attrs), tIdx = src.indexOf('>', m.index + m[0].length), t = /t\(\s*["'`]([^"'`]{1,50})["'`]/.exec(src.slice(m.index, m.index + 700));
    const dead = /^(\(\)\s*=>\s*(\{\s*\})?\s*(undefined|null)?|undefined|noop)$/.test(h) || h === '';
    out.push({ tag: m[1], label: (lab && (lab[1] || lab[2]) || t && t[1] || '').trim(), handler: h.slice(0, 110), dead, disabledProp: /\bdisabled=/.test(attrs) }); }
  for (const m of src.matchAll(/<(Link|Redirect)\b[^>]*href=\{?([^>\s]+)/g)) out.push({ tag: m[1], label: '', handler: 'href ' + m[2].slice(0, 80), dead: false });
  return out; };
// backend routes: method + full path + guards named on the line (router-level guards: router.use(...) / guards = [...] are recorded too)
const be = [];
for (const f of walk(resolve(B, 'routes')).concat(resolve(B, 'server.ts'))) { const src = readFileSync(f, 'utf8'); const global = [...src.matchAll(/router\.use\(([^)]*)\)/g)].map(m => m[1]).join(' ');
  for (const line of src.split('\n')) for (const m of line.matchAll(/(?:router|app)\.(get|post|put|patch|delete)\(\s*[`"']([^`"']+)[`"']([^\n]*)/g)) {
    const g = [...(m[3] + ' ' + (line.includes('guards') ? global : '')).matchAll(/\b(requireAuth|requireSuperAdmin|requireMechanicsAdmin|requireTowAdmin|requirePartsAdmin|requireTowProvider|requirePartsProvider|requireApprovedProvider|requireCustomer|admin|guards|ownerOnly|requireDriver)\b/g)].map(x => x[1]);
    be.push({ method: m[1].toUpperCase(), path: m[2], file: rel(f), guards: [...new Set(g)], line: 0 }); } }
const norm = p => p.replace(/\$\{[^}]+\}/g, ':x').replace(/:\w+/g, ':x').replace(/\?.*$/, '');
const beIndex = be.map(b => ({ ...b, n: norm(b.path) }));
const calls = src => [...src.matchAll(/\bapi(?:<[^>]*>)?\(\s*["'`](GET|POST|PUT|PATCH|DELETE)["'`]\s*,\s*([`"'])((?:\\.|(?!\2).)*)\2/g)].map(m => ({ method: m[1], path: m[3] })).concat([...src.matchAll(/\bapi(?:Get|Json)\(\s*([`"'])((?:\\.|(?!\1).)*)\1/g)].map(m => ({ method: 'GET', path: m[2] })));
const found = p => { const n = norm(p.path), tail = n.replace(/^\/api/, ''); return beIndex.filter(b => b.method === p.method && (b.n === tail || b.n.endsWith(tail) || tail.endsWith(b.n)) && b.n !== '/' ); };
const out = routes.map(r => { const files = [...closure(r.file)]; const els = [], api = new Map();
  for (const f of files) { const src = readFileSync(f, 'utf8'); for (const e of elements(src)) els.push({ ...e, file: rel(f) }); for (const c of calls(src)) api.set(c.method + ' ' + c.path, c); }
  return { route: r.route, role: ROLE(r.route.slice(1)), screen: rel(r.file), files: files.map(rel), elements: els, api: [...api.values()].map(c => { const m = found(c); return { ...c, backend: m.length ? m.slice(0, 3).map(x => ({ file: x.file, guards: x.guards })) : null }; }) }; });
mkdirSync(resolve(ROOT, 'docs/agents/four-roles'), { recursive: true });
writeFileSync(resolve(ROOT, 'docs/agents/four-roles/inventory.json'), JSON.stringify({ generated: 'static analysis', routes: out, backendRoutes: be.length }, null, 1));
const tot = out.reduce((a, r) => ({ screens: a.screens + 1, els: a.els + r.elements.length, dead: a.dead + r.elements.filter(e => e.dead).length, noBackend: a.noBackend + r.api.filter(c => !c.backend).length }), { screens: 0, els: 0, dead: 0, noBackend: 0 });
console.log(JSON.stringify(tot), 'backend routes scanned', be.length);
