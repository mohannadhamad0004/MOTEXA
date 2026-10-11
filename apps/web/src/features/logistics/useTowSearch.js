import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useAuthQuery } from '../../auth/useAuth.js'
import { ROLES } from '../../authorization/roles.js'
import { useTags } from '../../context/TagsContext.js'
import { useRatingSummaries } from '../requests/ReviewsContext.js'
import { findCity } from './cities.js'
import { nearestCity } from './geo.js'
import { createTowCompanyIndex } from './searchTowCompanies.js'
import { companiesByCity, findTowCompanies, nearbyCoveredCities } from './towSearch.js'
import { useGeolocation } from './useGeolocation.js'

// TODO: replace with real API call (GET /api/tow-companies)
const loadTowCompanies = (service) => service.getDirectory(ROLES.TOW)

const NONE = []
const SORTS = ['nearest', 'rating', 'trucks']

/**
 * Everything /tow-companies and /tow-companies/map share: the approved tow companies, the search in the
 * URL (?city=Nablus&q=rescue&service=local&sort=rating), the search tab (city, company name or "My
 * location"), the customer's position and the resulting list. The search lives in the URL, so a link from
 * one page to the other (with the same query string) keeps it; the tab starts on "Company name" when the
 * URL has a name, else on "City". The customer's position is never stored: it stays in the page's state
 * (so "My location" has to be chosen again on the other page), and only goes into a tow request the
 * customer confirms. `emergency` ("Need a tow now?") keeps only companies with a truck free right now.
 */
export function useTowSearch() {
  const { data, error } = useAuthQuery(loadTowCompanies)
  const [searchParams, setSearchParams] = useSearchParams()
  const geo = useGeolocation()
  const [mode, setMode] = useState(() => (searchParams.get('q') ? 'name' : 'city'))
  const [emergency, setEmergency] = useState(false)

  const city = findCity(searchParams.get('city') ?? '')?.name ?? ''
  const query = searchParams.get('q') ?? ''
  const service = searchParams.get('service') ?? ''
  const tags = useTags()
  const ratings = useRatingSummaries()
  const companies = data ?? NONE
  const index = useMemo(() => createTowCompanyIndex(companies, tags), [companies, tags])

  // Where distances are measured from: the customer's position, or the middle of the searched city.
  const userPosition = mode !== 'city' ? geo.position : null
  const origin = useMemo(() => {
    if (userPosition) return userPosition
    const centre = mode === 'city' && city ? findCity(city) : null
    return centre && { lat: centre.lat, lng: centre.lng }
  }, [userPosition, mode, city])
  const requestedSort = searchParams.get('sort')
  // Nearest when there is a position, otherwise best rated (or best name match when searching by name).
  const sort =
    SORTS.includes(requestedSort) && (origin || requestedSort !== 'nearest')
      ? requestedSort
      : origin
        ? 'nearest'
        : mode === 'name' && query
          ? 'search'
          : 'rating'

  const results = useMemo(
    () => findTowCompanies(companies, { mode, city, query, origin, service, emergency, sort, index, ratings }),
    [companies, mode, city, query, origin, service, emergency, sort, index, ratings],
  )
  const byCity = useMemo(() => companiesByCity(companies), [companies])
  const areaName = mode === 'location' && origin ? nearestCity(origin).city.name : city
  const nearbyCities = useMemo(() => nearbyCoveredCities(companies, origin, areaName), [companies, origin, areaName])

  function setParam(key, value) {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current)
        if (value) next.set(key, value)
        else next.delete(key)
        return next
      },
      { replace: true },
    )
  }

  function changeMode(next) {
    setMode(next)
    setEmergency(false)
  }

  // "Use my location": on failure the page shows why and goes back to searching by city.
  async function locate(isEmergency = false) {
    const position = await geo.locate()
    changeMode(position ? 'location' : 'city')
    if (position) {
      setEmergency(isEmergency)
      setParam('sort', '')
    }
    return position
  }

  function pickCity(name) {
    changeMode('city')
    setParam('city', name)
  }

  const summary = emergency
    ? 'with a truck available now, nearest first'
    : mode === 'location' && origin
      ? `near ${areaName}`
      : mode === 'name' && query
        ? `matching "${query}"`
        : city
          ? `covering ${city}`
          : 'all verified companies'

  return {
    data,
    error,
    companies,
    ratings,
    mode,
    city,
    query,
    service,
    sort,
    origin,
    isUserLocation: Boolean(userPosition),
    geo,
    emergency,
    setEmergency,
    results,
    byCity,
    nearbyCities,
    areaName,
    summary,
    setParam,
    changeMode,
    locate,
    pickCity,
    // the query string to carry to the other page (the search is in the URL)
    search: searchParams.toString() ? `?${searchParams.toString()}` : '',
  }
}
