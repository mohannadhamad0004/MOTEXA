import { useCallback, useState } from 'react'
import { useParams } from 'react-router'
import Button from '../../../components/Button.jsx'
import EmptyState from '../../../components/EmptyState.jsx'
import Notice from '../../../components/Notice.jsx'
import { SkeletonRows } from '../../../components/Skeleton.jsx'
import StatusIndicator from '../../../components/StatusIndicator.jsx'
import { useToast } from '../../../components/Toast/ToastContext.js'
import OrderDetailsSections from '../../marketplace/components/OrderDetailsSections.jsx'
import { ORDER_STATUS, orderStatusBadge } from '../../marketplace/orderConstants.js'
import { formatDateTime } from '../../requests/format.js'
import AdminPage from '../components/AdminPage.jsx'
import ReasonDialog from '../components/ReasonDialog.jsx'
import { useAdminQuery, useAdminService } from '../AdminContext.js'

// /admin/orders/:orderId - one order, read-only, with "Cancel order" (a reason is required) for
// problems. Cancelling puts the stock back, refunds a payment already taken and tells the buyer
// and the shop. Completed and cancelled orders can't be cancelled.
export default function AdminOrderDetails() {
  const { orderId } = useParams()
  const service = useAdminService()
  const toast = useToast()
  const load = useCallback((adminService) => adminService.getOrder(orderId), [orderId])
  const { data: order, error } = useAdminQuery(load)
  const [cancelling, setCancelling] = useState(false)

  if (error) return <Notice tone="danger">Couldn't load this order: {error.message}</Notice>
  if (order === undefined) return <SkeletonRows rows={5} label="Loading…" />
  if (!order) {
    return (
      <EmptyState icon="📦" headingLevel="h1" title="Order not found" action={<Button to="/admin/orders">Back to orders</Button>} />
    )
  }

  const badge = orderStatusBadge(order.status)
  const canCancel = order.status !== ORDER_STATUS.CANCELLED && order.status !== ORDER_STATUS.COMPLETED

  return (
    <AdminPage
      title={`Order ${order.id}`}
      description={`Checkout ${order.checkoutNumber} · ${order.shopName} · placed ${formatDateTime(order.createdAt)}`}
      actions={
        <>
          <StatusIndicator label={badge.label} tone={badge.tone} />
          <Button to="/admin/orders" variant="secondary">
            All orders
          </Button>
          {canCancel && (
            <Button variant="danger" onClick={() => setCancelling(true)}>
              Cancel order
            </Button>
          )}
        </>
      }
    >
      <OrderDetailsSections order={order} audience="admin" />

      <ReasonDialog
        open={cancelling}
        title="Cancel this order?"
        hint="The customer and the shop see this reason. Reserved or deducted stock goes back, and a payment already taken is refunded."
        requiredMessage="Write the reason for cancelling this order."
        confirmLabel="Cancel order"
        onCancel={() => setCancelling(false)}
        onConfirm={async (reason) => {
          await service.cancelOrder(order.id, reason)
          setCancelling(false)
          toast.success('Order cancelled. The customer and the shop were notified.')
        }}
      />
    </AdminPage>
  )
}
