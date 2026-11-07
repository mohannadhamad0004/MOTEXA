// STEP DRIVERS screenshots: every new screen at 390 px, EN/AR x light/dark -> docs/agents/drivers/<screen>-<lang>-<theme>.jpg
// Needs Expo web on :8083, the backend on :5000 and a fixture (backend/scripts/drivers-fixture.ts up) passed as FIXTURE=<json file>.
const fs = require('fs'), path = require('path');
const { launch, newPage, login, go, PASS } = require('./lib.cjs');
const F = JSON.parse(fs.readFileSync(process.env.FIXTURE, 'utf8').replace(/^﻿/, ''));
const OUT = path.resolve(__dirname, '../../../docs/agents/drivers');
fs.mkdirSync(OUT, { recursive: true });

// [who, file name, route, optional action before the shot]
const SCREENS = [
  ['owner', 'company-drivers', '/provider/tow/drivers'],
  ['owner', 'company-add-driver', '/provider/tow/drivers', async p => { await p.getByRole('button', { name: /add a driver|إضافة سائق/i }).first().click(); await p.waitForTimeout(800); }],
  ['admin.tow@motexa.test', 'admin-licences', '/dept/tows/drivers'],
  ['cust', 'customer-tow-choices', '/customer/tow'],
  ['cust', 'customer-choose-driver', '/customer/tow/drivers'],
  ['cust', 'customer-request-nearest', '/customer/towrequest/new?mode=NEAREST'],
  ['cust2', 'customer-job-live', `/customer/towrequest/${F.liveId}`],
  ['cust2', 'customer-chat', `/customer/towrequest/chat?id=${F.liveId}`],
  ['cust', 'customer-job-done', `/customer/towrequest/${F.doneId}`],
  ['cust', 'customer-company-profile', `/customer/tow/${F.companyId}`],
  ['cust', 'customer-job-timeout', `/customer/towrequest/${F.lostId}`],
  ['owner', 'company-stats', '/provider/tow/stats'],
  ['admin.tow@motexa.test', 'admin-history', '/dept/tows/history'],
  ['admin.tow@motexa.test', 'admin-reports', '/dept/tows/reports'],
  ['admin.tow@motexa.test', 'admin-job', `/dept/tows/${F.liveId}`],
  ['owner', 'company-dispatch-job', `/provider/tow/dispatch/${F.liveId}`],
  ['drvA', 'driver-home', '/driver'],
  ['drvA', 'driver-job', `/driver/job/${F.liveId}`],
];

(async () => {
  const b = await launch();
  const problems = [];
  for (const [lang, theme] of [['en', 'light'], ['en', 'dark'], ['ar', 'light'], ['ar', 'dark']]) {
    const dark = theme === 'dark', ar = lang === 'ar';
    for (const who of [...new Set(SCREENS.map(s => s[0]))]) {
      const email = who.includes('@') ? who : F[who];
      const p = await newPage(b, { dark, ar });
      try { await login(p, email); } catch (e) { problems.push(`login ${who} ${lang}-${theme}: ${e.message.slice(0, 80)}`); await p.context().close(); continue; }
      for (const [w, name, route, act] of SCREENS.filter(s => s[0] === who)) {
        try {
          await go(p, route); await p.waitForTimeout(2500); if (act) await act(p);
          const overflow = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
          if (overflow) problems.push(`OVERFLOW ${name} ${lang}-${theme}`);
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
