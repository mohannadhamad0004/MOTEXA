import { useId, useState } from 'react'
import Button from '../../../components/Button.jsx'
import { FieldError } from '../../../components/FormField.jsx'
import Notice from '../../../components/Notice.jsx'
import SearchBar from '../../../components/SearchBar.jsx'
import Tabs, { TabPanel } from '../../../components/Tabs.jsx'
import { CITIES, findCity } from '../cities.js'
import TowIcon from './TowIcon.jsx'
import styles from './TowSearch.module.css'

const MODES = [
  { value: 'city', label: 'City' },
  { value: 'name', label: 'Company name' },
  { value: 'location', label: 'My location' },
]

/**
 * The tow search used on /tow-companies and /tow-companies/map: three ways to search (a city, a company
 * name, the customer's location) as underline tabs, one field and one Search button. It only reports what
 * the customer chose through `search` (the useTowSearch result); the page does the searching. `compact` is
 * the narrow version for the map page's list rail. `children` go under the field.
 * @param {{ search: ReturnType<typeof import('../useTowSearch.js').useTowSearch>, compact?: boolean,
 *           idPrefix: string, onSearched?: () => void, children?: React.ReactNode }} props
 */
export default function TowSearch({ search, compact = false, idPrefix, onSearched, children }) {
  const { mode, changeMode, city, setParam, query, geo, locate } = search
  const listId = useId()
  const [cityText, setCityText] = useState(city)
  const [cityError, setCityError] = useState('')

  // The city changed from outside (a city in "Where we cover"): show it in the field.
  const [seenCity, setSeenCity] = useState(city)
  if (city !== seenCity) {
    setSeenCity(city)
    setCityText(city)
  }

  function changeCityText(text) {
    setCityText(text)
    setCityError('')
    // Picking a city from the list sets it right away; clearing the field clears the search.
    const match = findCity(text)
    if (match) setParam('city', match.name)
    else if (!text.trim()) setParam('city', '')
  }

  function submit() {
    if (mode === 'city') {
      const match = findCity(cityText)
      if (match) setParam('city', match.name)
      else setCityError(cityText.trim() ? "We don't know that city yet. Pick one from the list." : 'Choose a city.')
    } else if (mode === 'location' && geo.status !== 'ready') locate()
    onSearched?.()
  }

  return (
    <div className={`${styles.search} ${compact ? styles.compact : ''}`}>
      <Tabs tabs={MODES} value={mode} onChange={changeMode} label="Search by" idPrefix={idPrefix} fullWidth={compact} />
      {/* A short visible label above the field. The name field keeps its own screen reader label (SearchBar). */}
      {mode === 'city' && (
        <label htmlFor={`${idPrefix}-city`} className={styles.label}>
          City or town
        </label>
      )}
      {mode === 'name' && (
        <span className={styles.label} aria-hidden="true">
          Company name
        </span>
      )}
      <div className={styles.row}>
        <TabPanel idPrefix={idPrefix} value={mode} className={styles.panel}>
          {mode === 'city' && (
            <div className={styles.field}>
              <input
                id={`${idPrefix}-city`}
                className={styles.input}
                list={listId}
                value={cityText}
                onChange={(event) => changeCityText(event.target.value)}
                placeholder="Type or pick a city, e.g. Nablus"
                autoComplete="off"
                aria-invalid={Boolean(cityError) || undefined}
                aria-describedby={cityError ? `${idPrefix}-city-error` : undefined}
              />
              <datalist id={listId}>
                {CITIES.map((item) => (
                  <option key={item.name} value={item.name} />
                ))}
              </datalist>
              <FieldError id={`${idPrefix}-city-error`}>{cityError}</FieldError>
            </div>
          )}
          {mode === 'name' && (
            <SearchBar
              id={`${idPrefix}-text`}
              label="Search tow companies by name"
              placeholder={compact ? 'Company name' : 'Company name, e.g. Nablus Rescue'}
              value={query}
              onChange={(text) => setParam('q', text.trim())}
              quiet
            />
          )}
          {mode === 'location' && (
            <Button variant="secondary" size={compact ? 'md' : 'lg'} onClick={() => locate()} loading={geo.status === 'locating'}>
              {geo.status !== 'locating' && <TowIcon name="locate" size={20} />}
              {geo.status === 'locating' ? 'Finding your location…' : geo.status === 'ready' ? 'Location found - update it' : 'Use my location'}
            </Button>
          )}
        </TabPanel>
        <Button size={compact ? 'md' : 'lg'} onClick={submit} disabled={geo.status === 'locating'} className={styles.button}>
          Search
        </Button>
      </div>

      {geo.status === 'error' && <Notice tone="warning">{geo.error}</Notice>}
      {children}
    </div>
  )
}
