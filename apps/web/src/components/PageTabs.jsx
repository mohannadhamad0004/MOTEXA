import styles from './PageTabs.module.css'

// A row of quick-filter chips; exactly one is pressed. options: [{ value, label }], '' is "all".
export default function PageTabs({ label, options, value, onChange }) {
  return (
    <div className={styles.chips} role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={styles.chip}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
