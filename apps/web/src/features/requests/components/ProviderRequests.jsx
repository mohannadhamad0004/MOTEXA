import { useAuth } from '../../../auth/useAuth.js'
import { isApprovedTruck } from '../../../auth/reviewItems.js'
import Button from '../../../components/Button.jsx'
import Notice from '../../../components/Notice.jsx'
import { SkeletonRows } from '../../../components/Skeleton.jsx'
import StatusIndicator from '../../../components/StatusIndicator.jsx'
import { REQUEST_TYPE_LABELS, requestStatusBadge } from '../constants.js'
import { summarizeRequest } from '../format.js'
import { useRequestsQuery } from '../RequestsContext.js'
import { ProviderCompletion } from './CompletionActions.jsx'
import styles from './ProviderRequests.module.css'

const loadIncoming = (service) => service.getIncomingRequests()

/**
 * "Your requests" on the mechanic, tow and parts shop dashboards: requests sent to the logged-in
 * account that are open or waiting for the sender's confirmation, with the same buttons as the chat
 * ("Arrived", "Mark as completed", "Sale completed"). Mock dashboards above/below it still show
 * demo data; this list is the real one.
 */
export default function ProviderRequests() {
  const { user } = useAuth()
  const { data: requests, error } = useRequestsQuery(loadIncoming)
  const trucks = (user.trucks ?? []).filter(isApprovedTruck)

  return (
    <section className={styles.section} aria-labelledby="provider-requests">
      <h2 id="provider-requests" className={styles.title}>
        Your requests
      </h2>
      {error && <Notice tone="danger">Couldn't load your requests: {error.message}</Notice>}
      {!requests && !error && <SkeletonRows rows={2} label="Loading your requests…" />}
      {requests?.length === 0 && <p className={styles.muted}>No open requests. Finished ones are in Chats.</p>}
      {requests?.length > 0 && (
        <ul className={styles.list}>
          {requests.map((request) => (
            <li key={request.id} className={styles.item}>
              <div className={styles.text}>
                <p className={styles.name}>
                  {REQUEST_TYPE_LABELS[request.type]} · {request.sender.name}
                </p>
                <p className={styles.muted}>{summarizeRequest(request)}</p>
              </div>
              <StatusIndicator {...requestStatusBadge(request.status)} />
              <div className={styles.actions}>
                <ProviderCompletion request={request} trucks={trucks} />
                <Button to={`/chats/${request.id}`} size="sm" variant="secondary">
                  Open chat
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
