import { Link } from 'react-router'
import { SkeletonRows } from '../../../components/Skeleton.jsx'
import StatusIndicator from '../../../components/StatusIndicator.jsx'
import { formatDate } from '../../../utils/formatDate.js'
import { REQUEST_TYPE_LABELS, requestStatusBadge } from '../constants.js'
import { summarizeRequest, TARGET_PATHS } from '../format.js'
import { useRequestsQuery } from '../RequestsContext.js'
import styles from './MyRequestsList.module.css'

const loadMyRequests = (service) => service.getMyRequests()

// The requests the logged-in user sent, newest first.
export default function MyRequestsList() {
  const { data: requests, error } = useRequestsQuery(loadMyRequests)

  if (error) return <p className={styles.muted}>Couldn't load your requests.</p>
  if (!requests) return <SkeletonRows rows={3} label="Loading your requests…" />
  if (requests.length === 0) {
    return (
      <p className={styles.muted}>
        You haven't sent any requests yet. Find a <Link to="/mechanics">mechanic</Link>, a{' '}
        <Link to="/tow-companies">tow company</Link> or a <Link to="/marketplace">part</Link>.
      </p>
    )
  }

  return (
    <ul className={styles.list}>
      {requests.map((request) => (
        <li key={request.id} className={styles.item}>
          <div className={styles.header}>
            <p className={styles.title}>
              {REQUEST_TYPE_LABELS[request.type]} to{' '}
              <Link to={TARGET_PATHS[request.target.type](request.target.id)}>{request.target.name}</Link>
            </p>
            <StatusIndicator {...requestStatusBadge(request.status)} />
          </div>
          <p className={styles.summary}>{summarizeRequest(request)}</p>
          <p className={styles.muted}>
            Sent {formatDate(request.createdAt)} · <Link to={`/chats/${request.id}`}>Open chat</Link>
          </p>
        </li>
      ))}
    </ul>
  )
}
