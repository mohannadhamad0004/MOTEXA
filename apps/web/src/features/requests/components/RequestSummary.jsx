import { Link } from 'react-router'
import StatusIndicator from '../../../components/StatusIndicator.jsx'
import { towProblemLabel } from '../../logistics/constants.js'
import { formatPrice } from '../../marketplace/format.js'
import { formatCar } from '../carDetails.js'
import { REPORT_TYPES, REQUEST_TYPE_LABELS, REQUEST_TYPES, requestStatusBadge } from '../constants.js'
import { describeServiceMode, formatDateTime } from '../format.js'
import AttachedReport from './AttachedReport.jsx'
import styles from './RequestSummary.module.css'

// The request a chat is about, at the top of the conversation: type, status, car, what was asked,
// the attached AI report (service requests), and how it ended once completed. `showReportLink`
// links the customer to the printable report.
export default function RequestSummary({ request, showReportLink = false }) {
  const { details, completion } = request
  const badge = requestStatusBadge(request.status)

  return (
    <section className={styles.summary} aria-label="Request details">
      <div className={styles.header}>
        <p className={styles.type}>
          {REQUEST_TYPE_LABELS[request.type]} · <span className={styles.muted}>{request.id}</span>
        </p>
        <StatusIndicator label={badge.label} tone={badge.tone} />
      </div>

      <dl className={styles.facts}>
        {details.car && <Fact label="Car" value={formatCar(details.car)} />}
        {request.type === REQUEST_TYPES.SERVICE && details.mode && (
          <Fact label="Service" value={describeServiceMode(details)} />
        )}
        {request.type === REQUEST_TYPES.SERVICE && <Fact label="Problem" value={details.problem} wide />}
        {request.type === REQUEST_TYPES.TOW && (
          <>
            <Fact label="Pickup" value={details.pickup} />
            <Fact label="Destination" value={details.destination} />
            {details.problemType && <Fact label="Problem" value={towProblemLabel(details.problemType)} />}
            {details.note && <Fact label="Note" value={details.note} wide />}
          </>
        )}
        {request.type === REQUEST_TYPES.PART_QUESTION && (
          <>
            <Fact label="Part" value={`${request.target.partName} × ${details.quantity}`} />
            <Fact label="Message" value={details.message} wide />
          </>
        )}
        <Fact label="Sent" value={formatDateTime(request.createdAt)} />
      </dl>

      {details.diagnosis && <AttachedReport diagnosis={details.diagnosis} />}

      {request.purchasedParts?.length > 0 && (
        <div className={styles.parts}>
          <p className={styles.partsTitle}>Parts ordered for this request</p>
          <ul>
            {request.purchasedParts.map((part) => (
              <li key={`${part.orderId}-${part.name}`}>
                {part.quantity} × {part.name} · {formatPrice(part.quantity * part.priceIls)}{' '}
                <span className={styles.muted}>
                  ({part.shopName}, order {part.checkoutNumber})
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {completion && (
        <div className={styles.completion}>
          <p>
            <strong>Completed {formatDateTime(completion.completedAt)}</strong>
            {completion.confirmedDiagnosis && ` · ${completion.confirmedDiagnosis}`}
            {completion.truck && ` · truck ${completion.truck.plateNumber}`}
            {completion.note && ` · ${completion.note}`}
            {completion.totalIls !== undefined && ` · ${formatPrice(completion.totalIls)}`}
          </p>
          {showReportLink && REPORT_TYPES.includes(request.type) && (
            <Link to={`/reports/${request.id}`}>View the report</Link>
          )}
        </div>
      )}
    </section>
  )
}

function Fact({ label, value, wide = false }) {
  return (
    <div className={wide ? styles.wide : undefined}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}
