import { useEffect, useId, useRef, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router'
import { useAuth } from '../../auth/useAuth.js'
import EmergencyButton from '../../features/requests/emergency/components/EmergencyButton.jsx'
import Button from '../Button.jsx'
import AccountMenu from './AccountMenu.jsx'
import NotificationsBell from './NotificationsBell.jsx'
import ThemeToggle from './ThemeToggle.jsx'
import { widthOf } from './wideRoutes.js'
import styles from './Navbar.module.css'

// Public pages anyone can browse, logged in or not.
const links = [
  { to: '/marketplace', label: 'Marketplace' },
  { to: '/mechanics', label: 'Mechanics' },
  { to: '/tow-companies', label: 'Tow Companies' },
]

const linkClass = ({ isActive }) => (isActive ? `${styles.link} ${styles.active}` : styles.link)

// Brand and public links on the left; on the right, the theme switch and Log in / Sign up or the
// account menu. Below 1024px the links, the theme switch and Log in / Sign up move into a menu
// behind a hamburger button.
export default function Navbar() {
  const { user } = useAuth()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuId = useId()
  const headerRef = useRef(null)
  const toggleRef = useRef(null)

  // Close the mobile menu when the page changes (a link was followed, or back/forward).
  const [lastPath, setLastPath] = useState(location.pathname)
  if (location.pathname !== lastPath) {
    setLastPath(location.pathname)
    setMenuOpen(false)
  }

  useEffect(() => {
    if (!menuOpen) return undefined
    function handleKey(event) {
      if (event.key === 'Escape') {
        setMenuOpen(false)
        toggleRef.current?.focus()
      }
    }
    function handlePointer(event) {
      if (!headerRef.current?.contains(event.target)) setMenuOpen(false)
    }
    document.addEventListener('keydown', handleKey)
    document.addEventListener('pointerdown', handlePointer)
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.removeEventListener('pointerdown', handlePointer)
    }
  }, [menuOpen])

  return (
    <header className={styles.navbar} ref={headerRef} data-no-print>
      <nav className={styles.inner} data-wide={widthOf(location.pathname)} data-signed-in={user ? '' : undefined} aria-label="Main">
        <Link to="/" className={styles.brand} aria-label="MOTEXA home">
          <span className={styles.logo} aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z" />
            </svg>
          </span>
          <span className={styles.wordmark}>
            <span className={styles.brandAccent}>Mo</span>texa
          </span>
        </Link>

        <ul className={styles.links}>
          {links.map((link) => (
            <li key={link.to}>
              <NavLink to={link.to} className={linkClass}>
                {link.label}
              </NavLink>
            </li>
          ))}
        </ul>

        <div className={styles.account}>
          <EmergencyButton />
          <ThemeToggle className={styles.desktopOnly} />
          {user ? (
            <>
              <NotificationsBell />
              <AccountMenu />
            </>
          ) : (
            <div className={styles.guestActions}>
              <Button to="/login" variant="ghost" size="sm">
                Log in
              </Button>
              <Button to="/signup" size="sm">
                Sign up
              </Button>
            </div>
          )}
          <button
            ref={toggleRef}
            type="button"
            className={styles.menuToggle}
            aria-expanded={menuOpen}
            aria-controls={menuId}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className={`${styles.burger} ${menuOpen ? styles.burgerOpen : ''}`} aria-hidden="true" />
          </button>
        </div>
      </nav>

      {/* Mobile menu: always in the DOM so aria-controls points at something; hidden when closed. */}
      <div id={menuId} className={styles.mobileMenu} hidden={!menuOpen}>
        <ul className={styles.mobileLinks}>
          {links.map((link) => (
            <li key={link.to}>
              <NavLink to={link.to} className={linkClass}>
                {link.label}
              </NavLink>
            </li>
          ))}
        </ul>
        <ThemeToggle variant="segmented" />
        {!user && (
          <div className={styles.mobileActions}>
            <Button to="/login" variant="secondary" fullWidth>
              Log in
            </Button>
            <Button to="/signup" fullWidth>
              Sign up
            </Button>
          </div>
        )}
      </div>
    </header>
  )
}

