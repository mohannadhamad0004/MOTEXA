import Button from './Button.jsx'
import styles from './FilterBar.module.css'

// One horizontal toolbar for a list page: labelled controls on a quiet surface, and "Reset" when
// something is filtered. Put a <FilterField label="..."> around each control.
export default function FilterBar({ children, canReset = false, onReset }) {
  return (
    <div className={styles.toolbar} role="search">
      {children}
      {canReset && (
        <Button variant="ghost" onClick={onReset} className={styles.reset}>
          Reset
        </Button>
      )}
    </div>
  )
}

export function FilterField({ label, grow = false, children }) {
  return (
    <label className={`${styles.field} ${grow ? styles.grow : ''}`}>
      <span className={styles.label}>{label}</span>
      {children}
    </label>
  )
}
