import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { ACCOUNT_STATUS, ACCOUNT_TYPE_LABELS, verificationMethodLabel } from '../../../auth/constants.js'
import { ROLES } from '../../../authorization/roles.js'
import ActionMenu from '../../../components/ActionMenu.jsx'
import Avatar from '../../../components/Avatar.jsx'
import Button from '../../../components/Button.jsx'
import DetailDrawer from '../../../components/DetailDrawer.jsx'
import FilterToolbar, { FilterMenu } from '../../../components/FilterToolbar.jsx'
import FlatDataList from '../../../components/FlatDataList.jsx'
import Notice from '../../../components/Notice.jsx'
import PageIntro from '../../../components/PageIntro.jsx'
import PageShell from '../../../components/PageShell.jsx'
import SearchBar from '../../../components/SearchBar.jsx'
import { SkeletonRows } from '../../../components/Skeleton.jsx'
import { useToast } from '../../../components/Toast/ToastContext.js'
import { formatDate } from '../../../utils/formatDate.js'
import AccountStatusBadges from '../components/AccountStatusBadges.jsx'
import DetailList from '../components/DetailList.jsx'
import ShortId from '../components/ShortId.jsx'
import { useSuspendAction } from '../components/SuspendButton.jsx'
import { useAdminQuery } from '../AdminContext.js'
import styles from './AdminUsers.module.css'

const loadUsers = (service) => service.getUsers()

const STATUS_FILTERS = [
  { value: '', label: 'All statuses' },
  { value: ACCOUNT_STATUS.APPROVED, label: 'Approved' },
  { value: ACCOUNT_STATUS.PENDING, label: 'Pending' },
  { value: ACCOUNT_STATUS.REJECTED, label: 'Rejected' },
  { value: 'suspended', label: 'Suspended' },
]
const hasStatus = (user, status) => !status || (status === 'suspended' ? user.suspended : user.status === status)

const matches = (user, query) => !query || [user.name, user.email, user.city, user.workshopName].some((text) => text?.toLowerCase().includes(query))

// /admin/users?q=...&role=mechanic&status=suspended - every account, with search, role and status
// filters. A row opens a quick-detail drawer (full page: /admin/users/:id); suspend and reactivate
// are in the row menu and the drawer.
export default function AdminUsers() {
  const { data: users, error } = useAdminQuery(loadUsers)
  const [searchParams, setSearchParams] = useSearchParams()
  const toast = useToast()
  const [openId, setOpenId] = useState(null)
  const query = searchParams.get('q') ?? ''
  const role = searchParams.get('role') ?? ''
  const status = searchParams.get('status') ?? ''

  const results = useMemo(
    () => (users ?? []).filter((u) => (!role || u.role === role) && hasStatus(u, status) && matches(u, query.trim().toLowerCase())),
    [users, role, status, query],
  )
  const open = (users ?? []).find((u) => u.id === openId) ?? null
  const done = (text) => toast.success(text)
  const failed = (text) => toast.error(text)

  function setFilter(key, value) {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    setSearchParams(next, { replace: true })
  }

  const columns = [
    {
      key: 'person',
      header: 'Person',
      render: (u) => (
        <span className={styles.person}>
          <Avatar file={u.profilePhoto} name={u.name} size="sm" />
          <span className={styles.who}>
            <button type="button" className={styles.name} onClick={() => setOpenId(u.id)}>
              {u.name}
            </button>
            <span className={styles.email}>{u.email}</span>
          </span>
        </span>
      ),
    },
    { key: 'role', header: 'Role', render: (u) => <span className={styles.role}>{ACCOUNT_TYPE_LABELS[u.role]}</span> },
    { key: 'status', header: 'Status', render: (u) => <AccountStatusBadges account={u} /> },
    {
      key: 'joined',
      header: 'Joined',
      render: (u) => (
        <span className={styles.joined}>
          <span className={styles.joinedLabel}>Joined </span>
          {formatDate(u.createdAt)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: <span className={styles.srOnly}>Actions</span>,
      align: 'end',
      render: (u) => <UserRowMenu user={u} onOpen={() => setOpenId(u.id)} onChanged={done} onError={failed} />,
    },
  ]

  return (
    <PageShell>
      <PageIntro
        eyebrow="Operations / Users"
        title="Users"
        description="Every account on MOTEXA. Suspended accounts can't log in and are hidden from public pages."
      />

      <section className={styles.directory} aria-label="Users">
        <FilterToolbar
          search={
            <SearchBar
              quiet
              id="user-search"
              value={query}
              onChange={(value) => setFilter('q', value)}
              label="Search users"
              placeholder="Name, email, city or workshop"
            />
          }
          canReset={Boolean(query || role || status)}
          onReset={() => setSearchParams({}, { replace: true })}
        >
          <FilterMenu label="Role" value={role} onChange={(event) => setFilter('role', event.target.value)}>
            <option value="">All</option>
            {Object.values(ROLES).map((value) => (
              <option key={value} value={value}>
                {ACCOUNT_TYPE_LABELS[value]}
              </option>
            ))}
          </FilterMenu>
          <FilterMenu label="Status" value={status} onChange={(event) => setFilter('status', event.target.value)}>
            {STATUS_FILTERS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.value ? option.label : 'All'}
              </option>
            ))}
          </FilterMenu>
        </FilterToolbar>

        {error && <Notice tone="danger">Couldn't load users: {error.message}</Notice>}
        {!users && !error && <SkeletonRows label="Loading…" />}

        {users && (
          <>
            <p className={styles.muted} aria-live="polite">
              {results.length} of {users.length} accounts
            </p>
            <FlatDataList
              label="Users"
              widths="minmax(240px, 2.2fr) minmax(110px, 0.9fr) minmax(150px, 1.2fr) 110px 44px"
              emptyText="No accounts match these filters."
              rows={results}
              selectedKey={openId}
              onRowOpen={(u) => setOpenId(u.id)}
              columns={columns}
            />
          </>
        )}
      </section>

      <DetailDrawer open={Boolean(open)} title={open?.name ?? ''} onClose={() => setOpenId(null)}>
        {open && <UserDetails user={open} onChanged={done} onError={failed} />}
      </DetailDrawer>
    </PageShell>
  )
}

// The ⋯ menu of one row: quick view, the full page, suspend or reactivate (not for admins).
function UserRowMenu({ user, onOpen, onChanged, onError }) {
  const suspend = useSuspendAction(user, { onChanged, onError })
  const toast = useToast()
  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(user.id)
      toast.success('ID copied.')
    } catch {
      toast.error("Couldn't copy the ID.")
    }
  }
  const items = [
    { label: 'View details', onSelect: onOpen },
    { label: 'Copy user ID', onSelect: copyId },
  ]
  if (user.role !== ROLES.ADMIN) items.push({ label: suspend.label, onSelect: suspend.act, danger: !user.suspended, separated: true })
  return (
    <>
      <ActionMenu label={`Actions for ${user.name}`} items={items} />
      {suspend.dialog}
    </>
  )
}

// The drawer: the facts an admin looks up most, and the same suspend / reactivate action.
function UserDetails({ user, onChanged, onError }) {
  const suspend = useSuspendAction(user, { onChanged, onError })
  return (
    <div className={styles.drawerBody}>
      <AccountStatusBadges account={user} />
      <DetailList
        items={[
          { label: 'Email', value: user.email },
          { label: 'Role', value: ACCOUNT_TYPE_LABELS[user.role] },
          { label: 'City', value: user.city },
          { label: 'Workshop', value: user.workshopName },
          { label: 'Joined', value: formatDate(user.createdAt) },
          { label: 'Verified by', value: user.verification && verificationMethodLabel(user.verification.method) },
          { label: 'Suspended', value: user.suspended && formatDate(user.suspendedAt) },
          { label: 'Reason', value: user.suspended && (user.suspensionReason || '—') },
          { label: 'ID', value: <ShortId id={user.id} full /> },
        ]}
      />
      <div className={styles.drawerActions}>
        <Button to={`/admin/users/${user.id}`}>Open full account</Button>
        {user.role !== ROLES.ADMIN && (
          <Button variant="secondary" onClick={suspend.act} disabled={suspend.saving}>
            {suspend.label}
          </Button>
        )}
      </div>
      {suspend.dialog}
    </div>
  )
}
