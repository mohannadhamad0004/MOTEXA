import styles from './PageShell.module.css'

// The column every page sits in: one vertical rhythm between the header, toolbars and sections, so no
// page writes its own page wrapper. Width comes from the Layout (normal / wide / admin routes).
export default function PageShell({ children, className = '' }) {
  return <div className={`${styles.shell} ${className}`.trim()}>{children}</div>
}