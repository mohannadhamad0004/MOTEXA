import { useCallback, useState } from 'react'
import { useParams } from 'react-router'
import Button from '../../../components/Button.jsx'
import EmptyState from '../../../components/EmptyState.jsx'
import { TextField } from '../../../components/FormField.jsx'
import Modal from '../../../components/Modal.jsx'
import Notice from '../../../components/Notice.jsx'
import { SkeletonRows } from '../../../components/Skeleton.jsx'
import StatusIndicator from '../../../components/StatusIndicator.jsx'
import { useToast } from '../../../components/Toast/ToastContext.js'
import { formatDateTime } from '../../requests/format.js'
import OrderDetailsSections from '../components/OrderDetailsSections.jsx'
import { NEXT_STEP_LABELS, nextOrderStatus, ORDER_STATUS, orderStatusBadge } from '../orderConstants.js'
import { useOrdersQuery, useOrdersService } from '../OrdersContext.js'
import { PAYMENT_METHODS } from '../shopCommerce.js'
import styles from './ShopOrderDetailsPage.module.css'

// /parts-shop/orders/:orderId - one of the shop's own orders. Another shop's order id gives an
// error (the service refuses it, like part ownership). Actions:
//   new            Confirm (stock is deducted) or Reject (needs a reason; stock is released)
//   confirmed on   the next step: preparing -> out for delivery / ready for pickup -> delivered /
//                  picked up -> completed
//   cash orders    "Mark as paid" when the money is received; needed before completing
export default function ShopOrderDetailsPage() {
  const { orderId } = useParams()
  const orders = useOrdersService()
  const toast = useToast()
  const load = useCallback((service) => service.getShopOrder(orderId), [orderId])
  const { data: order, error } = useOrdersQuery(load)
  const [busy, setBusy] = useState(null)
  const [rejecting, setRejecting] = useState(false)

  if (error) {
    return (
      <EmptyState
        icon="🔒"
        headingLevel="h1"
        title="You can't open this order"
        description={error.message}
        action={<Button to="/parts-shop/orders">Back to orders</Button>}
      />
    )
  }
  if (order === undefined) return <SkeletonRows rows={5} label="Loading the order…" />
  if (!order) {
    return (
      <EmptyState
        icon="📦"
        headingLevel="h1"
        title="Order not found"
        action={<Button to="/parts-shop/orders">Back to orders</Button>}
      />
    )
  }

  const badge = orderStatusBadge(order.status)
  const next = order.status === ORDER_STATUS.PLACED ? null : nextOrderStatus(order)
  const needsPayment = next === ORDER_STATUS.COMPLETED && order.payment.status !== 'paid'
  const canMarkPaid =
    order.payment.method === PAYMENT_METHODS.CASH &&
    order.payment.status === 'unpaid' &&
    order.status !== ORDER_STATUS.PLACED &&
    order.status !== ORDER_STATUS.CANCELLED

  async function run(key, action, success) {
    setBusy(key)
    try {
      await action()
      if (success) toast.success(success)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Button to="/parts-shop/orders" variant="ghost" size="sm">
          ← Orders
        </Button>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>Order {order.id}</h1>
          <StatusIndicator label={badge.label} tone={badge.tone} />
        </div>
        <p className={styles.muted}>
          Checkout {order.checkoutNumber} · placed {formatDateTime(order.createdAt)}
        </p>

        <div className={styles.actions}>
          {order.status === ORDER_STATUS.PLACED && (
            <>
              <Button loading={busy === 'confirm'} onClick={() => run('confirm', () => orders.confirmOrder(order.id), 'Order confirmed. The customer was notified.')}>
                Confirm order
              </Button>
              <Button variant="danger" onClick={() => setRejecting(true)}>
                Reject order
              </Button>
            </>
          )}
          {next && (
            <Button
              loading={busy === 'next'}
              disabled={needsPayment}
              onClick={() => run('next', () => orders.advanceOrder(order.id), 'Order updated. The customer was notified.')}
            >
              {NEXT_STEP_LABELS[next]}
            </Button>
          )}
          {canMarkPaid && (
            <Button
              variant="secondary"
              loading={busy === 'paid'}
              onClick={() => run('paid', () => orders.markOrderPaid(order.id), 'Marked as paid.')}
            >
              Mark as paid
            </Button>
          )}
          <Button to={`/parts-shop/orders/${order.id}/packing-slip`} variant="secondary">
            Packing slip
          </Button>
        </div>
        {needsPayment && <p className={styles.muted}>Mark this cash order as paid before you complete it.</p>}
      </header>

      {order.status === ORDER_STATUS.PLACED && (
        <Notice tone="info" title="New order">
          Confirm it to take these parts off your stock, or reject it (with a reason) to put them back on sale.
        </Notice>
      )}

      <OrderDetailsSections order={order} audience="shop" />

      <RejectDialog
        open={rejecting}
        onClose={() => setRejecting(false)}
        onReject={async (reason) => {
          await orders.rejectOrder(order.id, reason)
          setRejecting(false)
          toast.success('Order rejected. The customer was notified.')
        }}
      />
    </div>
  )
}

function RejectDialog({ open, onClose, onReject }) {
  return (
    <Modal open={open} title="Reject this order?" onClose={onClose}>
      {open && <RejectForm onClose={onClose} onReject={onReject} />}
    </Modal>
  )
}

function RejectForm({ onClose, onReject }) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    if (!reason.trim()) {
      setError('Write the reason, so the customer knows why.')
      return
    }
    setSaving(true)
    try {
      await onReject(reason)
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <form className={styles.rejectForm} onSubmit={handleSubmit} noValidate>
      <p>The customer sees your reason. The reserved parts go back on sale, and a card payment is refunded.</p>
      <TextField
        id="reject-reason"
        as="textarea"
        label="Reason"
        rows={3}
        maxLength={300}
        autoFocus
        value={reason}
        onChange={(event) => {
          setReason(event.target.value)
          setError(null)
        }}
        error={error}
      />
      <div className={styles.rejectActions}>
        <Button variant="secondary" onClick={onClose} disabled={saving}>
          Keep order
        </Button>
        <Button type="submit" variant="danger" loading={saving}>
          Reject order
        </Button>
      </div>
    </form>
  )
}
