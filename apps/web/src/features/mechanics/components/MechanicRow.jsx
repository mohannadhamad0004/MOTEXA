import { Link } from 'react-router'
import { SERVICE_MODES } from '../../../auth/signup/constants.js'
import Avatar from '../../../components/Avatar.jsx'
import Button from '../../../components/Button.jsx'
import TagBadges from '../../../components/TagBadges.jsx'
import VerifiedBadge from '../../../components/VerifiedBadge.jsx'
import { resolveTags, useTags } from '../../../context/TagsContext.js'
import { formatDistance } from '../../logistics/geo.js'
import { RequestServiceButton } from '../../requests/components/RequestButtons.jsx'
import { RatingSummary } from '../../requests/components/Stars.jsx'
import { workshopImage } from '../images.js'
import { WorkshopCover } from './MechanicCard.jsx'
import styles from './MechanicRow.module.css'

const TOP_SKILLS = 3

/** The service modes a mechanic offers as plain words, in the SERVICE_MODES order: "On-site · Workshop visit". */
function modeLabels(mechanic) {
  return SERVICE_MODES.filter((mode) => mechanic.serviceModes.includes(mode.value))
}

/** "Brakes · Suspension · Engine": the filtered skill first and in copper, then the rest in the order listed. */
function Skills({ mechanic, highlightSkill, count }) {
  const skills = [...mechanic.skills].sort((a, b) => Number(b.skill === highlightSkill) - Number(a.skill === highlightSkill)).slice(0, count)
  return (
    <ul className={styles.inline} aria-label="Top skills">
      {skills.map((item) => (
        <li key={item.id} className={item.skill === highlightSkill ? styles.hit : undefined}>
          {item.skill}
        </li>
      ))}
    </ul>
  )
}

function Modes({ mechanic, highlightMode }) {
  const modes = modeLabels(mechanic)
  if (modes.length === 0) return null
  return (
    <ul className={styles.inline} aria-label="Services offered">
      {modes.map((mode) => (
        <li key={mode.value} className={mode.value === highlightMode ? styles.hit : undefined}>
          {mode.label}
        </li>
      ))}
    </ul>
  )
}

/**
 * One mechanic in the directory: a ruled row with the workshop photo, identity (workshop, mechanic, city
 * and distance), Verified and tags, rating, top skills, service modes, and the two actions. The workshop
 * name links to the profile and the whole row follows it.
 * @param {{ mechanic: import('../types.js').PublicMechanic, rating?: { average: number, count: number } | null,
 *           distanceKm?: number | null, highlightSkill?: string, highlightMode?: string }} props
 */
export default function MechanicRow({ mechanic, rating = null, distanceKm = null, highlightSkill = '', highlightMode = '' }) {
  const tags = resolveTags(mechanic.tagIds, useTags())
  // The workshop photo when there is one; else the mechanic's own photo (or initials) instead of an empty block
  const hasCover = Boolean(workshopImage(mechanic.id) || mechanic.workshopPhotos?.[0])
  return (
    <article className={styles.row} aria-labelledby={`row-${mechanic.id}`}>
      {hasCover ? (
        <WorkshopCover mechanic={mechanic} className={styles.photo} />
      ) : (
        <span className={styles.portrait}>
          <Avatar file={mechanic.profilePhoto} name={mechanic.name} size="lg" />
        </span>
      )}
      <div className={styles.main}>
        <h3 id={`row-${mechanic.id}`} className={styles.name}>
          <Link to={`/mechanics/${mechanic.id}`} className={styles.link}>
            {mechanic.workshopName}
          </Link>
        </h3>
        <p className={styles.muted}>
          {mechanic.name} · {mechanic.city}
          {distanceKm !== null && ` · ${formatDistance(distanceKm)}`}
        </p>
        <Skills mechanic={mechanic} highlightSkill={highlightSkill} count={TOP_SKILLS} />
      </div>
      <div className={styles.meta}>
        <div className={styles.trust}>
          <VerifiedBadge />
          <TagBadges tags={tags} />
        </div>
        <RatingSummary summary={rating} />
        <Modes mechanic={mechanic} highlightMode={highlightMode} />
      </div>
      <div className={styles.actions}>
        <Button to={`/mechanics/${mechanic.id}`} variant="ghost">
          View profile →
        </Button>
        <RequestServiceButton mechanic={mechanic} variant="secondary" />
      </div>
    </article>
  )
}

/**
 * The narrow version for the map page's list: avatar, workshop, mechanic and city (and distance),
 * rating and two skills. The whole row is one button that selects the mechanic (and its marker);
 * `onPreview` reports the row under the pointer or with focus, so its marker lights up too.
 */
export function MechanicRowCompact({ mechanic, rating = null, distanceKm = null, highlightSkill = '', selected, onSelect, onPreview }) {
  return (
    <li
      id={`result-${mechanic.id}`}
      className={styles.compactItem}
      onMouseEnter={() => onPreview(mechanic.id)}
      onMouseLeave={() => onPreview(null)}
      onFocus={() => onPreview(mechanic.id)}
      onBlur={() => onPreview(null)}
    >
      <button type="button" className={styles.compact} aria-pressed={selected} onClick={() => onSelect(mechanic.id)}>
        <Avatar file={mechanic.profilePhoto} name={mechanic.name} size="md" />
        <span className={styles.compactText}>
          <span className={styles.compactName}>{mechanic.workshopName}</span>
          <span className={styles.muted}>
            {mechanic.name} · {mechanic.city}
            {distanceKm !== null && ` · ${formatDistance(distanceKm)}`}
          </span>
          <RatingSummary summary={rating} compact />
          <Skills mechanic={mechanic} highlightSkill={highlightSkill} count={2} />
        </span>
      </button>
    </li>
  )
}
