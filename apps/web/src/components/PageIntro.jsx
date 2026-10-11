import styles from './PageIntro.module.css'

// The opening of an important page, on a 12-column grid: eyebrow + title + description (8 columns),
// the page's summary or main action (4 columns), and a hairline underneath.
export default function PageIntro({ eyebrow, aside, title, description, actions }) {
  return (
    <header className={styles.intro}>
      <p className={styles.eyebrow}>{eyebrow}</p>
      {aside && <p className={styles.aside}>{aside}</p>}
      <div className={styles.text}>
        <h1 className={styles.title}>{title}</h1>
        {description && <p className={styles.description}>{description}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  )
}
