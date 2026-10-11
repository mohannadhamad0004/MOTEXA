import { useState } from 'react'
import Button from '../../components/Button.jsx'
import Notice from '../../components/Notice.jsx'
import { useToast } from '../../components/Toast/ToastContext.js'
import { formatDate } from '../../utils/formatDate.js'
import { REVIEW_STATUS, REVIEWED_FIELD_LABELS } from '../constants.js'
import { useProfileService } from '../useAuth.js'
import styles from './ChangeStatusNotice.module.css'

// Under a reviewed field (business/workshop name, business license): the change waiting for an
// admin, with "Withdraw", or the admin's reason for rejecting it, with "Dismiss".
// `change` is from account.pendingChanges (or null: renders nothing). `children` describe the new
// value. onWithdrawn() runs after the change was withdrawn or dismissed.
export default function ChangeStatusNotice({ change, children, onWithdrawn = () => {} }) {
  const service = useProfileService()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  if (!change) return null

  const label = REVIEWED_FIELD_LABELS[change.field]
  const pending = change.status === REVIEW_STATUS.PENDING

  async function withdraw() {
    setBusy(true)
    try {
      await service.withdrawChange(change.field)
      onWithdrawn()
      if (pending) toast.success(`Your new ${label.toLowerCase()} was withdrawn.`)
    } catch (error) {
      toast.error(error.message)
      setBusy(false)
    }
  }

  return (
    <Notice
      tone={pending ? 'warning' : 'danger'}
      title={pending ? `New ${label.toLowerCase()} waiting for review` : `New ${label.toLowerCase()} not approved`}
    >
      <div className={styles.body}>
        {children}
        {pending ? (
          <p>Sent {formatDate(change.submittedAt)}. Your public profile keeps the approved one until MOTEXA approves it.</p>
        ) : (
          <p>
            <strong>Reason:</strong> {change.rejectionReason}
          </p>
        )}
        <div>
          <Button size="sm" variant="secondary" onClick={withdraw} loading={busy}>
            {pending ? 'Withdraw change' : 'Dismiss'}
          </Button>
        </div>
      </div>
    </Notice>
  )
}
