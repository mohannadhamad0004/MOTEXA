// Developer-only, read-only asset inspection. Never imported by the application.
import { readFileSync, existsSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { NodeIO, getBounds, Logger } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';

export const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const AUDIT = resolve(ROOT, '3d-source/audit');
export const rel = p => relative(ROOT, p).replaceAll('\\', '/');
export const json = p => JSON.parse(readFileSync(p, 'utf8'));
export const hash = p => createHash('sha256').update(readFileSync(p)).digest('hex');
export function loadTS(path) {
  // Only trusted repository modules without runtime imports are evaluated.
  const require = createRequire(resolve(ROOT, 'mobile/package.json'));
  const ts = require('typescript');
  const text = readFileSync(path, 'utf8');
  const output = ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  new Function('exports', output)(exports);
  return exports;
}
export const genKey = (make, model, code) => [make === 'Mercedes-Benz' ? 'Mercedes' : make, model, code].join('-').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export function triangles(mode, count) {
  return mode === 4 ? Math.floor(count / 3) : mode === 5 || mode === 6 ? Math.max(0, count - 2) : 0;
}
export function validBounds(bounds) {
  return bounds.min.length === 3 && bounds.max.length === 3 && [...bounds.min, ...bounds.max].every(Number.isFinite) && bounds.max.every((n, i) => n >= bounds.min[i]);
}
export function dimensions(bounds) { return validBounds(bounds) ? bounds.max.map((v, i) => v - bounds.min[i]) : null; }
export function duplicates(entries, field) {
  const groups = new Map();
  for (const e of entries) {
    const value = e[field];
    if (value) groups.set(value, [...(groups.get(value) || []), e.key]);
  }
  return [...groups].filter(([, keys]) => keys.length > 1).map(([value, keys]) => ({ value, keys }));
}
export function inventory() {
  const manifest = json(resolve(ROOT, 'docs/3d/models.json'));
  const { CAR_MODELS } = loadTS(resolve(ROOT, 'mobile/src/features/car3d/models.ts'));
  const rows = readFileSync(resolve(ROOT, 'docs/3d/generations-master.tsv'), 'utf8').trim().split(/\r?\n/).slice(1).map(line => {
    const [make, model, code, years, status, title, url, notes] = line.split('\t');
    return { key: genKey(make, model, code), make, model, code, years, status, title, url, notes };
  });
  const batch = json(resolve(ROOT, '3d-source/_batch.json'));
  const keys = new Set([...Object.keys(manifest), ...CAR_MODELS.map(m => m.key), ...Object.values(batch).filter(b => b.uid).map(b => b.key)]);
  const entries = [...keys].sort().map(key => {
    const m = manifest[key], config = CAR_MODELS.find(m => m.key === key), generation = rows.find(r => r.key === key);
    const metadataPath = resolve(ROOT, `3d-source/${key}/source.json`);
    const provenance = existsSync(metadataPath) ? json(metadataPath) : null;
    const original = key === 'toyota-corolla-e170-e180' ? '3d-source/toyota-corolla-2014.glb' : `3d-source/${key}/model.glb`;
    const current = m ? (m.inApp === false ? `3d-source/${key}/optimized.glb` : `backend/public/3d/${m.file}.glb`) : null;
    return { key, scope: m || config ? 'model-library' : 'undownloaded-candidate', generation: generation || null,
      model3dKey: config?.key ?? null, make: m?.make ?? generation?.make, model: m?.model ?? generation?.model,
      code: m?.code ?? generation?.code, yearRange: generation?.years ?? null,
      currentAsset: current, originalAsset: original, source: m?.url ?? provenance?.url ?? batch[key]?.url,
      author: m?.author ?? provenance?.author ?? batch[key]?.author ?? null, license: m?.license ?? provenance?.license ?? batch[key]?.license ?? null,
      provenance, batch: batch[key] ?? null, manifest: m ?? null, configuration: config ?? null,
      status: 'UNCERTAIN', reason: 'VISUAL_AUDIT_PENDING', action: null, replacement: null,
      visualNotes: 'Not visually reviewed; no PASS or replacement decision inferred from metadata.',
      accessoryReadiness: { confirmed: false, notes: 'Node-name signals only until visual inspection.' } };
  });
  return { entries, generationRows: rows, duplicateConfigKeys: duplicates(CAR_MODELS, 'key'), duplicateAssetMappings: duplicates(Object.values(manifest), 'file'), duplicateSources: duplicates(entries, 'source') };
}
await MeshoptDecoder.ready;
const io = new NodeIO().setLogger(new Logger(Logger.Verbosity.ERROR)).registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
export async function inspectAsset(path) {
  if (!existsSync(path)) return { path: rel(path), missing: true, loaded: false };
  const base = { path: rel(path), missing: false, bytes: statSync(path).size, sha256: hash(path) };
  try {
    const doc = await io.read(path), root = doc.getRoot(), scene = root.getDefaultScene() || root.listScenes()[0];
    const nodes = root.listNodes();
    let vertices = 0, triangleCount = 0, primitives = 0, invalidPositions = 0, zeroSizePrimitives = 0;
    for (const mesh of root.listMeshes()) for (const p of mesh.listPrimitives()) {
      primitives++;
      const a = p.getAttribute('POSITION');
      const count = a?.getCount() ?? 0;
      vertices += count;
      triangleCount += triangles(p.getMode(), p.getIndices()?.getCount() ?? count);
      if (a) {
        const arr = a.getArray();
        let min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
        for (let i = 0; i < arr.length; i++) { const v = arr[i]; if (!Number.isFinite(v)) invalidPositions++; min[i % 3] = Math.min(min[i % 3], v); max[i % 3] = Math.max(max[i % 3], v); }
        if (max.every((v, i) => v === min[i])) zeroSizePrimitives++;
      }
    }
    const hierarchy = nodes.map((n, index) => ({ index, name: n.getName(), parent: nodes.indexOf(n.getParentNode()), children: n.listChildren().map(c => nodes.indexOf(c)), mesh: n.getMesh()?.getName() ?? null,
      translation: n.getTranslation(), rotation: n.getRotation(), scale: n.getScale(), matrix: n.getMatrix(), worldMatrix: n.getWorldMatrix(),
      bounds: n.getMesh() ? getBounds(n) : null }));
    const bounds = scene ? getBounds(scene) : { min: [], max: [] }, size = scene ? dimensions(bounds) : null;
    const signals = pattern => hierarchy.filter(n => n.mesh !== null && pattern.test(`${n.name} ${n.mesh}`)).map(n => ({ index: n.index, name: n.name, bounds: n.bounds }));
    const flags = [];
    if (!scene || !vertices) flags.push('EMPTY_SCENE');
    if (!size || size.some(n => !Number.isFinite(n)) || (size && size.every(n => n === 0))) flags.push('INVALID_OR_ZERO_BOUNDS');
    if (hierarchy.some(n => !n.matrix.every(Number.isFinite) || !n.worldMatrix.every(Number.isFinite)) || invalidPositions) flags.push('INVALID_TRANSFORMS_OR_POSITIONS');
    if (size && size[1] > Math.max(size[0], size[2])) flags.push('VERTICAL_LONG_AXIS_REVIEW');
    if (size && (Math.max(...size) > 10000 || Math.max(...size) < 0.001)) flags.push('SOURCE_SCALE_REVIEW');
    if (zeroSizePrimitives) flags.push('ZERO_SIZE_PRIMITIVES');
    return { ...base, loaded: true, meshes: root.listMeshes().length, materials: root.listMaterials().length, textures: root.listTextures().length, vertices, triangles: triangleCount, primitives,
      countsNote: 'Unique mesh primitive counts, not instanced draw counts. Dimensions are source units, not necessarily metres.',
      bounds, dimensions: size, scenes: root.listScenes().map(s => ({ name: s.getName(), roots: s.listChildren().map(n => nodes.indexOf(n)) })),
      rootTransforms: scene?.listChildren().map(n => hierarchy[nodes.indexOf(n)]) ?? [], hierarchy,
      animations: root.listAnimations().map(a => ({ name: a.getName(), channels: a.listChannels().length, samplers: a.listSamplers().length })),
      texturesInfo: root.listTextures().map(t => ({ name: t.getName(), mimeType: t.getMimeType(), size: t.getSize(), bytes: t.getImage()?.byteLength ?? 0 })),
      wheelLike: signals(/wheel|tyre|tire|rim/i), bodyLike: signals(/body|chassis|paint|shell|karos/i), bumperLike: signals(/bumper/i), roofLike: signals(/roof/i), rearLike: signals(/trunk|boot|rear/i), flags };
  } catch (e) { return { ...base, loaded: false, error: String(e.message), flags: ['LOAD_FAILED'] }; }
}
