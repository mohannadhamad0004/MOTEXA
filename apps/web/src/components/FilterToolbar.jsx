import styles from './FilterToolbar.module.css'

// A light toolbar for a list page: a search box, quiet "Label: value ▾" menus and "Clear filters".
// Children are <FilterMenu>s (and a search box passed as `search`).
export default function FilterToolbar({ search, children, canReset = false, onReset }) {
  return (
    <div className={styles.toolbar} role="search">
      <div className={styles.search}>{search}</div>
      <div className={styles.menus}>
        {children}
        {canReset && (
          <button type="button" className={styles.reset} onClick={onReset}>
            Clear filters
          </button>
        )}
      </div>
    </div>
  )
}

// A native <select> dressed as text, so keyboard and screen readers behave as usual.
export function FilterMenu({ label, value, onChange, children }) {
  return (
    <label className={styles.menu}>
      <span className={styles.menuLabel}>{label}:</span>
      <select className={styles.select} value={value} onChange={onChange}>
        {children}
      </select>
    </label>
  )
}
