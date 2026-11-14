// One-off: the 4 part-card images of the shop's 3D wizard, rendered through the real MOTEXA viewer (BMW E36, neutral grey clay,
// the part in bronze, transparent background). Run from backend/: node <this file>. Writes mobile/assets/wizard/*.webp
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
const B = new URL("../", import.meta.url).href.replace(/^file:\/\/\//, "");
const { ROOT, loadTS } = await import("file:///" + B + "scripts/vehicle-audit-lib.mjs");
const { AUDIT_ORIGIN } = await import("file:///" + B + "scripts/vehicle-audit-local.mjs");
const req = createRequire(resolve(ROOT, "mobile/package.json"));
const { chromium } = req("@playwright/test");
const sharp = createRequire(B + "package.json")("sharp");
const { prisma } = await import("file:///" + B + "src/prisma.ts");

const ACCENT = 0xc98a50; // between the dark (#E0A36F) and light (#9A602D) accents: reads on both card colours
const { CAR3D_HTML, THREE_VERSION } = loadTS(resolve(ROOT, "mobile/src/features/car3d/sceneHtml.ts"));
const { mergeZones } = await import("file:///" + B + "src/services/accessory3d.ts");
const { publishedVehicleModels } = await import("file:///" + B + "src/services/vehicle3d-revisions.ts");
const model = (await mergeZones(await publishedVehicleModels())).find(m => m.key === "bmw-3-series-e36"); // with the admin-tuned zones, as the app gets it
const pm = await prisma.carPartMap.findUnique({ where: { model3dKey: "bmw-3-series-e36" } });
await prisma.$disconnect();

const hook = `
window.cardLoad = async function (model, label, ids, wing) {
  renderer.setAnimationLoop(null); controls.autoRotate = false; controls.enableDamping = false;
  scene.background = null; renderer.setClearColor(0x000000, 0); renderer.toneMappingExposure = 0.82;
  PART_COLORS[label || "X"] = ${ACCENT};
  parsed["/car.glb"] = loader.loadAsync("/car.glb");
  car = await build({ model: model, file: "/car.glb", color: "#b7bbc0", partEdit: {} });
  if (car.wing) car.wing.visible = false; if (car.rack) car.rack.visible = false;
  scene.add(car.group);
  var labels = {}; if (label) labels[label] = ids;
  editApply({ partEdit: { label: label, labels: labels } });
  if (wing) {
    parsed["/wing.glb"] = loader.loadAsync("/wing.glb");
    var b = await buildAccessory(car, { type: "WING", file: "/wing.glb", size: { widthMm: 1300 } });
    var mat = new THREE.MeshStandardMaterial({ color: ${ACCENT}, roughness: 0.6, metalness: 0 });
    b.group.traverse(function (o) { if (o.isMesh) o.material = mat; });
    car.group.add(b.group);
  }
  car.group.updateMatrixWorld(true);
  var box = new THREE.Box3().setFromObject(car.root, true), size = box.getSize(new THREE.Vector3()), target = box.getCenter(new THREE.Vector3());
  var dist = size.length() / 2 / Math.sin(THREE.MathUtils.degToRad(camera.fov) / 2) * 0.8;
  window.cardView = function (dir) {
    camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
    camera.position.copy(new THREE.Vector3(dir[0], dir[1], dir[2]).normalize().multiplyScalar(dist).add(target));
    camera.near = dist / 1000; camera.far = dist * 100; camera.updateProjectionMatrix(); camera.lookAt(target);
    renderer.render(scene, camera);
  };
  return size.toArray();
};
window.cardReady = true;
`;
const html = CAR3D_HTML
  .replace("new THREE.WebGLRenderer({ antialias: true })", "new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })")
  .replace("<body", "<body style=\"background:transparent\"")
  .replace('post({ type: "ready" });', `${hook}\npost({ type: "ready" });`);

const CARDS = [
  ["front-bumper", "FRONT_BUMPER", [-0.75, 0.32, 1], false],
  ["rear-bumper", "REAR_BUMPER", [-0.75, 0.32, -1], false],
  ["rear-wing", null, [-0.75, 0.42, -1], true],
  ["rims", "WHEELS", [-1, 0.1, 0.12], false],
];
const out = resolve(ROOT, "mobile/assets/wizard"); mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
for (const [name, label, dir, wing] of CARDS) {
  const ctx = await browser.newContext({ viewport: { width: 180, height: 120 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage(); const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await ctx.route("**/*", async route => {
    const u = new URL(route.request().url());
    if (u.origin !== AUDIT_ORIGIN) return route.continue(); // three.js from the viewer's own CDN
    if (u.pathname === "/") return route.fulfill({ status: 200, contentType: "text/html", body: html });
    if (u.pathname === "/car.glb") return route.fulfill({ status: 200, contentType: "model/gltf-binary", body: readFileSync(resolve(ROOT, "backend/public/3d/bmw-3-series-e36.glb")) });
    if (u.pathname === "/wing.glb") return route.fulfill({ status: 200, contentType: "model/gltf-binary", body: readFileSync(resolve(ROOT, "backend/public/3d/accessories/acc-7e40b463d76777b8.glb")) });
    return route.fulfill({ status: 404, body: "" });
  });
  await page.goto(AUDIT_ORIGIN + "/");
  await page.waitForFunction(() => window.cardReady === true, null, { timeout: 25000 });
  await page.evaluate(({ model, label, ids, wing }) => window.cardLoad(model, label, ids, wing), { model, label, ids: label ? pm.map[label] : [], wing });
  await page.evaluate(d => window.cardView(d), dir);
  const png = await page.screenshot({ omitBackground: true });
  const webp = await sharp(png).webp({ quality: 82, alphaQuality: 90, effort: 6 }).toBuffer();
  writeFileSync(resolve(out, `${name}.webp`), webp);
  console.log(name, png.length, "->", webp.length, "bytes", errors.length ? errors : "");
  await ctx.close();
}
await browser.close();
