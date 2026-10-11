import { useCallback } from 'react'
import { useParams } from 'react-router'
import { useAuthQuery } from '../../../auth/useAuth.js'
import { ROLES } from '../../../authorization/roles.js'
import Avatar from '../../../components/Avatar.jsx'
import Button from '../../../components/Button.jsx'
import EmptyState from '../../../components/EmptyState.jsx'
import { SkeletonRows } from '../../../components/Skeleton.jsx'
import FileImage from '../../../components/FileImage.jsx'
import TagBadges from '../../../components/TagBadges.jsx'
import VerifiedBadge from '../../../components/VerifiedBadge.jsx'
import { resolveTags, useTags } from '../../../context/TagsContext.js'
import { RequestTowButton } from '../../requests/components/RequestButtons.jsx'
import ReviewList from '../../requests/components/ReviewList.jsx'
import { RatingSummary } from '../../requests/components/Stars.jsx'
import { useRatingSummaries } from '../../requests/ReviewsContext.js'
import { formatWeight, truckTypeLabel } from '../format.js'
import styles from './TowCompanyProfile.module.css'

// /tow-companies/:companyId - public profile of an approved tow company. Plate numbers and truck
// documents are not part of the public profile; only admins see them. Trucks still waiting for
// review are left out.
export default function TowCompanyProfile() {
  const { companyId } = useParams()
  // TODO: replace with real API call (GET /api/tow-companies/:id)
  const loadCompany = useCallback((service) => service.getDirectoryEntry(ROLES.TOW, companyId), [companyId])
  const { data: company, error, loading } = useAuthQuery(loadCompany)
  const allTags = useTags()
  const ratings = useRatingSummaries()

  if (error) return <EmptyState icon="⚠" title="Couldn't load this tow company" description="Please try again in a moment." />
  if (loading) return <SkeletonRows rows={4} label="Loading…" />

  if (!company) {
    return (
      <EmptyState
        icon="🚚"
        headingLevel="h1"
        title="Tow company not found"
        description="This company isn't on MOTEXA, or its account is still being reviewed."
        action={<Button to="/tow-companies">Back to tow companies</Button>}
      />
    )
  }

  return (
    <div className={styles.page}>
      <Button to="/tow-companies" variant="ghost" size="sm" className={styles.back}>
        ← All tow companies
      </Button>

      <header className={styles.header}>
        <Avatar file={company.profilePhoto} name={company.name} size="lg" />
        <div className={styles.headerText}>
          <VerifiedBadge />
          <h1 className={styles.title}>{company.name}</h1>
          <p className={styles.muted}>
            Based in {company.city}
            {company.address && ` · ${company.address}`}
          </p>
          <RatingSummary summary={ratings[company.id]} />
          <TagBadges tags={resolveTags(company.tagIds, allTags)} />
          {company.description && <p className={styles.description}>{company.description}</p>}
        </div>
        <div className={styles.headerAction}>
          <RequestTowButton company={company} />
        </div>
      </header>

      <section className={styles.section} aria-labelledby="area-title">
        <h2 id="area-title" className={styles.sectionTitle}>
          Service area
        </h2>
        <ul className={styles.cities}>
          {company.serviceArea.map((city) => (
            <li key={city} className={styles.city}>
              {city}
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.section} aria-labelledby="trucks-title">
        <h2 id="trucks-title" className={styles.sectionTitle}>
          Trucks ({company.trucks.length})
        </h2>
        <ul className={styles.trucks}>
          {company.trucks.map((truck) => (
            <li key={truck.id} className={styles.truck}>
              <div className={styles.truckPhoto}>
                <FileImage file={truck.photos[0]} alt={`${truckTypeLabel(truck.type)} truck`} className={styles.image} />
              </div>
              <div className={styles.truckBody}>
                <p className={styles.truckType}>{truckTypeLabel(truck.type)}</p>
                <p className={styles.muted}>Carries vehicles up to {formatWeight(truck.maxWeightKg)}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <ReviewList targetId={company.id} />
    </div>
  )
}
