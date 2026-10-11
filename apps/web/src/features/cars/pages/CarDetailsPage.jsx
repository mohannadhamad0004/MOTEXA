import { useCallback, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import Button from '../../../components/Button.jsx'
import EmptyState from '../../../components/EmptyState.jsx'
import Modal from '../../../components/Modal.jsx'
import { SkeletonRows } from '../../../components/Skeleton.jsx'
import { useToast } from '../../../components/Toast/ToastContext.js'
import { formatDate } from '../../../utils/formatDate.js'
import ScanStatusCard from '../../preview3d/components/ScanStatusCard.jsx'
import { usePreview3D } from '../../preview3d/Preview3DContext.js'
import { useScans } from '../../preview3d/ScansContext.js'
import WorkDetails from '../../requests/components/WorkDetails.jsx'
import { TARGET_PATHS } from '../../requests/format.js'
import { useRequestsQuery } from '../../requests/RequestsContext.js'
import CarForm from '../components/CarForm.jsx'
import CarPhoto from '../components/CarPhoto.jsx'
import DeleteCarDialog from '../components/DeleteCarDialog.jsx'
import { useCarsQuery } from '../CarsContext.js'
import { carTitle, formatMileage } from '../format.js'
import styles from './CarDetailsPage.module.css'

// /my-cars/:carId (customers) - one car and its maintenance history: the completed service requests
// for it, with the mechanic's confirmed diagnosis, work done, parts used and cost - and its 3D model
// (scanned): scans of the car for the marketplace's 3D preview, with their status.
export default function CarDetailsPage() {
  const { carId } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const loadCar = useCallback((service) => service.getCar(carId), [carId])
  const loadHistory = useCallback((service) => service.getCarHistory(carId), [carId])
  const { data: car, loading } = useCarsQuery(loadCar)
  const { data: history, error: historyError } = useRequestsQuery(loadHistory)
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const { scans, service: scanService } = useScans()
  const { selectScan, startScan, open: openPreview } = usePreview3D()

  if (loading) return <SkeletonRows rows={4} label="Loading…" />
  if (!car) {
    return (
      <EmptyState
        icon="🚗"
        headingLevel="h1"
        title="Car not found"
        description="It isn't in your garage any more."
        action={<Button to="/my-cars">Back to My Cars</Button>}
      />
    )
  }

  const carScans = scans.filter((scan) => scan.carId === car.id)

  return (
    <div className={styles.page}>
      <Button to="/my-cars" variant="ghost" size="sm" className={styles.back}>
        ← My Cars
      </Button>

      <header className={styles.header}>
        <CarPhoto car={car} className={styles.photo} />
        <div className={styles.headerText}>
          <h1 className={styles.title}>{car.nickname || carTitle(car)}</h1>
          {car.nickname && <p className={styles.subtitle}>{carTitle(car)}</p>}
          <dl className={styles.facts}>
            <div>
              <dt>Mileage</dt>
              <dd>{formatMileage(car.mileageKm)}</dd>
            </div>
            <div>
              <dt>VIN</dt>
              <dd className={styles.vin}>{car.vin || '—'}</dd>
            </div>
            <div>
              <dt>Repairs on MOTEXA</dt>
              <dd>{history?.length ?? '…'}</dd>
            </div>
          </dl>
          <div className={styles.actions}>
            <Button variant="secondary" onClick={() => setEditing(true)}>
              Edit car
            </Button>
            <Button variant="ghost" className={styles.delete} onClick={() => setDeleting(true)}>
              Delete
            </Button>
          </div>
        </div>
      </header>

      <section className={styles.section} aria-labelledby="scan-title">
        <div className={styles.sectionHeader}>
          <h2 id="scan-title" className={styles.sectionTitle}>
            3D model (scanned)
          </h2>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              startScan(car.id)
              navigate('/marketplace')
            }}
          >
            Scan this car
          </Button>
        </div>
        {carScans.length === 0 ? (
          <p className={styles.muted}>
            No scan yet. Scan this car (beta) to try accessories on your own car in the marketplace&apos;s 3D preview.
          </p>
        ) : (
          <ul className={styles.scans}>
            {carScans.map((scan) => (
              <li key={scan.id}>
                <ScanStatusCard
                  scan={scan}
                  showCar={false}
                  onUse={(ready) => {
                    selectScan(ready)
                    openPreview()
                    navigate('/marketplace')
                  }}
                  onDelete={async (removed) => {
                    await scanService.deleteScan(removed.id)
                    toast.success('Scan deleted.')
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.section} aria-labelledby="history-title">
        <h2 id="history-title" className={styles.sectionTitle}>
          Maintenance history
        </h2>
        {historyError && <p className={styles.muted}>Couldn't load the history.</p>}
        {!history && !historyError && <SkeletonRows rows={2} label="Loading the history…" />}
        {history?.length === 0 && (
          <EmptyState
            compact
            headingLevel="h3"
            icon="🔧"
            title="No completed repairs yet"
            description="When a mechanic completes a service request for this car, it appears here."
            action={<Button to="/mechanics">Find a mechanic</Button>}
          />
        )}
        {history?.length > 0 && (
          <ol className={styles.timeline}>
            {history.map((request) => (
              <li key={request.id} className={styles.record}>
                <div className={styles.recordHeader}>
                  <div>
                    <h3 className={styles.recordTitle}>{formatDate(request.completion.completedAt)}</h3>
                    <p className={styles.muted}>
                      <Link to={TARGET_PATHS[request.target.type](request.target.id)}>{request.target.name}</Link> ·
                      request {request.id}
                    </p>
                  </div>
                  <Button to={`/reports/${request.id}`} size="sm" variant="secondary">
                    Full report
                  </Button>
                </div>
                <WorkDetails completion={request.completion} />
              </li>
            ))}
          </ol>
        )}
      </section>

      <Modal open={editing} title={`Edit ${carTitle(car)}`} onClose={() => setEditing(false)} wide>
        {editing && (
          <CarForm
            car={car}
            onCancel={() => setEditing(false)}
            onDone={() => {
              setEditing(false)
              toast.success('Your car was saved.')
            }}
          />
        )}
      </Modal>

      <DeleteCarDialog
        car={deleting ? car : null}
        onCancel={() => setDeleting(false)}
        onDeleted={() => {
          toast.success(`${carTitle(car)} was removed.`)
          navigate('/my-cars')
        }}
      />
    </div>
  )
}
