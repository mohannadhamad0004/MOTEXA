import { Link } from 'react-router'
import Button from '../../../components/Button.jsx'
import EmptyState from '../../../components/EmptyState.jsx'
import Notice from '../../../components/Notice.jsx'
import Select from '../../../components/Select.jsx'
import { SkeletonCards } from '../../../components/Skeleton.jsx'
import ServiceFilter from '../components/ServiceFilter.jsx'
import TowCompanyRow from '../components/TowCompanyRow.jsx'
import TowSearch from '../components/TowSearch.jsx'
import { TOW_SORTS } from '../constants.js'
import { useTowSearch } from '../useTowSearch.js'
import styles from './TowCompaniesDirectory.module.css'

const scrollToResults = () => document.getElementById('results')?.scrollIntoView({ behavior: 'smooth', block: 'start' })

const TIPS = [
  'Turn on your hazard lights.',
  'Stay off the road: wait behind the barrier or well away from traffic.',
  'Keep your phone charged, and keep it with you.',
]

// /tow-companies - find a tow company. One page, one job: search (by city, company name or the browser's
// location), and one directory of verified companies with a service filter and sort. The map is its own
// page (/tow-companies/map) and gets the same search through the URL. City, name, service and sort are
// in the URL (?city=Nablus&q=rescue&service=local&sort=rating). "Need a tow now?" keeps only companies
// with a truck free right now. The customer's position is never stored: it stays in this page's state,
// and only goes into a tow request the customer confirms.
export default function TowCompaniesDirectory() {
  const search = useTowSearch()
  const { data, error, results, ratings, service, sort, origin, geo, emergency } = search

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <div className={styles.intro}>
          <p className={styles.kicker}>Towing</p>
          <h1 className={styles.title}>
            Roadside help when your car <span className={styles.nowrap}>cannot make the trip.</span>
          </h1>
          <p className={styles.lead}>Find a verified tow company that covers your area. Every company is checked by MOTEXA.</p>
        </div>

        <section className={styles.search} aria-label="Search tow companies">
          <TowSearch search={search} idPrefix="tow-by" onSearched={scrollToResults} />
        </section>

        <nav className={styles.desk} aria-label="Quick actions">
          <Link to={`/tow-companies/map${search.search}`} className={styles.deskRow}>
            <span className={styles.deskTag}>Map</span>
            <span className={styles.deskText}>View towing on map</span>
            <span aria-hidden="true">→</span>
          </Link>
          <button type="button" className={styles.deskRow} onClick={() => search.locate(true)} disabled={geo.status === 'locating'}>
            <span className={styles.deskTag}>Now</span>
            <span className={styles.deskText}>
              Need a tow now? Use my location
              <span className={styles.deskNote}>Shows companies with a truck free right now, nearest first.</span>
            </span>
            <span aria-hidden="true">→</span>
          </button>
        </nav>
      </header>

      {error ? (
        <EmptyState icon="⚠" title="Couldn't load tow companies" description="Please try again in a moment." />
      ) : !data ? (
        <SkeletonCards label="Loading tow companies…" />
      ) : (
        <>
          <section id="results" className={styles.block} aria-labelledby="tow-results">
            <div className={styles.resultsHead}>
              <h2 id="tow-results" className={styles.sectionTitle}>
                Available tow companies
              </h2>
              <p className={styles.count} aria-live="polite">
                <strong>{results.length}</strong> {results.length === 1 ? 'company' : 'companies'}
                <span className={styles.summary}> · {search.summary}</span>
              </p>
            </div>

            <div className={styles.toolbar}>
              <ServiceFilter service={service} onChange={(value) => search.setParam('service', value)} />
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

            {emergency && (
              <Notice tone="info">
                Showing only companies with a truck free right now.{' '}
                <Button variant="ghost" size="sm" onClick={() => search.setEmergency(false)}>
                  Show all nearby companies
                </Button>
              </Notice>
            )}

            {results.length === 0 ? (
              <EmptyState
                icon="🚚"
                title="No tow companies cover this area yet"
                description={search.nearbyCities.length > 0 ? 'Try a nearby city, or remove a filter.' : 'Try a different city or remove a filter.'}
                action={
                  search.nearbyCities.length > 0 && (
                    <div className={styles.suggestions}>
                      {search.nearbyCities.map((city) => (
                        <Button key={city.name} variant="secondary" onClick={() => search.pickCity(city.name)}>
                          Try {city.name}
                        </Button>
                      ))}
                    </div>
                  )
                }
              />
            ) : (
              <ul className={styles.list}>
                {results.map(({ item, distanceKm }) => (
                  <li key={item.id}>
                    <TowCompanyRow company={item} rating={ratings[item.id]} distanceKm={distanceKm} pickupPosition={geo.position} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          {search.byCity.length > 0 && (
            <section className={styles.block} aria-labelledby="tow-cities">
              <h2 id="tow-cities" className={styles.kickerTitle}>
                Tow companies by city
              </h2>
              <ul className={styles.cities}>
                {search.byCity.map(({ city, count }) => (
                  <li key={city.name}>
                    <Link
                      to={`/tow-companies?city=${encodeURIComponent(city.name)}`}
                      className={styles.city}
                      onClick={() => {
                        search.changeMode('city')
                        scrollToResults()
                      }}
                    >
                      <span className={styles.cityName}>{city.name}</span>
                      <span className={styles.cityCount}>
                        {count} {count === 1 ? 'company' : 'companies'}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <aside className={styles.block} aria-labelledby="tow-wait">
            <h2 id="tow-wait" className={styles.kickerTitle}>
              While you wait
            </h2>
            <ul className={styles.tips}>
              {TIPS.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
          </aside>
        </>
      )}
    </div>
  )
}
