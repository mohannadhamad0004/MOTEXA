// STEP PROVIDERS-CLEAN screenshots: every tow company / parts shop screen at 390 px, EN/AR x light/dark -> docs/agents/providers/<screen>-<lang>-<theme>.jpg
// Needs Expo web on :8083, the backend on :5000 and the dev seed (tow@motexa.test, shop@motexa.test). Fails on overflow and console errors.
const fs = require('fs'), path = require('path');
const { launch, newPage, login, go } = require('./lib.cjs');
const OUT = path.resolve(__dirname, '../../../docs/agents/providers');
fs.mkdirSync(OUT, { recursive: true });
const click = (re, nth = 0) => async p => { const b = p.getByRole('button', { name: re }).nth(nth); await b.waitFor({ timeout: 20000 }); await b.click(); await p.waitForTimeout(900); };
const closeSheet = async p => { const c = p.getByRole('button', { name: /^(close|إغلاق)$/i }); if (await c.count()) { await c.first().click(); await p.waitForTimeout(600); } };
const seq = (...fns) => async p => { for (const f of fns) await f(p); };

const SCREENS = [
  ['tow@motexa.test', 'tow-home', '/provider/tow'],
  ['tow@motexa.test', 'tow-jobs', '/provider/tow/jobs'],
  ['tow@motexa.test', 'tow-fleet-drivers', '/provider/tow/fleet'],
  ['tow@motexa.test', 'tow-fleet-trucks', '/provider/tow/fleet', click(/^trucks|^الشاحنات/i)],
  ['tow@motexa.test', 'tow-add-driver', '/provider/tow/fleet', seq(closeSheet, click(/^drivers|^السائقون/i), click(/add driver|إضافة سائق/i))],
  ['tow@motexa.test', 'tow-add-truck', '/provider/tow/fleet', seq(closeSheet, click(/^trucks|^الشاحنات/i), click(/add truck|إضافة شاحنة/i))],
  ['tow@motexa.test', 'tow-messages', '/provider/tow/messages'],
  ['tow@motexa.test', 'tow-profile', '/provider/tow/profile'],
  ['tow@motexa.test', 'tow-stats', '/provider/tow/stats'],
  ['shop@motexa.test', 'parts-home', '/provider/parts'],
  ['shop@motexa.test', 'parts-products', '/provider/parts/products'],
  ['shop@motexa.test', 'parts-products-low', '/provider/parts/products?filter=low'],
  ['shop@motexa.test', 'parts-orders-soon', '/provider/parts/orders'],
  ['shop@motexa.test', 'parts-messages', '/provider/parts/messages'],
  ['shop@motexa.test', 'parts-profile', '/provider/parts/profile'],
  ['shop@motexa.test', 'parts-add-product', '/provider/parts/new'],
  ['shop@motexa.test', 'parts-add-product-step2', '/provider/parts/new', click(/^(next|التالي)$/i)],
];

(async () => {
  const b = await launch();
  const problems = [];
  for (const [lang, theme] of [['en', 'light'], ['en', 'dark'], ['ar', 'light'], ['ar', 'dark']]) {
    const dark = theme === 'dark', ar = lang === 'ar';
    for (const who of [...new Set(SCREENS.map(s => s[0]))]) {
      const p = await newPage(b, { dark, ar });
      try { await login(p, who); } catch (e) { problems.push(`login ${who} ${lang}-${theme}: ${e.message.slice(0, 80)}`); await p.context().close(); continue; }
      for (const [, name, route, act] of SCREENS.filter(s => s[0] === who)) {
        try {
          await go(p, route); await p.waitForTimeout(2500); if (act) await act(p);
          if (await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)) problems.push(`OVERFLOW ${name} ${lang}-${theme}`);
          await p.screenshot({ path: path.join(OUT, `${name}-${lang}-${theme}.jpg`), type: 'jpeg', quality: 60 });
        } catch (e) { problems.push(`${name} ${lang}-${theme}: ${e.message.slice(0, 100)}`); }
      }
      for (const x of p.problems) if (!/Failed to load resource|favicon/.test(x)) problems.push(`${who} ${lang}-${theme}: ${x}`);
      await p.context().close();
    }
  }
  await b.close();
  fs.writeFileSync(path.join(OUT, 'problems.txt'), problems.join('\n') || 'none');
  console.log(problems.length ? problems.join('\n') : 'no problems');
})();
