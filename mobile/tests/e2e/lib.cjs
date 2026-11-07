// Shared helpers for the FOUR-ROLES click-through (Expo web on :8083 against the real backend on :5000). Fails on console errors / page errors.
const { chromium } = require('@playwright/test'); const fs = require('fs'), path = require('path');
const BASE = process.env.WEB || 'http://localhost:8083', PASS = 'Motexa-Dev-1234!';
const SHOTS = path.resolve(__dirname, '../../../docs/agents/four-roles');
async function launch() { const b = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || 'chrome' }); return b; }
/** a 390 px page; collects console errors / page errors / failed API calls */
async function newPage(b, { dark = true, ar = false } = {}) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, colorScheme: dark ? 'dark' : 'light' }); const p = await ctx.newPage(); p.problems = []; p.opts = { dark, ar };
  p.on('pageerror', e => p.problems.push('pageerror: ' + e.message)); p.on('console', m => { if (m.type() === 'error' && !/Invalid style property of "direction"/.test(m.text())) p.problems.push('console: ' + m.text().slice(0, 240)); });
  p.on('response', r => { if (r.url().includes(':5000') && r.status() >= 500) p.problems.push('http ' + r.status() + ' ' + r.url().slice(-80)); });
  return p;
}
async function login(p, email) {
  await p.goto(BASE + '/auth/login'); await p.waitForLoadState('networkidle');
  const R = p.getByRole('radio'); await R.nth(p.opts && !p.opts.dark ? 2 : 3).click(); await p.waitForTimeout(300); if (p.opts && p.opts.ar) await R.nth(1).click(); await p.waitForTimeout(400);
  await p.getByPlaceholder(p.opts && p.opts.ar ? /./ : /email/i).first().fill(email); await p.locator('input[type=password]').first().fill(PASS);
  await p.getByRole('button', { name: /enter workspace|دخول|الدخول|مساحة|workspace/i }).first().click(); await p.waitForURL(u => !/\/auth\//.test(u.pathname), { timeout: 20000 }); await p.waitForTimeout(2500);
}
/** go to a route; for AR / light we navigate client-side (a full reload resets the theme on web: expo-secure-store has no web storage) */
async function go(p, route) {
  const custom = p.opts && (p.opts.ar || !p.opts.dark);
  if (custom && !/\/auth\//.test(new URL(p.url()).pathname)) { await p.evaluate(r => { window.history.pushState({}, '', r); window.dispatchEvent(new PopStateEvent('popstate')); }, route); await p.waitForTimeout(1200); }
  else { await p.goto(BASE + route); await p.waitForTimeout(1200); }
}
async function shot(p, role, name) { const d = path.join(SHOTS, role); fs.mkdirSync(d, { recursive: true }); await p.screenshot({ path: path.join(d, name + '.jpg'), type: 'jpeg', quality: 55 }); }
/** every visible tappable thing: role button / link / tab / switch / checkbox + clickable divs with a pointer cursor */
async function tappables(p) {
  return p.evaluate(() => { const out = []; let k = 0; document.querySelectorAll('[data-e2e]').forEach(e => e.removeAttribute('data-e2e')); document.querySelectorAll('[role=button],[role=link],[role=tab],[role=switch],[role=checkbox],a[href],button,input,[tabindex="0"]').forEach(e => { const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return; if (getComputedStyle(e).visibility === 'hidden') return; e.setAttribute('data-e2e', String(k));
    out.push({ k: k++, role: e.getAttribute('role') || e.tagName.toLowerCase(), name: (e.getAttribute('aria-label') || e.innerText || e.getAttribute('placeholder') || '').trim().replace(/\s+/g, ' ').slice(0, 50), w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x), y: Math.round(r.y) }); }); return out; });
}
module.exports = { go, BASE, PASS, launch, newPage, login, shot, tappables };
