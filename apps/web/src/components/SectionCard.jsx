import { useId } from 'react'
import styles from './SectionCard.module.css'

/**
 * A titled section in a card, for settings and profile pages: heading, optional description and
 * header action, then the content. The section is labelled by its heading.
 * @param {Object} props
 * @param {React.ReactNode} props.title
 * @param {React.ReactNode} [props.description]
 * @param {React.ReactNode} [props.action]   e.g. a link or button on the right of the heading
 * @param {'h2' | 'h3'} [props.headingLevel]
 */
export default function SectionCard({ title, description, action, headingLevel = 'h2', className = '', children }) {
  const titleId = useId()
  const Heading = headingLevel
  return (
    <section className={`${styles.card} ${className}`.trim()} aria-labelledby={titleId}>
      <div className={styles.header}>
        <div className={styles.headings}>
          <Heading id={titleId} className={styles.title}>
            {title}
          </Heading>
          {description && <p className={styles.description}>{description}</p>}
        </div>
        {action && <div className={styles.action}>{action}</div>}
      </div>
      <div className={styles.body}>{children}</div>
    </section>
  )
}
