import { Link } from 'react-router'
import { useAuthQuery } from '../auth/useAuth.js'
import { ROLES } from '../authorization/roles.js'
import Button from '../components/Button.jsx'
import { SkeletonCards } from '../components/Skeleton.jsx'
import { formatPrice } from '../features/marketplace/format.js'
import { useMarketplaceQuery } from '../features/marketplace/MarketplaceContext.js'
import MechanicCard from '../features/mechanics/components/MechanicCard.jsx'
import EmergencyButton from '../features/requests/emergency/components/EmergencyButton.jsx'
import { useRatingSummaries } from '../features/requests/ReviewsContext.js'
import styles from './Home.module.css'

const steps = [
  {
    title: 'Upload',
    text: 'Take a photo of a warning light or leak, film the smoke, or record the engine noise right in your browser.',
  },
  {
    title: 'Get your AI report',
    text: 'See what the AI noticed, the possible causes with how strong the evidence is, and whether it is safe to drive.',
  },
  {
    title: 'Connect with a verified mechanic',
    text: 'Find a mechanic with the right skill. They confirm or correct the diagnosis and fix your car.',
  },
]

const destinations = [
  {
    to: '/diagnose',
    title: 'Diagnose a problem',
    text: 'Upload a photo, video or engine sound and get a preliminary AI report.',
    cta: 'Start a diagnosis',
  },
  {
    to: '/mechanics',
    title: 'Find a mechanic',
    text: 'Every mechanic is checked by MOTEXA. Filter by skill and city, and send a request.',
    cta: 'Find a mechanic',
  },
  {
    to: '/marketplace',
    title: 'Buy car parts',
    text: 'Search parts from every shop by part number, name or car, with typo-tolerant search.',
    cta: 'Search parts',
  },
  {
    to: '/tow-companies',
    title: 'Get a tow',
    text: 'Stuck on the road? Find a verified tow company that covers your city.',
    cta: 'Find a tow truck',
  },
]

const trustPoints = [
  { title: 'Documents checked', text: 'Business licenses and certificates are reviewed by our team before an account goes public.' },
  { title: 'Skills approved one by one', text: 'A mechanic only shows the skills an admin has approved.' },
  { title: 'Real reviews', text: 'Only customers of a completed request can review, once per request.' },
]
// Featured picks: tagged items first ("Top Rated" mechanics, "Best Seller" / "On Offer" parts).
const TOP_RATED = 't-4'
const PROMOTED_PART_TAGS = ['t-2', 't-3']
const byTag = (hasTag) => (a, b) => Number(hasTag(b)) - Number(hasTag(a))

// TODO: replace with real API calls (GET /api/mechanics, GET /api/marketplace/parts)
const loadMechanics = (service) => service.getDirectory(ROLES.MECHANIC)
const loadParts = (service) => service.getParts()

const pad = (n) => String(n).padStart(2, '0')

// "/" - hero with the diagnosis preview, service index, how it works, featured providers and parts,
// the trust section and the emergency callout. The diagnosis itself lives at /diagnose.
export default function Home() {
  return (
    <div className={styles.page}>
      <section className={styles.hero} aria-labelledby="home-title">
        <div className={styles.heroText}>
          <p className={styles.kicker}>AI diagnosis · Free to try</p>
          <h1 id="home-title" className={styles.heroTitle}>
            Understand what&apos;s wrong with your <span className={styles.heroAccent}>car</span>, then get it fixed.
          </h1>
          <p className={styles.heroSubtitle}>
            Upload a photo, a video or the sound of your engine. MOTEXA&apos;s AI gives you a preliminary diagnosis in
            seconds, and a verified mechanic confirms it.
          </p>
          <div className={styles.heroActions}>
            <Button to="/diagnose" size="lg">
              Diagnose my car
            </Button>
            <Button to="/mechanics" variant="ghost" size="lg">
              Find a mechanic →
            </Button>
          </div>
          <ul className={styles.trust} aria-label="Why MOTEXA">
            <li>Verified providers</li>
            <li>AI-assisted triage</li>
            <li>Towing assistance</li>
          </ul>
        </div>
        <ReportPreview />
      </section>

      <section className={styles.index} aria-labelledby="explore-title">
        <h2 id="explore-title" className={styles.indexTitle}>
          What do you need right now?
        </h2>
        <ul className={styles.destinations}>
          {destinations.map((item, index) => (
            <li key={item.to} className={styles.destination}>
              <span className={styles.destinationNo} aria-hidden="true">
                {pad(index + 1)}
              </span>
              <h3 className={styles.destinationTitle}>
                <Link to={item.to} className={styles.destinationLink}>
                  {item.title}
                </Link>
              </h3>
              <p className={styles.destinationText}>{item.text}</p>
              <span className={styles.destinationCta} aria-hidden="true">
                {item.cta} <span className={styles.arrow}>→</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.how} aria-labelledby="how-title">
        <div className={styles.howHeader}>
          <h2 id="how-title" className={styles.bigTitle}>
            How MOTEXA works
          </h2>
          <p className={styles.lead}>From “what's that noise?” to a mechanic who knows what to fix.</p>
        </div>
        <ol className={styles.steps}>
          {steps.map((step, index) => (
            <li key={step.title} className={styles.step}>
              <span className={styles.stepNode} aria-hidden="true">
                {index + 1}
              </span>
              <h3 className={styles.stepTitle}>
                <span className={styles.srOnly}>Step {index + 1}: </span>
                {step.title}
              </h3>
              <p className={styles.stepText}>{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <Featured />

      <section className={`${styles.railed} ${styles.trustSection}`} aria-labelledby="trust-title">
        <div className={styles.rail}>
          <h2 id="trust-title" className={styles.railTitle}>
            Verified before they&apos;re visible
          </h2>
          <p className={styles.railText}>Nobody appears on MOTEXA until an admin has checked them.</p>
        </div>
        <ul className={styles.trustGrid}>
          {trustPoints.map((point, index) => (
            <li key={point.title} className={styles.trustItem}>
              <span className={styles.trustNo} aria-hidden="true">
                {pad(index + 1)}
              </span>
              <h3 className={styles.trustTitle}>{point.title}</h3>
              <p className={styles.stepText}>{point.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.emergency} aria-labelledby="home-emergency-title">
        <div className={styles.emergencyText}>
          <h2 id="home-emergency-title" className={styles.emergencyTitle}>
            Broken down right now?
          </h2>
          <p className={styles.lead}>
            Skip the search: send your location and the nearest tow truck or on-site mechanic is alerted.
          </p>
        </div>
        <div className={styles.emergencyAction}>
          <EmergencyButton variant="large" />
          <Button to="/tow-companies" variant="secondary">
            Browse tow companies
          </Button>
        </div>
      </section>
    </div>
  )
}

// A product preview made from UI (not a screenshot): what a MOTEXA report looks like, as a ruled sheet.
function ReportPreview() {
  return (
    <figure className={styles.preview} aria-label="Example of an AI diagnosis report">
      <figcaption className={styles.previewCaption}>
        <span>Example report</span>
        <span>Hyundai Accent 2016</span>
      </figcaption>
      <dl className={styles.previewRows}>
        <div className={styles.previewRow}>
          <dt>Urgency</dt>
          <dd className={styles.previewUrgency}>
            <span className={styles.previewDot} aria-hidden="true" />
            Inspect soon
          </dd>
        </div>
        <div className={`${styles.previewRow} ${styles.previewMain}`}>
          <dt>Most likely issue</dt>
          <dd className={styles.previewIssue}>Worn serpentine belt</dd>
        </div>
        <div className={styles.previewRow}>
          <dt>Evidence</dt>
          <dd className={styles.previewEvidence}>
            <span className={styles.previewMeter} aria-hidden="true">
              <span /> <span /> <span className={styles.previewOff} />
            </span>
            Moderate
          </dd>
        </div>
        <div className={styles.previewRow}>
          <dt>Suggested specialty</dt>
          <dd>Engine mechanic</dd>
        </div>
      </dl>
    </figure>
  )
}

// A few mechanics and parts from the (mock) data, tagged ones first.
function Featured() {
  const mechanics = useAuthQuery(loadMechanics)
  const ratings = useRatingSummaries()
  const parts = useMarketplaceQuery(loadParts)

  const featuredMechanics = (mechanics.data ?? [])
    .toSorted(byTag((m) => m.tagIds.includes(TOP_RATED)))
    .slice(0, 3)
  const featuredParts = (parts.data ?? [])
    .toSorted(byTag((p) => p.tagIds?.some((id) => PROMOTED_PART_TAGS.includes(id))))
    .slice(0, 4)

  return (
    <section className={styles.featured} aria-labelledby="featured-title">
      <h2 id="featured-title" className={styles.bigTitle}>
        Featured on MOTEXA
      </h2>

      <div className={styles.railed}>
        <div className={styles.rail}>
          <h3 className={styles.railTitle}>Top mechanics</h3>
          <Link to="/mechanics" className={styles.seeAll}>
            See all mechanics →
          </Link>
        </div>
        {!mechanics.data ? (
          <SkeletonCards count={3} label="Loading mechanics…" />
        ) : (
          <ul className={styles.strip}>
            {featuredMechanics.map((mechanic) => (
              <li key={mechanic.id}>
                <MechanicCard mechanic={mechanic} rating={ratings[mechanic.id]} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={styles.railed}>
        <div className={styles.rail}>
          <h3 className={styles.railTitle}>Popular parts</h3>
          <Link to="/marketplace" className={styles.seeAll}>
            See all parts →
          </Link>
        </div>
        {!parts.data ? (
          <SkeletonCards count={4} label="Loading parts…" />
        ) : (
          <ul className={styles.parts}>
            {featuredParts.map((part) => (
              <li key={part.id} className={styles.part}>
                <span className={styles.partCategory}>{part.category}</span>
                <h4 className={styles.partName}>
                  <Link
                    to={`/marketplace/search?q=${encodeURIComponent(part.oemNumber || part.name)}`}
                    className={styles.partLink}
                  >
                    {part.name}
                  </Link>
                </h4>
                <p className={styles.partMeta}>
                  {part.brand} · fits {part.fitments[0]?.make} {part.fitments[0]?.model}
                  {part.fitments.length > 1 && ` +${part.fitments.length - 1}`}
                </p>
                <p className={styles.partPrice}>{formatPrice(part.priceIls)}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
