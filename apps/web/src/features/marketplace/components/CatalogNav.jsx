import { useState } from 'react'
import { Link } from 'react-router'
import Tabs, { TabPanel } from '../../../components/Tabs.jsx'
import { categoryPath, GROUPS, inCategory } from '../catalog.js'
import CatalogIcon from './CatalogIcon.jsx'
import styles from './CatalogNav.module.css'

const TABS_ID = 'marketplace-groups'

// "Shop by category": the main groups as a horizontal tab bar (active group marked), and under it that
// group's categories laid out like a catalogue index: the group on the left (photo, description, link to
// its page), the categories on the right as ruled entries with a photo, name and part count.
// `fitting` is the parts that fit the selected vehicle, so the counts match what the category shows.
export default function CatalogNav({ value, onChange, fitting }) {
  const group = GROUPS.find((g) => g.slug === value)

  return (
    <section aria-labelledby="categories-title" className={styles.nav}>
      <h2 id="categories-title" className={styles.kicker}>
        Shop by category
      </h2>
      <div className={styles.bar}>
        <Tabs
          tabs={GROUPS.map((g) => ({ value: g.slug, label: g.name }))}
          value={value}
          onChange={onChange}
          idPrefix={TABS_ID}
          label="Main groups"
        />
      </div>
      <TabPanel idPrefix={TABS_ID} value={value} className={styles.panel}>
        <div className={styles.group}>
          <Thumb image={group.image} icon={group.icon} className={styles.groupPhoto} size={64} />
          <h3 className={styles.groupName}>{group.name}</h3>
          <p className={styles.groupText}>{group.description}</p>
          <Link to={`/marketplace/${group.slug}`} className={styles.groupLink}>
            Browse all {group.name} →
          </Link>
        </div>
        <ul className={styles.categories} aria-label={`${group.name} categories`}>
          {group.categories.map((category) => (
            <li key={category.slug}>
              <Link to={categoryPath(group, category)} className={styles.category}>
                <Thumb image={category.image} icon={category.icon} className={styles.thumb} size={28} />
                <span className={styles.categoryName}>{category.name}</span>
                <span className={styles.count}>{inCategory(fitting, category).length}</span>
              </Link>
            </li>
          ))}
        </ul>
      </TabPanel>
    </section>
  )
}

// A photo that falls back to the category icon when it has none or fails to load. Decorative: the name
// beside it is the label.
function Thumb({ image, icon, className, size }) {
  const [failed, setFailed] = useState(false)
  if (image && !failed) {
    return <img className={className} src={image} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />
  }
  return (
    <span className={`${className} ${styles.iconBox}`}>
      <CatalogIcon name={icon} size={size} />
    </span>
  )
}
