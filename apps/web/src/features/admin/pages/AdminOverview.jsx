import { Link } from 'react-router'
import { ACCOUNT_STATUS, ACCOUNT_TYPE_LABELS } from '../../../auth/constants.js'
import Notice from '../../../components/Notice.jsx'
import { SkeletonCards } from '../../../components/Skeleton.jsx'
import { formatDate } from '../../../utils/formatDate.js'
import { formatPrice } from '../../marketplace/format.js'
import AdminPage from '../components/AdminPage.jsx'
import { useAdminAttention } from '../components/useAdminAttention.js'
import { useAdminQuery } from '../AdminContext.js'
import { APPROVAL_TABS } from '../constants.js'
import styles from './AdminOverview.module.css'

const loadOverview = (service) => service.getOverview()

// Decisions and moderation already taken, newest first (the approval history and the review action log).
const loadActivity = async (service) => {
  const [decisions, log] = await Promise.all([service.getReviewHistory(), service.getReviewActionLog()])
  const REVIEW_ACTIONS = { review_hidden: 'Hid a review', review_unhidden: 'Showed a review again', reports_dismissed: 'Dismissed reports on a review' }
  return [
    ...decisions.map((d) => ({
      id: `d-${d.id}`,
      at: d.reviewedAt,
      action: d.status === ACCOUNT_STATUS.APPROVED ? 'Approved' : 'Rejected',
      entity: `${d.name} · ${ACCOUNT_TYPE_LABELS[d.role]}`,
      actor: d.reviewedByName,
    })),
    ...log.map((e) => ({
      id: e.id,
      at: e.at,
      action: REVIEW_ACTIONS[e.action] ?? e.action,
      entity: e.targetName,
      actor: e.adminName,
    })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 8)
}

const formatTime = (iso) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

// One group of the platform snapshot: a small-caps label over aligned figures.
function SnapshotGroup({ title, items }) {
  return (
    <div className={styles.snapGroup}>
      <h3 className={styles.kicker}>{title}</h3>
      <dl className={styles.figures}>
        {items.map(({ label, value, to }) => (
          <div key={label} className={styles.figure}>
            <dt>{label}</dt>
            <dd>{to ? <Link to={to}>{value}</Link> : value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

// /admin - the operational home: what needs a decision (flat rows, strongest), the platform
// snapshot as a strip, then what the team did recently beside the newest pending signups.
export default function AdminOverview() {
  const { data, error } = useAdminQuery(loadOverview)
  const attention = useAdminAttention().data
  const activity = useAdminQuery(loadActivity).data

  const waiting = attention && [
    { label: 'Pending account approvals', count: attention.accounts, to: '/admin/approvals' },
    { label: 'Mechanic skills to review', count: attention.skills, to: '/admin/approvals?tab=mechanic' },
    { label: 'Tow trucks to review', count: attention.trucks, to: '/admin/approvals?tab=tow' },
    { label: 'Changed business names or licenses', count: attention.changes, to: '/admin/approvals' },
    { label: 'Reviews with open reports', count: attention.reports, to: '/admin/reviews' },
    ...(data ? [{ label: 'Orders waiting for the shop', count: data.orders.new, to: '/admin/orders?status=placed' }] : []),
  ].filter((item) => item.count > 0)

  return (
    <AdminPage title="Overview" description="What needs your attention on MOTEXA today.">
      {error && <Notice tone="danger">Couldn't load the overview: {error.message}</Notice>}

      <section aria-labelledby="attention-title" className={styles.section}>
        <h2 id="attention-title" className={styles.kicker}>
          Needs attention
        </h2>
        {!waiting ? (
          <SkeletonCards count={3} label="Loading…" />
        ) : waiting.length === 0 ? (
          <p className={styles.quiet}>Nothing is waiting for a decision.</p>
        ) : (
          <ul className={styles.attention}>
            {waiting.map((item) => (
              <li key={item.label}>
                <Link to={item.to} className={styles.attentionRow}>
                  <span className={styles.attentionLabel}>{item.label}</span>
                  <span className={styles.attentionCount}>{item.count}</span>
                  <span className={styles.arrow} aria-hidden="true">
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {!data && !error && <SkeletonCards count={4} label="Loading…" />}
      {data && (
        <>
          <section aria-labelledby="snapshot-title" className={styles.section}>
            <h2 id="snapshot-title" className={styles.kicker}>
              Platform snapshot
            </h2>
            <div className={styles.snapshot}>
              <SnapshotGroup
                title="Users"
                items={[
                  ...APPROVAL_TABS.map(({ role, label }) => ({
                    label: label,
                    value: data.approvedByRole[role],
                    to: `/admin/approvals?tab=${role}`,
                  })),
                  { label: 'Suspended', value: data.suspendedUsers, to: '/admin/users?status=suspended' },
                ]}
              />
              <SnapshotGroup
                title="Marketplace"
                items={[
                  { label: 'Parts listed', value: data.partsListed, to: '/admin/listings' },
                  { label: 'Parts hidden', value: data.partsHidden, to: '/admin/listings?show=hidden' },
                  { label: 'Requests today', value: data.requestsToday, to: '/admin/requests' },
                ]}
              />
              <SnapshotGroup
                title="Orders"
                items={[
                  { label: 'Total', value: data.orders.total, to: '/admin/orders' },
                  { label: 'In progress', value: data.orders.inProgress },
                  { label: 'Completed', value: data.orders.completed },
                  { label: 'Cancelled', value: data.orders.cancelled, to: '/admin/orders?status=cancelled' },
                ]}
              />
              <SnapshotGroup
                title="Order value"
                items={[
                  { label: 'Excluding cancelled', value: formatPrice(data.orders.valueIls) },
                  { label: 'Completed orders', value: formatPrice(data.orders.completedValueIls) },
                ]}
              />
            </div>
          </section>

          <div className={styles.grid}>
            <section aria-labelledby="activity-title" className={styles.section}>
              <h2 id="activity-title" className={styles.kicker}>
                Recent activity
              </h2>
              {!activity ? (
                <SkeletonCards count={3} label="Loading…" />
              ) : activity.length === 0 ? (
                <p className={styles.quiet}>No decisions or moderation actions yet.</p>
              ) : (
                <ol className={styles.feed}>
                  {activity.map((item) => (
                    <li key={item.id} className={styles.feedItem}>
                      <time dateTime={item.at} className={styles.when}>
                        {formatDate(item.at)} · {formatTime(item.at)}
                      </time>
                      <span className={styles.what}>
                        <strong>{item.action}</strong> {item.entity}
                      </span>
                      <span className={styles.who}>by {item.actor}</span>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            <aside className={styles.section} aria-labelledby="newest-title">
              <h2 id="newest-title" className={styles.kicker}>
                Newest pending signups
              </h2>
              {data.newestPending.length === 0 ? (
                <p className={styles.quiet}>No signups are waiting.</p>
              ) : (
                <ul className={styles.list}>
                  {data.newestPending.map((account) => (
                    <li key={account.id}>
                      <Link to={`/admin/approvals?tab=${account.role}&account=${account.id}`} className={styles.listItem}>
                        <span className={styles.listName}>{account.name}</span>
                        <span className={styles.quiet}>
                          {ACCOUNT_TYPE_LABELS[account.role]} · {account.city} · {formatDate(account.createdAt)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </aside>
          </div>
        </>
      )}
    </AdminPage>
  )
}
