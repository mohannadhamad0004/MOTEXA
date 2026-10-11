import { Link } from 'react-router'
import { ROLE_LABELS } from '../../../authorization/roles.js'
import Card from '../../../components/Card.jsx'
import Notice from '../../../components/Notice.jsx'
import { formatPrice } from '../format.js'
import { ORDER_STATUS, paymentSummary } from '../orderConstants.js'
import { FULFILLMENT_METHODS, paymentLabel } from '../shopCommerce.js'
import OrderTimeline from './OrderTimeline.jsx'
import styles from './OrderDetailsSections.module.css'

const CANCELLED_BY = { buyer: 'Cancelled by the customer', shop: 'Rejected by the shop', admin: 'Cancelled by MOTEXA' }
// whose is 'your' for the shop's own page and 'the shop's' for the admin's.
const stockText = (whose) => ({
  reserved: `Reserved: held for this order, deducted from ${whose} stock when ${whose === 'your' ? 'you confirm' : 'the shop confirms'} it.`,
  deducted: `Deducted from ${whose} stock.`,
  released: 'Released: the reserved units went back on sale.',
  returned: `Returned to ${whose} stock.`,
})

// Everything about one order, read-only: who ordered, items and totals, delivery or pickup,
// payment, the linked service request, stock and the status timeline. Used by the shop's order page
// and the admin's order page. `audience` only changes a few words ('shop' | 'admin').
export default function OrderDetailsSections({ order, audience = 'shop', requestLink = null }) {
  const pickup = order.fulfillment.method === FULFILLMENT_METHODS.PICKUP
  const cancelled = order.status === ORDER_STATUS.CANCELLED

  return (
    <div className={styles.layout}>
      <div className={styles.main}>
        {cancelled && order.cancellation && (
          <Notice tone="danger" title={CANCELLED_BY[order.cancellation.by] ?? 'Cancelled'}>
            {order.cancellation.reason}
            {order.payment.status === 'refunded' && ' · The payment was refunded.'}
          </Notice>
        )}

        <Card as="section" aria-labelledby="buyer-title">
          <h2 id="buyer-title" className={styles.title}>
            {order.buyerRole === 'mechanic' ? 'Mechanic' : 'Customer'}
          </h2>
          <dl className={styles.facts}>
            <div>
              <dt>Name</dt>
              <dd>{order.buyerName}</dd>
            </div>
            <div>
              <dt>Account type</dt>
              <dd>{ROLE_LABELS[order.buyerRole]}</dd>
            </div>
            {audience === 'admin' && (
              <div>
                <dt>Shop</dt>
                <dd>
                  <Link to={`/shops/${order.shopId}`}>{order.shopName}</Link>
                </dd>
              </div>
            )}
            {order.serviceRequestId && (
              <div>
                <dt>Linked service request</dt>
                <dd>{requestLink ?? order.serviceRequestId}</dd>
              </div>
            )}
          </dl>
          {order.serviceRequestId && (
            <p className={styles.muted}>The parts are for service request {order.serviceRequestId}.</p>
          )}
        </Card>

        <Card as="section" aria-labelledby="order-items-title">
          <h2 id="order-items-title" className={styles.title}>
            Items
          </h2>
          <ul className={styles.items}>
            {order.items.map((item) => (
              <li key={item.partId}>
                <div>
                  <strong>{item.name}</strong>
                  <p className={styles.muted}>
                    {item.brand} · Part no. <span className={styles.mono}>{item.partNumber}</span>
                  </p>
                  <p className={styles.muted}>
                    {item.quantity} × {formatPrice(item.priceIls)}
                  </p>
                </div>
                <strong>{formatPrice(item.quantity * item.priceIls)}</strong>
              </li>
            ))}
          </ul>
          <dl className={styles.totals}>
            <div>
              <dt>Items</dt>
              <dd>{formatPrice(order.subtotalIls)}</dd>
            </div>
            <div>
              <dt>{pickup ? 'Pickup' : 'Delivery fee'}</dt>
              <dd>{order.deliveryFeeIls === 0 ? 'Free' : formatPrice(order.deliveryFeeIls)}</dd>
            </div>
            <div className={styles.totalRow}>
              <dt>Total</dt>
              <dd>{formatPrice(order.totalIls)}</dd>
            </div>
          </dl>
        </Card>

        <Card as="section" aria-labelledby="order-fulfillment-title">
          <h2 id="order-fulfillment-title" className={styles.title}>
            {pickup ? 'Pickup' : 'Delivery'}
          </h2>
          {pickup ? (
            <dl className={styles.facts}>
              <div>
                <dt>Pickup address</dt>
                <dd>{order.fulfillment.address}</dd>
              </div>
              <div>
                <dt>Pickup hours</dt>
                <dd>{order.fulfillment.hours}</dd>
              </div>
            </dl>
          ) : (
            <dl className={styles.facts}>
              <div>
                <dt>Deliver to</dt>
                <dd>
                  {order.fulfillment.address.label && <strong>{order.fulfillment.address.label}: </strong>}
                  {order.fulfillment.address.address}, {order.fulfillment.address.city}
                </dd>
              </div>
            </dl>
          )}
        </Card>

        <Card as="section" aria-labelledby="order-payment-title">
          <h2 id="order-payment-title" className={styles.title}>
            Payment
          </h2>
          <dl className={styles.facts}>
            <div>
              <dt>Method</dt>
              <dd>{paymentLabel(order.payment.method, order.fulfillment.method)}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{paymentSummary(order)}</dd>
            </div>
          </dl>
        </Card>
      </div>

      <div className={styles.side}>
        <Card as="section" aria-labelledby="order-status-title">
          <h2 id="order-status-title" className={styles.title}>
            Status
          </h2>
          <OrderTimeline order={order} />
        </Card>
        <Card as="section" aria-labelledby="order-stock-title">
          <h2 id="order-stock-title" className={styles.title}>
            Stock
          </h2>
          <p className={styles.muted}>{stockText(audience === 'admin' ? "the shop's" : 'your')[order.stockState] ?? '—'}</p>
        </Card>
      </div>
    </div>
  )
}
