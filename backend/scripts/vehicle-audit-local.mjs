// Offline-only dependency resolution/routing for the developer audit browser.
import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { createRequire } from 'node:module';

export const AUDIT_ORIGIN = 'http://motexa-audit.local';
export const REQUIRED_THREE_FILES = [
  'build/three.module.js',
  'examples/jsm/loaders/GLTFLoader.js',
  'examples/jsm/controls/OrbitControls.js',
  'examples/jsm/environments/RoomEnvironment.js',
  'examples/jsm/libs/meshopt_decoder.module.js',
  'examples/jsm/utils/BufferGeometryUtils.js',
];

export function validateThreeDirectory(directory, version) {
  const dir = resolve(directory);
  if (!existsSync(resolve(dir, 'package.json'))) throw new Error(`No Three.js package.json in ${dir}`);
  const pkg = JSON.parse(readFileSync(resolve(dir, 'package.json'), 'utf8'));
  if (pkg.name !== 'three' || pkg.version !== version) throw new Error(`Audit requires three@${version}; found ${pkg.name}@${pkg.version}`);
  for (const file of REQUIRED_THREE_FILES) {
    if (!existsSync(resolve(dir, file))) throw new Error(`Local Three.js package is incomplete: ${file}`);
  }
  return realpathSync(dir);
}

export function resolveLocalThree(root, version, explicit) {
  if (explicit) return validateThreeDirectory(explicit, version);
  const candidates = [resolve(root, '3d-source/audit/vendor/three'), resolve(root, '3d-source/audit/vendor/package')];
  for (const project of ['mobile', 'backend', 'apps/web']) {
    candidates.push(resolve(root, project, 'node_modules/three'));
    try {
      const require = createRequire(resolve(root, project, 'package.json'));
      // Package exports may hide package.json; the entry lives inside build/.
      candidates.push(resolve(require.resolve('three'), '../..'));
    } catch { /* Not installed in this project. */ }
  }
  for (const candidate of [...new Set(candidates)]) {
    try { return validateThreeDirectory(candidate, version); } catch { /* No compatible local package. */ }
  }
  throw new Error(`LOCAL_THREE_MISSING: three@${version} is not installed locally. Supply --three-dir=<package directory>, or place the exact package in 3d-source/audit/vendor/three. No network fallback is allowed.`);
}

export function localizeViewerHtml(html) {
  const maps = html.match(/<script type="importmap">[\s\S]*?<\/script>/g);
  if (maps?.length !== 1) throw new Error('Expected exactly one production viewer import map');
  const local = html.replace(maps[0], '<script type="importmap">{"imports":{"three":"/vendor/three/build/three.module.js","three/addons/":"/vendor/three/examples/jsm/"}}</script>');
  if (/https?:\/\//i.test(local)) throw new Error('Unexpected remote URL remains in audit viewer HTML');
  return local;
}

/** The only files exposed to the browser: one HTML page, the selected GLB and local Three.js. */
export function localResponse(urlString, { html, assetPath, threeDir }) {
  const url = new URL(urlString);
  if (url.origin !== AUDIT_ORIGIN) return { blocked: true };
  if (url.pathname === '/') return { status: 200, contentType: 'text/html', body: html };
  if (url.pathname === '/asset.glb') return { status: 200, contentType: 'model/gltf-binary', body: readFileSync(assetPath) };
  if (url.pathname.startsWith('/vendor/three/')) {
    const suffix = decodeURIComponent(url.pathname.slice('/vendor/three/'.length));
    // Only JS modules beneath the package's build and addon directories are exposed.
    if (!/^(build|examples\/jsm)\/.+\.js$/.test(suffix) || suffix.includes('..') || suffix.includes('\\')) return { status: 404, body: 'Not found' };
    const path = resolve(threeDir, suffix), realRoot = realpathSync(threeDir);
    if (!path.startsWith(resolve(threeDir) + sep) || !existsSync(path) || !statSync(path).isFile()) return { status: 404, body: 'Not found' };
    if (!realpathSync(path).startsWith(realRoot + sep)) return { status: 404, body: 'Not found' };
    return { status: 200, contentType: 'text/javascript', body: readFileSync(path) };
  }
  return { status: 404, body: 'Not found' };
}
