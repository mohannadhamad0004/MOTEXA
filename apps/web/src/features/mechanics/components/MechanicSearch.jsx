import { useId, useState } from 'react'
import Button from '../../../components/Button.jsx'
import { FieldError } from '../../../components/FormField.jsx'
import Notice from '../../../components/Notice.jsx'
import SearchBar from '../../../components/SearchBar.jsx'
import Tabs, { TabPanel } from '../../../components/Tabs.jsx'
import { CITIES, findCity } from '../../logistics/cities.js'
import TowIcon from '../../logistics/components/TowIcon.jsx'
import styles from './MechanicSearch.module.css'

const MODES = [
  { value: 'problem', label: 'Problem or skill' },
  { value: 'city', label: 'City' },
  { value: 'location', label: 'My location' },
]

/**
 * The mechanic search used on /mechanics and /mechanics/map: three ways to search (a problem or skill,
 * a city, the customer's location) as underline tabs, one field, one Search button. It only reports
 * what the customer chose through `search` (the useMechanicSearch result); the page does the searching.
 * `compact` is the narrow version for the map page's list rail. `children` go under the field.
 * @param {{ search: ReturnType<typeof import('../useMechanicSearch.js').useMechanicSearch>, compact?: boolean,
 *           idPrefix: string, onSearched?: () => void, children?: React.ReactNode }} props
 */
export default function MechanicSearch({ search, compact = false, idPrefix, onSearched, children }) {
  const { mode, changeMode, city, setParam, query, geo, locate, symptomSkills } = search
  const listId = useId()
  const [cityText, setCityText] = useState(city)
  const [cityError, setCityError] = useState('')

  // The city changed from outside (a city in "Mechanics by city"): show it in the field.
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
      {/* A short visible label, so the field isn't explained by its placeholder alone. The problem field keeps
          its longer screen reader label (SearchBar), so this one is hidden from them. */}
      {mode === 'problem' && (
        <span className={styles.label} aria-hidden="true">
          Problem, skill, name or workshop
        </span>
      )}
      {mode === 'city' && (
        <label htmlFor={`${idPrefix}-city`} className={styles.label}>
          City or town
        </label>
      )}
      <div className={styles.row}>
        <TabPanel idPrefix={idPrefix} value={mode} className={styles.panel}>
          {mode === 'problem' && (
            <SearchBar
              id={`${idPrefix}-text`}
              label="Describe the problem or search by skill, name or workshop"
              placeholder={compact ? 'Problem, skill, name or workshop' : "e.g. squeaking brakes, car won't start, AC not cold"}
              value={query}
              onChange={(text) => setParam('q', text.trim())}
              quiet
            />
          )}
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
          {mode === 'location' && (
            <Button variant="secondary" size={compact ? 'md' : 'lg'} onClick={locate} loading={geo.status === 'locating'}>
              {geo.status !== 'locating' && <TowIcon name="locate" size={20} />}
              {geo.status === 'locating' ? 'Finding your location…' : geo.status === 'ready' ? 'Location found - update it' : 'Use my location'}
            </Button>
          )}
        </TabPanel>
        <Button size={compact ? 'md' : 'lg'} onClick={submit} disabled={geo.status === 'locating'} className={styles.button}>
          Search
        </Button>
      </div>

      {mode === 'problem' && symptomSkills.length > 0 && (
        <p className={styles.hint} aria-live="polite">
          Sounds like a problem for <strong>{symptomSkills.join(' or ')}</strong>
        </p>
      )}
      {geo.status === 'error' && <Notice tone="warning">{geo.error}</Notice>}
      {children}
    </div>
  )
}
