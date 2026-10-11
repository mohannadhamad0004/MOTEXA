import { useCallback } from 'react'
import { useParams } from 'react-router'
import { SERVICE_MODES } from '../../../auth/signup/constants.js'
import { useAuthQuery } from '../../../auth/useAuth.js'
import { ROLES } from '../../../authorization/roles.js'
import Avatar from '../../../components/Avatar.jsx'
import Button from '../../../components/Button.jsx'
import EmptyState from '../../../components/EmptyState.jsx'
import { SkeletonRows } from '../../../components/Skeleton.jsx'
import PhotoGallery from '../../../components/PhotoGallery.jsx'
import TagBadges from '../../../components/TagBadges.jsx'
import VerifiedBadge from '../../../components/VerifiedBadge.jsx'
import { resolveTags, useTags } from '../../../context/TagsContext.js'
import { RequestServiceButton } from '../../requests/components/RequestButtons.jsx'
import ReviewList from '../../requests/components/ReviewList.jsx'
import { RatingSummary } from '../../requests/components/Stars.jsx'
import { useRatingSummaries } from '../../requests/ReviewsContext.js'
import ServiceModeBadges from '../components/ServiceModeBadges.jsx'
import styles from './MechanicProfile.module.css'

const years = (count) => `${count} ${count === 1 ? 'year' : 'years'}`

// /mechanics/:mechanicId - public profile of an approved mechanic. Certificates are not shown
// here (the public profile doesn't include them); only admins see them.
export default function MechanicProfile() {
  const { mechanicId } = useParams()
  // TODO: replace with real API call (GET /api/mechanics/:id)
  const loadMechanic = useCallback(
    (service) => service.getDirectoryEntry(ROLES.MECHANIC, mechanicId),
    [mechanicId],
  )
  const { data: mechanic, error, loading } = useAuthQuery(loadMechanic)
  const allTags = useTags()
  const ratings = useRatingSummaries()

  if (error) return <EmptyState icon="⚠" title="Couldn't load this mechanic" description="Please try again in a moment." />
  if (loading) return <SkeletonRows rows={4} label="Loading…" />

  if (!mechanic) {
    return (
      <EmptyState
        icon="🔧"
        headingLevel="h1"
        title="Mechanic not found"
        description="This mechanic isn't on MOTEXA, or their account is still being reviewed."
        action={<Button to="/mechanics">Back to mechanics</Button>}
      />
    )
  }

  return (
    <div className={styles.page}>
      <Button to="/mechanics" variant="ghost" size="sm" className={styles.back}>
        ← All mechanics
      </Button>

      <header className={styles.header}>
        <Avatar file={mechanic.profilePhoto} name={mechanic.name} size="lg" />
        <div className={styles.headerText}>
          <VerifiedBadge />
          <h1 className={styles.title}>{mechanic.workshopName}</h1>
          <p className={styles.name}>{mechanic.name}</p>
          <TagBadges tags={resolveTags(mechanic.tagIds, allTags)} />
          <RatingSummary summary={ratings[mechanic.id]} />
          <ServiceModeBadges modes={mechanic.serviceModes} />
          <p className={styles.muted}>
            {mechanic.address}, {mechanic.city}
          </p>
          {mechanic.description && <p className={styles.description}>{mechanic.description}</p>}
        </div>
        <div className={styles.headerAction}>
          <RequestServiceButton mechanic={mechanic} />
        </div>
      </header>

      <section className={styles.section} aria-labelledby="services-title">
        <h2 id="services-title" className={styles.sectionTitle}>
          Services
        </h2>
        <ul className={styles.services}>
          {SERVICE_MODES.filter((mode) => mechanic.serviceModes.includes(mode.value)).map((mode) => (
            <li key={mode.value} className={styles.skill}>
              <span className={styles.skillName}>{mode.label}</span>
              <span className={styles.muted}>
                {mode.value === 'on_site' ? `Comes to you in ${mechanic.onSiteCities.join(', ')}` : mode.description}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.section} aria-labelledby="skills-title">
        <h2 id="skills-title" className={styles.sectionTitle}>
          Skills
        </h2>
        <ul className={styles.skills}>
          {mechanic.skills.map((skill) => (
            <li key={skill.id} className={styles.skill}>
              <span className={styles.skillName}>{skill.skill}</span>
              <span className={styles.muted}>{years(skill.years)} of experience</span>
            </li>
          ))}
        </ul>
        <p className={styles.muted}>Each skill listed here was checked against a certificate by the MOTEXA team.</p>
      </section>

      <section className={styles.section} aria-labelledby="gallery-title">
        <h2 id="gallery-title" className={styles.sectionTitle}>
          Workshop photos
        </h2>
        <PhotoGallery files={mechanic.workshopPhotos} label={`${mechanic.workshopName} workshop`} />
      </section>

      <ReviewList targetId={mechanic.id} />

    </div>
  )
}
