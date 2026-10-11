import styles from './SectionHeader.module.css'

// A section heading on a thin rule: title, optional description, optional action on the right.
// Use it instead of wrapping a section in a card.
export default function SectionHeader({ id, title, description, action, level = 'h2' }) {
  const Heading = level
  return (
    <div className={styles.header}>
      <div className={styles.text}>
        <Heading id={id} className={styles.title}>
          {title}
        </Heading>
        {description && <p className={styles.description}>{description}</p>}
      </div>
      {action && <div className={styles.action}>{action}</div>}
    </div>
  )
}