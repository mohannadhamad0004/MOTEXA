import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { SERVICE_MODES, serviceModeLabel, SKILLS } from '../../auth/signup/constants.js'
import { useAuthQuery } from '../../auth/useAuth.js'
import { ROLES } from '../../authorization/roles.js'
import { useTags } from '../../context/TagsContext.js'
import { findCity } from '../logistics/cities.js'
import { nearestCity } from '../logistics/geo.js'
import { useGeolocation } from '../logistics/useGeolocation.js'
import { useCart } from '../marketplace/CartContext.js'
import { useRatingSummaries } from '../requests/ReviewsContext.js'
import { allMakes, findMechanics, mechanicsByCity, nearbyMechanicCities, skillCounts } from './mechanicsSearch.js'
import { createMechanicIndex } from './searchMechanics.js'
import { skillsForProblem } from './symptoms.js'

// TODO: replace with real API call (GET /api/mechanics)
const loadMechanics = (service) => service.getDirectory(ROLES.MECHANIC)

const NONE = []
export const SORTS = [
  { value: 'match', label: 'Best match' },
  { value: 'nearest', label: 'Nearest' },
  { value: 'rating', label: 'Rating' },
]

// ?skill=electrical -> "Electrical" (the spelling in SKILLS); unknown skills are kept as typed.
const toSkill = (value) => SKILLS.find((skill) => skill.toLowerCase() === value.toLowerCase()) ?? value

// ?mode=on_site -> "on_site"; unknown modes are ignored.
const toMode = (value) => SERVICE_MODES.find((mode) => mode.value === value)?.value ?? ''

/**
 * Everything /mechanics and /mechanics/map share: the approved mechanics, the search in the URL
 * (?q=brakes&city=Nablus&skill=Brakes&mode=on_site&make=Toyota&sort=rating), the search tab, the
 * customer's location and the resulting list. Because the search lives in the URL, a link from one page
 * to the other (with the same query string) keeps it. The search tab starts on "City" when the URL has
 * a city. The customer's position is never stored: it stays in the page's state, so "My location" has
 * to be chosen again on the other page.
 */
export function useMechanicSearch() {
  const { data, error } = useAuthQuery(loadMechanics)
  const [searchParams, setSearchParams] = useSearchParams()
  const geo = useGeolocation()
  const { vehicle } = useCart()
  const [mode, setMode] = useState(() => (findCity(searchParams.get('city') ?? '') ? 'city' : 'problem'))

  const query = searchParams.get('q') ?? ''
  const city = findCity(searchParams.get('city') ?? '')?.name ?? ''
  const skill = toSkill(searchParams.get('skill') ?? '')
  const serviceMode = toMode(searchParams.get('mode') ?? '')
  const make = searchParams.get('make') ?? ''
  const requestedSort = searchParams.get('sort')

  const tags = useTags()
  const ratings = useRatingSummaries()
  const mechanics = data ?? NONE
  const index = useMemo(() => createMechanicIndex(mechanics, tags), [mechanics, tags])
  const symptomSkills = useMemo(() => (mode === 'problem' ? skillsForProblem(query) : NONE), [mode, query])

  // Distances are measured from the customer's position, or the middle of the searched city.
  const userPosition = mode === 'location' ? geo.position : null
  const origin = useMemo(() => {
    if (userPosition) return userPosition
    const centre = mode === 'city' && city ? findCity(city) : null
    return centre && { lat: centre.lat, lng: centre.lng }
  }, [userPosition, mode, city])
  const sort = SORTS.some((s) => s.value === requestedSort) && (origin || requestedSort !== 'nearest') ? requestedSort : origin ? 'nearest' : 'match'

  const results = useMemo(
    () => findMechanics(mechanics, { mode, query, symptomSkills, city, origin, skill, serviceMode, make, sort, index, ratings }),
    [mechanics, mode, query, symptomSkills, city, origin, skill, serviceMode, make, sort, index, ratings],
  )
  const counts = useMemo(() => skillCounts(mechanics), [mechanics])
  const makes = useMemo(() => allMakes(mechanics), [mechanics])
  const byCity = useMemo(() => mechanicsByCity(mechanics), [mechanics])
  const areaName = mode === 'location' && origin ? nearestCity(origin).city.name : city
  const nearbyCities = useMemo(() => nearbyMechanicCities(mechanics, origin, areaName), [mechanics, origin, areaName])

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
    // Nearest only makes sense with a position or a city
    if (requestedSort === 'nearest') setParam('sort', '')
  }

  async function locate() {
    const position = await geo.locate()
    changeMode(position ? 'location' : 'city')
    return position
  }

  function pickCity(name) {
    changeMode('city')
    setParam('city', name)
  }

  function clearSearch() {
    setSearchParams({}, { replace: true })
    setMode('problem')
  }

  const summary = [
    mode === 'problem' && query && (symptomSkills.length ? `for ${symptomSkills.join(' or ')}` : `matching "${query}"`),
    mode === 'city' && city && `working in ${city}`,
    mode === 'location' && origin && `near ${areaName}`,
    skill && `skilled in ${skill}`,
    serviceMode && `offering ${serviceModeLabel(serviceMode).toLowerCase()}`,
    make && `specializing in ${make}`,
  ]
    .filter(Boolean)
    .join(', ')

  return {
    // data
    data,
    error,
    mechanics,
    ratings,
    vehicle,
    // search state
    mode,
    query,
    city,
    skill,
    serviceMode,
    make,
    sort,
    origin,
    isUserLocation: Boolean(userPosition),
    symptomSkills,
    geo,
    // derived
    results,
    counts,
    makes,
    byCity,
    nearbyCities,
    summary: summary || 'all verified mechanics',
    // actions
    setParam,
    changeMode,
    locate,
    pickCity,
    clearSearch,
    // the query string to carry to the other page (the search is in the URL)
    search: searchParams.toString() ? `?${searchParams.toString()}` : '',
  }
}
