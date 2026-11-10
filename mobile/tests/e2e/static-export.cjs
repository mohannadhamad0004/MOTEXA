// Serve a local Expo export through Playwright interception; the browser needs no listening HTTP server.
const fs = require('node:fs');
const path = require('node:path');

async function serveExport(route, directory) {
  const root = path.resolve(directory);
  const local = path.resolve(root, '.' + decodeURIComponent(new URL(route.request().url()).pathname));
  if (local !== root && !local.startsWith(root + path.sep)) return route.abort();
  const file = name => fs.existsSync(name) && fs.statSync(name).isFile();
  if (file(local)) return route.fulfill({ path: local });
  // Only documents get an HTML fallback. Missing JS/fonts must fail instead of receiving an HTML body.
  if (!route.request().isNavigationRequest()) return route.fulfill({ status: 404, body: 'Missing export asset' });
  for (const candidate of [path.join(local, 'index.html'), local + '.html']) {
    if (file(candidate)) return route.fulfill({ path: candidate, contentType: 'text/html' });
  }
  const parent = path.dirname(local);
  if (fs.existsSync(parent)) {
    const dynamic = fs.readdirSync(parent).find(name => /^\[[^\]]+\]\.html$/.test(name));
    if (dynamic) return route.fulfill({ path: path.join(parent, dynamic), contentType: 'text/html' });
  }
  return route.fulfill({ path: path.join(root, 'index.html'), contentType: 'text/html' });
}

module.exports = { serveExport };
