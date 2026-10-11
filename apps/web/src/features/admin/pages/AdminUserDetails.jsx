import { useCallback, useState } from 'react'
import { Link, useParams } from 'react-router'
import AccountSummary from '../../../auth/AccountSummary.jsx'
import { ACCOUNT_STATUS, verificationMethodLabel } from '../../../auth/constants.js'
import { pendingReviewItems } from '../../../auth/reviewItems.js'
import { ROLES } from '../../../authorization/roles.js'
import Button from '../../../components/Button.jsx'
import Notice from '../../../components/Notice.jsx'
import { SkeletonRows } from '../../../components/Skeleton.jsx'
import { formatDate } from '../../../utils/formatDate.js'
import AccountStatusBadges from '../components/AccountStatusBadges.jsx'
import AdminPage from '../components/AdminPage.jsx'
import ShortId from '../components/ShortId.jsx'
import SuspendButton from '../components/SuspendButton.jsx'
import TagPicker from '../components/TagPicker.jsx'
import { useAdminQuery } from '../AdminContext.js'
import styles from './AdminUserDetails.module.css'

const TAG_TYPES_BY_ROLE = { [ROLES.MECHANIC]: 'mechanic', [ROLES.TOW]: 'tow' }
const PUBLIC_PATHS = { [ROLES.MECHANIC]: '/mechanics/', [ROLES.TOW]: '/tow-companies/', [ROLES.PARTS_SHOP]: '/shops/' }

// /admin/users/:userId - everything about one account: status, suspension, verification record,
// tags (mechanics and tow companies), and all submitted details and documents.
export default function AdminUserDetails() {
  const { userId } = useParams()
  const loadUser = useCallback((service) => service.getUser(userId), [userId])
  const { data: user, error } = useAdminQuery(loadUser)
  const [notice, setNotice] = useState(null)

  if (error) {
    return (
      <AdminPage title="Account not found">
        <Notice tone="danger">{error.message}</Notice>
        <Button to="/admin/users" variant="secondary">
          ← All users
        </Button>
      </AdminPage>
    )
  }
  if (!user) return <SkeletonRows rows={3} label="Loading…" />

  const tagType = TAG_TYPES_BY_ROLE[user.role]
  const publicPath = user.status === ACCOUNT_STATUS.APPROVED && !user.suspended && PUBLIC_PATHS[user.role]
  const updateCount = user.status === ACCOUNT_STATUS.APPROVED ? pendingReviewItems(user).length : 0

  return (
    <AdminPage
      title={user.name}
      description={
        <>
          {user.email} · ID <ShortId id={user.id} full />
        </>
      }
      actions={
        <>
          <Button to="/admin/users" variant="secondary">
            ← All users
          </Button>
          <SuspendButton
            account={user}
            onChanged={(text) => setNotice({ tone: 'success', text })}
            onError={(text) => setNotice({ tone: 'danger', text })}
          />
        </>
      }
    >
      {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}

      <div className={styles.layout}>
        <div className={styles.main}>
          <section className={styles.block} aria-label="Submitted details">
            <AccountSummary account={user} />
          </section>
        </div>
        <aside className={styles.rail}>
      <section className={styles.block} aria-label="Account status">
        <div className={styles.statusRow}>
          <AccountStatusBadges account={user} />
          {publicPath && <Link to={`${publicPath}${user.id}`}>View public page</Link>}
          {user.status === ACCOUNT_STATUS.PENDING && (
            <Link to={`/admin/approvals?tab=${user.role}&account=${user.id}`}>Review this signup</Link>
          )}
          {updateCount > 0 && (
            <Link to={`/admin/approvals?tab=${user.role}&update=${user.id}`}>
              Review {updateCount} {updateCount === 1 ? 'update' : 'updates'}
            </Link>
          )}
        </div>
        <dl className={styles.facts}>
          <Fact label="Joined" value={formatDate(user.createdAt)} />
          {user.reviewedAt && <Fact label="Reviewed" value={formatDate(user.reviewedAt)} />}
          {user.verification && <Fact label="Verified by" value={verificationMethodLabel(user.verification.method)} />}
          {user.verification?.note && <Fact label="Admin note" value={user.verification.note} />}
          {user.suspended && <Fact label="Suspended" value={formatDate(user.suspendedAt)} />}
          {user.suspended && <Fact label="Suspension reason" value={user.suspensionReason || '—'} />}
        </dl>
      </section>

      {tagType && (
        <section className={styles.block}>
          <TagPicker targetType={tagType} targetId={user.id} tagIds={user.tagIds ?? []} />
        </section>
      )}

        </aside>
      </div>
    </AdminPage>
  )
}

function Fact({ label, value }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}
