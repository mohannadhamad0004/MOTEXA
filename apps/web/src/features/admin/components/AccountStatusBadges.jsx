import { STATUS_BADGES } from '../../../auth/constants.js'
import StatusIndicator from '../../../components/StatusIndicator.jsx'
import styles from './AccountStatusBadges.module.css'

// Approval status plus a "Suspended" badge when the account is suspended.
export default function AccountStatusBadges({ account }) {
  const status = STATUS_BADGES[account.status]
  return (
    <span className={styles.badges}>
      {status && <StatusIndicator label={status.label} tone={status.tone} />}
      {account.suspended && <StatusIndicator label="Suspended" tone="danger" />}
    </span>
  )
}
