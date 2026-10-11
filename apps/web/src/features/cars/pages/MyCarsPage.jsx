import { useState } from 'react'
import { Link } from 'react-router'
import Badge from '../../../components/Badge.jsx'
import Button from '../../../components/Button.jsx'
import EmptyState from '../../../components/EmptyState.jsx'
import ActionMenu from '../../../components/ActionMenu.jsx'
import Modal from '../../../components/Modal.jsx'
import { SkeletonCards } from '../../../components/Skeleton.jsx'
import { useToast } from '../../../components/Toast/ToastContext.js'
import { SCAN_STATUS } from '../../preview3d/scanConstants.js'
import { useScans } from '../../preview3d/ScansContext.js'
import CarForm from '../components/CarForm.jsx'
import CarPhoto from '../components/CarPhoto.jsx'
import DeleteCarDialog from '../components/DeleteCarDialog.jsx'
import { carTitle, formatMileage } from '../format.js'
import { useMyCars } from '../useMyCars.js'
import styles from './MyCarsPage.module.css'

// /my-cars (customers) - the customer's cars: add, edit, delete, and open one for its maintenance
// history. These cars are offered in the diagnosis card and in "Request service".
export default function MyCarsPage() {
  const { cars, loading } = useMyCars()
  const { scans } = useScans()
  const hasScan = (car) => scans.some((scan) => scan.carId === car.id && scan.status === SCAN_STATUS.READY)
  const toast = useToast()
  // { car: null } to add, { car } to edit
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)

  const addButton = <Button onClick={() => setEditing({ car: null })}>+ Add car</Button>

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>My Cars</h1>
          <p className={styles.subtitle}>
            Your cars, ready to pick when you run an AI diagnosis or request service. Open one to see its maintenance
            history.
          </p>
        </div>
        {cars.length > 0 && addButton}
      </header>

      {loading && cars.length === 0 ? (
        <SkeletonCards count={2} media label="Loading your cars…" />
      ) : cars.length === 0 ? (
        <EmptyState
          icon="🚗"
          title="No cars yet"
          description="Add your car once, and pick it in a click next time you diagnose a problem or request service."
          action={addButton}
        />
      ) : (
        <ul className={styles.grid}>
          {cars.map((car) => (
            <li key={car.id} className={styles.card}>
              <div className={styles.thumb}>
                <CarPhoto car={car} />
              </div>
              <div className={styles.main}>
                <h2 className={styles.name}>
                  <Link to={`/my-cars/${car.id}`} className={styles.link}>
                    {car.nickname || carTitle(car)}
                  </Link>
                </h2>
                {car.nickname && <p className={styles.muted}>{carTitle(car)}</p>}
                {hasScan(car) && <Badge tone="info">3D model (scanned)</Badge>}
              </div>
              <dl className={styles.facts}>
                <div>
                  <dt>Mileage</dt>
                  <dd>{formatMileage(car.mileageKm)}</dd>
                </div>
                <div>
                  <dt>VIN</dt>
                  <dd className={styles.vin}>{car.vin || '—'}</dd>
                </div>
              </dl>
              <div className={styles.actions}>
                <Button to={`/my-cars/${car.id}`} size="sm">
                  History
                </Button>
                <ActionMenu
                  label={`Actions for ${car.nickname || carTitle(car)}`}
                  items={[
                    { label: 'Edit car', onSelect: () => setEditing({ car }) },
                    { label: 'Delete car', onSelect: () => setDeleting(car), danger: true },
                  ]}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={Boolean(editing)}
        title={editing?.car ? `Edit ${carTitle(editing.car)}` : 'Add a car'}
        onClose={() => setEditing(null)}
        wide
      >
        {editing && (
          <CarForm
            car={editing.car}
            onCancel={() => setEditing(null)}
            onDone={(saved) => {
              toast.success(editing.car ? `${carTitle(saved)} was saved.` : `${carTitle(saved)} was added to My Cars.`)
              setEditing(null)
            }}
          />
        )}
      </Modal>

      <DeleteCarDialog
        car={deleting}
        onCancel={() => setDeleting(null)}
        onDeleted={() => {
          toast.success(`${carTitle(deleting)} was removed.`)
          setDeleting(null)
        }}
      />
    </div>
  )
}
