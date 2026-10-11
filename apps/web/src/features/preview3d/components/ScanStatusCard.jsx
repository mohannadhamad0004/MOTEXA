import Button from '../../../components/Button.jsx'
import StatusIndicator from '../../../components/StatusIndicator.jsx'
import { formatFileSize } from '../../../utils/files.js'
import { formatDuration } from '../../diagnosis/mediaRules.js'
import { formatDateTime } from '../../requests/format.js'
import { SCAN_STATUS, SCAN_STATUS_LABELS, SCAN_STATUS_TONES } from '../scanConstants.js'
import styles from './ScanStatusCard.module.css'

const STEPS = [SCAN_STATUS.UPLOADED, SCAN_STATUS.PROCESSING, 'done']

const scanCarName = (scan) =>
  `${scan.car.nickname ? `${scan.car.nickname} · ` : ''}${scan.car.make} ${scan.car.model} ${scan.car.year}`

// One 3D scan and where it is: Uploaded -> Processing (with the estimated time) -> Ready, or
// Failed with the reason. `onUse` (ready scans) loads it in the 3D preview; `onDelete` removes it.
// `active`: this scan is the one loaded in the preview.
export default function ScanStatusCard({ scan, active = false, onUse, onDelete, showCar = true }) {
  const done = scan.status === SCAN_STATUS.READY || scan.status === SCAN_STATUS.FAILED
  const currentIndex = done ? 2 : STEPS.indexOf(scan.status)
  const what =
    scan.kind === 'photos'
      ? `${scan.fileCount} photos · ${formatFileSize(scan.totalBytes)}`
      : `Video${scan.durationSec ? ` · ${formatDuration(scan.durationSec)}` : ''} · ${formatFileSize(scan.totalBytes)}`

  return (
    <article className={`${styles.card} ${active ? styles.active : ''}`} aria-label={`3D scan of ${scanCarName(scan)}`}>
      <div className={styles.header}>
        <div>
          {showCar && <p className={styles.car}>{scanCarName(scan)}</p>}
          <p className={styles.muted}>
            {what} · {formatDateTime(scan.createdAt)}
          </p>
        </div>
        <StatusIndicator label={SCAN_STATUS_LABELS[scan.status]} tone={SCAN_STATUS_TONES[scan.status]} />
      </div>

      <ol className={styles.steps} aria-label="Scan progress">
        {STEPS.map((step, index) => {
          const label = step === 'done' ? (scan.status === SCAN_STATUS.FAILED ? 'Failed' : 'Ready') : SCAN_STATUS_LABELS[step]
          const state =
            index < currentIndex || (index === 2 && scan.status === SCAN_STATUS.READY)
              ? styles.stepDone
              : index === 2 && scan.status === SCAN_STATUS.FAILED
                ? styles.stepFailed
                : index === currentIndex
                  ? styles.stepCurrent
                  : ''
          return (
            <li key={step} className={`${styles.step} ${state}`} aria-current={index === currentIndex ? 'step' : undefined}>
              {label}
            </li>
          )
        })}
      </ol>

      <p className={styles.status} aria-live="polite">
        {scan.status === SCAN_STATUS.UPLOADED && 'Uploaded. Waiting for processing to start…'}
        {scan.status === SCAN_STATUS.PROCESSING &&
          `Building your 3D model. This usually takes about ${scan.estimatedMinutes} minutes (the demo finishes in seconds). We'll notify you when it's ready.`}
        {scan.status === SCAN_STATUS.READY && 'Your 3D model is ready.'}
        {scan.status === SCAN_STATUS.FAILED && <span className={styles.failure}>{scan.failureReason}</span>}
      </p>

      {(onUse || onDelete) && (
        <div className={styles.actions}>
          {onUse && scan.status === SCAN_STATUS.READY && (
            <Button size="sm" variant={active ? 'secondary' : 'primary'} disabled={active} onClick={() => onUse(scan)}>
              {active ? '✓ Loaded' : 'Use this model'}
            </Button>
          )}
          {onDelete && (
            <Button size="sm" variant="ghost" onClick={() => onDelete(scan)} aria-label={`Delete the 3D scan of ${scanCarName(scan)}`}>
              Delete
            </Button>
          )}
        </div>
      )}
    </article>
  )
}
