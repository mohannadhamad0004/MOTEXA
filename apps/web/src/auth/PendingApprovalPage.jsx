import { Navigate, useNavigate } from 'react-router'
import Button from '../components/Button.jsx'
import Notice from '../components/Notice.jsx'
import StatusIndicator from '../components/StatusIndicator.jsx'
import { ROLE_HOME_PATHS } from '../authorization/roles.js'
import { ACCOUNT_STATUS, STATUS_BADGES } from './constants.js'
import { useAuth } from './useAuth.js'
import AccountSummary from './AccountSummary.jsx'
import AuthCard from './AuthCard.jsx'
import styles from './PendingApprovalPage.module.css'

// /pending-approval - where mechanics, parts shops and tow companies land after signup and on
// every login until an admin approves them. Shows their status and everything they submitted.
export default function PendingApprovalPage() {
  const { user, service } = useAuth()
  const navigate = useNavigate()

  if (!user) return <Navigate to="/login" replace />
  if (user.status === ACCOUNT_STATUS.APPROVED) return <Navigate to={ROLE_HOME_PATHS[user.role]} replace />

  const rejected = user.status === ACCOUNT_STATUS.REJECTED
  const badge = STATUS_BADGES[user.status]

  // Leave the page first, so its "not logged in -> /login" redirect doesn't kick in.
  async function handleLogout() {
    await navigate('/')
    await service.logout()
  }

  return (
    <AuthCard
      wide
      title={rejected ? 'Your account was not approved' : "Thanks! We're reviewing your account"}
      subtitle={
        rejected
          ? 'An admin reviewed your documents and could not approve them.'
          : "An admin is checking your documents. Once you're approved, log in again to reach your dashboard."
      }
    >
      <div className={styles.status}>
        <span>Status:</span>
        <StatusIndicator label={badge.label} tone={badge.tone} />
      </div>

      {rejected && (
        <Notice tone="danger" title="Reason">
          <p>{user.rejectionReason}</p>
          <p>Contact MOTEXA support if you have questions about this decision.</p>
        </Notice>
      )}

      <section className={styles.submitted} aria-labelledby="submitted-title">
        <h2 id="submitted-title" className={styles.sectionTitle}>
          What you submitted
        </h2>
        <AccountSummary account={user} />
      </section>

      <div>
        <Button variant="secondary" onClick={handleLogout}>
          Log out
        </Button>
      </div>
    </AuthCard>
  )
}
