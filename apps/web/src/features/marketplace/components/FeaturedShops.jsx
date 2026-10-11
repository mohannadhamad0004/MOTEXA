import { Link } from 'react-router'
import Avatar from '../../../components/Avatar.jsx'
import { RatingSummary } from '../../requests/components/Stars.jsx'
import { compareRatings } from '../../requests/ratings.js'
import styles from './FeaturedShops.module.css'

// "Featured shops": a ruled directory, best rated first. Logo, name, city and rating; each entry links
// to the shop's page.
export default function FeaturedShops({ shops, ratings }) {
  if (shops.length === 0) return null
  const sorted = [...shops].sort((a, b) => compareRatings(ratings[a.id], ratings[b.id]))
  return (
    <section className={styles.section} aria-labelledby="featured-shops-title">
      <h2 id="featured-shops-title" className={styles.title}>
        Featured shops
      </h2>
      <ul className={styles.list}>
        {sorted.map((shop) => (
          <li key={shop.id} className={styles.shop}>
            <Avatar file={shop.logo} name={shop.name} size="lg" />
            <div className={styles.text}>
              <h3 className={styles.name}>
                <Link to={`/shops/${shop.id}`} className={styles.link}>
                  {shop.name}
                </Link>
              </h3>
              <p className={styles.city}>{shop.city}</p>
              <RatingSummary summary={ratings[shop.id]} compact />
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
