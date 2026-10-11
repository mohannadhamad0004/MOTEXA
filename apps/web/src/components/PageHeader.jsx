import styles from './PageHeader.module.css'

// Page title, one-line description and the page's main action(s) on the right.
export default function PageHeader({ title, description, actions }) {
  return (
    <header className={styles.header}>
      <div className={styles.text}>
        <h1 className={styles.title}>{title}</h1>
        {description && <p className={styles.description}>{description}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  )
}