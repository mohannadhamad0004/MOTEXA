import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ACCOUNT_TYPE_LABELS } from '../../../auth/constants.js'
import Button from '../../../components/Button.jsx'
import Notice from '../../../components/Notice.jsx'
import { SkeletonRows } from '../../../components/Skeleton.jsx'
import StatusIndicator from '../../../components/StatusIndicator.jsx'
import { useToast } from '../../../components/Toast/ToastContext.js'
import { formatDate } from '../../../utils/formatDate.js'
import { REVIEW_CRITERIA, REVIEW_REPORT_REASONS } from '../../requests/constants.js'
import { StarRating } from '../../requests/components/Stars.jsx'
import { TARGET_PATHS } from '../../requests/format.js'
import { useAdminQuery, useAdminService } from '../AdminContext.js'
import AdminPage from '../components/AdminPage.jsx'
import DataList from '../../../components/DataList.jsx'
import PageTabs from '../../../components/PageTabs.jsx'
import ReasonDialog from '../components/ReasonDialog.jsx'
import ActionMenu from '../../../components/ActionMenu.jsx'
import ShortId from '../components/ShortId.jsx'
import styles from './AdminReviews.module.css'

const loadReviews = (service) => service.getReviews()
const loadLog = (service) => service.getReviewActionLog()

const reasonLabel = (value) => REVIEW_REPORT_REASONS.find((r) => r.value === value)?.label ?? value
const LOG_ACTIONS = {
  review_hidden: 'Hid a review',
  review_unhidden: 'Showed a review again',
  reports_dismissed: 'Dismissed the reports',
}

const VISIBILITY = [
  { value: '', label: 'All reviews' },
  { value: 'reported', label: 'Reported' },
  { value: 'visible', label: 'Visible' },
  { value: 'hidden', label: 'Hidden' },
]

// /admin/reviews?show=reported - every review of mechanics, shops and tow companies. Reviews that
// people reported wait here: hide one that breaks the rules (with a reason the reviewer sees) or
// dismiss the reports. Hidden reviews leave the public pages and the averages. Every action is
// logged at the bottom.
export default function AdminReviews() {
  const { data: reviews, error } = useAdminQuery(loadReviews)
  const { data: log } = useAdminQuery(loadLog)
  const service = useAdminService()
  const toast = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const show = searchParams.get('show') ?? ''
  const [hiding, setHiding] = useState(null)
  const [busyId, setBusyId] = useState(null)

  const results = useMemo(
    () =>
      (reviews ?? []).filter((r) =>
        show === 'reported' ? r.reports.length > 0 : !show || (show === 'hidden') === Boolean(r.hidden),
      ),
    [reviews, show],
  )

  async function unhide(review) {
    setBusyId(review.id)
    try {
      await service.unhideReview(review.id)
      toast.success(`The review of ${review.targetName} is visible again.`)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusyId(null)
    }
  }

  async function dismiss(review) {
    setBusyId(review.id)
    try {
      await service.dismissReports(review.id)
      toast.success('The reports are dismissed. The review stays visible.')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusyId(null)
    }
  }

  const reportedCount = (reviews ?? []).filter((r) => r.reports.length > 0).length

  return (
    <AdminPage
      title="Reviews"
      description="Reviews left after completed and confirmed requests. Hide a review that breaks the rules - it leaves the public pages and the averages, and the reviewer sees your reason."
    >
      {reportedCount > 0 && (
        <p className={styles.reportedLine}>
          <StatusIndicator tone="warning" label={`${reportedCount} reported ${reportedCount === 1 ? 'review needs' : 'reviews need'} a decision`} />
          <button type="button" className={styles.linkButton} onClick={() => setSearchParams({ show: 'reported' }, { replace: true })}>
            Show reported reviews
          </button>
        </p>
      )}

      <PageTabs
        label="Show reviews"
        options={VISIBILITY.map((o) => (o.value === 'reported' && reportedCount > 0 ? { ...o, label: `Reported (${reportedCount})` } : o))}
        value={show}
        onChange={(value) => setSearchParams(value ? { show: value } : {}, { replace: true })}
      />

      {error && <Notice tone="danger">Couldn't load reviews: {error.message}</Notice>}
      {!reviews && !error && <SkeletonRows label="Loading…" />}
      {reviews && (
        <>
          <p className={styles.muted} aria-live="polite">
            {results.length} of {reviews.length} reviews
          </p>
          {results.length === 0 ? (
            <p className={styles.muted}>No reviews match.</p>
          ) : (
            <ul className={styles.reviews} aria-label="Reviews">
              {results.map((r) => (
                <li key={r.id} className={styles.review}>
                  <div className={styles.rating}>
                    <StarRating value={r.rating} />
                    <span className={styles.subline}>{formatDate(r.createdAt)}</span>
                  </div>

                  <div className={styles.body}>
                    {r.comment ? <p className={styles.comment}>{r.comment}</p> : <p className={styles.subline}>No written comment.</p>}
                    {r.aspects && (
                      <p className={styles.subline}>
                        {REVIEW_CRITERIA[r.targetType].map((c) => `${c.label} ${r.aspects[c.key]}/5`).join(' · ')}
                      </p>
                    )}
                    {r.reply && <p className={styles.reply}>Reply from {r.targetName}: {r.reply.text}</p>}
                    {r.reports.map((report) => (
                      <p key={report.id} className={styles.report}>
                        Reported by {report.reporterName} ({formatDate(report.createdAt)}): <strong>{reasonLabel(report.reason)}</strong>
                        {report.details && ` - ${report.details}`}
                      </p>
                    ))}
                    <p className={styles.meta}>
                      <span>
                        by {r.customerName} for <Link to={TARGET_PATHS[r.targetType](r.targetId)}>{r.targetName}</Link> (
                        {ACCOUNT_TYPE_LABELS[r.targetType]})
                      </span>
                      <span>
                        request {r.requestId}
                        {r.serviceLabel && ` · ${r.serviceLabel}`}
                      </span>
                      <ShortId id={r.id} />
                    </p>
                  </div>

                  <div className={styles.side}>
                    {r.hidden ? (
                      <>
                        <StatusIndicator label="Hidden" tone="danger" />
                        <span className={styles.subline}>{r.hidden.reason}</span>
                      </>
                    ) : (
                      <StatusIndicator label="Visible" tone="success" />
                    )}
                    <ActionMenu
                      label={`Actions for the review of ${r.targetName}`}
                      items={[
                        ...(r.reports.length > 0 ? [{ label: 'Dismiss reports', onSelect: () => dismiss(r) }] : []),
                        r.hidden
                          ? { label: 'Unhide review', onSelect: () => unhide(r) }
                          : { label: 'Hide review', onSelect: () => setHiding(r), danger: true },
                      ]}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <section aria-labelledby="review-log">
        <h2 id="review-log" className={styles.heading}>
          Action log
        </h2>
        <DataList
          caption="Review action log"
          emptyText="No actions yet."
          rows={log ?? []}
          columns={[
            { key: 'at', header: 'When', nowrap: true, render: (e) => formatDate(e.at) },
            { key: 'admin', header: 'Admin', render: (e) => e.adminName },
            {
              key: 'action',
              header: 'Action',
              render: (e) => (
                <>
                  {LOG_ACTIONS[e.action] ?? e.action}
                  <span className={styles.subline}>
                    review {e.reviewId} of {e.targetName}
                    {e.reason && ` · ${e.reason}`}
                  </span>
                </>
              ),
            },
          ]}
        />
      </section>

      <ReasonDialog
        open={Boolean(hiding)}
        title={hiding ? `Hide this review of ${hiding.targetName}?` : ''}
        label="Reason"
        hint="The reviewer sees this reason, and it goes in the action log. E.g. advertising, insults, or not about a real request."
        requiredMessage="Write why the review is hidden."
        confirmLabel="Hide review"
        onCancel={() => setHiding(null)}
        onConfirm={async (reason) => {
          await service.hideReview(hiding.id, reason)
          toast.success('The review is hidden.')
          setHiding(null)
        }}
      />
    </AdminPage>
  )
}
