import ProviderRequests from '../features/requests/components/ProviderRequests.jsx'
import ResponderEmergencies from '../features/requests/emergency/components/ResponderEmergencies.jsx'
import Button from '../components/Button.jsx'
import Card from '../components/Card.jsx'
import StatusIndicator from '../components/StatusIndicator.jsx'
import styles from './TowDashboard.module.css'

// TODO: replace with real API call
const transportRequests = [
  {
    id: 'TR-310',
    status: 'Pending',
    car: 'Toyota Corolla 2015',
    reason: 'Engine will not start',
    pickup: 'Al Nour St. 14, Downtown',
    dropoff: 'Kareem Auto Repair, Industrial Area',
    distanceKm: 7.4,
    requestedAt: '10:42',
  },
  {
    id: 'TR-312',
    status: 'Pending',
    car: 'Hyundai Elantra 2021',
    reason: 'Oil pressure warning, customer told not to drive',
    pickup: 'City Mall parking, Gate 3',
    dropoff: 'FastLane Garage, Ring Road',
    distanceKm: 12.1,
    requestedAt: '10:55',
  },
  {
    id: 'TR-305',
    status: 'En route to pickup',
    car: 'Volkswagen Golf 2018',
    reason: 'Flat tire, no spare',
    pickup: 'University Ave. 2',
    dropoff: 'Tire Pro Shop, North District',
    distanceKm: 4.8,
    requestedAt: '09:58',
  },
  {
    id: 'TR-301',
    status: 'Towing',
    car: 'Kia Sportage 2019',
    reason: 'Accident damage, front bumper',
    pickup: 'Highway 5, exit 12',
    dropoff: 'Kareem Auto Repair, Industrial Area',
    distanceKm: 18.6,
    requestedAt: '09:20',
  },
]

const pending = transportRequests.filter((request) => request.status === 'Pending')
const active = transportRequests.filter((request) => request.status !== 'Pending')

function RequestCard({ request, action }) {
  return (
    <Card as="li" className={styles.card}>
      <div className={styles.cardHeader}>
        <div>
          <h3 className={styles.carName}>{request.car}</h3>
          <p className={styles.muted}>
            {request.id} · requested at {request.requestedAt} · {request.distanceKm} km
          </p>
        </div>
        <StatusIndicator label={request.status} tone={request.status === 'Pending' ? 'warning' : 'info'} />
      </div>
      <p className={styles.reason}>{request.reason}</p>
      <dl className={styles.route}>
        <div>
          <dt>Pickup</dt>
          <dd>{request.pickup}</dd>
        </div>
        <div>
          <dt>Drop-off</dt>
          <dd>{request.dropoff}</dd>
        </div>
      </dl>
      {action}
    </Card>
  )
}

export default function TowDashboard() {
  return (
    <div className={styles.page}>
      <ResponderEmergencies />
      <ProviderRequests />

      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Transport requests</h1>
          <p className={styles.subtitle}>
            Tow requests near your company and the jobs your trucks are working on.
          </p>
        </div>
        <Button to="/tow/trucks" variant="secondary">
          Manage trucks
        </Button>
      </header>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Pending ({pending.length})</h2>
        <ul className={styles.list}>
          {pending.map((request) => (
            <RequestCard
              key={request.id}
              request={request}
              // TODO: send the acceptance to the API
              action={
                <div>
                  <Button disabled>Accept request</Button>
                </div>
              }
            />
          ))}
        </ul>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Active ({active.length})</h2>
        <ul className={styles.list}>
          {active.map((request) => (
            <RequestCard key={request.id} request={request} />
          ))}
        </ul>
      </section>
    </div>
  )
}
