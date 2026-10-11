import { useCallback } from 'react'
import { Link, useParams } from 'react-router'
import Button from '../../../components/Button.jsx'
import Card from '../../../components/Card.jsx'
import EmptyState from '../../../components/EmptyState.jsx'
import Notice from '../../../components/Notice.jsx'
import { SkeletonRows } from '../../../components/Skeleton.jsx'
import StatusIndicator from '../../../components/StatusIndicator.jsx'
import { formatDateTime } from '../../requests/format.js'
import { formatPrice } from '../format.js'
import { orderStatusBadge } from '../orderConstants.js'
import { useOrdersQuery } from '../OrdersContext.js'
import { FULFILLMENT_METHODS, paymentLabel } from '../shopCommerce.js'
import styles from './CheckoutConfirmationPage.module.css'

// /checkout/confirmation/:checkoutId - shown right after placing: the checkout number and every
// order that was created (one per shop).
export default function CheckoutConfirmationPage() {
  const { checkoutId } = useParams()
  const load = useCallback((service) => service.getCheckout(checkoutId), [checkoutId])
  const { data: checkout, error } = useOrdersQuery(load)

  if (error) return <EmptyState icon="⚠" title="Couldn't load your order" description={error.message} />
  if (checkout === undefined) return <SkeletonRows rows={3} label="Loading your order…" />
  if (!checkout) {
    return (
      <EmptyState
        icon="🧾"
        headingLevel="h1"
        title="Order not found"
        description="We couldn't find this checkout in your orders."
        action={<Button to="/orders">My orders</Button>}
      />
    )
  }

  const { orders } = checkout
  const hasCard = orders.some((order) => order.payment.method === 'card')

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <span className={styles.check} aria-hidden="true">
          ✓
        </span>
        <h1 className={styles.title}>Thank you, your order is placed</h1>
        <p className={styles.number}>
          Checkout number <strong>{checkout.checkoutNumber}</strong>
        </p>
        <p className={styles.muted}>
          {orders.length === 1 ? 'The shop' : `${orders.length} shops`} will confirm {orders.length === 1 ? 'it' : 'them'} soon. You can
          cancel an order until its shop confirms it.
        </p>
      </header>

      {hasCard && (
        <Notice tone="info" title="Card payment (demo)">
          In the live app, the payment provider&apos;s secure page opens here to take your card payment. In this demo your card orders are
          marked as paid.
        </Notice>
      )}

      <ul className={styles.orders}>
        {orders.map((order) => {
          const badge = orderStatusBadge(order.status)
          const pickup = order.fulfillment.method === FULFILLMENT_METHODS.PICKUP
          return (
            <li key={order.id}>
              <Card as="article" aria-labelledby={`order-${order.id}`} className={styles.order}>
                <div className={styles.orderHeader}>
                  <h2 id={`order-${order.id}`} className={styles.shop}>
                    {order.shopName}
                  </h2>
                  <StatusIndicator label={badge.label} tone={badge.tone} />
                </div>
                <ul className={styles.items}>
                  {order.items.map((item) => (
                    <li key={item.partId}>
                      {item.quantity} × {item.name}
                    </li>
                  ))}
                </ul>
                <p className={styles.muted}>
                  {pickup
                    ? `Pickup at ${order.fulfillment.address} · ${order.fulfillment.hours}`
                    : `Delivery to ${order.fulfillment.address.address}, ${order.fulfillment.address.city}`}
                  {' · '}
                  {paymentLabel(order.payment.method, order.fulfillment.method)}
                </p>
                <div className={styles.orderFooter}>
                  <span className={styles.muted}>{formatDateTime(order.createdAt)}</span>
                  <strong>{formatPrice(order.totalIls)}</strong>
                  <Link to={`/orders/${order.id}`}>View order</Link>
                </div>
              </Card>
            </li>
          )
        })}
      </ul>

      <p className={styles.grand}>
        Grand total <strong>{formatPrice(checkout.grandTotalIls)}</strong>
      </p>

      <div className={styles.actions}>
        <Button to="/orders" size="lg">
          View my orders
        </Button>
        <Button to="/marketplace" variant="secondary" size="lg">
          Continue shopping
        </Button>
      </div>
    </div>
  )
}
