import { useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { ROLE_LABELS } from '../../../authorization/roles.js'
import ActionMenu from '../../../components/ActionMenu.jsx'
import FilterToolbar, { FilterMenu } from '../../../components/FilterToolbar.jsx'
import FlatDataList from '../../../components/FlatDataList.jsx'
import Notice from '../../../components/Notice.jsx'
import PageIntro from '../../../components/PageIntro.jsx'
import PageShell from '../../../components/PageShell.jsx'
import SearchBar from '../../../components/SearchBar.jsx'
import { SkeletonRows } from '../../../components/Skeleton.jsx'
import StatusIndicator from '../../../components/StatusIndicator.jsx'
import { useToast } from '../../../components/Toast/ToastContext.js'
import { formatPrice } from '../../marketplace/format.js'
import { ORDER_STATUS_BADGES, orderStatusBadge } from '../../marketplace/orderConstants.js'
import { useAdminQuery } from '../AdminContext.js'
import styles from './AdminOrders.module.css'

const loadOrders = (service) => service.getAllOrders()

const formatDay = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
const formatTime = (iso) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

// What the search box looks through.
const searchText = (order) => [order.checkoutNumber, order.id, order.shopName, order.buyerName].join(' ').toLowerCase()

// Today / Yesterday / Earlier, by the order's local date.
function groupOf(iso) {
  const day = new Date(iso).toDateString()
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (day === today.toDateString()) return 'Today'
  if (day === yesterday.toDateString()) return 'Yesterday'
  return 'Earlier'
}
const GROUPS = ['Today', 'Yesterday', 'Earlier']

const itemCount = (order) => order.items?.length ?? order.itemCount

// /admin/orders?q=FF-10002&status=placed - every order of every shop, grouped by day.
// Search by checkout number, shop or buyer, and filter by status. A row opens the order
// (read-only, with "Cancel order" on its page).
export default function AdminOrders() {
  const { data: orders, error } = useAdminQuery(loadOrders)
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToast()
  const q = searchParams.get('q') ?? ''
  const status = searchParams.get('status') ?? ''

  const update = (changes) => {
    const next = new URLSearchParams(searchParams)
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    setSearchParams(next, { replace: true })
  }

  const results = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean)
    return (orders ?? []).filter(
      (order) =>
        (!status || order.status === status) &&
        words.every((word) => searchText(order).includes(word)),
    )
  }, [orders, q, status])
  const ordered = GROUPS.flatMap((name) => results.filter((o) => groupOf(o.createdAt) === name))

  async function copyId(order) {
    try {
      await navigator.clipboard.writeText(order.id)
      toast.success('ID copied.')
    } catch {
      toast.error("Couldn't copy the ID.")
    }
  }

  const columns = [
    {
      key: 'order',
      header: 'Order',
      render: (o) => (
        <span className={styles.orderCell}>
          <Link to={`/admin/orders/${o.id}`} className={styles.order}>
            {o.checkoutNumber}
          </Link>
          <span className={styles.subline}>
            {itemCount(o) ?? '—'} {itemCount(o) === 1 ? 'item' : 'items'}
          </span>
        </span>
      ),
    },
    {
      key: 'customer',
      header: 'Customer',
      render: (o) => (
        <>
          <span className={styles.primary}>{o.buyerName}</span>
          <span className={styles.subline}>{ROLE_LABELS[o.buyerRole]}</span>
        </>
      ),
    },
    { key: 'shop', header: 'Shop', render: (o) => <span className={styles.primary}>{o.shopName}</span> },
    { key: 'status', header: 'Status', render: (o) => <StatusIndicator {...orderStatusBadge(o.status)} /> },
    { key: 'total', header: 'Total', align: 'end', cellClassName: styles.totalCell, render: (o) => <strong className={styles.total}>{formatPrice(o.totalIls)}</strong> },
    {
      key: 'date',
      header: 'Date',
      render: (o) => (
        <span className={styles.date}>
          <span className={styles.primary}>{formatDay(o.createdAt)}</span>
          <span className={styles.subline}>{formatTime(o.createdAt)}</span>
        </span>
      ),
    },
    {
      key: 'actions',
      header: <span className={styles.srOnly}>Actions</span>,
      align: 'end',
      render: (o) => (
        <ActionMenu
          label={`Actions for order ${o.checkoutNumber}`}
          items={[
            { label: 'View details', onSelect: () => navigate(`/admin/orders/${o.id}`) },
            { label: 'Copy order ID', onSelect: () => copyId(o) },
          ]}
        />
      ),
    },
  ]

  return (
    <PageShell>
      <PageIntro
        eyebrow="Operations / Orders"
        title="Orders"
        description="Every parts order on MOTEXA, newest first. Open one to see its details or cancel it."
      />

      <section className={styles.workspace} aria-label="Orders">
        <FilterToolbar
          search={
            <SearchBar
              quiet
              id="order-search"
              value={q}
              onChange={(value) => update({ q: value })}
              label="Search orders"
              placeholder="Checkout number, shop or buyer"
            />
          }
          canReset={Boolean(q || status)}
          onReset={() => setSearchParams({}, { replace: true })}
        >
          <FilterMenu label="Status" value={status} onChange={(event) => update({ status: event.target.value })}>
            <option value="">All</option>
            {Object.entries(ORDER_STATUS_BADGES).map(([value, { label }]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </FilterMenu>
        </FilterToolbar>

        {error && <Notice tone="danger">Couldn't load orders: {error.message}</Notice>}
        {!orders && !error && <SkeletonRows label="Loading…" />}
        {orders && (
          <>
            <p className={styles.count} aria-live="polite">
              {results.length} {results.length === 1 ? 'order' : 'orders'}
            </p>
            <FlatDataList
              label="Orders"
              widths="minmax(100px, 1fr) minmax(130px, 1.2fr) minmax(140px, 1.3fr) 150px 80px 90px 44px"
              emptyText="No orders match your search."
              rows={ordered}
              groupOf={(o) => groupOf(o.createdAt)}
              onRowOpen={(o) => navigate(`/admin/orders/${o.id}`)}
              columns={columns}
            />
          </>
        )}
      </section>
    </PageShell>
  )
}
