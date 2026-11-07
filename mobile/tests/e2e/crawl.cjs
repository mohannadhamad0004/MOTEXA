// Click-through crawler: node crawl.cjs <role-folder> <email> <route> [route...]   (env DARK=0 for light, AR=1 for Arabic)
// For every route: load, screenshot, then tap each tappable element (index by index, reloading the route between taps) and record what happened:
//   NAV (url changed) / CHANGED (text or element count changed) / REQUEST (an API call went out) / NOTHING (dead) / SKIP (destructive or text input).
const SHOTS_ONLY = process.env.SHOTS_ONLY === '1';
const L = require('./lib.cjs'); const fs = require('fs'), path = require('path');
const [role, email, ...routes] = process.argv.slice(2); const DARK = process.env.DARK !== '0', AR = process.env.AR === '1';
const SKIP = /sign out|log out|logout|delete|remove|reject|deactivate|cancel|تسجيل الخروج|حذف|رفض|إلغاء|forgot|back to roles/i;
const state = p => p.evaluate(() => ({ t: document.body.innerText.replace(/\s+/g, ' ').slice(0, 4000), n: document.body.innerHTML.length, u: location.pathname + location.search }));
(async () => {
  const b = await L.launch(); const p = await L.newPage(b, { dark: DARK, ar: AR }); await L.login(p, email);
  if (AR) { await p.evaluate(() => 0); }
  let reqs = 0; p.on('request', r => { if (r.url().includes(':5000')) reqs++; });
  const report = [];
  for (const route of routes) {
    const rec = { route, title: '', elements: [], problems: [] };
    const load = async () => { await L.go(p, route); await p.waitForTimeout(1500); if (/\/auth\//.test(new URL(p.url()).pathname)) { await L.login(p, email); await L.go(p, route); await p.waitForTimeout(1500); } }; // the JWT lives 15 min
    await load(); rec.landed = new URL(p.url()).pathname; await L.shot(p, role, route.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') + (DARK ? '' : '_light') + (AR ? '_ar' : '')); 
    const list = SHOTS_ONLY ? [] : await L.tappables(p); rec.total = list.length; const before0 = p.problems.length;
    for (let i = 0; i < list.length; i++) {
      const t = list[i]; const e = { i, role: t.role, name: t.name, size: `${t.w}x${t.h}`, small: t.h < 44 && t.role !== 'input' && t.role !== 'checkbox' && t.w < 44 };
      if (t.role === 'input' || SKIP.test(t.name)) { e.result = 'SKIP'; rec.elements.push(e); continue; }
      try {
        if (i > 0 || new URL(p.url()).pathname !== rec.landed) await load();
        const fresh = await L.tappables(p); const m = fresh.find(x => x.role === t.role && x.name === t.name && x.w === t.w) || fresh[i]; if (!m) { e.result = 'GONE'; rec.elements.push(e); continue; }
        const s0 = await state(p), r0 = reqs, pr0 = p.problems.length; await p.locator(`[data-e2e="${m.k}"]`).first().click({ timeout: 5000, force: t.role === 'tab' }); await p.waitForTimeout(1100); const s1 = await state(p);
        e.result = s1.u !== s0.u ? 'NAV ' + s1.u : t.role === 'tab' && s1.t === s0.t && s1.u === s0.u ? 'SELF' : s1.t !== s0.t || s1.n !== s0.n ? 'CHANGED' : reqs > r0 ? 'REQUEST' : 'NOTHING';
        if (p.problems.length > pr0) e.problems = p.problems.slice(pr0);
      } catch (err) { e.result = 'ERROR ' + err.message.split('\n')[0].slice(0, 80); }
      rec.elements.push(e);
    }
    rec.problems = p.problems.slice(before0); report.push(rec);
    console.log(route, '->', rec.landed, rec.total, 'els;', rec.elements.filter(x => x.result === 'NOTHING').length, 'dead;', rec.elements.filter(x => x.small).length, 'small;', rec.problems.length, 'problems');
  }
  const out = path.join(L.BASE ? path.resolve(__dirname, '../../../docs/agents/four-roles', role) : '.', `crawl${DARK ? '' : '-light'}${AR ? '-ar' : ''}.json`); fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, JSON.stringify(report, null, 1));
  await b.close();
})().catch(e => { console.error(e.message.split('\n')[0]); process.exit(1); });
