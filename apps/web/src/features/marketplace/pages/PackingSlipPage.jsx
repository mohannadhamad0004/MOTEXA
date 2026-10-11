import { useCallback } from 'react'
import { useParams } from 'react-router'
import Button from '../../../components/Button.jsx'
import EmptyState from '../../../components/EmptyState.jsx'
import { SkeletonRows } from '../../../components/Skeleton.jsx'
import { formatDate } from '../../../utils/formatDate.js'
import { formatPrice } from '../format.js'
import { ORDER_STATUS } from '../orderConstants.js'
import { useOrdersQuery } from '../OrdersContext.js'
import { FULFILLMENT_METHODS, paymentLabel } from '../shopCommerce.js'
import styles from './PackingSlipPage.module.css'

// /parts-shop/orders/:orderId/packing-slip - a printable slip to put in the box: who it is for, how
// it leaves the shop, and what to pack with part numbers and a tick box per line. "Print" opens
// the browser's print dialog; the print styles leave out the navigation and buttons and use
// light colors in both themes. Only the shop's own orders open (the service refuses others).
export default function PackingSlipPage() {
  const { orderId } = useParams()
  const load = useCallback((service) => service.getShopOrder(orderId), [orderId])
  const { data: order, error } = useOrdersQuery(load)

  if (error) {
    return <EmptyState icon="🔒" headingLevel="h1" title="You can't open this order" description={error.message} action={<Button to="/parts-shop/orders">Back to orders</Button>} />
  }
  if (order === undefined) return <SkeletonRows rows={5} label="Loading the packing slip…" />
  if (!order || order.status === ORDER_STATUS.PLACED || order.status === ORDER_STATUS.CANCELLED) {
    return (
      <EmptyState
        icon="📦"
        headingLevel="h1"
        title="No packing slip for this order"
        description="Packing slips are for orders you have confirmed."
        action={<Button to={order ? `/parts-shop/orders/${order.id}` : '/parts-shop/orders'}>Back</Button>}
      />
    )
  }

  const pickup = order.fulfillment.method === FULFILLMENT_METHODS.PICKUP
  const unitCount = order.items.reduce((sum, item) => sum + item.quantity, 0)

  return (
    <div className={styles.page}>
      <div className={styles.toolbar}>
        <Button to={`/parts-shop/orders/${order.id}`} variant="ghost" size="sm">
          ← Order
        </Button>
        <Button onClick={() => window.print()}>Print packing slip</Button>
      </div>

      <article className={styles.slip} aria-labelledby="slip-title">
        <header className={styles.header}>
          <div>
            <p className={styles.brand}>
              <span className={styles.brandAccent}>Mo</span>texa
            </p>
            <h1 id="slip-title" className={styles.title}>
              Packing slip
            </h1>
          </div>
          <dl className={styles.meta}>
            <div>
              <dt>Order</dt>
              <dd>{order.id}</dd>
            </div>
            <div>
              <dt>Checkout</dt>
              <dd>{order.checkoutNumber}</dd>
            </div>
            <div>
              <dt>Date</dt>
              <dd>{formatDate(order.createdAt)}</dd>
            </div>
          </dl>
        </header>

        <section className={styles.parties}>
          <div>
            <h2 className={styles.label}>From</h2>
            <p className={styles.strong}>{order.shopName}</p>
          </div>
          <div>
            <h2 className={styles.label}>For</h2>
            <p className={styles.strong}>{order.buyerName}</p>
            {order.serviceRequestId && <p>Service request {order.serviceRequestId}</p>}
          </div>
          <div>
            <h2 className={styles.label}>{pickup ? 'Pickup' : 'Deliver to'}</h2>
            {pickup ? (
              <p>
                {order.fulfillment.address}
                <br />
                {order.fulfillment.hours}
              </p>
            ) : (
              <p>
                {order.fulfillment.address.address}
                <br />
                {order.fulfillment.address.city}
              </p>
            )}
          </div>
        </section>

        <table className={styles.table}>
          <caption className={styles.caption}>
            {unitCount} {unitCount === 1 ? 'unit' : 'units'} to pack
          </caption>
          <thead>
            <tr>
              <th scope="col">Packed</th>
              <th scope="col">Part</th>
              <th scope="col">Part no.</th>
              <th scope="col" className={styles.number}>
                Qty
              </th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.partId}>
                <td>
                  <span className={styles.box} aria-hidden="true" />
                </td>
                <td>
                  {item.name}
                  <span className={styles.sub}>{item.brand}</span>
                </td>
                <td className={styles.mono}>{item.partNumber}</td>
                <td className={styles.number}>{item.quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <section className={styles.payment}>
          <p>
            <strong>Payment:</strong> {paymentLabel(order.payment.method, order.fulfillment.method)}
            {order.payment.status === 'paid' ? ' (paid)' : ' (collect on ' + (pickup ? 'pickup' : 'delivery') + ')'}
          </p>
          <p className={styles.total}>
            {order.payment.status === 'paid' ? 'Total paid' : 'Amount to collect'}: {formatPrice(order.totalIls)}
          </p>
        </section>
      </article>
    </div>
  )
}
