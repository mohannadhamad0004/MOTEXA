import { Link, useSearchParams } from 'react-router'
import Button from '../../../components/Button.jsx'
import Card from '../../../components/Card.jsx'
import EmptyState from '../../../components/EmptyState.jsx'
import { SkeletonRows } from '../../../components/Skeleton.jsx'
import StatusIndicator from '../../../components/StatusIndicator.jsx'
import Tabs, { TabPanel } from '../../../components/Tabs.jsx'
import { formatDateTime } from '../../requests/format.js'
import { formatPrice } from '../format.js'
import { orderStatusBadge, SHOP_ORDER_TABS } from '../orderConstants.js'
import { useOrdersQuery } from '../OrdersContext.js'
import { FULFILLMENT_METHODS } from '../shopCommerce.js'
import styles from './ShopOrdersPage.module.css'

const loadOrders = (service) => service.getShopOrders()
const ID_PREFIX = 'shop-orders'

const EMPTY_TEXT = {
  new: 'No new orders. When a customer orders from you it shows up here.',
  in_progress: 'No orders in progress.',
  completed: 'No completed orders yet.',
  cancelled: 'No cancelled orders.',
}

// /parts-shop/orders - the logged-in shop's own orders (the service only ever returns orders with
// order.shopId === the shop's id), in four tabs with counts. Opening an order lets the shop confirm
// or reject it and move it along.
export default function ShopOrdersPage() {
  const { data: orders, error } = useOrdersQuery(loadOrders)
  const [searchParams, setSearchParams] = useSearchParams()
  const requested = searchParams.get('tab')
  const tab = SHOP_ORDER_TABS.some((t) => t.value === requested) ? requested : 'new'

  if (error) return <EmptyState icon="⚠" title="Couldn't load your orders" description={error.message} />

  const inTab = (value) => {
    const statuses = SHOP_ORDER_TABS.find((t) => t.value === value).statuses
    return (orders ?? []).filter((order) => statuses.includes(order.status))
  }
  const tabs = SHOP_ORDER_TABS.map(({ value, label }) => ({ value, label, count: orders ? inTab(value).length : undefined }))
  const visible = orders ? inTab(tab) : []

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Orders</h1>
          <p className={styles.subtitle}>Orders for your parts. Confirm new orders, then follow them through to completion.</p>
        </div>
        <Button to="/parts-shop" variant="secondary">
          Inventory
        </Button>
      </header>

      <Tabs
        tabs={tabs}
        value={tab}
        idPrefix={ID_PREFIX}
        label="Order status"
        onChange={(value) => setSearchParams({ tab: value }, { replace: true })}
      />

      <TabPanel idPrefix={ID_PREFIX} value={tab}>
        {!orders ? (
          <SkeletonRows rows={3} label="Loading orders…" />
        ) : visible.length === 0 ? (
          <EmptyState compact icon="📦" headingLevel="h2" title={EMPTY_TEXT[tab]} />
        ) : (
          <ul className={styles.list}>
            {visible.map((order) => {
              const badge = orderStatusBadge(order.status)
              const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0)
              return (
                <li key={order.id}>
                  <Card as="article" interactive className={styles.order}>
                    <div className={styles.top}>
                      <p className={styles.number}>
                        <Link to={`/parts-shop/orders/${order.id}`} className={Card.cover}>
                          {order.buyerName}
                        </Link>
                        <span className={styles.muted}> · {order.checkoutNumber}</span>
                      </p>
                      <StatusIndicator label={badge.label} tone={badge.tone} />
                    </div>
                    <p className={styles.muted}>
                      {itemCount} {itemCount === 1 ? 'part' : 'parts'} ·{' '}
                      {order.fulfillment.method === FULFILLMENT_METHODS.PICKUP ? 'Pickup' : 'Delivery'} ·{' '}
                      {order.payment.method === 'card' ? 'Card' : 'Cash'}
                      {order.serviceRequestId && ' · For a service request'}
                    </p>
                    <div className={styles.bottom}>
                      <span className={styles.muted}>{formatDateTime(order.createdAt)}</span>
                      <strong>{formatPrice(order.totalIls)}</strong>
                    </div>
                  </Card>
                </li>
              )
            })}
          </ul>
        )}
      </TabPanel>
    </div>
  )
}
