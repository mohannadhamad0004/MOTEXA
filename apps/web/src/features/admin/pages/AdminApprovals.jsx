import { Link, useSearchParams } from 'react-router'
import { ACCOUNT_TYPE_LABELS, STATUS_BADGES, verificationMethodLabel } from '../../../auth/constants.js'
import Button from '../../../components/Button.jsx'
import Notice from '../../../components/Notice.jsx'
import { useToast } from '../../../components/Toast/ToastContext.js'
import StatusIndicator from '../../../components/StatusIndicator.jsx'
import { formatDate } from '../../../utils/formatDate.js'
import AccountReview from '../components/AccountReview.jsx'
import AdminPage from '../components/AdminPage.jsx'
import DataList from '../../../components/DataList.jsx'
import ShortId from '../components/ShortId.jsx'
import UpdateReview from '../components/UpdateReview.jsx'
import { SkeletonRows } from '../../../components/Skeleton.jsx'
import Tabs from '../../../components/Tabs.jsx'
import { useAdminQuery } from '../AdminContext.js'
import { APPROVAL_TABS } from '../constants.js'
import styles from './AdminApprovals.module.css'

const HISTORY = 'history'

const loadApprovals = async (service) => {
  const [pending, updates, history] = await Promise.all([
    service.getPendingAccounts(),
    service.getUpdatesToReview(),
    service.getReviewHistory(),
  ])
  return { pending, updates, history }
}

// /admin/approvals?tab=mechanic&account=u-18   a new signup
// /admin/approvals?tab=tow&update=u-30          updates from an approved account
// Tabs per role with the pending signups and the updates to review (changed names and licenses,
// new or re-certified skills, new or edited trucks), plus a history tab of past signup decisions.
// The tab and the open item are in the URL.
export default function AdminApprovals() {
  const { data, error } = useAdminQuery(loadApprovals)
  const [searchParams, setSearchParams] = useSearchParams()
  const toast = useToast()

  const tabParam = searchParams.get('tab')
  const tab = [...APPROVAL_TABS.map((t) => t.role), HISTORY].includes(tabParam) ? tabParam : APPROVAL_TABS[0].role
  const accountId = searchParams.get('account')
  const updateId = searchParams.get('update')

  const pending = data?.pending ?? []
  const updates = data?.updates ?? []
  const inTab = pending.filter((account) => account.role === tab)
  const updatesInTab = updates.filter((account) => account.role === tab)
  const selected = inTab.find((account) => account.id === accountId) ?? null
  const selectedUpdate = updatesInTab.find((account) => account.id === updateId) ?? null

  const tabs = [
    ...APPROVAL_TABS.map(({ role, label }) => ({
      value: role,
      label,
      count: pending.filter((a) => a.role === role).length + updates.filter((a) => a.role === role).length,
    })),
    { value: HISTORY, label: 'History' },
  ]

  function show(nextTab, selection = null) {
    setSearchParams({ tab: nextTab, ...selection })
  }

  const nothingWaiting = inTab.length === 0 && updatesInTab.length === 0

  return (
    <AdminPage
      title="Approvals"
      description="Review new mechanics, parts shops and tow companies before they appear on MOTEXA, and the changes approved accounts send in (names, licenses, skills, trucks)."
    >
      <Tabs
        label="Approval queues"
        idPrefix="approvals"
        tabs={tabs}
        value={tab}
        onChange={(value) => {
          show(value)
        }}
      />

      <div id="approvals-panel" role="tabpanel" aria-labelledby={`approvals-tab-${tab}`} className={styles.panel}>
        {error && <Notice tone="danger">Couldn't load approvals: {error.message}</Notice>}
        {!data && !error && <SkeletonRows label="Loading…" />}

        {data && tab === HISTORY && <ReviewHistory history={data.history} />}

        {data && tab !== HISTORY && (
          <div className={`${styles.layout} ${selected || selectedUpdate ? styles.hasSelection : ''}`}>
            <div className={styles.queues}>
              <section aria-labelledby="signups-title" className={styles.queue}>
                <h2 id="signups-title" className={styles.queueTitle}>
                  New signups ({inTab.length})
                </h2>
                <ul className={styles.list}>
                  {inTab.length === 0 && <li className={styles.muted}>No new signups.</li>}
                  {inTab.map((account) => (
                    <li key={account.id}>
                      <button
                        type="button"
                        className={`${styles.item} ${account.id === accountId ? styles.selected : ''}`}
                        aria-current={account.id === accountId ? 'true' : undefined}
                        onClick={() => {
                          show(tab, { account: account.id })
                        }}
                      >
                        <span className={styles.itemName}>{account.name}</span>
                        <span className={styles.muted}>{account.email}</span>
                        <span className={styles.muted}>
                          {account.city} · submitted {formatDate(account.createdAt)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>

              <section aria-labelledby="updates-title" className={styles.queue}>
                <h2 id="updates-title" className={styles.queueTitle}>
                  Updates to review ({updatesInTab.length})
                </h2>
                <ul className={styles.list}>
                  {updatesInTab.length === 0 && <li className={styles.muted}>No updates from approved accounts.</li>}
                  {updatesInTab.map((account) => (
                    <li key={account.id}>
                      <button
                        type="button"
                        className={`${styles.item} ${account.id === updateId ? styles.selected : ''}`}
                        aria-current={account.id === updateId ? 'true' : undefined}
                        onClick={() => {
                          show(tab, { update: account.id })
                        }}
                      >
                        <span className={styles.itemName}>{account.name}</span>
                        <span className={styles.muted}>{account.reviewItems.map((item) => item.label).join(', ')}</span>
                        <span className={styles.muted}>since {formatDate(account.reviewItems[0].submittedAt)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            <section className={styles.detail} aria-label={selectedUpdate ? 'Updates to review' : 'Signup details'}>
              {(selected || selectedUpdate) && (
                <Button variant="secondary" className={styles.back} onClick={() => show(tab)}>
                  ← Back to the list
                </Button>
              )}
              {(selected || selectedUpdate) && (
                <p className={styles.idLine}>
                  Account ID <ShortId id={(selected ?? selectedUpdate).id} />
                </p>
              )}
              {selected && (
                <AccountReview
                  key={selected.id}
                  account={selected}
                  onDone={(message) => {
                    toast.success(message)
                    show(tab)
                  }}
                />
              )}
              {selectedUpdate && (
                <UpdateReview
                  key={selectedUpdate.id}
                  account={selectedUpdate}
                  onDecided={(message) => {
                    toast.success(message)
                    // Back to the list once the last update of this account is decided.
                    if (selectedUpdate.reviewItems.length === 1) show(tab)
                  }}
                />
              )}
              {!selected && !selectedUpdate && (
                <p className={styles.placeholder}>
                  {nothingWaiting ? 'Nothing to review here right now.' : 'Choose a signup or an update to review it.'}
                </p>
              )}
            </section>
          </div>
        )}
      </div>
    </AdminPage>
  )
}

function ReviewHistory({ history }) {
  return (
    <DataList
      caption="Approved and rejected signups"
      emptyText="No decisions yet."
      rows={history}
      columns={[
        {
          key: 'name',
          header: 'Account',
          render: (row) => (
            <>
              <Link to={`/admin/users/${row.id}`}>{row.name}</Link>
              <span className={styles.subline}>{ACCOUNT_TYPE_LABELS[row.role]}</span>
            </>
          ),
        },
        {
          key: 'decision',
          header: 'Decision',
          render: (row) => <StatusIndicator label={STATUS_BADGES[row.status].label} tone={STATUS_BADGES[row.status].tone} />,
        },
        { key: 'date', header: 'Date', nowrap: true, render: (row) => formatDate(row.reviewedAt) },
        { key: 'method', header: 'Verified by', nowrap: true, render: (row) => verificationMethodLabel(row.method) },
        {
          key: 'note',
          header: 'Admin note / reason',
          render: (row) => (
            <>
              {row.note && <span>{row.note}</span>}
              {row.rejectionReason && <span className={styles.subline}>Reason: {row.rejectionReason}</span>}
              {row.skills.length > 0 && (
                <span className={styles.subline}>
                  Skills:{' '}
                  {row.skills.map((s) => `${s.skill} ${s.status === 'approved' ? '✓' : '✗'}`).join(', ')}
                </span>
              )}
              {!row.note && !row.rejectionReason && !row.skills.length && '—'}
            </>
          ),
        },
        { key: 'admin', header: 'Admin', nowrap: true, render: (row) => row.reviewedByName || '—' },
      ]}
    />
  )
}
