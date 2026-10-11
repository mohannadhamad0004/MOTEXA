// Which width a page gets: 'admin' (the admin area: sidebar plus content up to ~1440px), 'wide'
// (directory, catalog), 'full' (a workspace that fills the screen under the navbar: the two map pages) or
// undefined (normal). Layout and Navbar both read this so their edges line up. Detail pages
// (/mechanics/:id ...) stay normal width.
const WIDE_EXACT = ['', '/marketplace', '/mechanics', '/tow-companies']
const FULL_EXACT = ['/mechanics/map', '/tow-companies/map']

export function widthOf(pathname) {
  if (pathname === '/admin' || pathname.startsWith('/admin/')) return 'admin'
  if (FULL_EXACT.includes(pathname.replace(/\/$/, ''))) return 'full'
  if (WIDE_EXACT.includes(pathname.replace(/\/$/, ''))) return 'wide'
  return undefined
}