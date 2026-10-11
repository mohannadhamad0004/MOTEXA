import ProviderRequests from '../features/requests/components/ProviderRequests.jsx'
import ResponderEmergencies from '../features/requests/emergency/components/ResponderEmergencies.jsx'
import Button from '../components/Button.jsx'
import Card from '../components/Card.jsx'
import StatusIndicator from '../components/StatusIndicator.jsx'
import styles from './MechanicDashboard.module.css'

// TODO: replace with real API call
const assignedRequests = [
  {
    id: 'SR-1042',
    car: 'Volkswagen Golf 2018',
    customer: 'Omar K.',
    mediaType: 'Audio',
    complaint: 'Squealing noise when starting the engine',
    aiReport: {
      summary: 'High-pitched squeal for 2-3 seconds right after a cold start, fading as the engine warms up.',
      likelyFaults: [
        { fault: 'Worn or loose serpentine belt', probability: 0.62 },
        { fault: 'Failing belt tensioner', probability: 0.24 },
        { fault: 'Worn idler pulley bearing', probability: 0.14 },
      ],
      urgency: 'Medium',
      checkFirst: 'Belt condition and tension, then the tensioner pulley.',
    },
  },
  {
    id: 'SR-1045',
    car: 'Hyundai Elantra 2021',
    customer: 'Sara M.',
    mediaType: 'Photo',
    complaint: 'Red warning light on the dashboard',
    aiReport: {
      summary: 'Oil pressure warning light is lit with the engine running.',
      likelyFaults: [
        { fault: 'Low engine oil level', probability: 0.55 },
        { fault: 'Faulty oil pressure sensor', probability: 0.3 },
        { fault: 'Failing oil pump', probability: 0.15 },
      ],
      urgency: 'High',
      checkFirst: 'Oil level on the dipstick before the engine is run again.',
    },
  },
  {
    id: 'SR-1047',
    car: 'Toyota Corolla 2015',
    customer: 'Ahmed R.',
    mediaType: 'Video',
    complaint: 'Car shakes at idle',
    aiReport: {
      summary: 'Visible engine vibration at idle; rough, uneven engine sound.',
      likelyFaults: [
        { fault: 'Engine misfire (spark plug or ignition coil)', probability: 0.48 },
        { fault: 'Worn engine mounts', probability: 0.32 },
        { fault: 'Vacuum leak', probability: 0.2 },
      ],
      urgency: 'Low',
      checkFirst: 'Read OBD codes for misfires, then inspect the engine mounts.',
    },
  },
]

const urgencyTone = { High: 'danger', Medium: 'warning', Low: 'success' }

export default function MechanicDashboard() {
  return (
    <div className={styles.page}>
      <ResponderEmergencies />
      <ProviderRequests />

      <header>
        <h1 className={styles.title}>Assigned requests</h1>
        <p className={styles.subtitle}>
          Each request includes a preliminary AI report. Review it and confirm or correct the diagnosis.
        </p>
      </header>

      <ul className={styles.list}>
        {assignedRequests.map((request) => (
          <Card as="li" key={request.id} padding="lg" className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h2 className={styles.carName}>{request.car}</h2>
                <p className={styles.muted}>
                  {request.id} · {request.customer} · {request.mediaType} uploaded
                </p>
              </div>
              <StatusIndicator
                label={`${request.aiReport.urgency} urgency`}
                tone={urgencyTone[request.aiReport.urgency]}
              />
            </div>

            <p>
              <strong>Customer says:</strong> {request.complaint}
            </p>

            <div className={styles.report}>
              <h3 className={styles.reportTitle}>AI pre-report (preliminary)</h3>
              <p>{request.aiReport.summary}</p>
              <ol className={styles.faults}>
                {request.aiReport.likelyFaults.map((item) => (
                  <li key={item.fault}>
                    <span>{item.fault}</span>
                    <span className={styles.probability}>{Math.round(item.probability * 100)}%</span>
                  </li>
                ))}
              </ol>
              <p>
                <strong>Check first:</strong> {request.aiReport.checkFirst}
              </p>
            </div>

            <div>
              {/* TODO: send the mechanic's confirmation or correction to the API */}
              <Button disabled>Confirm diagnosis</Button>
            </div>
          </Card>
        ))}
      </ul>
    </div>
  )
}
