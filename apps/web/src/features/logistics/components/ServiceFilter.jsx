import { TOW_SERVICES } from '../constants.js'
import styles from './ServiceFilter.module.css'

/**
 * Filter by service: the five tow services as plain text toggles under a small label. Choosing one keeps
 * only the companies that offer it; choosing it again clears it. Replaces the old row of icon chips.
 * @param {{ service: string, onChange: (service: string) => void }} props
 */
export default function ServiceFilter({ service, onChange }) {
  return (
    <div className={styles.filter} role="group" aria-label="Filter by service">
      <span className={styles.label} aria-hidden="true">
        Service
      </span>
      <ul className={styles.list}>
        {TOW_SERVICES.map((item) => {
          const selected = service === item.value
          return (
            <li key={item.value}>
              <button type="button" className={styles.toggle} aria-pressed={selected} onClick={() => onChange(selected ? '' : item.value)}>
                {item.label}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
