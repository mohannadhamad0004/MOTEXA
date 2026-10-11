import { useState } from 'react'
import { Link } from 'react-router'
import EmptyState from '../../../components/EmptyState.jsx'
import Select from '../../../components/Select.jsx'
import { SkeletonCards } from '../../../components/Skeleton.jsx'
import { useMediaQuery } from '../../../hooks/useMediaQuery.js'
import ExplorerShell from '../../logistics/components/ExplorerShell.jsx'
import styles from '../../logistics/components/ExplorerShell.module.css'
import ResultsMap from '../../logistics/components/ResultsMap.jsx'
import MechanicFilters from '../components/MechanicFilters.jsx'
import MechanicInspector from '../components/MechanicInspector.jsx'
import { MechanicRowCompact } from '../components/MechanicRow.jsx'
import MechanicSearch from '../components/MechanicSearch.jsx'
import { SORTS, useMechanicSearch } from '../useMechanicSearch.js'

// /mechanics/map - the map explorer. A list rail on the left (back link, search, filters, count, sort,
// the mechanics) and the map filling the rest. Choosing a mechanic in the list, or its marker on the
// map, selects both and opens a compact inspector over the map. Phones show one at a time: List | Map.
// It reads the same search from the URL as /mechanics, so the search carries over both ways.
// The workspace itself (rail, map, switch, inspector placement) is logistics/ExplorerShell.
export default function MechanicsMap() {
  const search = useMechanicSearch()
  const { data, error, results, ratings, skill, serviceMode, make, makes, sort, origin, symptomSkills } = search
  const [selectedId, setSelectedId] = useState(null)
  const [hoveredId, setHoveredId] = useState(null) // the row under the pointer or with focus: its marker lights up too
  const [view, setView] = useState('list') // phones only
  const isPhone = useMediaQuery('(max-width: 767px)')

  const selected = results.find(({ item }) => item.id === selectedId)
  const filterCount = [skill, serviceMode, make].filter(Boolean).length

  function select(id) {
    setSelectedId(id)
    document.getElementById(`result-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

  const rail = (
    <>
      <div className={styles.top}>
        <Link to={`/mechanics${search.search}`} className={styles.back}>
          ← Back to mechanic directory
        </Link>
        <p className={styles.kicker}>Map view</p>
        <h1 className={styles.title}>Mechanics on the map</h1>
        <MechanicSearch search={search} compact idPrefix="map-by" />
        <details className={styles.filters}>
          <summary className={styles.filtersSummary}>Filters{filterCount > 0 && ` (${filterCount})`}</summary>
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
        </details>
        <div className={styles.bar}>
          <p className={styles.count} aria-live="polite">
            <strong>{results.length}</strong> {results.length === 1 ? 'mechanic' : 'mechanics'}
          </p>
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
      </div>

      <div className={styles.listArea}>
        {error ? (
          <EmptyState icon="⚠" title="Couldn't load mechanics" description="Please try again in a moment." />
        ) : !data ? (
          <SkeletonCards count={3} label="Loading mechanics…" />
        ) : results.length === 0 ? (
          <EmptyState
            icon="🔧"
            title="No mechanics match your search"
            description="Try a different city or remove a filter."
            action={
              <button type="button" className={styles.clear} onClick={search.clearSearch}>
                Show all mechanics
              </button>
            }
          />
        ) : (
          <ul className={styles.list}>
            {results.map(({ item, distanceKm }) => (
              <MechanicRowCompact
                key={item.id}
                mechanic={item}
                rating={ratings[item.id]}
                distanceKm={distanceKm}
                highlightSkill={skill || symptomSkills[0] || ''}
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
      railLabel="Mechanics list"
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
          pin="wrench"
          getName={(item) => item.workshopName}
        />
      }
      inspector={
        selected && (
          <MechanicInspector
            mechanic={selected.item}
            rating={ratings[selected.item.id]}
            distanceKm={selected.distanceKm}
            compact={isPhone}
            onClose={() => setSelectedId(null)}
          />
        )
      }
    />
  )
}
