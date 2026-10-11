import { useState } from 'react'
import Badge from '../../../components/Badge.jsx'
import Button from '../../../components/Button.jsx'
import Modal from '../../../components/Modal.jsx'
import Notice from '../../../components/Notice.jsx'
import { useToast } from '../../../components/Toast/ToastContext.js'
import { completeLabel, REQUEST_STATUS, REQUEST_TYPES } from '../constants.js'
import { useRequestsService } from '../RequestsContext.js'
import CompleteRequestDialog from './CompleteRequestDialog.jsx'
import styles from './CompletionActions.module.css'

const senderWord = (request) => (request.sender.role === 'mechanic' ? 'mechanic' : 'customer')

/**
 * For the mechanic, tow company or shop that got the request. Open request: "Mark as completed" (a
 * tow company first presses "Arrived"; a shop says "Sale completed"). Completed request: whether
 * the sender confirmed it yet. Used in the chat header and in the dashboards' request lists.
 * `trucks` are the tow company's approved trucks.
 */
export function ProviderCompletion({ request, trucks = [] }) {
  const service = useRequestsService()
  const toast = useToast()
  const [completing, setCompleting] = useState(false)
  const [busy, setBusy] = useState(false)

  if (request.status === REQUEST_STATUS.COMPLETED) {
    if (request.disputedAt) return <Badge tone="danger">The {senderWord(request)} says this didn't happen</Badge>
    if (request.customerConfirmedAt) return <Badge tone="success">Confirmed by the {senderWord(request)}</Badge>
    return <Badge tone="warning">Waiting for the {senderWord(request)} to confirm</Badge>
  }

  async function markArrived() {
    setBusy(true)
    try {
      await service.markArrived(request.id)
      toast.success('Marked as arrived. Complete the request when the job is done.')
    } catch (error) {
      toast.error(error.message)
    } finally {
      setBusy(false)
    }
  }

  if (request.type === REQUEST_TYPES.TOW && !request.arrivedAt) {
    return (
      <Button size="sm" onClick={markArrived} loading={busy}>
        Arrived
      </Button>
    )
  }

  return (
    <>
      <Button size="sm" onClick={() => setCompleting(true)}>
        {completeLabel(request)}
      </Button>
      <CompleteRequestDialog request={request} trucks={trucks} open={completing} onClose={() => setCompleting(false)} />
    </>
  )
}

/**
 * For the sender of a request (the customer, or the mechanic for a part question) once the provider
 * marked it completed: "Confirm completed" or "This didn't happen" (flags it for the admins). Reviews
 * open after the confirmation. Renders nothing when there is nothing to answer.
 */
export function ConfirmCompletion({ request }) {
  const service = useRequestsService()
  const toast = useToast()
  const [busy, setBusy] = useState(null)
  const [asking, setAsking] = useState(false)

  if (request.status !== REQUEST_STATUS.COMPLETED || request.customerConfirmedAt) return null
  if (request.disputedAt) {
    return <Notice tone="warning">You told MOTEXA this didn't happen. An admin will look into it.</Notice>
  }

  async function answer(kind) {
    setBusy(kind)
    try {
      if (kind === 'confirm') {
        await service.confirmCompleted(request.id)
        toast.success('Thanks for confirming. You can now rate your experience.')
      } else {
        await service.disputeCompleted(request.id)
        toast.success('We flagged this request for an admin.')
      }
      setAsking(false)
    } catch (error) {
      toast.error(error.message)
      setBusy(null)
    }
  }

  return (
    <div className={styles.confirm}>
      <div>
        <p className={styles.title}>{request.target.name} marked this as completed</p>
        <p className={styles.text}>Did it happen? You can rate them after you confirm.</p>
      </div>
      <div className={styles.buttons}>
        <Button onClick={() => answer('confirm')} loading={busy === 'confirm'} disabled={Boolean(busy)}>
          Confirm completed
        </Button>
        <Button variant="secondary" onClick={() => setAsking(true)} disabled={Boolean(busy)}>
          This didn't happen
        </Button>
      </div>
      <Modal open={asking} title="This didn't happen?" onClose={() => setAsking(false)}>
        <p className={styles.text}>
          MOTEXA will flag this request for an admin to look into. You won't be able to review {request.target.name}{' '}
          for it.
        </p>
        <div className={styles.dialogActions}>
          <Button variant="secondary" onClick={() => setAsking(false)} disabled={Boolean(busy)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => answer('dispute')} loading={busy === 'dispute'}>
            Yes, this didn't happen
          </Button>
        </div>
      </Modal>
    </div>
  )
}
