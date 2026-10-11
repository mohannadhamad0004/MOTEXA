import { useState } from 'react'
import { NavLink, Outlet } from 'react-router'
import AdminProvider from '../AdminProvider.jsx'
import { useAdminAttention } from './useAdminAttention.js'
import styles from './AdminLayout.module.css'

// 20px line icons, drawn once here so every section looks alike.
const ICONS = {
  overview: 'M3 12l9-9 9 9M5 10v10h14V10',
  approvals: 'M9 12l2 2 4-4M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  reviews: 'M12 3l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.8 6.2 20.9l1.1-6.5L2.6 9.8l6.5-.9z',
  users: 'M16 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M9.5 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M21 20v-2a4 4 0 0 0-3-3.9M16 3.1a3.5 3.5 0 0 1 0 6.8',
  listings: 'M21 8l-9-5-9 5v8l9 5 9-5zM3.3 7.5L12 12l8.7-4.5M12 12v9',
  tags: 'M20 12l-8 8-9-9V3h8zM7.5 7.5h.01',
  requests: 'M4 5h16v11H8l-4 4z',
  orders: 'M5 7h14l-1 13H6zM9 7a3 3 0 0 1 6 0',
}

// Grouped like the work: the overview, what to manage, and the day-to-day operations. `badge` names the
// pending count (from useAdminAttention) shown next to a section.
const groups = [
  { label: 'Overview', items: [{ to: '/admin', label: 'Overview', icon: 'overview', end: true }] },
  {
    label: 'Management',
    items: [
      { to: '/admin/approvals', label: 'Approvals', icon: 'approvals', badge: 'approvals' },
      { to: '/admin/users', label: 'Users', icon: 'users' },
      { to: '/admin/listings', label: 'Listings', icon: 'listings' },
      { to: '/admin/tags', label: 'Tags', icon: 'tags' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { to: '/admin/requests', label: 'Requests', icon: 'requests' },
      { to: '/admin/orders', label: 'Orders', icon: 'orders' },
      { to: '/admin/reviews', label: 'Reviews', icon: 'reviews', badge: 'reports' },
    ],
  },
]
const Icon = ({ name }) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={ICONS[name]} />
  </svg>
)

// Sidebar + page area for every /admin/* route. Routes wrap it in ProtectedRoute (admins only);
// it also mounts AdminProvider, so the admin service exists only inside the admin area.
export default function AdminLayout() {
  return (
    <AdminProvider>
      <AdminShell />
    </AdminProvider>
  )
}

function AdminShell() {
  const { data } = useAdminAttention()
  const [collapsed, setCollapsed] = useState(false) // desktop: icons only
  const counts = data && { approvals: data.accounts + data.skills + data.trucks + data.changes, reports: data.reports }

  return (
    <div className={`${styles.layout} ${collapsed ? styles.collapsed : ''}`}>
      <nav className={styles.sidebar} aria-label="Admin sections">
        <p className={styles.brand}>
          MOTEXA
          <span className={styles.brandSub}>Operations</span>
        </p>
        <button
          type="button"
          className={styles.collapse}
          aria-pressed={collapsed}
          onClick={() => setCollapsed(!collapsed)}
        >
          <span aria-hidden="true">{collapsed ? '»' : '«'}</span>
          <span className={styles.text}>{collapsed ? 'Expand menu' : 'Collapse menu'}</span>
        </button>
        {groups.map((group, index) => (
          <div key={group.label ?? index} className={styles.group}>
            {group.label && <p className={styles.heading}>{group.label}</p>}
            <ul className={styles.links}>
              {group.items.map((item) => {
                const count = item.badge ? counts?.[item.badge] : 0
                return (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      title={item.label}
                      className={({ isActive }) => (isActive ? `${styles.link} ${styles.active}` : styles.link)}
                    >
                      <Icon name={item.icon} />
                      <span className={styles.text}>{item.label}</span>
                      {count > 0 && (
                        <span className={styles.badge}>
                          {count}
                          <span className={styles.srOnly}> waiting</span>
                        </span>
                      )}
                    </NavLink>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className={styles.content}>
        <Outlet />
      </div>
    </div>
  )
}
