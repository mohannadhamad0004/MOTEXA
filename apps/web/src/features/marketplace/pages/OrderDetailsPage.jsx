import { useCallback, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useAuth } from '../../../auth/useAuth.js'
import { ROLES } from '../../../authorization/roles.js'
import Button from '../../../components/Button.jsx'
import Card from '../../../components/Card.jsx'
import EmptyState from '../../../components/EmptyState.jsx'
import { TextField } from '../../../components/FormField.jsx'
import Modal from '../../../components/Modal.jsx'
import Notice from '../../../components/Notice.jsx'
import { SkeletonRows } from '../../../components/Skeleton.jsx'
import StatusIndicator from '../../../components/StatusIndicator.jsx'
import { useToast } from '../../../components/Toast/ToastContext.js'
import { formatDateTime } from '../../requests/format.js'
import RateExperience from '../../requests/components/RateExperience.jsx'
import OrderTimeline from '../components/OrderTimeline.jsx'
import { formatPrice } from '../format.js'
import { ORDER_STATUS, orderStatusBadge, paymentSummary } from '../orderConstants.js'
import { useOrdersQuery, useOrdersService } from '../OrdersContext.js'
import { FULFILLMENT_METHODS, paymentLabel } from '../shopCommerce.js'
import styles from './OrderDetailsPage.module.css'

const CANCELLED_TITLES = {
  buyer: 'You cancelled this order',
  shop: 'The shop rejected this order',
  admin: 'MOTEXA cancelled this order',
}

// /orders/:orderId - one order in full: items, delivery or pickup, payment, status timeline, the
// shop's chat, the service request it is for (mechanics), cancel (before the shop confirms),
// "Buy again" and, once completed, rating the shop.
export default function OrderDetailsPage() {
  const { orderId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const orders = useOrdersService()
  const load = useCallback((service) => service.getOrder(orderId), [orderId])
  const { data: order, error } = useOrdersQuery(load)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [busy, setBusy] = useState(null) // 'chat' | 'again' | 'demo'

  if (error) return <EmptyState icon="⚠" title="Couldn't load this order" description={error.message} />
  if (order === undefined) return <SkeletonRows rows={5} label="Loading the order…" />
  if (!order) {
    return (
      <EmptyState
        icon="📦"
        headingLevel="h1"
        title="Order not found"
        description="This order doesn't exist, or it isn't yours."
        action={<Button to="/orders">My orders</Button>}
      />
    )
  }

  const badge = orderStatusBadge(order.status)
  const pickup = order.fulfillment.method === FULFILLMENT_METHODS.PICKUP
  const cancelled = order.status === ORDER_STATUS.CANCELLED
  const refunded = order.payment.status === 'refunded'

  async function run(key, action) {
    setBusy(key)
    try {
      await action()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(null)
    }
  }

  const handleChat = () => run('chat', async () => navigate(`/chats/${await orders.openShopChat(order.id)}`))

  const handleBuyAgain = () =>
    run('again', async () => {
      const { added, skipped } = await orders.buyAgain(order.id)
      if (added === 0) {
        toast.error('None of these parts can be ordered right now: they are out of stock or no longer for sale.')
        return
      }
      if (skipped.length > 0) toast.warning(`Not added (unavailable): ${skipped.join(', ')}.`)
      toast.success(`${added} ${added === 1 ? 'part' : 'parts'} added to your cart.`)
      navigate('/cart')
    })

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Button to="/orders" variant="ghost" size="sm">
          ← My orders
        </Button>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>Order {order.id}</h1>
          <StatusIndicator label={badge.label} tone={badge.tone} />
        </div>
        <p className={styles.muted}>
          Checkout {order.checkoutNumber} · placed {formatDateTime(order.createdAt)} · <Link to={`/shops/${order.shopId}`}>{order.shopName}</Link>
        </p>
        <div className={styles.actions}>
          {order.status === ORDER_STATUS.PLACED && (
            <Button variant="danger" onClick={() => setCancelOpen(true)}>
              Cancel order
            </Button>
          )}
          <Button variant="secondary" loading={busy === 'again'} onClick={handleBuyAgain}>
            Buy again
          </Button>
          <Button variant="secondary" loading={busy === 'chat'} onClick={handleChat}>
            Message the shop
          </Button>
        </div>
      </header>

      {cancelled && (
        <Notice tone="danger" title={CANCELLED_TITLES[order.cancellation?.by] ?? 'This order was cancelled'}>
          {order.cancellation?.reason}
          {refunded && ' · Refund issued: your card payment is being returned.'}
        </Notice>
      )}

      <div className={styles.layout}>
        <div className={styles.main}>
          <Card flat as="section" aria-labelledby="items-title">
            <h2 id="items-title" className={styles.sectionTitle}>
              Items
            </h2>
            <ul className={styles.items}>
              {order.items.map((item) => (
                <li key={item.partId}>
                  <div>
                    <Link to={`/marketplace/part/${item.partId}`}>{item.name}</Link>
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

          <Card flat as="section" aria-labelledby="fulfillment-title">
            <h2 id="fulfillment-title" className={styles.sectionTitle}>
              {pickup ? 'Pickup' : 'Delivery'}
            </h2>
            {pickup ? (
              <>
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
                <a href={order.fulfillment.mapUrl} target="_blank" rel="noopener noreferrer">
                  Open in maps<span className={styles.srOnly}> (opens in a new tab)</span> ↗
                </a>
              </>
            ) : (
              <dl className={styles.facts}>
                <div>
                  <dt>Delivering to</dt>
                  <dd>
                    {order.fulfillment.address.label && <strong>{order.fulfillment.address.label}: </strong>}
                    {order.fulfillment.address.address}, {order.fulfillment.address.city}
                  </dd>
                </div>
              </dl>
            )}
          </Card>

          <Card flat as="section" aria-labelledby="payment-title">
            <h2 id="payment-title" className={styles.sectionTitle}>
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
          <Card flat as="section" aria-labelledby="timeline-title">
            <h2 id="timeline-title" className={styles.sectionTitle}>
              Status
            </h2>
            <OrderTimeline order={order} />
          </Card>

          {order.serviceRequestId && user.role === ROLES.MECHANIC && (
            <Card flat as="section" aria-labelledby="request-title">
              <h2 id="request-title" className={styles.sectionTitle}>
                Service request
              </h2>
              <p>
                For service request <Link to={`/chats/${order.serviceRequestId}`}>{order.serviceRequestId}</Link>. These parts are listed as
                &ldquo;parts used&rdquo; on it and appear in its final report.
              </p>
            </Card>
          )}

          {order.status === ORDER_STATUS.COMPLETED && user.role === ROLES.CUSTOMER && (
            <RateExperience request={{ id: order.id, target: { name: order.shopName } }} />
          )}
        </div>
      </div>

      <CancelDialog
        order={order}
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onCancel={async (reason) => {
          try {
            await orders.cancelOrder(order.id, reason)
            setCancelOpen(false)
            toast.success(order.payment.method === 'card' ? 'Order cancelled. Refund issued.' : 'Order cancelled.')
          } catch (err) {
            toast.error(err.message)
            setCancelOpen(false)
          }
        }}
      />
    </div>
  )
}

function CancelDialog({ order, open, onClose, onCancel }) {
  return (
    <Modal open={open} title="Cancel this order?" onClose={onClose}>
      {open && <CancelForm order={order} onClose={onClose} onCancel={onCancel} />}
    </Modal>
  )
}

function CancelForm({ order, onClose, onCancel }) {
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  return (
    <div className={styles.cancelForm}>
      <p>
        You can cancel because {order.shopName} hasn&apos;t confirmed this order yet.
        {order.payment.method === 'card' && ' Your card payment will be refunded.'}
      </p>
      <TextField
        id="cancel-reason"
        as="textarea"
        label="Reason"
        optional
        rows={3}
        maxLength={300}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
      />
      <div className={styles.cancelActions}>
        <Button variant="secondary" onClick={onClose} disabled={saving}>
          Keep order
        </Button>
        <Button
          variant="danger"
          loading={saving}
          onClick={async () => {
            setSaving(true)
            await onCancel(reason)
          }}
        >
          Cancel order
        </Button>
      </div>
    </div>
  )
}
