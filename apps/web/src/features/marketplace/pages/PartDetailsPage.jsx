import { useCallback, useState } from 'react'
import { Link, useParams } from 'react-router'
import Avatar from '../../../components/Avatar.jsx'
import Badge from '../../../components/Badge.jsx'
import Button from '../../../components/Button.jsx'
import Card from '../../../components/Card.jsx'
import EmptyState from '../../../components/EmptyState.jsx'
import Notice from '../../../components/Notice.jsx'
import { SkeletonRows } from '../../../components/Skeleton.jsx'
import StatusIndicator from '../../../components/StatusIndicator.jsx'
import TagBadges from '../../../components/TagBadges.jsx'
import { resolveTags } from '../../../context/TagsContext.js'
import { AskAboutPartButton } from '../../requests/components/RequestButtons.jsx'
import { RatingSummary } from '../../requests/components/Stars.jsx'
import { categoryPath, discountPercent, forVehicle, inCategory, placePart } from '../catalog.js'
import AddToCartButton from '../components/AddToCartButton.jsx'
import Breadcrumb from '../components/Breadcrumb.jsx'
import PartPhoto from '../components/PartPhoto.jsx'
import PartRow from '../components/PartRow.jsx'
import QuantityStepper from '../components/QuantityStepper.jsx'
import SavePartButton from '../components/SavePartButton.jsx'
import View3DButton from '../components/View3DButton.jsx'
import { CONDITIONS, LOW_STOCK_THRESHOLD, PART_TYPES } from '../constants.js'
import { fitsVehicle } from '../filters.js'
import { formatFitments, formatPrice, vehicleName } from '../format.js'
import { useMarketplaceQuery } from '../MarketplaceContext.js'
import { getShopCommerce } from '../shopCommerce.js'
import { useMarketplaceData } from '../useMarketplaceData.js'
import styles from './PartDetailsPage.module.css'

const conditionTone = { new: 'success', used: 'warning', refurbished: 'info' }

// /marketplace/part/:partId - one part in full: image, numbers, condition, price, stock, tags, what
// it fits (and whether it fits the selected car), the shop that sells it and how it delivers. The
// quantity selector feeds "Add to cart". "View on my 3D car" for parts the 3D preview supports.
// Then "Other parts from this shop" and "Similar parts" (same category, fitting the selected car).
export default function PartDetailsPage() {
  const { partId } = useParams()
  const loadPart = useCallback(
    async (service) => {
      const part = await service.getPartById(partId)
      return { part, shop: part ? await service.getShopById(part.shopId) : null }
    },
    [partId],
  )
  const { data, error } = useMarketplaceQuery(loadPart)
  const { parts, fitting, shopsById, tags, ratings, vehicle } = useMarketplaceData()
  const [quantity, setQuantity] = useState(1)

  if (error) return <EmptyState icon="⚠" title="Couldn't load this part" description="Please try again in a moment." />
  if (!data) return <SkeletonRows rows={5} label="Loading the part…" />

  const { part, shop } = data
  if (!part || !shop) {
    return (
      <EmptyState
        icon="🔧"
        headingLevel="h1"
        title="Part not found"
        description="This part isn't for sale any more, or its shop is no longer on MOTEXA."
        action={<Button to="/marketplace">Back to marketplace</Button>}
      />
    )
  }

  const placed = placePart(part)
  const conditionLabel = CONDITIONS.find((c) => c.value === part.condition)?.label
  const typeLabel = PART_TYPES.find((t) => t.value === part.type)?.label
  const commerce = getShopCommerce(shop)
  const outOfStock = part.stock === 0
  const chosen = Math.min(quantity, Math.max(part.stock, 1))
  const discount = discountPercent(part)
  const fits = vehicle?.make ? fitsVehicle(part, vehicle) : null
  const fromShop = forVehicle(parts, vehicle).filter((p) => p.shopId === shop.id && p.id !== part.id)
  const similar = placed ? inCategory(fitting, placed.category).filter((p) => p.id !== part.id) : []

  return (
    <div className={styles.page}>
      <Breadcrumb
        items={[
          { label: 'Marketplace', to: '/marketplace' },
          ...(placed
            ? [
                { label: placed.group.name, to: `/marketplace/${placed.group.slug}` },
                { label: placed.category.name, to: categoryPath(placed.group, placed.category) },
              ]
            : []),
          { label: part.name },
        ]}
      />

      <div className={styles.layout}>
        <PartPhoto part={part} size="large">
          {discount > 0 && <span className={styles.discount}>−{discount}%</span>}
          {part.stock === 0 && <span className={styles.soldOut}>Out of stock</span>}
        </PartPhoto>

        <div className={styles.info}>
          <div className={styles.badges}>
            <StatusIndicator label={conditionLabel} tone={conditionTone[part.condition]} />
            <Badge>{typeLabel}</Badge>
            {fits === true && <Badge tone="success">✓ Fits your {vehicleName(vehicle)}</Badge>}
            {fits === false && <Badge tone="danger">Doesn&apos;t fit your {vehicleName(vehicle)}</Badge>}
          </div>
          <h1 className={styles.title}>{part.name}</h1>
          <TagBadges tags={resolveTags(part.tagIds, tags)} />
          <p className={styles.brand}>
            Brand: <strong>{part.brand}</strong>
          </p>

          <dl className={styles.numbers}>
            <div>
              <dt>OEM number</dt>
              <dd>{part.oemNumber || '—'}</dd>
            </div>
            <div>
              <dt>Manufacturer number</dt>
              <dd>{part.manufacturerNumber || '—'}</dd>
            </div>
            <div>
              <dt>Condition</dt>
              <dd className={styles.plain}>{conditionLabel}</dd>
            </div>
          </dl>

          {fits === false && (
            <Notice tone="warning" title={`This part doesn't fit your ${vehicleName(vehicle)}`}>
              Check the list of compatible vehicles below before you order.
            </Notice>
          )}

          <Card className={styles.buy} elevated>
            <p className={styles.price}>
              {formatPrice(part.priceIls)}
              {discount > 0 && (
                <s className={styles.oldPrice}>
                  <span className={styles.srOnly}>was </span>
                  {formatPrice(part.compareAtPriceIls)}
                </s>
              )}
            </p>
            <p className={outOfStock ? styles.outOfStock : part.stock <= LOW_STOCK_THRESHOLD ? styles.lowStock : styles.inStock}>
              {outOfStock ? 'Out of stock' : part.stock <= LOW_STOCK_THRESHOLD ? `Only ${part.stock} left` : `In stock (${part.stock})`}
            </p>

            {commerce.selling && !outOfStock && (
              <div className={styles.quantity}>
                <span className={styles.quantityLabel}>Quantity</span>
                <QuantityStepper value={chosen} max={part.stock} onChange={setQuantity} name={part.name} />
                <span className={styles.total}>Total {formatPrice(part.priceIls * chosen)}</span>
              </div>
            )}

            {commerce.selling ? (
              <div className={styles.actions}>
                <AddToCartButton part={part} quantity={chosen} size="lg" />
                <SavePartButton part={part} size="lg" />
              </div>
            ) : (
              <Notice tone="info" title="Not available to order online">
                {shop.name} isn&apos;t taking online orders right now. Ask the shop about this part and they&apos;ll get back to you.
              </Notice>
            )}
            <div className={styles.secondaryActions}>
              <AskAboutPartButton part={part} shop={shop} />
              <View3DButton part={part} />
            </div>
          </Card>
        </div>
      </div>

      <section className={styles.section} aria-labelledby="fits-title">
        <h2 id="fits-title" className={styles.sectionTitle}>
          Fits these vehicles
        </h2>
        {part.universalFit ? (
          <p>All cars.</p>
        ) : (
          <ul className={styles.fits}>
            {formatFitments(part.fitments)
              .split('; ')
              .map((line) => (
                <li key={line}>{line}</li>
              ))}
          </ul>
        )}
      </section>

      <section className={styles.section} aria-labelledby="shop-title">
        <h2 id="shop-title" className={styles.sectionTitle}>
          Sold by
        </h2>
        <Card className={styles.shop}>
          <div className={styles.shopIdentity}>
            <Avatar file={shop.logo} name={shop.name} size="lg" />
            <div>
              <p className={styles.shopName}>
                <Link to={`/shops/${shop.id}`}>{shop.name}</Link>
              </p>
              <p className={styles.muted}>{shop.city}</p>
              <RatingSummary summary={ratings[shop.id]} />
            </div>
          </div>
          <ul className={styles.shopTerms}>
            <li>
              <strong>Delivery:</strong>{' '}
              {commerce.delivery
                ? `${commerce.delivery.cities.join(', ')} · ${formatPrice(commerce.delivery.feeIls)}${
                    commerce.delivery.freeAboveIls != null ? `, free above ${formatPrice(commerce.delivery.freeAboveIls)}` : ''
                  }${commerce.delivery.estimatedTime ? ` · ${commerce.delivery.estimatedTime}` : ''}`
                : 'Not offered'}
            </li>
            <li>
              <strong>Pickup:</strong> {commerce.pickup ? commerce.pickup.hours : 'Not offered'}
            </li>
            <li>
              <strong>Payment:</strong>{' '}
              {commerce.payments.length ? commerce.payments.map((method) => (method === 'card' ? 'Card' : 'Cash')).join(' or ') : 'None yet'}
            </li>
          </ul>
          <Button to={`/shops/${shop.id}`} variant="secondary" size="sm">
            Visit the shop
          </Button>
        </Card>
      </section>

      <PartRow title="Other parts from this shop" parts={fromShop} shopsById={shopsById} tags={tags} viewAllTo={`/shops/${shop.id}`} />
      <PartRow
        title="Similar parts"
        parts={similar}
        shopsById={shopsById}
        tags={tags}
        viewAllTo={placed ? categoryPath(placed.group, placed.category) : undefined}
      />
    </div>
  )
}
