import FilePreview from '../components/FilePreview.jsx'
import StatusIndicator from '../components/StatusIndicator.jsx'
import { ROLES } from '../authorization/roles.js'
import { formatDate } from '../utils/formatDate.js'
import {
  ACCOUNT_STATUS,
  ACCOUNT_TYPE_LABELS,
  COMPANY_ROLES,
  REVIEW_STATUS_BADGES,
  REVIEWED_FIELD_LABELS,
  SKILL_STATUS_BADGES,
  STATUS_BADGES,
} from './constants.js'
import { serviceModeLabel, TRUCK_STATUSES, TRUCK_TYPES } from './signup/constants.js'
import styles from './AccountSummary.module.css'

const truckTypeLabel = (value) => TRUCK_TYPES.find((type) => type.value === value)?.label ?? value
const truckStatusLabel = (value) => TRUCK_STATUSES.find((status) => status.value === value)?.label ?? value

// Everything an account submitted: details, skills with certificates, documents, trucks and
// photos, and changes waiting for review. Used by the signup review step, the pending-approval page
// and the admin pages.
// `account` has the Account shape from types.js (a signup form works too - status is optional).
// Each skill shows its review status; the admin review passes renderSkillActions(skill) to put
// approve/reject controls on each skill instead.
export default function AccountSummary({ account, renderSkillActions = null }) {
  const { role } = account
  const isCompany = COMPANY_ROLES.includes(role)
  const status = STATUS_BADGES[account.status]

  return (
    <div className={styles.summary}>
      <section className={styles.section}>
        <div className={styles.identity}>
          <div>
            <h3 className={styles.name}>{account.name}</h3>
            <p className={styles.muted}>{ACCOUNT_TYPE_LABELS[role]}</p>
          </div>
          {status && <StatusIndicator label={status.label} tone={status.tone} />}
        </div>
        <dl className={styles.details}>
          <Detail label="Email" value={account.email} />
          <Detail label="Phone" value={account.phone} />
          <Detail label="City" value={account.city} />
          <Detail label="Workshop name" value={account.workshopName} />
          <Detail label={role === ROLES.MECHANIC ? 'Workshop address' : 'Address'} value={account.address} />
          <Detail label="Cities covered" value={account.serviceArea?.join(', ')} />
          <Detail label="Services offered" value={account.serviceModes?.map(serviceModeLabel).join(', ')} />
          <Detail label="On-site cities" value={account.onSiteCities?.join(', ')} />
          <Detail label="Description" value={account.description} wide />
          <Detail label="Submitted" value={account.createdAt && formatDate(account.createdAt)} />
          <Detail label="Rejection reason" value={account.rejectionReason} wide />
        </dl>
      </section>

      <FileGroup title={isCompany ? 'Logo' : 'Profile photo'} files={account.profilePhoto} emptyText="No photo" />

      {account.skills && (
        <section className={styles.section}>
          <h4 className={styles.sectionTitle}>Skills and certificates</h4>
          <ul className={styles.cards}>
            {account.skills.map((skill) => {
              const skillStatus = !renderSkillActions && SKILL_STATUS_BADGES[skill.status]
              return (
                <li key={skill.id} className={styles.card}>
                  <div className={styles.cardHeader}>
                    <p className={styles.cardTitle}>{skill.skill}</p>
                    {skillStatus && <StatusIndicator label={skillStatus.label} tone={skillStatus.tone} />}
                  </div>
                  <p className={styles.muted}>
                    {skill.years} {Number(skill.years) === 1 ? 'year' : 'years'} of experience
                  </p>
                  {skillStatus && skill.rejectionReason && (
                    <p className={styles.muted}>Reason: {skill.rejectionReason}</p>
                  )}
                  <FileGroup title="Certificate" files={skill.certificate} small />
                  {renderSkillActions?.(skill)}
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {'businessLicense' in account && (
        <FileGroup
          title={role === ROLES.PARTS_SHOP ? 'Business license / commercial registration' : 'Business license'}
          files={account.businessLicense}
        />
      )}
      {account.extraDocuments && (
        <FileGroup title="Other documents" files={account.extraDocuments} emptyText="None added" />
      )}

      {account.trucks && (
        <section className={styles.section}>
          <h4 className={styles.sectionTitle}>Trucks ({account.trucks.length})</h4>
          <ul className={styles.cards}>
            {account.trucks.map((truck, index) => {
              // Trucks of a pending signup are reviewed with the account; after that, one by one.
              const review = account.status === ACCOUNT_STATUS.APPROVED && REVIEW_STATUS_BADGES[truck.reviewStatus]
              return (
                <li key={truck.id} className={styles.card}>
                  <div className={styles.cardHeader}>
                    <p className={styles.cardTitle}>
                      Truck {index + 1}: {truck.plateNumber}
                    </p>
                    {review && <StatusIndicator label={review.label} tone={review.tone} />}
                  </div>
                  <p className={styles.muted}>
                    {truckTypeLabel(truck.type)} · carries up to {Number(truck.maxWeightKg).toLocaleString('en')} kg
                    {truck.status && ` · ${truckStatusLabel(truck.status)}`}
                  </p>
                  {review && truck.rejectionReason && <p className={styles.muted}>Reason: {truck.rejectionReason}</p>}
                  <FileGroup title="Photos" files={truck.photos} small />
                  <FileGroup title="Registration" files={truck.registration} small />
                  <FileGroup title="Insurance" files={truck.insurance} small />
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {account.workshopPhotos && <FileGroup title="Workshop photos" files={account.workshopPhotos} />}
      {account.shopPhotos && <FileGroup title="Shop photos" files={account.shopPhotos} />}

      {account.pendingChanges?.length > 0 && (
        <section className={styles.section}>
          <h4 className={styles.sectionTitle}>Changes sent for review</h4>
          <ul className={styles.cards}>
            {account.pendingChanges.map((change) => {
              const badge = REVIEW_STATUS_BADGES[change.status]
              return (
                <li key={change.field} className={styles.card}>
                  <div className={styles.cardHeader}>
                    <p className={styles.cardTitle}>{REVIEWED_FIELD_LABELS[change.field]}</p>
                    <StatusIndicator label={badge.label} tone={badge.tone} />
                  </div>
                  {change.value instanceof Blob ? (
                    <FileGroup title="New file" files={change.value} small />
                  ) : (
                    <p>New: {change.value}</p>
                  )}
                  {change.rejectionReason && <p className={styles.muted}>Reason: {change.rejectionReason}</p>}
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}

function Detail({ label, value, wide = false }) {
  if (!value) return null
  return (
    <div className={wide ? styles.wide : undefined}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

// A titled row of file previews. `files` may be one File, an array, or empty.
function FileGroup({ title, files, emptyText = 'Missing', small = false }) {
  const list = (Array.isArray(files) ? files : [files]).filter(Boolean)
  const Heading = small ? 'p' : 'h4'

  return (
    <section className={small ? styles.group : styles.section}>
      <Heading className={small ? styles.groupTitle : styles.sectionTitle}>{title}</Heading>
      {list.length ? (
        <ul className={styles.files}>
          {list.map((file) => (
            <li key={`${file.name}-${file.size}-${file.lastModified}`}>
              <FilePreview file={file} />
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.muted}>{emptyText}</p>
      )}
    </section>
  )
}
