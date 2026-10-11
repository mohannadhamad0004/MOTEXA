import { useState } from 'react'
import { Link } from 'react-router'
import Button from '../../../components/Button.jsx'
import EmptyState from '../../../components/EmptyState.jsx'
import Notice from '../../../components/Notice.jsx'
import Select from '../../../components/Select.jsx'
import { SkeletonCards } from '../../../components/Skeleton.jsx'
import { useMediaQuery } from '../../../hooks/useMediaQuery.js'
import ExplorerShell from '../components/ExplorerShell.jsx'
import styles from '../components/ExplorerShell.module.css'
import PickupContext from '../components/PickupContext.jsx'
import ResultsMap from '../components/ResultsMap.jsx'
import ServiceFilter from '../components/ServiceFilter.jsx'
import { TowCompanyRowCompact } from '../components/TowCompanyRow.jsx'
import TowInspector from '../components/TowInspector.jsx'
import TowSearch from '../components/TowSearch.jsx'
import { TOW_SORTS } from '../constants.js'
import { useTowSearch } from '../useTowSearch.js'
import page from './TowCompaniesMap.module.css'

// /tow-companies/map - the towing map. A list rail on the left (back link, the pickup context, search,
// service filter, count, sort, the companies) and the map filling the rest. Choosing a company in the list,
// or its marker on the map, selects both and opens a compact inspector over the map. Phones show one at a
// time: List | Map. It reads the same search from the URL as /tow-companies, so the search carries over
// both ways. The pickup itself is set in the "Request tow" form; the customer's shared position only
// pre-fills it. The workspace (rail, map, switch, inspector placement) is logistics/ExplorerShell.
export default function TowCompaniesMap() {
  const search = useTowSearch()
  const { data, error, results, ratings, service, sort, origin, geo, emergency } = search
  const [selectedId, setSelectedId] = useState(null)
  const [hoveredId, setHoveredId] = useState(null) // the row under the pointer or with focus: its marker lights up too
  const [view, setView] = useState('list') // phones only
  const isPhone = useMediaQuery('(max-width: 767px)')

  const selected = results.find(({ item }) => item.id === selectedId)

  function select(id) {
    setSelectedId(id)
    document.getElementById(`result-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

  const rail = (
    <>
      <div className={styles.top}>
        <Link to={`/tow-companies${search.search}`} className={styles.back}>
          ← Back to Tow Companies
        </Link>
        <p className={styles.kicker}>Map view</p>
        <h1 className={styles.title}>Towing on the map</h1>
        <PickupContext position={geo.position} locating={geo.status === 'locating'} onLocate={() => search.locate()} />
        <TowSearch search={search} compact idPrefix="map-by" />
        <details className={styles.filters}>
          <summary className={styles.filtersSummary}>Filters{(service || emergency) && ` (${Number(Boolean(service)) + Number(emergency)})`}</summary>
          <ServiceFilter service={service} onChange={(value) => search.setParam('service', value)} />
          <button type="button" className={page.nowButton} onClick={() => search.locate(true)} disabled={geo.status === 'locating'}>
            Need a tow now? Use my location →
          </button>
        </details>
        {emergency && (
          <Notice tone="info">
            Only companies with a truck free right now.{' '}
            <Button variant="ghost" size="sm" onClick={() => search.setEmergency(false)}>
              Show all
            </Button>
          </Notice>
        )}
        <div className={styles.bar}>
          <p className={styles.count} aria-live="polite">
            <strong>{results.length}</strong> {results.length === 1 ? 'company' : 'companies'}
          </p>
          <label className={styles.sort}>
            <span className={styles.sortLabel}>Sort</span>
            <Select size="sm" value={sort} onChange={(event) => search.setParam('sort', event.target.value)}>
              {sort === 'search' && <option value="search">Best match</option>}
              {TOW_SORTS.map((item) => (
                <option key={item.value} value={item.value} disabled={item.value === 'nearest' && !origin}>
                  {item.label}
                </option>
              ))}
            </Select>
          </label>
        </div>
      </div>

      <div className={styles.listArea}>
        {error ? (
          <EmptyState icon="⚠" title="Couldn't load tow companies" description="Please try again in a moment." />
        ) : !data ? (
          <SkeletonCards count={3} label="Loading tow companies…" />
        ) : results.length === 0 ? (
          <EmptyState
            icon="🚚"
            title="No tow companies cover this area yet"
            description={search.nearbyCities.length > 0 ? 'Try a nearby city, or remove a filter.' : 'Try a different city or remove a filter.'}
            action={
              search.nearbyCities.length > 0 && (
                <div className={page.suggestions}>
                  {search.nearbyCities.map((city) => (
                    <button key={city.name} type="button" className={styles.clear} onClick={() => search.pickCity(city.name)}>
                      Try {city.name}
                    </button>
                  ))}
                </div>
              )
            }
          />
        ) : (
          <ul className={styles.list}>
            {results.map(({ item, distanceKm }) => (
              <TowCompanyRowCompact
                key={item.id}
                company={item}
                rating={ratings[item.id]}
                distanceKm={distanceKm}
                selected={item.id === selectedId}
                onSelect={(id) => (id === selectedId ? setSelectedId(null) : select(id))}
                onPreview={setHoveredId}
              />
            ))}
          </ul>
        )}
      </div>
    </>
  )

  return (
    <ExplorerShell
      view={view}
      onViewChange={setView}
      hasSelection={Boolean(selected)}
      railLabel="Tow companies list"
      rail={rail}
      // key: a map made while hidden has no size, so it is rebuilt when "Map" shows it on a phone
      map={
        <ResultsMap
          key={view}
          origin={origin}
          isUserLocation={search.isUserLocation}
          results={results}
          selectedId={hoveredId ?? selectedId}
          onSelect={select}
          panToId={selectedId}
          pin="truck"
          getName={(item) => item.name}
        />
      }
      inspector={
        selected && (
          <TowInspector
            company={selected.item}
            rating={ratings[selected.item.id]}
            distanceKm={selected.distanceKm}
            pickupPosition={geo.position}
            compact={isPhone}
            onClose={() => setSelectedId(null)}
          />
        )
      }
    />
  )
}
