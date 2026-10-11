import { useState } from 'react'
import { Link } from 'react-router'
import Button from '../../../components/Button.jsx'
import EmptyState from '../../../components/EmptyState.jsx'
import PageTabs from '../../../components/PageTabs.jsx'
import { SkeletonRows } from '../../../components/Skeleton.jsx'
import StatusIndicator from '../../../components/StatusIndicator.jsx'
import { formatDate } from '../../../utils/formatDate.js'
import { formatPrice } from '../format.js'
import { ORDER_STATUS, orderStatusBadge } from '../orderConstants.js'
import { useOrdersQuery } from '../OrdersContext.js'
import styles from './OrdersPage.module.css'

const loadOrders = (service) => service.getMyOrders()

const isClosed = (order) => order.status === ORDER_STATUS.COMPLETED || order.status === ORDER_STATUS.CANCELLED
const FILTERS = {
  '': () => true,
  open: (order) => !isClosed(order),
  completed: (order) => order.status === ORDER_STATUS.COMPLETED,
  cancelled: (order) => order.status === ORDER_STATUS.CANCELLED,
}

// First item by name, then "+N more" for the rest.
function itemsSummary(items) {
  const [first, ...rest] = items
  return rest.length ? `${first.name} +${rest.length} more` : first.name
}

// /orders - "My Orders" for customers and mechanics: one row per order (one per shop), newest
// first, with the checkout number it belongs to.
export default function OrdersPage() {
  const { data: orders, error } = useOrdersQuery(loadOrders)
  const [filter, setFilter] = useState('')

  if (error) return <EmptyState icon="⚠" title="Couldn't load your orders" description={error.message} />

  const count = (key) => (orders ? orders.filter(FILTERS[key]).length : 0)
  const tabs = [
    { value: '', label: `All (${count('')})` },
    { value: 'open', label: `Open (${count('open')})` },
    { value: 'completed', label: `Completed (${count('completed')})` },
    { value: 'cancelled', label: `Cancelled (${count('cancelled')})` },
  ]
  const visible = orders?.filter(FILTERS[filter]) ?? []

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Parts marketplace</p>
        <div className={styles.headline}>
          <h1 className={styles.title}>My orders</h1>
          {orders && orders.length > 0 && (
            <p className={styles.summary}>
              <strong>{count('open')}</strong> open · {orders.length} total
            </p>
          )}
        </div>
      </header>

      {!orders ? (
        <SkeletonRows rows={3} label="Loading your orders…" />
      ) : orders.length === 0 ? (
        <EmptyState
          icon="📦"
          title="No orders yet"
          description="Parts you buy in the marketplace will show up here."
          action={<Button to="/marketplace">Browse parts</Button>}
        />
      ) : (
        <>
          <PageTabs label="Filter orders" options={tabs} value={filter} onChange={setFilter} />

          <div className={styles.columns} aria-hidden="true">
            <span>Order</span>
            <span>Shop</span>
            <span>Items</span>
            <span>Status</span>
            <span className={styles.right}>Total</span>
          </div>

          {visible.length === 0 ? (
            <p className={styles.none}>No orders in this view.</p>
          ) : (
            <ul className={styles.list}>
              {visible.map((order) => {
                const badge = orderStatusBadge(order.status)
                const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0)
                return (
                  <li key={order.id} className={styles.row}>
                    <div className={styles.order}>
                      <Link to={`/orders/${order.id}`} className={styles.link}>
                        {order.checkoutNumber}
                      </Link>
                      <span className={styles.muted}>{formatDate(order.createdAt)}</span>
                    </div>
                    <p className={styles.shop}>{order.shopName}</p>
                    <div className={styles.items}>
                      <span className={styles.itemName}>{itemsSummary(order.items)}</span>
                      <span className={styles.muted}>
                        {itemCount} {itemCount === 1 ? 'item' : 'items'}
                      </span>
                    </div>
                    <div className={styles.status}>
                      <StatusIndicator label={badge.label} tone={badge.tone} />
                    </div>
                    <strong className={styles.total}>{formatPrice(order.totalIls)}</strong>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
