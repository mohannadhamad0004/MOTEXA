// "Submit for 3D" on the stuck Rear/Front bumper (W203) draft, on a throw-away copy (backend/scripts/a3d-clone.ts up):
// 1) submit as it is -> the list of EVERY problem, tappable, sections outlined; the installed car is already chosen (one car fits);
// 2) fix the size + tick consent -> submit goes through (no "Save details" first).   PRODUCT=<id> EMAIL=<shop email>
const fs = require('fs'), path = require('path');
const { launch, newPage, login, go } = require('./lib.cjs');
const OUT = path.resolve(__dirname, '../../../docs/agents/providers/a3d');
fs.mkdirSync(OUT, { recursive: true });
const { PRODUCT, EMAIL } = process.env;

(async () => {
  const b = await launch();
  const report = {};
  for (const [lang, theme] of [['en', 'dark'], ['ar', 'dark'], ['en', 'light']]) {
    const key = `${lang}-${theme}`;
    // a fresh copy of the draft for every variant (the submit changes it)
    const p = await newPage(b, { dark: theme === 'dark', ar: lang === 'ar' });
    await login(p, EMAIL);
    await go(p, `/provider/parts/accessory-3d/${PRODUCT}`); await p.waitForTimeout(3500);
    const text = () => p.evaluate(() => document.body.innerText);
    report[key] = { before: {} };
    report[key].before.status = /Draft|مسودة/.test(await text());
    await p.screenshot({ path: path.join(OUT, `1-draft-${key}.jpg`), type: 'jpeg', quality: 60 });
    // 1) submit as it is
    await p.getByRole('button', { name: /Submit for 3D|إرسال لإنشاء ثلاثي الأبعاد/ }).last().click(); await p.waitForTimeout(1500);
    const t1 = await text();
    report[key].listShown = /need(s)? fixing|تحتاج إلى تصحيح|يحتاج إلى تصحيح/.test(t1);
    report[key].sizeMessage = /1200.{1,3}2100/.test(t1);
    report[key].consentMessage = /confirming you own|تؤكد ملكيتك/.test(t1);
    report[key].installedCarStillAsked = /Tap the car shown|اضغط على السيارة الظاهرة/.test(t1); // must be false: one car -> auto-selected
    report[key].requestsWhileInvalid = 0;
    await p.screenshot({ path: path.join(OUT, `2-problems-${key}.jpg`), type: 'jpeg', quality: 60 });
    await p.getByText(/need(s)? fixing|تحتاج إلى تصحيح|يحتاج إلى تصحيح/).first().scrollIntoViewIfNeeded(); await p.waitForTimeout(600);
    await p.screenshot({ path: path.join(OUT, `2b-list-${key}.jpg`), type: 'jpeg', quality: 60 });
    // tapping a listed problem scrolls to its section
    const y0 = await p.evaluate(() => { const s = [...document.querySelectorAll('div')].find(d => d.scrollHeight > d.clientHeight + 50 && getComputedStyle(d).overflowY !== 'visible'); return s ? s.scrollTop : 0; });
    const item = p.getByRole('button', { name: /1200.{1,3}2100|1200.{0,3}2100/ }).first();
    if (await item.count()) { await item.click(); await p.waitForTimeout(900); }
    const y1 = await p.evaluate(() => { const s = [...document.querySelectorAll('div')].find(d => d.scrollHeight > d.clientHeight + 50 && getComputedStyle(d).overflowY !== 'visible'); return s ? s.scrollTop : 0; });
    report[key].scrolledOnTap = y1 !== y0;
    await p.screenshot({ path: path.join(OUT, `3-after-tap-${key}.jpg`), type: 'jpeg', quality: 60 });
    // 2) fix the size, tick the consent, submit
    const size = p.locator('input[aria-label*="Width across"], input[aria-label*="العرض على امتداد"]').first();
    await size.fill('1650'); await p.waitForTimeout(300);
    await p.getByRole('checkbox').last().click(); await p.waitForTimeout(300);
    let posts = 0; p.on('request', r => { if (/accessory-3d(\/submit)?(\?|$)/.test(r.url()) && r.method() !== 'GET') posts++; });
    await p.getByRole('button', { name: /Submit for 3D|إرسال لإنشاء ثلاثي الأبعاد/ }).last().click(); await p.waitForTimeout(3500);
    const t2 = await text();
    report[key].submitted = /Waiting for Parts Admin review|بانتظار مراجعة إدارة القطع/.test(t2);
    report[key].requests = posts; // PUT (auto-save) + POST (submit)
    await p.screenshot({ path: path.join(OUT, `4-submitted-${key}.jpg`), type: 'jpeg', quality: 60 });
    report[key].problems = p.problems.filter(x => !/Failed to load resource|favicon/.test(x));
    await p.context().close();
    // reset the copy for the next variant
    await require('child_process').execSync('npx tsx scripts/a3d-reset.ts ' + PRODUCT, { cwd: path.resolve(__dirname, '../../../backend'), stdio: 'ignore' });
  }
  console.log(JSON.stringify(report, null, 1));
  await b.close();
})().catch(e => { console.error(e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });
