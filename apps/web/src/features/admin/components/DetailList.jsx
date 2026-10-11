import styles from './DetailList.module.css'

// Label / value pairs for a drawer. items: [{ label, value }]; empty values are skipped.
export default function DetailList({ items }) {
  return (
    <dl className={styles.list}>
      {items
        .filter((item) => item.value !== undefined && item.value !== null && item.value !== '' && item.value !== false)
        .map((item) => (
          <div key={item.label} className={styles.row}>
            <dt className={styles.label}>{item.label}</dt>
            <dd className={styles.value}>{item.value}</dd>
          </div>
        ))}
    </dl>
  )
}
