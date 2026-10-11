import { useEffect, useMemo, useState } from 'react'
import Button from '../components/Button.jsx'
import EmptyState from '../components/EmptyState.jsx'
import SearchBar from '../components/SearchBar.jsx'
import Select from '../components/Select.jsx'
import { SkeletonCards } from '../components/Skeleton.jsx'
import { useCart } from '../features/marketplace/CartContext.js'
import CartLinks from '../features/marketplace/components/CartLinks.jsx'
import FilterChips from '../features/marketplace/components/FilterChips.jsx'
import FilterPanel from '../features/marketplace/components/FilterPanel.jsx'
import PartCard from '../features/marketplace/components/PartCard.jsx'
import PartBuyActions from '../features/marketplace/components/PartBuyActions.jsx'
import PartOwnerActions from '../features/marketplace/components/PartOwnerActions.jsx'
import { SORT_OPTIONS } from '../features/marketplace/constants.js'
import { applyFilters, getActiveFilterChips, getVehicleOptions } from '../features/marketplace/filters.js'
import { useMarketplaceQuery } from '../features/marketplace/MarketplaceContext.js'
import { useMarketplaceFilters } from '../features/marketplace/useMarketplaceFilters.js'
import { usePartSearch } from '../features/marketplace/usePartSearch.js'
import AddToPreviewButton from '../features/preview3d/components/AddToPreviewButton.jsx'
import Preview3DDrawer from '../features/preview3d/components/Preview3DDrawer.jsx'
import Preview3DLauncher from '../features/preview3d/components/Preview3DLauncher.jsx'
import { AskAboutPartButton } from '../features/requests/components/RequestButtons.jsx'
import { useRatingSummaries } from '../features/requests/ReviewsContext.js'
import styles from './Marketplace.module.css'

const loadMarketplace = async (service) => {
  const [parts, shops] = await Promise.all([service.getParts(), service.getShops()])
  return { parts, shops }
}

const NONE = []

export default function Marketplace() {
  const { filters, updateFilters, clearFilters } = useMarketplaceFilters()
  const [filtersOpen, setFiltersOpen] = useState(false)
  const { data, error } = useMarketplaceQuery(loadMarketplace)
  const ratings = useRatingSummaries()
  const { service: cart } = useCart()
  const parts = data?.parts ?? NONE
  const shops = data?.shops ?? NONE

  const shopsById = useMemo(() => Object.fromEntries(shops.map((shop) => [shop.id, shop])), [shops])
  const brands = useMemo(
    () => [...new Set(parts.map((part) => part.brand))].sort((a, b) => a.localeCompare(b)),
    [parts],
  )
  const vehicles = useMemo(() => getVehicleOptions(parts), [parts])
  // The text search runs on the server; filters and sorting are applied to its results here.
  const search = usePartSearch(filters.q)
  // The search response can be older than orders and shop edits made in this session, so stock and
  // prices on the cards come from the marketplace data (which also holds reserved units).
  const partsById = useMemo(() => new Map(parts.map((part) => [part.id, part])), [parts])
  const results = useMemo(
    () =>
      applyFilters(
        (search.data?.results ?? NONE).map((result) => ({ ...result, part: partsById.get(result.part.id) ?? result.part })),
        shopsById,
        filters,
      ),
    [search.data, partsById, shopsById, filters],
  )
  const suggestion = search.data?.suggestion
  // The vehicle picked in the filters is remembered, so the cart can warn about parts that don't fit it.
  useEffect(() => {
    if (filters.make) cart.setVehicle({ make: filters.make, model: filters.model, year: filters.year })
  }, [cart, filters.make, filters.model, filters.year])
  const chips = getActiveFilterChips(filters, shopsById)
  const filterCount = chips.filter((chip) => chip.key !== 'q').length

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <div>
            <h1 className={styles.title}>Parts marketplace</h1>
            <p className={styles.subtitle}>Search parts from every shop on MOTEXA.</p>
          </div>
          <CartLinks />
        </div>
        <SearchBar value={filters.q} onChange={(q) => updateFilters({ q })} />
      </header>

      <div className={styles.layout}>
        <aside
          id="marketplace-filters"
          className={`${styles.sidebar} ${filtersOpen ? styles.sidebarOpen : ''}`}
          aria-label="Filters"
        >
          <FilterPanel
            filters={filters}
            onChange={updateFilters}
            onClear={clearFilters}
            vehicles={vehicles}
            brands={brands}
            shops={shops}
          />
        </aside>

        <section className={styles.results} aria-live="polite">
          <div className={styles.toolbar}>
            <p className={styles.count}>
              {search.data && `${results.length} ${results.length === 1 ? 'part' : 'parts'} found`}
            </p>
            <div className={styles.toolbarActions}>
              <Button
                variant="secondary"
                size="sm"
                className={styles.filterToggle}
                aria-expanded={filtersOpen}
                aria-controls="marketplace-filters"
                onClick={() => setFiltersOpen((open) => !open)}
              >
                {filtersOpen ? 'Hide filters' : 'Filters'}
                {filterCount > 0 && ` (${filterCount})`}
              </Button>
              <label className={styles.sort}>
                <span>Sort by</span>
                <Select
                  size="sm"
                  value={filters.sort}
                  onChange={(event) => updateFilters({ sort: event.target.value })}
                >
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </label>
            </div>
          </div>

          <FilterChips chips={chips} onRemove={updateFilters} onClearAll={clearFilters} />

          {suggestion && (
            <p className={styles.suggestion}>
              Did you mean:{' '}
              <button
                type="button"
                className={styles.suggestionButton}
                onClick={() => updateFilters({ q: suggestion.query })}
              >
                {suggestion.label}
              </button>
              ?
            </p>
          )}

          {error || search.error ? (
            <EmptyState icon="⚠" title="Couldn't load parts" description="Please try again in a moment." />
          ) : !data || !search.data ? (
            <SkeletonCards count={6} media label="Loading parts…" />
          ) : results.length > 0 ? (
            <ul className={styles.grid}>
              {results.map(({ part, shop, exact, highlight }) => (
                <li key={part.id}>
                  <PartCard
                    part={part}
                    shop={shop}
                    shopRating={shop && ratings[shop.id]}
                    exact={exact}
                    highlight={highlight}
                    footer={
                      <>
                        <PartBuyActions part={part} shop={shopsById[part.shopId] ?? shop} />
                        <PartOwnerActions part={part} />
                        <AddToPreviewButton part={part} />
                        <AskAboutPartButton part={part} shop={shop} />
                      </>
                    }
                  />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon="🔍"
              title="No parts match your search"
              description="Try a different part number, remove a filter, or search all shops again."
              action={<Button onClick={clearFilters}>Clear all filters</Button>}
            />
          )}
        </section>
      </div>

      <Preview3DLauncher />
      <Preview3DDrawer vehicles={vehicles} />
    </div>
  )
}
