import { Link } from 'react-router'
import Avatar from '../../../components/Avatar.jsx'
import Button from '../../../components/Button.jsx'
import TagBadges from '../../../components/TagBadges.jsx'
import VerifiedBadge from '../../../components/VerifiedBadge.jsx'
import { resolveTags, useTags } from '../../../context/TagsContext.js'
import { RequestTowButton } from '../../requests/components/RequestButtons.jsx'
import { RatingSummary } from '../../requests/components/Stars.jsx'
import { formatDistance } from '../geo.js'
import { fleetSummary, serviceLabels, truckCounts } from '../towDisplay.js'
import styles from './TowCompanyRow.module.css'

/** A dot and a short line: "2 of 3 trucks available now" / "No trucks available right now". The dot is green only when one is free. */
export function AvailabilityLine({ company }) {
  const { available, total } = truckCounts(company)
  return (
    <p className={styles.line}>
      <span className={`${styles.dot} ${available > 0 ? styles.free : ''}`} aria-hidden="true" />
      {available > 0 ? `${available} of ${total} ${total === 1 ? 'truck' : 'trucks'} available now` : 'No trucks available right now'}
    </p>
  )
}

/**
 * One tow company in the directory, laid out like a dispatch ledger: the company (logo, name, city and
 * distance, rating, Verified and tags), then labelled facts (Covers, Services, Fleet), then the trucks
 * available now as the one big figure, and the two actions. The name links to the profile and the whole
 * row follows it.
 * @param {{ company: import('../types.js').PublicTowCompany, rating?: { average: number, count: number } | null,
 *           distanceKm?: number | null, pickupPosition?: { lat: number, lng: number } | null }} props
 */
export default function TowCompanyRow({ company, rating = null, distanceKm = null, pickupPosition = null }) {
  const tags = resolveTags(company.tagIds, useTags())
  const services = serviceLabels(company)
  const fleet = fleetSummary(company)
  const { available, total } = truckCounts(company)

  return (
    <article className={styles.row} aria-labelledby={`tow-${company.id}`}>
      <div className={styles.company}>
        <Avatar file={company.profilePhoto} name={company.name} size="md" />
        <div className={styles.identity}>
          <h3 id={`tow-${company.id}`} className={styles.name}>
            <Link to={`/tow-companies/${company.id}`} className={styles.link}>
              {company.name}
            </Link>
          </h3>
          <p className={styles.muted}>
            Based in {company.city}
            {distanceKm !== null && ` · ${formatDistance(distanceKm)}`}
          </p>
          <RatingSummary summary={rating} />
          <div className={styles.trust}>
            <VerifiedBadge />
            <TagBadges tags={tags} />
          </div>
        </div>
      </div>

      <dl className={styles.facts}>
        <div>
          <dt>Covers</dt>
          <dd>{company.serviceArea.join(', ')}</dd>
        </div>
        {services.length > 0 && (
          <div>
            <dt>Services</dt>
            <dd>{services.join(' · ')}</dd>
          </div>
        )}
        {fleet && (
          <div>
            <dt>Fleet</dt>
            <dd>{fleet}</dd>
          </div>
        )}
      </dl>

      <div className={styles.dispatch}>
        <p className={styles.figure} aria-hidden="true">
          <span className={available > 0 ? styles.figureNow : styles.figureNone}>{available}</span>
          <span className={styles.of}>/{total}</span>
        </p>
        <AvailabilityLine company={company} />
        <div className={styles.actions}>
          <Button to={`/tow-companies/${company.id}`} variant="ghost">
            View company →
          </Button>
          <RequestTowButton company={company} pickupPosition={pickupPosition} variant="secondary" />
        </div>
      </div>
    </article>
  )
}

/**
 * The narrow version for the map page's list: logo, name, city (and distance), the trucks line and the
 * rating. The whole row is one button that selects the company (and its marker); `onPreview` reports the
 * row under the pointer or with focus, so its marker lights up too.
 */
export function TowCompanyRowCompact({ company, rating = null, distanceKm = null, selected, onSelect, onPreview }) {
  return (
    <li
      id={`result-${company.id}`}
      className={styles.compactItem}
      onMouseEnter={() => onPreview(company.id)}
      onMouseLeave={() => onPreview(null)}
      onFocus={() => onPreview(company.id)}
      onBlur={() => onPreview(null)}
    >
      <button type="button" className={styles.compact} aria-pressed={selected} onClick={() => onSelect(company.id)}>
        <Avatar file={company.profilePhoto} name={company.name} size="md" />
        <span className={styles.compactText}>
          <span className={styles.compactName}>{company.name}</span>
          <span className={styles.muted}>
            {company.city}
            {distanceKm !== null && ` · ${formatDistance(distanceKm)}`}
          </span>
          <AvailabilityLine company={company} />
          <RatingSummary summary={rating} compact />
        </span>
      </button>
    </li>
  )
}
