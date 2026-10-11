import { Link } from 'react-router'
import Card from '../../../components/Card.jsx'
import { discountPercent, isOnOffer, partPath } from '../catalog.js'
import { LOW_STOCK_THRESHOLD } from '../constants.js'
import { formatPrice } from '../format.js'
import PartPhoto from './PartPhoto.jsx'
import styles from './PartMiniCard.module.css'

// An image-led part card for the catalog sections: the photo first, then name, brand and shop, price
// (with the old price and the discount when on offer) and low stock. The whole card links to the part
// page. `featured` is the large version used for the first part of "Most popular".
export default function PartMiniCard({ part, shop, tags, featured = false }) {
  const discount = discountPercent(part)
  const offer = isOnOffer(part, tags)
  return (
    <Card as="article" interactive padding="none" className={`${styles.card} ${featured ? styles.featured : ''}`}>
      <PartPhoto part={part} className={styles.photo}>
        {offer && <span className={styles.offer}>{discount > 0 ? `−${discount}%` : 'Offer'}</span>}
        {part.stock === 0 && <span className={styles.soldOut}>Out of stock</span>}
      </PartPhoto>
      <div className={styles.body}>
        <h3 className={styles.name}>
          <Link to={partPath(part)} className={`${styles.link} ${Card.cover}`}>
            {part.name}
          </Link>
        </h3>
        <p className={styles.meta}>
          {part.brand}
          {shop && ` · ${shop.name}`}
        </p>
        <p className={styles.priceRow}>
          <span className={styles.price}>{formatPrice(part.priceIls)}</span>
          {discount > 0 && (
            <s className={styles.oldPrice}>
              <span className={styles.srOnly}>was </span>
              {formatPrice(part.compareAtPriceIls)}
            </s>
          )}
        </p>
        {part.stock === 0 ? (
          <p className={styles.out}>Out of stock</p>
        ) : (
          part.stock <= LOW_STOCK_THRESHOLD && <p className={styles.low}>Only {part.stock} left</p>
        )}
      </div>
    </Card>
  )
}
