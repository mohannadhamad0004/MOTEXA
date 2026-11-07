// 3D requests, end to end on the web build: the shop submits -> the Parts Admin sees it in Requests > 3D requests (and the Home count)
// within one refresh -> opens the review screen -> requests changes -> the shop sees the message and the notification.
// Needs a throw-away copy of the draft (backend/scripts/a3d-clone.ts up): PRODUCT=<id> SHOP=<email>. Meshy is never started.
const fs = require('fs'), path = require('path');
const { launch, newPage, login, go, PASS } = require('./lib.cjs');
const OUT = path.resolve(__dirname, '../../../docs/agents/providers/a3d-admin');
fs.mkdirSync(OUT, { recursive: true });
const { PRODUCT, SHOP } = process.env, ADMIN = 'admin.parts@motexa.test', NAME = 'Rear bumper (flow test)';
const API = 'http://127.0.0.1:5000/api';
const token = async email => (await (await fetch(API + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: PASS }) })).json()).accessToken;

(async () => {
  const b = await launch(); const r = {};
  // 1) the shop submits (ticks the consent, taps Submit)
  const shop = await newPage(b, { dark: true, ar: false }); await login(shop, SHOP);
  await go(shop, `/provider/parts/accessory-3d/${PRODUCT}`); await shop.waitForTimeout(3500);
  await shop.getByRole('checkbox').last().click();
  const before = Date.now();
  await shop.getByRole('button', { name: /Submit for 3D/ }).last().click(); await shop.waitForTimeout(3500);
  r.shopSeesWaiting = /Waiting for Parts Admin review/.test(await shop.evaluate(() => document.body.innerText));
  await shop.screenshot({ path: path.join(OUT, '1-shop-submitted.jpg'), type: 'jpeg', quality: 60 });

  // 2) the Parts Admin: Home count, Requests > 3D requests, review screen (3 looks)
  for (const [lang, theme] of [['en', 'dark'], ['ar', 'dark'], ['en', 'light']]) {
    const key = `${lang}-${theme}`, ad = await newPage(b, { dark: theme === 'dark', ar: lang === 'ar' }); await login(ad, ADMIN);
    const text = () => ad.evaluate(() => document.body.innerText);
    await go(ad, '/dept'); await ad.waitForTimeout(3500);
    r[key] = { homeTile: /3D requests|طلبات ثلاثية الأبعاد/.test(await text()) && /waiting for you|بانتظارك/.test(await text()) };
    await ad.screenshot({ path: path.join(OUT, `2-admin-home-${key}.jpg`), type: 'jpeg', quality: 60 });
    await go(ad, '/dept/requests?seg=3d'); await ad.waitForTimeout(3500);
    const t = await text();
    r[key].listHasRequest = t.includes(NAME);
    r[key].firstRow = t.indexOf(NAME) >= 0 && ['Mesh rims', 'BMW E36', 'Rear wing'].every(n => t.indexOf(n) === -1 || t.indexOf(NAME) < t.indexOf(n));
    r[key].showsShopAndCar = /Al-Mahaba/.test(t) && /W203/.test(t);
    await ad.screenshot({ path: path.join(OUT, `3-admin-3d-list-${key}.jpg`), type: 'jpeg', quality: 60 });
    // open it
    await ad.getByRole('button', { name: new RegExp(NAME.replace(/[()]/g, '\\$&')) }).first().click(); await ad.waitForTimeout(3500);
    const t2 = await text();
    r[key].reviewOpens = /Approve for 3D generation|الموافقة على إنشاء النموذج/.test(t2) && /Installed photos|صور التركيب/.test(t2) && /Real size|المقاس الحقيقي/.test(t2);
    await ad.screenshot({ path: path.join(OUT, `4-admin-review-${key}.jpg`), type: 'jpeg', quality: 60 });
    r[key].problems = ad.problems.filter(x => !/Failed to load resource|favicon/.test(x));
    if (key === 'en-dark') {
      // 3) request changes
      await ad.locator('input[aria-label*="Notes to the shop"]').first().scrollIntoViewIfNeeded();
      await ad.locator('input[aria-label*="Notes to the shop"]').first().fill('The loose-part photos are too dark. Retake them on a white background, from 4 angles.');
      await ad.screenshot({ path: path.join(OUT, '5-admin-request-changes.jpg'), type: 'jpeg', quality: 60 });
      await ad.getByRole('button', { name: /Reject \(shop must change it\)/ }).click(); await ad.waitForTimeout(3000);
      r.adminAfter = /Changes requested|مطلوب تعديلات/.test(await text());
    }
    await ad.context().close();
  }

  // 4) the shop sees the message (form + notification)
  await go(shop, `/provider/parts/accessory-3d/${PRODUCT}`); await shop.waitForTimeout(3500);
  const st = await shop.evaluate(() => document.body.innerText);
  r.shopSeesChanges = /Changes requested/.test(st) && /too dark/.test(st);
  await shop.screenshot({ path: path.join(OUT, '6-shop-sees-message.jpg'), type: 'jpeg', quality: 60 });
  const tk = await token(SHOP);
  const notes = await (await fetch(API + '/notifications', { headers: { authorization: 'Bearer ' + tk } })).json();
  const list = notes.notifications ?? notes.items ?? [];
  r.shopNotification = list.filter(n => new Date(n.createdAt).getTime() >= before).map(n => `${n.title} | ${n.body}`.slice(0, 160));
  r.shopProblems = shop.problems.filter(x => !/Failed to load resource|favicon/.test(x));
  console.log(JSON.stringify(r, null, 1));
  await b.close();
})().catch(e => { console.error(e.message.split('\n').slice(0, 8).join('\n')); process.exit(1); });
