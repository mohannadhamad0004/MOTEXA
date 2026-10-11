import { useId } from 'react'
import { Link } from 'react-router'
import ScrollRow from '../../../components/ScrollRow.jsx'
import PartMiniCard from './PartMiniCard.jsx'
import styles from './PartRow.module.css'

const MAX_IN_ROW = 12
const MAX_IN_FEATURE = 9
const MAX_IN_RAIL = 8

/**
 * A product section. Renders nothing without parts. Three compositions of the same cards:
 *  - 'row' (default): a titled row that scrolls sideways, up to 12 parts
 *  - 'feature': a grid where the first part is large (two columns, two rows), up to 9 parts
 *  - 'rail': the title and "View all" on a left rail, a plain grid on the right, up to 8 parts
 */
export default function PartRow({ title, parts, shopsById, tags, viewAllTo, layout = 'row' }) {
  const titleId = useId()
  if (parts.length === 0) return null
  const card = (part, featured = false) => (
    <li key={part.id} className={featured ? styles.featuredItem : undefined}>
      <PartMiniCard part={part} shop={shopsById[part.shopId]} tags={tags} featured={featured} />
    </li>
  )

  if (layout === 'row') {
    return (
      <ScrollRow title={title} viewAllTo={viewAllTo} editorial>
        {parts.slice(0, MAX_IN_ROW).map((part) => card(part))}
      </ScrollRow>
    )
  }

  const viewAll = viewAllTo && (
    <Link to={viewAllTo} className={styles.viewAll}>
      View all
      <span className={styles.srOnly}>: {title}</span>
    </Link>
  )

  if (layout === 'feature') {
    return (
      <section className={styles.section} aria-labelledby={titleId}>
        <div className={styles.header}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          {viewAll}
        </div>
        <ul className={styles.feature}>{parts.slice(0, MAX_IN_FEATURE).map((part, i) => card(part, i === 0))}</ul>
      </section>
    )
  }

  return (
    <section className={`${styles.section} ${styles.railed}`} aria-labelledby={titleId}>
      <div className={styles.rail}>
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        {viewAll}
      </div>
      <ul className={styles.railGrid}>{parts.slice(0, MAX_IN_RAIL).map((part) => card(part))}</ul>
    </section>
  )
}
