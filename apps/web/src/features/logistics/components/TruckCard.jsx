import { useId } from 'react'
import { REVIEW_STATUS_BADGES } from '../../../auth/constants.js'
import { TRUCK_STATUSES } from '../../../auth/signup/constants.js'
import Button from '../../../components/Button.jsx'
import Card from '../../../components/Card.jsx'
import FileImage from '../../../components/FileImage.jsx'
import Notice from '../../../components/Notice.jsx'
import Select from '../../../components/Select.jsx'
import StatusIndicator from '../../../components/StatusIndicator.jsx'
import { formatWeight, truckTypeLabel } from '../format.js'
import styles from './TruckCard.module.css'

// One truck on /tow/trucks: photo, plate, type, max weight, its status (changeable right here),
// its review status with the admin's reason if rejected, and the tow request it is on.
export default function TruckCard({ truck, onStatusChange, onEdit, onRemove, statusSaving = false }) {
  const statusId = useId()
  const review = REVIEW_STATUS_BADGES[truck.reviewStatus]
  const typeLabel = truckTypeLabel(truck.type)

  return (
    <Card as="li" padding="none" className={styles.card}>
      <div className={styles.photo}>
        {truck.photos[0] ? (
          <FileImage file={truck.photos[0]} alt={`${typeLabel} truck ${truck.plateNumber}`} className={styles.image} />
        ) : (
          <span className={styles.noPhoto}>No photo</span>
        )}
      </div>

      <div className={styles.body}>
        <div className={styles.header}>
          <div>
            <h2 className={styles.plate}>{truck.plateNumber}</h2>
            <p className={styles.muted}>
              {typeLabel} · carries up to {formatWeight(truck.maxWeightKg)}
            </p>
          </div>
          <StatusIndicator label={review.label} tone={review.tone} />
        </div>

        {truck.reviewStatus === 'pending' && (
          <p className={styles.muted}>Not on your public profile until MOTEXA approves it.</p>
        )}
        {truck.reviewStatus === 'rejected' && (
          <Notice tone="danger" title="Not approved">
            <p>{truck.rejectionReason}</p>
            <p>Edit the truck to fix it - saving sends it back for review.</p>
          </Notice>
        )}
        {truck.activeRequest && (
          <p className={styles.job}>
            <span className={styles.jobLabel}>On request {truck.activeRequest.id}:</span> {truck.activeRequest.summary}
          </p>
        )}

        <div className={styles.status}>
          <label htmlFor={statusId} className={styles.statusLabel}>
            Status
          </label>
          <Select
            id={statusId}
            value={truck.status}
            disabled={statusSaving}
            onChange={(event) => onStatusChange(event.target.value)}
          >
            {TRUCK_STATUSES.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </Select>
        </div>

        <div className={styles.actions}>
          <Button variant="secondary" size="sm" onClick={onEdit}>
            Edit
          </Button>
          <Button variant="ghost" size="sm" className={styles.remove} onClick={onRemove}>
            Remove
          </Button>
        </div>
      </div>
    </Card>
  )
}
