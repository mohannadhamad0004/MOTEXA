import { Link } from 'react-router'
import Avatar from '../../../components/Avatar.jsx'
import Button from '../../../components/Button.jsx'
import VerifiedBadge from '../../../components/VerifiedBadge.jsx'
import { RequestTowButton } from '../../requests/components/RequestButtons.jsx'
import { RatingSummary } from '../../requests/components/Stars.jsx'
import { formatDistance } from '../geo.js'
import { fleetSummary } from '../towDisplay.js'
import { AvailabilityLine } from './TowCompanyRow.jsx'
import styles from './TowInspector.module.css'

/**
 * The selected tow company on the map page: a compact summary with the same two actions as the directory
 * (View company, Request tow, pre-filled with the customer's position when they shared it). It floats over
 * the map on desktop; on phones it is a slim bar (`compact`: who, the trucks line and the actions) so the
 * list stays usable above it. `onClose` shows a close button.
 * @param {{ company: import('../types.js').PublicTowCompany, rating?: { average: number, count: number } | null,
 *           distanceKm?: number | null, pickupPosition?: { lat: number, lng: number } | null,
 *           compact?: boolean, onClose?: () => void }} props
 */
export default function TowInspector({ company, rating = null, distanceKm = null, pickupPosition = null, compact = false, onClose }) {
  const fleet = fleetSummary(company)
  return (
    <aside className={`${styles.inspector} ${compact ? styles.compact : ''}`} aria-label="Selected tow company">
      <div className={styles.head}>
        <Avatar file={company.profilePhoto} name={company.name} size={compact ? 'sm' : 'md'} />
        <div className={styles.identity}>
          <h2 className={styles.name}>
            <Link to={`/tow-companies/${company.id}`} className={styles.link}>
              {company.name}
            </Link>
          </h2>
          <p className={styles.muted}>
            Based in {company.city}
            {distanceKm !== null && ` · ${formatDistance(distanceKm)}`}
          </p>
          {!compact && <RatingSummary summary={rating} />}
        </div>
        {onClose && (
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close selected tow company">
            ×
          </button>
        )}
      </div>
      <div className={styles.facts}>
        <AvailabilityLine company={company} />
        {!compact && (
          <>
            <VerifiedBadge />
            <p className={styles.line}>Covers {company.serviceArea.join(', ')}</p>
            {fleet && <p className={styles.line}>{fleet}</p>}
          </>
        )}
      </div>
      <div className={styles.actions}>
        <Button to={`/tow-companies/${company.id}`} variant="secondary">
          View company
        </Button>
        <RequestTowButton company={company} pickupPosition={pickupPosition} />
      </div>
    </aside>
  )
}
