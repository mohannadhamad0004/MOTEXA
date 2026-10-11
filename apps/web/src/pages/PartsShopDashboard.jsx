import { useCallback, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useAuth } from '../auth/useAuth.js'
import Badge from '../components/Badge.jsx'
import Button from '../components/Button.jsx'
import EmptyState from '../components/EmptyState.jsx'
import Notice from '../components/Notice.jsx'
import ActionMenu from '../components/ActionMenu.jsx'
import { SkeletonRows } from '../components/Skeleton.jsx'
import StatusIndicator from '../components/StatusIndicator.jsx'
import DeletePartDialog from '../features/marketplace/components/DeletePartDialog.jsx'
import PartForm from '../features/marketplace/components/PartForm.jsx'
import { getVehicleOptions } from '../features/marketplace/filters.js'
import { formatPrice } from '../features/marketplace/format.js'
import { useMarketplaceQuery } from '../features/marketplace/MarketplaceContext.js'
import ProviderRequests from '../features/requests/components/ProviderRequests.jsx'
import { useNewShopOrders } from '../features/marketplace/OrdersContext.js'
import { OWN_PARTS_ONLY } from '../features/marketplace/ownership.js'
import styles from './PartsShopDashboard.module.css'

const LOW_STOCK = 5

// /parts-shop - the logged-in shop's own inventory (part.shopId === user.id), nobody else's.
// ?edit=<partId> opens the edit form; for a part from another shop it shows an error instead.
// Parts an admin hid are marked, with the admin's reason.
export default function PartsShopDashboard() {
  const { user } = useAuth()
  const shopId = user.id
  const newOrders = useNewShopOrders()
  const [searchParams, setSearchParams] = useSearchParams()
  const editId = searchParams.get('edit')

  const loadDashboard = useCallback(
    async (service) => {
      // getShopInventory includes parts an admin hid (with the reason); the public calls don't.
      const [{ shop, parts: inventory }, allParts] = await Promise.all([
        service.getShopInventory(shopId),
        service.getParts(),
      ])
      // Newest first, so a part that was just added is at the top
      inventory.sort((a, b) => b.addedAt.localeCompare(a.addedAt))
      return { shop, inventory, vehicles: getVehicleOptions(allParts) }
    },
    [shopId],
  )
  const { data, error } = useMarketplaceQuery(loadDashboard)
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState(null)
  const [notice, setNotice] = useState(null)

  if (error) return <EmptyState icon="⚠" title="Couldn't load your inventory" description="Please try again in a moment." />
  if (!data) return <SkeletonRows rows={6} label="Loading inventory…" />

  const { shop, inventory, vehicles } = data
  const editing = editId ? inventory.find((part) => part.id === editId) : null
  // A part id that isn't in this shop's inventory: another shop's part, or one that was deleted.
  const editNotAllowed = Boolean(editId) && !editing
  const hiddenParts = inventory.filter((part) => part.hidden)

  const closeEdit = () => setSearchParams({}, { replace: true })

  function startAdd() {
    setNotice(null)
    closeEdit()
    setAdding(true)
  }

  function startEdit(part) {
    setNotice(null)
    setAdding(false)
    setSearchParams({ edit: part.id })
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Parts inventory</h1>
          <p className={styles.subtitle}>{shop?.name ?? user.name} · Parts and accessories listed in your shop.</p>
        </div>
        <div className={styles.headerActions}>
          <Button
            to="/parts-shop/orders"
            variant="secondary"
            aria-label={newOrders > 0 ? `Orders, ${newOrders} new` : 'Orders'}
          >
            Orders {newOrders > 0 && <Badge tone="accent">{newOrders}</Badge>}
          </Button>
          {shop && (
            <Button to={`/shops/${shopId}`} variant="secondary">
              View public page
            </Button>
          )}
          {!adding && !editing && <Button onClick={startAdd}>Add new part</Button>}
        </div>
      </header>

      {newOrders > 0 && (
        <Notice tone="info" title={`${newOrders} new ${newOrders === 1 ? 'order is' : 'orders are'} waiting for you`}>
          <Link to="/parts-shop/orders">Open your orders</Link> to confirm or reject {newOrders === 1 ? 'it' : 'them'}.
        </Notice>
      )}

      <ProviderRequests />

      {notice && (
        <Notice tone="success">
          {notice.text}{' '}
          {notice.part && (
            <>
              See it in the <Link to={`/marketplace/search?q=${encodeURIComponent(notice.part.oemNumber || notice.part.name)}`}>marketplace</Link>{' '}
              or on <Link to={`/shops/${shopId}`}>your public page</Link>.
            </>
          )}
        </Notice>
      )}

      {hiddenParts.length > 0 && (
        <Notice
          tone="warning"
          title={`${hiddenParts.length} ${hiddenParts.length === 1 ? 'part is' : 'parts are'} hidden from the marketplace by MOTEXA`}
        >
          <ul className={styles.hiddenList}>
            {hiddenParts.map((part) => (
              <li key={part.id}>
                <strong>{part.name}</strong>: {part.hidden.reason}
              </li>
            ))}
          </ul>
          <p>Fix the listing and contact MOTEXA support to have it shown again.</p>
        </Notice>
      )}

      {editNotAllowed && (
        <Notice tone="danger" title={OWN_PARTS_ONLY}>
          <p>Part “{editId}” isn't in your inventory, so you can't edit it.</p>
          <p>
            <Button variant="secondary" size="sm" onClick={closeEdit}>
              Back to your parts
            </Button>
          </p>
        </Notice>
      )}

      {adding && (
        <PartForm
          shopId={shopId}
          vehicles={vehicles}
          onSaved={(part) => {
            setNotice({ text: `“${part.name}” was added.`, part })
            setAdding(false)
          }}
          onCancel={() => setAdding(false)}
        />
      )}

      {editing && (
        <PartForm
          key={editing.id}
          shopId={shopId}
          part={editing}
          vehicles={vehicles}
          onSaved={(part) => {
            setNotice({ text: `“${part.name}” was updated.`, part })
            closeEdit()
          }}
          onCancel={closeEdit}
        />
      )}

      {inventory.length === 0 ? (
        <EmptyState
          icon="📦"
          title="No parts listed yet"
          description="List your first part and it shows up in the marketplace right away."
          action={!adding && <Button onClick={startAdd}>Add new part</Button>}
        />
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Part</th>
                <th className={styles.numeric}>Price</th>
                <th className={styles.numeric}>Stock</th>
                <th className={styles.actionsCell}>
                  <span className={styles.visuallyHidden}>Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {inventory.map((part) => (
                <tr key={part.id} className={part.id === editId ? styles.editingRow : undefined}>
                  <td>
                    {part.name}{' '}
                    {part.hidden && <StatusIndicator label="Hidden by admin" tone="danger" />}
                    <span className={styles.partId}>
                      {part.oemNumber} · {part.brand}
                    </span>
                  </td>
                  <td className={styles.numeric}>{formatPrice(part.priceIls)}</td>
                  <td className={`${styles.numeric} ${part.stock <= LOW_STOCK ? styles.lowStock : ''}`}>
                    {part.stock === 0 ? 'Out of stock' : part.stock}
                    {part.reserved > 0 && <span className={styles.partId}>{part.reserved} reserved for orders</span>}
                  </td>
                  <td className={styles.actionsCell}>
                    <ActionMenu
                      label={`Actions for ${part.name}`}
                      items={[
                        { label: 'Edit part', onSelect: () => startEdit(part) },
                        { label: 'Delete part', onSelect: () => setDeleting(part), danger: true },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <DeletePartDialog
        part={deleting}
        onDeleted={(part) => {
          setDeleting(null)
          if (part.id === editId) closeEdit()
          setNotice({ text: `“${part.name}” was deleted.` })
        }}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}
