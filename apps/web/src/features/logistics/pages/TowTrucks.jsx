import { useState } from 'react'
import { TRUCK_STATUSES } from '../../../auth/signup/constants.js'
import { useAuth } from '../../../auth/useAuth.js'
import Button from '../../../components/Button.jsx'
import EmptyState from '../../../components/EmptyState.jsx'
import Modal from '../../../components/Modal.jsx'
import Notice from '../../../components/Notice.jsx'
import { SkeletonCards } from '../../../components/Skeleton.jsx'
import { useToast } from '../../../components/Toast/ToastContext.js'
import TruckCard from '../components/TruckCard.jsx'
import TruckForm from '../components/TruckForm.jsx'
import { useTrucksQuery, useTrucksService } from '../TrucksContext.js'
import TrucksProvider from '../TrucksProvider.jsx'
import styles from './TowTrucks.module.css'

const loadTrucks = (service) => service.getMyTrucks()

// /tow/trucks - the tow company's fleet (tow companies only, see routes.jsx): add, edit, change
// status and remove trucks. New trucks and changes to a plate, type, weight or document wait for an
// admin before they are public.
export default function TowTrucks() {
  return (
    <TrucksProvider>
      <TrucksPage />
    </TrucksProvider>
  )
}

function TrucksPage() {
  const { user } = useAuth()
  const service = useTrucksService()
  const toast = useToast()
  const { data: trucks, error } = useTrucksQuery(loadTrucks)
  // { mode: 'add' } or { mode: 'edit', truck }
  const [editing, setEditing] = useState(null)
  const [removing, setRemoving] = useState(null)
  const [savingStatusOf, setSavingStatusOf] = useState(null)

  async function changeStatus(truck, status) {
    setSavingStatusOf(truck.id)
    try {
      await service.setTruckStatus(truck.id, status)
      const label = TRUCK_STATUSES.find((option) => option.value === status)?.label ?? status
      toast.success(`${truck.plateNumber} is now marked as ${label.toLowerCase()}.`)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSavingStatusOf(null)
    }
  }

  const pendingCount = trucks?.filter((t) => t.reviewStatus === 'pending').length ?? 0

  return (
    <div className={styles.page}>
      <Button to="/tow" variant="ghost" size="sm" className={styles.back}>
        ← Tow dashboard
      </Button>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Your trucks</h1>
          <p className={styles.subtitle}>{user.name} · the trucks you use for MOTEXA tow requests.</p>
        </div>
        <Button onClick={() => setEditing({ mode: 'add' })}>+ Add truck</Button>
      </header>

      <Notice tone="info">
        New trucks, and changes to a plate number, type, max weight or document, are checked by MOTEXA before they
        appear on your public profile. Status and photos change right away.
      </Notice>

      {error && <Notice tone="danger">Couldn't load your trucks: {error.message}</Notice>}
      {!trucks && !error && <SkeletonCards count={3} media label="Loading your trucks…" />}

      {trucks && (
        <>
          <p className={styles.muted} aria-live="polite">
            {trucks.length} {trucks.length === 1 ? 'truck' : 'trucks'}
            {pendingCount > 0 && ` · ${pendingCount} waiting for review`}
          </p>
          {trucks.length === 0 ? (
            <EmptyState
              icon="🚚"
              title="No trucks yet"
              description="Add a truck to start taking tow requests."
              action={<Button onClick={() => setEditing({ mode: 'add' })}>Add truck</Button>}
            />
          ) : (
            <ul className={styles.grid}>
              {trucks.map((truck) => (
                <TruckCard
                  key={truck.id}
                  truck={truck}
                  statusSaving={savingStatusOf === truck.id}
                  onStatusChange={(status) => changeStatus(truck, status)}
                  onEdit={() => setEditing({ mode: 'edit', truck })}
                  onRemove={() => setRemoving(truck)}
                />
              ))}
            </ul>
          )}
        </>
      )}

      <Modal
        open={Boolean(editing)}
        title={editing?.mode === 'edit' ? `Edit truck ${editing.truck.plateNumber}` : 'Add a truck'}
        onClose={() => setEditing(null)}
        wide
      >
        {editing && (
          <TruckForm
            truck={editing.mode === 'edit' ? editing.truck : null}
            onCancel={() => setEditing(null)}
            onDone={(message) => {
              setEditing(null)
              toast.success(message)
            }}
          />
        )}
      </Modal>

      <RemoveTruckDialog
        truck={removing}
        isLast={trucks?.length === 1}
        onCancel={() => setRemoving(null)}
        onRemove={async (truck) => {
          await service.removeTruck(truck.id)
          setRemoving(null)
          toast.success(`${truck.plateNumber} was removed from your fleet.`)
        }}
      />
    </div>
  )
}

// Asks before removing. A truck on an active tow request (or the only truck) can't be removed, so
// the dialog explains why instead of offering the button. The service checks the same.
function RemoveTruckDialog({ truck, isLast, onCancel, onRemove }) {
  const [error, setError] = useState(null)
  const [removing, setRemoving] = useState(false)
  const blockedReason =
    (truck?.activeRequest &&
      `This truck is on an active tow request (${truck.activeRequest.id}: ${truck.activeRequest.summary}). You can remove it once that job is finished.`) ||
    (isLast && 'This is your only truck. Add another one before removing it.') ||
    null

  function close() {
    setError(null)
    setRemoving(false)
    onCancel()
  }

  async function confirm() {
    setRemoving(true)
    setError(null)
    try {
      await onRemove(truck)
      setRemoving(false)
    } catch (err) {
      setError(err.message)
      setRemoving(false)
    }
  }

  return (
    <Modal open={Boolean(truck)} title={truck ? `Remove truck ${truck.plateNumber}?` : ''} onClose={close}>
      {truck && (
        <div className={styles.dialog}>
          {blockedReason ? (
            <Notice tone="warning" title="This truck can't be removed right now">
              {blockedReason}
            </Notice>
          ) : (
            <p>
              It will disappear from your fleet and your public profile, together with its documents. To use it
              again later, add it again and it will be reviewed again.
            </p>
          )}
          {error && <Notice tone="danger">{error}</Notice>}
          <div className={styles.dialogActions}>
            <Button variant="secondary" onClick={close} disabled={removing}>
              {blockedReason ? 'OK' : 'Cancel'}
            </Button>
            {!blockedReason && (
              <Button variant="danger" onClick={confirm} loading={removing}>
                {removing ? 'Removing…' : 'Remove truck'}
              </Button>
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}
