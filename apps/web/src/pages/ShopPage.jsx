import { useCallback } from 'react'
import { useParams } from 'react-router'
import Avatar from '../components/Avatar.jsx'
import Button from '../components/Button.jsx'
import EmptyState from '../components/EmptyState.jsx'
import PhotoGallery from '../components/PhotoGallery.jsx'
import { SkeletonRows } from '../components/Skeleton.jsx'
import PartCard from '../features/marketplace/components/PartCard.jsx'
import PartBuyActions from '../features/marketplace/components/PartBuyActions.jsx'
import PartOwnerActions from '../features/marketplace/components/PartOwnerActions.jsx'
import { useMarketplaceQuery } from '../features/marketplace/MarketplaceContext.js'
import AddToPreviewButton from '../features/preview3d/components/AddToPreviewButton.jsx'
import { AskAboutPartButton } from '../features/requests/components/RequestButtons.jsx'
import ReviewList from '../features/requests/components/ReviewList.jsx'
import { RatingSummary } from '../features/requests/components/Stars.jsx'
import { useRatingSummaries } from '../features/requests/ReviewsContext.js'
import styles from './ShopPage.module.css'

// Public page for one parts shop: logo, name, city, address, description, photos (all from the
// shop's account, edited on /profile) and its own parts.
export default function ShopPage() {
  const { shopId } = useParams()
  const loadShop = useCallback(
    async (service) => {
      const [shop, parts] = await Promise.all([service.getShopById(shopId), service.getPartsByShop(shopId)])
      return { shop, parts }
    },
    [shopId],
  )
  const { data, error } = useMarketplaceQuery(loadShop)
  const ratings = useRatingSummaries()

  if (error) return <EmptyState icon="⚠" title="Couldn't load this shop" description="Please try again in a moment." />
  if (!data) return <SkeletonRows rows={4} label="Loading…" />

  const { shop, parts: shopParts } = data

  if (!shop) {
    return (
      <EmptyState
        icon="🏪"
        headingLevel="h1"
        title="Shop not found"
        description="This shop doesn't exist or is no longer on MOTEXA."
        action={<Button to="/marketplace">Back to marketplace</Button>}
      />
    )
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Button to="/marketplace" variant="ghost" size="sm">
          ← Marketplace
        </Button>
        <div className={styles.identity}>
          <Avatar file={shop.logo} name={shop.name} size="lg" />
          <div>
            <h1 className={styles.title}>{shop.name}</h1>
            <p className={styles.city}>
              {shop.city}
              {shop.address && ` · ${shop.address}`}
            </p>
            <RatingSummary summary={ratings[shop.id]} />
          </div>
        </div>
        <p className={styles.description}>{shop.description}</p>
      </header>

      {shop.photos?.length > 0 && (
        <section className={styles.section} aria-labelledby="shop-photos-title">
          <h2 id="shop-photos-title" className={styles.sectionTitle}>
            Shop photos
          </h2>
          <PhotoGallery files={shop.photos} label={`${shop.name} photos`} />
        </section>
      )}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          {shopParts.length} {shopParts.length === 1 ? 'part' : 'parts'} from this shop
        </h2>
        <ul className={styles.grid}>
          {shopParts.map((part) => (
            <li key={part.id}>
              <PartCard
                part={part}
                shop={shop}
                showShop={false}
                footer={
                  <>
                    <PartBuyActions part={part} shop={shop} />
                    <PartOwnerActions part={part} />
                    <AddToPreviewButton part={part} />
                    <AskAboutPartButton part={part} shop={shop} />
                  </>
                }
              />
            </li>
          ))}
        </ul>
      </section>

      <ReviewList targetId={shop.id} />
    </div>
  )
}
