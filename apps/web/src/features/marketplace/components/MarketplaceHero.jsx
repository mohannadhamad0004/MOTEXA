import { useState } from 'react'
import { useNavigate } from 'react-router'
import Button from '../../../components/Button.jsx'
import { useCart } from '../CartContext.js'
import { useVehicleDrawer } from '../VehicleDrawerContext.js'
import CatalogIcon from './CatalogIcon.jsx'
import styles from './MarketplaceHero.module.css'

// The top of /marketplace: kicker, display headline and one large search (part name, part number, OEM
// or manufacturer number) on the left; "My Garage" on the right, the selected vehicle that every list
// is checked against.
export default function MarketplaceHero() {
  const navigate = useNavigate()
  const openVehicleDrawer = useVehicleDrawer()
  const { vehicle, service } = useCart()
  const [query, setQuery] = useState('')

  function handleSubmit(event) {
    event.preventDefault()
    const q = query.trim()
    navigate(q ? `/marketplace/search?q=${encodeURIComponent(q)}` : '/marketplace/search')
  }

  return (
    <section className={styles.hero} aria-labelledby="marketplace-title">
      <div className={styles.intro}>
        <p className={styles.kicker}>Marketplace</p>
        <h1 id="marketplace-title" className={styles.title}>
          Find the right part for <span className={styles.accent}>your car</span>
        </h1>
        <p className={styles.subtitle}>Parts from every shop on MOTEXA, checked against your car.</p>

        <form className={styles.search} role="search" onSubmit={handleSubmit}>
          <label htmlFor="hero-search" className={styles.label}>
            Search by part name, part number, OEM or manufacturer number
          </label>
          <div className={styles.searchRow}>
            <input
              id="hero-search"
              type="search"
              className={styles.searchInput}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="e.g. 1K0615301AA or brake pads"
              autoComplete="off"
            />
            <Button type="submit" size="lg" className={styles.searchButton}>
              Search
            </Button>
          </div>
        </form>
      </div>

      <aside className={`${styles.garage} ${vehicle ? styles.selected : ''}`} aria-labelledby="garage-title">
        <h2 id="garage-title" className={styles.garageTitle}>
          <CatalogIcon name="car" size={20} /> My Garage
        </h2>
        {vehicle ? (
          <>
            <p className={styles.vehicleName}>
              {[vehicle.make, vehicle.model].filter(Boolean).join(' ')}
              {vehicle.year && <span className={styles.vehicleYear}>{vehicle.year}</span>}
            </p>
            <p className={styles.status}>
              <span className={styles.dot} aria-hidden="true" />
              Showing parts compatible with your vehicle.
            </p>
            <div className={styles.garageActions}>
              <Button variant="ghost" onClick={() => openVehicleDrawer?.()}>
                Change vehicle →
              </Button>
              <Button variant="ghost" onClick={() => service.setVehicle(null)}>
                Clear
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className={styles.empty}>Choose your make and model and we only show parts that fit.</p>
            <Button variant="secondary" onClick={() => openVehicleDrawer?.()}>
              Select your car
            </Button>
          </>
        )}
      </aside>
    </section>
  )
}
