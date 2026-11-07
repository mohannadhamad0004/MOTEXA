// STEP PROVIDERS-CLEAN: the add truck / add driver step forms on the web build, once with a JPEG and once with a PNG photo.
// Needs Expo web on :8083 + the backend on :5000 + the dev seed. Creates a truck and a driver on the seeded company (tow@motexa.test),
// checks the request bodies went out as JPEG and the cards appear in Fleet, then prints what it created (clean up with provider-flow-clean.ts).
const fs = require('fs'), path = require('path');
const sharp = require(path.resolve(__dirname, '../../../backend/node_modules/sharp'));
const { launch, newPage, login, go } = require('./lib.cjs');
const OUT = path.resolve(__dirname, '../../../docs/agents/providers');
fs.mkdirSync(OUT, { recursive: true });
const tag = String(Date.now()).slice(-6);

async function pics() {
  const px = Buffer.alloc(640 * 480 * 3); for (let i = 0; i < px.length; i++) px[i] = (i * 31 + (i >> 4)) & 255;
  const img = sharp(px, { raw: { width: 640, height: 480, channels: 3 } });
  const dir = path.join(require('os').tmpdir(), 'motexa-flow'); fs.mkdirSync(dir, { recursive: true });
  const jpg = path.join(dir, 'a.jpg'), png = path.join(dir, 'b.png'), webp = path.join(dir, 'c.webp');
  await img.clone().jpeg({ quality: 85 }).toFile(jpg); await img.clone().png().toFile(png); await img.clone().webp().toFile(webp);
  return { jpg, png, webp };
}

(async () => {
  const files = await pics();
  const b = await launch();
  const p = await newPage(b, { dark: true, ar: false });
  const bodies = [];
  p.on('request', r => { if (/\/tow\/me\/(trucks|drivers)/.test(r.url()) && r.method() !== 'GET') bodies.push({ url: r.url().replace(/.*\/api/, ''), method: r.method(), post: r.postData() || '' }); });
  const responses = [];
  p.on('response', r => { if (/\/tow\/me\/(trucks|drivers)/.test(r.url()) && r.request().method() !== 'GET') responses.push(r.status()); });
  await login(p, 'tow@motexa.test');
  await go(p, '/provider/tow/fleet'); await p.waitForTimeout(2500);
  const pick = async file => { const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.getByRole('button', { name: /choose photo|change photo|اختيار صورة|تغيير الصورة/i }).first().click()]); await fc.setFiles(file); await p.waitForTimeout(1500); };
  const next = async () => { await p.getByRole('button', { name: /^(next|التالي)$/i }).last().click(); await p.waitForTimeout(500); };
  const results = {};

  // ---- truck with a JPEG (truck photo) + PNG (documents)
  await p.getByRole('button', { name: /^trucks|الشاحنات/i }).first().click(); await p.waitForTimeout(500);
  await p.getByRole('button', { name: /add truck|إضافة شاحنة/i }).first().click(); await p.waitForTimeout(800);
  await p.locator('input:not([type=checkbox]):not([type=file])').nth(0).fill(`FLOW-${tag}`); await next();
  await pick(files.jpg); await p.screenshot({ path: path.join(OUT, 'flow-truck-photo.jpg'), type: 'jpeg', quality: 60 }); await next();
  await p.locator('input:not([type=checkbox]):not([type=file])').nth(0).fill('Isuzu'); await p.locator('input:not([type=checkbox]):not([type=file])').nth(1).fill('NPR'); await next();
  for (let i = 0; i < 2; i++) { const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.getByRole('button', { name: /choose photo|change photo|اختيار صورة|تغيير الصورة/i }).nth(i).click()]); await fc.setFiles(i === 0 ? files.png : files.webp); await p.waitForTimeout(1200); }
  await p.screenshot({ path: path.join(OUT, 'flow-truck-docs.jpg'), type: 'jpeg', quality: 60 });
  await p.getByRole('button', { name: /submit for approval|إرسال للاعتماد/i }).click(); await p.waitForTimeout(3500);
  results.truckShown = await p.getByText(`FLOW-${tag}`, { exact: false }).count() > 0;

  // ---- driver with a PNG licence + a JPEG photo
  await p.getByRole('button', { name: /^drivers|السائقون/i }).first().click(); await p.waitForTimeout(500);
  await p.getByRole('button', { name: /add driver|إضافة سائق/i }).first().click(); await p.waitForTimeout(800);
  await p.locator('input:not([type=checkbox]):not([type=file])').nth(0).fill(`Flow Driver ${tag}`); await p.locator('input:not([type=checkbox]):not([type=file])').nth(1).fill(`flow${tag}@motexa.test`); await p.locator('input:not([type=checkbox]):not([type=file])').nth(2).fill('0599123456'); await next();
  await p.locator('input:not([type=checkbox]):not([type=file])').nth(0).fill(`LIC-${tag}`); await pick(files.png); await next();
  await pick(files.jpg); await p.screenshot({ path: path.join(OUT, 'flow-driver-photo.jpg'), type: 'jpeg', quality: 60 });
  await p.getByRole('button', { name: /^(save|حفظ)$/i }).last().click(); await p.waitForTimeout(4000);
  results.driverShown = await p.getByText(`Flow Driver ${tag}`, { exact: false }).count() > 0;
  await p.screenshot({ path: path.join(OUT, 'flow-fleet-after.jpg'), type: 'jpeg', quality: 60 });

  const isJpeg = s => /"dataBase64":"\/9j\//.test(s);
  results.requests = bodies.map(x => ({ url: x.url, method: x.method, kb: Math.round(x.post.length / 1024), jpegPhotos: (x.post.match(/"dataBase64":"\/9j\//g) || []).length, otherPhotos: (x.post.match(/"dataBase64":"(?!\/9j\/)/g) || []).length }));
  results.statuses = responses; results.problems = p.problems.filter(x => !/Failed to load resource|favicon/.test(x)); results.tag = tag;
  void isJpeg;
  console.log(JSON.stringify(results, null, 1));
  await b.close();
})().catch(e => { console.error(e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });
