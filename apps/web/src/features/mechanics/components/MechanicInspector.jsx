import { Link } from 'react-router'
import { SERVICE_MODES } from '../../../auth/signup/constants.js'
import Avatar from '../../../components/Avatar.jsx'
import Button from '../../../components/Button.jsx'
import VerifiedBadge from '../../../components/VerifiedBadge.jsx'
import { formatDistance } from '../../logistics/geo.js'
import { RequestServiceButton } from '../../requests/components/RequestButtons.jsx'
import { RatingSummary } from '../../requests/components/Stars.jsx'
import styles from './MechanicInspector.module.css'

/**
 * The selected mechanic on the map page: a compact summary with the same two actions as the directory
 * (View profile, Request service). It floats over the map on desktop; on phones it is a compact bar
 * (`compact`: just who and the two actions) at the bottom, so the list stays usable above it.
 * `onClose` shows a close button.
 * @param {{ mechanic: import('../types.js').PublicMechanic, rating?: { average: number, count: number } | null,
 *           distanceKm?: number | null, compact?: boolean, onClose?: () => void }} props
 */
export default function MechanicInspector({ mechanic, rating = null, distanceKm = null, compact = false, onClose }) {
  const modes = SERVICE_MODES.filter((mode) => mechanic.serviceModes.includes(mode.value))
  return (
    <aside className={`${styles.inspector} ${compact ? styles.compact : ''}`} aria-label="Selected mechanic">
      <div className={styles.head}>
        <Avatar file={mechanic.profilePhoto} name={mechanic.name} size={compact ? 'sm' : 'md'} />
        <div className={styles.identity}>
          <h2 className={styles.name}>
            <Link to={`/mechanics/${mechanic.id}`} className={styles.link}>
              {mechanic.workshopName}
            </Link>
          </h2>
          <p className={styles.muted}>
            {mechanic.name} · {mechanic.city}
            {distanceKm !== null && ` · ${formatDistance(distanceKm)}`}
          </p>
          <RatingSummary summary={rating} />
        </div>
        {onClose && (
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close selected mechanic">
            ×
          </button>
        )}
      </div>
      {!compact && (
        <div className={styles.facts}>
          <VerifiedBadge />
          <p className={styles.line}>{mechanic.skills.slice(0, 3).map((s) => s.skill).join(' · ')}</p>
          {modes.length > 0 && <p className={styles.line}>{modes.map((m) => m.label).join(' · ')}</p>}
        </div>
      )}
      <div className={styles.actions}>
        <Button to={`/mechanics/${mechanic.id}`} variant="secondary">
          View profile
        </Button>
        <RequestServiceButton mechanic={mechanic} />
      </div>
    </aside>
  )
}
