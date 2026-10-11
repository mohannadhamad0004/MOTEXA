import Badge from './Badge.jsx'
import styles from './StatusIndicator.module.css'

// A status as a colored dot and its text label (the text means color is never the only signal).
// tone: 'success' | 'warning' | 'danger' | 'info' | 'neutral'. `emphasis` shows the tinted pill
// instead, for the one status on a page that must stand out.
export default function StatusIndicator({ label, tone = 'neutral', emphasis = false }) {
  if (emphasis) return <Badge tone={tone} dot>{label}</Badge>
  return (
    <span className={`${styles.status} ${styles[tone]}`}>
      <span className={styles.dot} aria-hidden="true" />
      {label}
    </span>
  )
}
