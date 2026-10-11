import { Link } from 'react-router'
import Button from '../../../components/Button.jsx'
import EmptyState from '../../../components/EmptyState.jsx'
import Select from '../../../components/Select.jsx'
import { SkeletonCards } from '../../../components/Skeleton.jsx'
import { vehicleName } from '../../marketplace/format.js'
import MechanicFilters from '../components/MechanicFilters.jsx'
import MechanicRow from '../components/MechanicRow.jsx'
import MechanicSearch from '../components/MechanicSearch.jsx'
import SkillIndex from '../components/SkillIndex.jsx'
import { knowsMake } from '../mechanicsSearch.js'
import { SORTS, useMechanicSearch } from '../useMechanicSearch.js'
import styles from './MechanicsDirectory.module.css'

const scrollToResults = () => document.getElementById('results')?.scrollIntoView({ behavior: 'smooth', block: 'start' })

// /mechanics - find a mechanic. One page, one job: search (by problem or skill, city or the browser's
// location), a skill index, and one directory of verified mechanics with sort and filters. The map is
// its own page (/mechanics/map) and gets the same search through the URL. Search, city, skill,
// service, make and sort are in the URL (?q=brakes&city=Nablus&skill=Brakes&mode=on_site&make=Toyota&sort=rating);
// the AI diagnosis links here with ?skill=. Only approved skills and accounts are public. The
// customer's position is never stored: it stays in this page's state.
// The old rows map onto what is here: "Top rated" is Sort: Rating, "Mobile mechanics" is Service type:
// On-site, "Near you" is Sort: Nearest with "My location", "Specialists for your car" is Car make.
export default function MechanicsDirectory() {
  const search = useMechanicSearch()
  const { data, error, results, ratings, skill, serviceMode, make, makes, sort, origin, vehicle, symptomSkills } = search

  // The garage car's make, when some mechanic specializes in it and it isn't chosen yet
  const garageMake = vehicle?.make && !make && makes.some((name) => knowsMake({ makes: [name] }, vehicle.make)) ? vehicle.make : ''

  return (
    <div className={styles.page}>
      <header className={styles.intro}>
        <p className={styles.kicker}>Mechanics</p>
        <h1 className={styles.title}>
          Find the right specialist <span className={styles.nowrap}>for your car.</span>
        </h1>
        <p className={styles.lead}>Search verified mechanics by problem, skill, city or your location. Every mechanic is checked by MOTEXA.</p>
      </header>

      <section className={styles.searchSection} aria-label="Search mechanics">
        <MechanicSearch search={search} idPrefix="mechanic-by" onSearched={scrollToResults} />
        <p className={styles.links}>
          <Link to={`/mechanics/map${search.search}`} className={styles.mapLink}>
            View mechanics on map →
          </Link>
          <span className={styles.ai}>
            Not sure what&apos;s wrong? <Link to="/diagnose">Diagnose my car with AI</Link>
          </span>
        </p>
      </section>

      {error ? (
        <EmptyState icon="⚠" title="Couldn't load mechanics" description="Please try again in a moment." />
      ) : !data ? (
        <SkeletonCards label="Loading mechanics…" />
      ) : (
        <>
          <section className={styles.block} aria-labelledby="mechanic-skills">
            <h2 id="mechanic-skills" className={styles.kickerTitle}>
              Browse by skill
            </h2>
            <SkillIndex
              counts={search.counts}
              skill={skill}
              onPick={(name) => {
                search.setParam('skill', skill === name ? '' : name)
                if (skill !== name) scrollToResults()
              }}
            />
          </section>

          <section id="results" className={styles.block} aria-labelledby="mechanic-results">
            <div className={styles.resultsHead}>
              <h2 id="mechanic-results" className={styles.sectionTitle}>
                Available mechanics
              </h2>
              <p className={styles.count} aria-live="polite">
                <strong>{results.length}</strong> {results.length === 1 ? 'result' : 'results'}
                <span className={styles.summary}> · {search.summary}</span>
              </p>
            </div>

            <div className={styles.toolbar}>
              <MechanicFilters
                skill={skill}
                serviceMode={serviceMode}
                make={make}
                makes={makes}
                onChange={(key, value) => search.setParam(key, value)}
                onClear={() => {
                  search.setParam('skill', '')
                  search.setParam('mode', '')
                  search.setParam('make', '')
                }}
              />
              <label className={styles.sort}>
                <span className={styles.sortLabel}>Sort</span>
                <Select size="sm" value={sort} onChange={(event) => search.setParam('sort', event.target.value)}>
                  {SORTS.map((item) => (
                    <option key={item.value} value={item.value} disabled={item.value === 'nearest' && !origin}>
                      {item.label}
                    </option>
                  ))}
                </Select>
              </label>
            </div>

            {garageMake && (
              <p className={styles.garage}>
                <button type="button" className={styles.textButton} onClick={() => search.setParam('make', garageMake)}>
                  Show specialists for your {vehicleName(vehicle)} →
                </button>
              </p>
            )}

            {results.length === 0 ? (
              <EmptyState
                icon="🔧"
                title="No mechanics match your search"
                description={search.nearbyCities.length > 0 ? 'Try a nearby city, or remove a filter.' : 'Try a different city or remove a filter.'}
                action={
                  <div className={styles.suggestions}>
                    {search.nearbyCities.map((city) => (
                      <Button key={city.name} variant="secondary" onClick={() => search.pickCity(city.name)}>
                        Try {city.name}
                      </Button>
                    ))}
                    <Button variant="secondary" onClick={search.clearSearch}>
                      Show all mechanics
                    </Button>
                  </div>
                }
              />
            ) : (
              <ul className={styles.list}>
                {results.map(({ item, distanceKm }) => (
                  <li key={item.id}>
                    <MechanicRow
                      mechanic={item}
                      rating={ratings[item.id]}
                      distanceKm={distanceKm}
                      highlightSkill={skill || symptomSkills[0] || ''}
                      highlightMode={serviceMode}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>

          {search.byCity.length > 0 && (
            <section className={styles.block} aria-labelledby="mechanic-cities">
              <h2 id="mechanic-cities" className={styles.kickerTitle}>
                Mechanics by city
              </h2>
              <ul className={styles.cities}>
                {search.byCity.map(({ city, count }) => (
                  <li key={city.name}>
                    <Link
                      to={`/mechanics?city=${encodeURIComponent(city.name)}`}
                      className={styles.city}
                      onClick={() => {
                        search.changeMode('city')
                        scrollToResults()
                      }}
                    >
                      <span className={styles.cityName}>{city.name}</span>
                      <span className={styles.cityCount}>
                        {count} {count === 1 ? 'mechanic' : 'mechanics'}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  )
}
