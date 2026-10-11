import { nearestCity } from '../geo.js'
import styles from './PickupContext.module.css'

/**
 * The pickup context on the map page. The pickup itself is set in the "Request tow" form (a pin and/or
 * notes); the customer's shared position only pre-fills it. So this shows whether a position is shared
 * (kept in this page's state, never stored) and offers "Use my location" when it isn't.
 * @param {{ position: { lat: number, lng: number } | null, locating: boolean, onLocate: () => void }} props
 */
export default function PickupContext({ position, locating, onLocate }) {
  return (
    <div className={styles.pickup}>
      <p className={styles.label}>Pickup location</p>
      {position ? (
        <p className={styles.value}>
          <strong>Your location</strong>, near {nearestCity(position).city.name}
          <span className={styles.note}> · pre-filled when you request a tow</span>
        </p>
      ) : (
        <p className={styles.value}>
          Not shared. <span className={styles.note}>You set it when you request a tow.</span>{' '}
          <button type="button" className={styles.button} onClick={onLocate} disabled={locating}>
            {locating ? 'Finding your location…' : 'Use my location'}
          </button>
        </p>
      )}
    </div>
  )
}
