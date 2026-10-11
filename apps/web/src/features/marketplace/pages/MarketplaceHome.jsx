import { useState } from 'react'
import { Navigate, useSearchParams } from 'react-router'
import EmptyState from '../../../components/EmptyState.jsx'
import { SkeletonCards } from '../../../components/Skeleton.jsx'
import { GROUPS, mostPopular, offerBanners, onOffer, recentlyAdded, recentlyUpdated } from '../catalog.js'
import CatalogNav from '../components/CatalogNav.jsx'
import FeaturedShops from '../components/FeaturedShops.jsx'
import MarketplaceHero from '../components/MarketplaceHero.jsx'
import OfferCarousel from '../components/OfferCarousel.jsx'
import PartRow from '../components/PartRow.jsx'
import { vehicleName } from '../format.js'
import { useMarketplaceData } from '../useMarketplaceData.js'
import styles from './MarketplaceHome.module.css'

// /marketplace - hero (search by part name or number, My Garage), the category navigation (groups as
// tabs, that group's categories under them), offer banners, product sections and featured shops. With
// a vehicle chosen, "Parts that fit your car" comes first and every section only shows parts that fit it.
// Old links (/marketplace?q=...) go to the search page.
export default function MarketplaceHome() {
  const [searchParams] = useSearchParams()
  const { loading, error, fitting, shops, shopsById, vehicle, tags, ratings } = useMarketplaceData()
  const [tab, setTab] = useState(GROUPS[0].slug)

  if (searchParams.get('q')) return <Navigate to={`/marketplace/search?${searchParams}`} replace />

  const rowProps = { shopsById, tags }

  return (
    <div className={styles.page}>
      <MarketplaceHero />

      <CatalogNav value={tab} onChange={setTab} fitting={fitting} />

      {error ? (
        <EmptyState icon="⚠" title="Couldn't load parts" description="Please try again in a moment." />
      ) : loading ? (
        <SkeletonCards count={4} media label="Loading parts…" />
      ) : (
        <>
          {vehicle && (
            <PartRow
              title={`Parts that fit your ${vehicleName(vehicle)}`}
              parts={[...mostPopular(fitting), ...recentlyAdded(fitting).filter((p) => !p.salesCount)]}
              viewAllTo="/marketplace/search"
              {...rowProps}
            />
          )}

          <OfferCarousel banners={offerBanners(fitting, tags)} />

          <PartRow
            title="Most popular"
            parts={mostPopular(fitting)}
            viewAllTo="/marketplace/search?list=popular"
            layout="feature"
            {...rowProps}
          />
          <PartRow title="Recently added" parts={recentlyAdded(fitting)} viewAllTo="/marketplace/search?list=new" {...rowProps} />
          <PartRow
            title="On offer"
            parts={onOffer(fitting, tags)}
            viewAllTo="/marketplace/search?list=offers"
            layout="rail"
            {...rowProps}
          />
          <PartRow
            title="Recently updated"
            parts={recentlyUpdated(fitting)}
            viewAllTo="/marketplace/search?list=updated"
            {...rowProps}
          />

          <FeaturedShops shops={shops} ratings={ratings} />
        </>
      )}
    </div>
  )
}
