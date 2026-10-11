import { useCallback } from 'react'
import { Link, useParams } from 'react-router'
import { useAuth } from '../../../auth/useAuth.js'
import Button from '../../../components/Button.jsx'
import EmptyState from '../../../components/EmptyState.jsx'
import { SkeletonRows } from '../../../components/Skeleton.jsx'
import { formatDate } from '../../../utils/formatDate.js'
import { EVIDENCE, URGENCY } from '../../diagnosis/constants.js'
import { truckTypeLabel } from '../../logistics/format.js'
import { formatPrice } from '../../marketplace/format.js'
import { formatCar } from '../carDetails.js'
import { REPORT_TYPES, REQUEST_STATUS, REQUEST_TYPES } from '../constants.js'
import { describeServiceMode, formatDateTime, TARGET_PATHS } from '../format.js'
import { useRequestsQuery } from '../RequestsContext.js'
import { ConfirmCompletion } from '../components/CompletionActions.jsx'
import RateExperience from '../components/RateExperience.jsx'
import WorkDetails from '../components/WorkDetails.jsx'
import styles from './ReportPage.module.css'

// /reports/:requestId (customers) - the final report of one completed service or tow request, laid
// out for printing: "Print / Save as PDF" opens the browser's print dialog, and the print styles
// leave out the navigation and buttons and use light colors in both themes.
export default function ReportPage() {
  const { requestId } = useParams()
  const { user } = useAuth()
  const load = useCallback((service) => service.getRequest(requestId), [requestId])
  const { data: request, loading } = useRequestsQuery(load)

  if (loading) return <SkeletonRows rows={5} label="Loading the report…" />

  const isReport =
    request &&
    request.sender.id === user.id &&
    request.status === REQUEST_STATUS.COMPLETED &&
    REPORT_TYPES.includes(request.type)
  if (!isReport) {
    return (
      <EmptyState
        icon="📄"
        headingLevel="h1"
        title="Report not found"
        description="Reports exist for your completed service and tow requests."
        action={<Button to="/reports">Back to reports</Button>}
      />
    )
  }

  const isService = request.type === REQUEST_TYPES.SERVICE
  const { details, completion } = request
  const targetPath = TARGET_PATHS[request.target.type](request.target.id)

  return (
    <div className={styles.page}>
      <div className={styles.toolbar}>
        <Button to="/reports" variant="ghost" size="sm">
          ← Reports
        </Button>
        <Button onClick={() => window.print()}>Print / Save as PDF</Button>
      </div>

      <article className={styles.report} aria-labelledby="report-title">
        <header className={styles.header}>
          <div>
            <p className={styles.brand}>
              <span className={styles.brandAccent}>Mo</span>texa
            </p>
            <h1 id="report-title" className={styles.title}>
              {isService ? 'Service report' : 'Tow report'}
            </h1>
          </div>
          <dl className={styles.meta}>
            <div>
              <dt>Report</dt>
              <dd>{request.id}</dd>
            </div>
            <div>
              <dt>Date</dt>
              <dd>{formatDate(completion.completedAt)}</dd>
            </div>
            <div>
              <dt>Customer</dt>
              <dd>{request.sender.name}</dd>
            </div>
          </dl>
        </header>

        <section className={styles.section}>
          <dl className={styles.facts}>
            <Fact label={isService ? 'Mechanic' : 'Tow company'}>
              <Link to={targetPath}>{request.target.name}</Link>
            </Fact>
            {details.car && <Fact label="Car">{formatCar(details.car)}</Fact>}
            {isService && details.mode && <Fact label="Service">{describeServiceMode(details)}</Fact>}
            {!isService && (
              <>
                <Fact label="Pickup">{details.pickup}</Fact>
                <Fact label="Destination">{details.destination}</Fact>
                <Fact label="Truck">
                  {completion.truck.plateNumber} ({truckTypeLabel(completion.truck.type)})
                </Fact>
              </>
            )}
            <Fact label="Requested">{formatDateTime(request.createdAt)}</Fact>
          </dl>
        </section>

        {isService && (
          <>
            <section className={styles.section} aria-labelledby="report-problem">
              <h2 id="report-problem" className={styles.sectionTitle}>
                Problem reported
              </h2>
              <p>{details.problem}</p>
            </section>

            <section className={styles.section} aria-labelledby="report-compare">
              <h2 id="report-compare" className={styles.sectionTitle}>
                AI diagnosis and the mechanic&apos;s diagnosis
              </h2>
              <div className={styles.compare}>
                <div className={styles.column}>
                  <p className={styles.columnTitle}>AI preliminary diagnosis</p>
                  {details.diagnosis ? (
                    <>
                      <p>{URGENCY[details.diagnosis.urgency].label}</p>
                      <ol className={styles.causes}>
                        {details.diagnosis.possibleCauses.map(({ cause, evidence }) => (
                          <li key={cause}>
                            {cause} <span className={styles.muted}>({EVIDENCE[evidence].label.toLowerCase()})</span>
                          </li>
                        ))}
                      </ol>
                    </>
                  ) : (
                    <p className={styles.muted}>No AI report was attached to this request.</p>
                  )}
                </div>
                <div className={styles.column}>
                  <p className={styles.columnTitle}>Confirmed by the mechanic</p>
                  <p>
                    <strong>{completion.confirmedDiagnosis}</strong>
                  </p>
                </div>
              </div>
            </section>

            <section className={styles.section} aria-labelledby="report-work">
              <h2 id="report-work" className={styles.sectionTitle}>
                Work done, parts and cost
              </h2>
              <WorkDetails completion={completion} />
            </section>
          </>
        )}

        {!isService && (
          <section className={styles.section} aria-labelledby="report-cost">
            <h2 id="report-cost" className={styles.sectionTitle}>
              Cost
            </h2>
            <p className={styles.total}>{formatPrice(completion.totalIls)}</p>
          </section>
        )}

        <footer className={styles.footer}>
          <ConfirmCompletion request={request} />
          <RateExperience request={request} compact />
          <p className={styles.muted}>
            MOTEXA report {request.id}. The AI diagnosis is a preliminary assessment; the mechanic&apos;s diagnosis
            is the final one.
          </p>
        </footer>
      </article>
    </div>
  )
}

function Fact({ label, children }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}
