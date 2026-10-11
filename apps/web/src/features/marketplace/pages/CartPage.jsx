import { useCart, useCartQuery } from '../CartContext.js'
import { useToast } from '../../../components/Toast/ToastContext.js'
import Button from '../../../components/Button.jsx'
import Card from '../../../components/Card.jsx'
import EmptyState from '../../../components/EmptyState.jsx'
import { SkeletonRows } from '../../../components/Skeleton.jsx'
import CartChangesNotice from '../components/CartChangesNotice.jsx'
import CartGroupCard from '../components/CartGroupCard.jsx'
import VehiclePicker from '../components/VehiclePicker.jsx'
import { formatPrice } from '../format.js'
import styles from './CartPage.module.css'

const loadCart = (service) => service.getCartView()

// /cart - the items, grouped by shop (each shop is a separate order), with quantity controls, fit
// warnings for the selected vehicle, subtotals and the way on to checkout.
export default function CartPage() {
  const { service } = useCart()
  const toast = useToast()
  const { data: view, error } = useCartQuery(loadCart)

  async function run(action) {
    try {
      await action()
    } catch (err) {
      toast.error(err.message)
    }
  }

  if (error) return <EmptyState icon="⚠" title="Couldn't load your cart" description={error.message} />
  if (!view) return <SkeletonRows rows={4} label="Loading your cart…" />

  if (view.groups.length === 0 && view.changes.length === 0) {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>Your cart</h1>
        <EmptyState
          icon="🛒"
          title="Your cart is empty"
          description="Find a part in the marketplace, or move one over from your saved parts."
          action={
            <>
              <Button to="/marketplace">Browse parts</Button>{' '}
              <Button to="/saved-parts" variant="secondary">
                Saved parts
              </Button>
            </>
          }
        />
      </div>
    )
  }

  const shopCount = view.groups.length
  const blocked = view.changes.length > 0

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Button to="/marketplace" variant="ghost" size="sm">
          ← Keep shopping
        </Button>
        <h1 className={styles.title}>Your cart</h1>
        <p className={styles.subtitle}>
          {view.itemCount} {view.itemCount === 1 ? 'item' : 'items'} from {shopCount} {shopCount === 1 ? 'shop' : 'shops'}. Each shop
          prepares its own order.
        </p>
      </header>

      <CartChangesNotice changes={view.changes} />

      <Card flat as="section" aria-labelledby="fit-title" className={styles.fit}>
        <h2 id="fit-title" className={styles.fitTitle}>
          Check that parts fit your car
        </h2>
        <p className={styles.hint}>Choose your vehicle and we&apos;ll flag any part that doesn&apos;t fit it.</p>
        <VehiclePicker
          vehicle={view.vehicle}
          options={view.vehicleOptions}
          onChange={(vehicle) => run(() => service.setVehicle(vehicle))}
        />
      </Card>

      <div className={styles.layout}>
        <div className={styles.groups}>
          {view.groups.map((group) => (
            <CartGroupCard
              key={group.shop.id}
              group={group}
              onQuantity={(partId, quantity) => run(() => service.setQuantity(partId, quantity))}
              onRemove={(partId) => run(() => service.removeItem(partId))}
            />
          ))}
        </div>

        <aside className={styles.summary} aria-label="Order summary">
          <Card elevated className={styles.summaryCard}>
            <h2 className={styles.summaryTitle}>Summary</h2>
            <dl className={styles.rows}>
              {view.groups.map(({ shop, subtotalIls }) => (
                <div key={shop.id}>
                  <dt>{shop.name}</dt>
                  <dd>{formatPrice(subtotalIls)}</dd>
                </div>
              ))}
              <div className={styles.total}>
                <dt>Items total</dt>
                <dd>{formatPrice(view.subtotalIls)}</dd>
              </div>
            </dl>
            <p className={styles.hint}>Delivery fees are added at checkout, per shop.</p>
            <Button to="/checkout" size="lg" fullWidth disabled={blocked} aria-disabled={blocked || undefined} onClick={(e) => blocked && e.preventDefault()}>
              Go to checkout
            </Button>
            {blocked && <p className={styles.hint}>Accept the changes above to continue.</p>}
          </Card>
        </aside>
      </div>
    </div>
  )
}
