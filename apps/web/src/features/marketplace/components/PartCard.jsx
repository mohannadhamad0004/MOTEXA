import { Link } from 'react-router'
import Badge from '../../../components/Badge.jsx'
import Card from '../../../components/Card.jsx'
import TagBadges from '../../../components/TagBadges.jsx'
import { resolveTags, useTags } from '../../../context/TagsContext.js'
import { CONDITIONS, LOW_STOCK_THRESHOLD, PART_TYPES } from '../constants.js'
import { discountPercent, OFFER_TAG_NAME, partPath } from '../catalog.js'
import { formatPartFit, formatPrice } from '../format.js'
import { RatingSummary } from '../../requests/components/Stars.jsx'
import Highlight from './Highlight.jsx'
import PartPhoto from './PartPhoto.jsx'
import styles from './PartCard.module.css'

function stockStatus(stock) {
  if (stock === 0) return { label: 'Out of stock', className: styles.outOfStock }
  if (stock <= LOW_STOCK_THRESHOLD) return { label: `Only ${stock} left`, className: styles.lowStock }
  return { label: `In stock (${stock})`, className: styles.inStock }
}

// `highlight` comes from the part search: the words to mark and which part numbers matched.
// `footer` holds actions composed by the page (owner Edit/Delete, "Ask about this part").
// `shopRating` ({ average, count }) is shown next to the shop name.
export default function PartCard({
  part,
  shop,
  exact = false,
  highlight = null,
  showShop = true,
  shopRating = null,
  footer = null,
}) {
  const tags = resolveTags(part.tagIds, useTags())
  const stock = stockStatus(part.stock)
  const discount = discountPercent(part)
  const onOffer = tags.some((tag) => tag.name === OFFER_TAG_NAME)
  const conditionLabel = CONDITIONS.find((c) => c.value === part.condition)?.label
  const typeLabel = PART_TYPES.find((t) => t.value === part.type)?.label
  const terms = highlight?.terms
  const numberClass = (field) => (highlight?.numberFields.includes(field) ? styles.numberMatch : undefined)

  return (
    <Card as="article" padding="none" className={`${styles.card} ${exact ? styles.exact : ''}`}>
      <PartPhoto part={part}>
        {(discount > 0 || onOffer) && <span className={styles.discount}>{discount > 0 ? `−${discount}%` : 'Offer'}</span>}
        {part.stock === 0 && <span className={styles.soldOut}>Out of stock</span>}
      </PartPhoto>

      <div className={styles.body}>
        {exact && (
          <Badge tone="accent" className={styles.exactLabel}>
            Exact part number match
          </Badge>
        )}

        <h3 className={styles.name}>
          <Link to={partPath(part)} className={styles.nameLink}>
            <Highlight text={part.name} terms={terms} />
          </Link>
        </h3>

        <p className={styles.meta}>
          <Highlight text={part.brand} terms={terms} /> · {typeLabel}
          {conditionLabel && ` · ${conditionLabel}`}
        </p>

        <p className={styles.fits}>
          <span aria-hidden="true">✓ </span>
          <span className={styles.fitsLabel}>Fits: </span>
          <Highlight text={formatPartFit(part)} terms={terms} />
        </p>

        {highlight?.numberFields.length > 0 && (
        <dl className={styles.numbers}>
          {part.oemNumber && (
            <div>
              <dt>OEM</dt>
              <dd className={numberClass('oemNumber')}>{part.oemNumber}</dd>
            </div>
          )}
          {part.manufacturerNumber && (
            <div>
              <dt>Mfr.</dt>
              <dd className={numberClass('manufacturerNumber')}>{part.manufacturerNumber}</dd>
            </div>
          )}
        </dl>
        )}

        <TagBadges tags={tags} />

        <div className={styles.priceRow}>
          <span className={styles.price}>
            {formatPrice(part.priceIls)}
            {discountPercent(part) > 0 && (
              <s className={styles.oldPrice}>
                <span className={styles.srOnly}>was </span>
                {formatPrice(part.compareAtPriceIls)}
              </s>
            )}
          </span>
          <span className={stock.className}>{stock.label}</span>
        </div>

        {showShop && shop && (
          <p className={styles.shop}>
            <Link to={`/shops/${shop.id}`}>{shop.name}</Link> · {shop.city}{' '}
            <RatingSummary summary={shopRating} compact />
          </p>
        )}

        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </Card>
  )
}
