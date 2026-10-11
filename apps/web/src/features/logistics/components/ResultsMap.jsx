import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { useEffect } from 'react'
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet'
import { DEFAULT_CENTER, TILE_ATTRIBUTION, TILE_URL } from '../mapTiles.js'
import styles from './TowMap.module.css'

// Markers are drawn with HTML and an inline SVG (no image files), in the theme colors.

const svg = (body) =>
  `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`
// What a marker shows: a tow truck, or a wrench for a workshop.
const PINS = {
  truck: svg('<path d="M2 16V8h11v8M13 11h4l3 3v2h-7"/><circle cx="6" cy="17" r="1.8"/><circle cx="17" cy="17" r="1.8"/>'),
  wrench: svg('<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/>'),
}

const placeIcon = (selected, pin) =>
  L.divIcon({
    className: '',
    html: `<span class="${styles.pin} ${selected ? styles.pinSelected : ''}">${PINS[pin]}</span>`,
    iconSize: [40, 40],
    iconAnchor: [20, 40],
  })

const userIcon = L.divIcon({
  className: '',
  html: `<span class="${styles.user}"><span class="${styles.userDot}"></span></span>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
})

// Fits the map to the markers whenever they change, and again when its container comes back from being
// hidden (a map made inside a hidden tab or a phone's other view has no size, so it can't fit then).
// Any other size change just tells Leaflet to re-measure.
function FitToMarkers({ points }) {
  const map = useMap()
  const key = points.map((p) => `${p[0]},${p[1]}`).join('|')
  useEffect(() => {
    // Not animated: Leaflet doesn't cancel a zoom animation that is still running when the map is removed
    // (leaving the page right after a search), and its timer then throws on the deleted map.
    const fit = () => {
      if (points.length === 0) return
      if (points.length === 1) map.setView(points[0], 12, { animate: false })
      else map.fitBounds(points, { padding: [40, 40], maxZoom: 13, animate: false })
    }
    fit()
    const container = map.getContainer()
    let hidden = container.clientWidth === 0 || container.clientHeight === 0
    const observer = new ResizeObserver(() => {
      const nowHidden = container.clientWidth === 0 || container.clientHeight === 0
      if (!nowHidden) {
        map.invalidateSize()
        if (hidden) fit()
      }
      hidden = nowHidden
    })
    observer.observe(container)
    return () => observer.disconnect()
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- `key` stands for `points`
  }, [map, key])
  return null
}

// Centers the map on one result when `id` changes (the mechanic chosen on /mechanics/map).
function PanTo({ id, results }) {
  const map = useMap()
  const base = results.find(({ item }) => item.id === id)?.item.base
  useEffect(() => {
    if (base) map.panTo([base.lat, base.lng], { animate: true })
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- only when the chosen result changes
  }, [map, id])
  return null
}

/**
 * The results map: a marker for each result's base (a tow company's yard, a mechanic's workshop) and
 * one for the customer's location. Clicking (or pressing Enter on) a marker calls onSelect(id).
 * @param {{ origin: { lat: number, lng: number } | null, isUserLocation: boolean,
 *           results: { item: { id: string, base: { lat: number, lng: number } | null } }[],
 *           selectedId: string | null, onSelect: (id: string) => void,
 *           pin?: 'truck' | 'wrench', getName?: (item: Object) => string, panToId?: string | null }} props
 *   `panToId`: when set, the map centers on that result (without changing the zoom)
 */
export default function ResultsMap({ origin, isUserLocation, results, selectedId, onSelect, pin = 'truck', getName = (item) => item.name, panToId = null }) {
  const withBase = results.filter(({ item }) => item.base)
  const points = [...withBase.map(({ item }) => [item.base.lat, item.base.lng]), ...(origin ? [[origin.lat, origin.lng]] : [])]

  return (
    <div className={styles.map}>
      <MapContainer center={DEFAULT_CENTER} zoom={8} scrollWheelZoom={false} className={styles.container}>
        <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
        {withBase.map(({ item }) => (
          <Marker
            key={item.id}
            position={[item.base.lat, item.base.lng]}
            icon={placeIcon(item.id === selectedId, pin)}
            title={getName(item)}
            alt={getName(item)}
            zIndexOffset={item.id === selectedId ? 1000 : 0}
            eventHandlers={{
              click: () => onSelect(item.id),
              // Leaflet's marker is a focusable button but doesn't turn Enter into a click: do it here
              add: (event) =>
                event.target.getElement()?.addEventListener('keydown', (keyEvent) => {
                  if (keyEvent.key !== 'Enter' && keyEvent.key !== ' ') return
                  keyEvent.preventDefault()
                  onSelect(item.id)
                }),
            }}
          />
        ))}
        {origin && isUserLocation && <Marker position={[origin.lat, origin.lng]} icon={userIcon} title="Your location" alt="Your location" keyboard={false} />}
        <FitToMarkers points={points} />
        {panToId && <PanTo id={panToId} results={results} />}
      </MapContainer>
    </div>
  )
}
