// Screenshot tour for a provider role in one variant: node tour.cjs <role-folder> <email> <tabs comma list> <home link names comma list>   env DARK=0 AR=1
// Logs in with the variant (theme / language toggles on the login screen), then ONLY navigates inside the app (tab bar, workspace links, back),
// because a page reload resets the theme on web (expo-secure-store has no web storage).
const L = require('./lib.cjs'); const [role, email, tabsCsv, linksCsv] = process.argv.slice(2); const DARK = process.env.DARK !== '0', AR = process.env.AR === '1', suf = (DARK ? 'dark' : 'light') + '-' + (AR ? 'ar' : 'en');
(async () => { const b = await L.launch(); const p = await L.newPage(b, { dark: DARK, ar: AR }); await L.login(p, email);
  const tabs = tabsCsv.split(','), links = (linksCsv || '').split(',').filter(Boolean); const tabBtn = i => p.getByRole('tab').nth(-(tabs.length - i)); // the tab bar is the LAST tabs in the DOM (pages can have their own segment tabs)
  for (let i = 0; i < tabs.length; i++) { await tabBtn(i).click({ force: true }); await p.waitForTimeout(1800); await L.shot(p, role, `tab-${tabs[i]}-${suf}`); }
  await tabBtn(0).click({ force: true }); await p.waitForTimeout(1500);
  for (const l of links) { const [name, label] = l.split('='); const loc = p.locator('[role=button],[role=link]').filter({ hasText: new RegExp(label || name) }).last();
    if (!(await loc.count())) { console.log('no link', l); continue; } await loc.scrollIntoViewIfNeeded(); await loc.click({ force: true }); await p.waitForTimeout(2000); await L.shot(p, role, `${name}-${suf}`); await p.goBack(); await p.waitForTimeout(1200); }
  console.log(suf, 'problems:', p.problems.length, p.problems.map(x => x.slice(0, 100)).join(' | ')); await b.close(); })().catch(e => { console.error(e.message.split('\n')[0]); process.exit(1); });
