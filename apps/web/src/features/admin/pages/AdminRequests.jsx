import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { ACCOUNT_TYPE_LABELS } from '../../../auth/constants.js'
import ActionMenu from '../../../components/ActionMenu.jsx'
import DetailDrawer from '../../../components/DetailDrawer.jsx'
import FlatDataList from '../../../components/FlatDataList.jsx'
import Notice from '../../../components/Notice.jsx'
import PageIntro from '../../../components/PageIntro.jsx'
import PageShell from '../../../components/PageShell.jsx'
import PageTabs from '../../../components/PageTabs.jsx'
import { SkeletonRows } from '../../../components/Skeleton.jsx'
import StatusIndicator from '../../../components/StatusIndicator.jsx'
import { useToast } from '../../../components/Toast/ToastContext.js'
import { REQUEST_TYPE_LABELS, REQUEST_TYPES, requestStatusBadge } from '../../requests/constants.js'
import { ACTIVE_EMERGENCY, emergencyKindLabel, emergencyProblemLabel, EMERGENCY_STATUS_LABELS } from '../../requests/emergency/constants.js'
import { useEmergency } from '../../requests/emergency/EmergencyContext.js'
import { formatCar } from '../../requests/carDetails.js'
import { describeServiceMode, summarizeRequest, TARGET_PATHS } from '../../requests/format.js'
import { formatPrice } from '../../marketplace/format.js'
import DetailList from '../components/DetailList.jsx'
import ShortId from '../components/ShortId.jsx'
import { useAdminQuery } from '../AdminContext.js'
import styles from './AdminRequests.module.css'

const loadRequests = (service) => service.getAllRequests()

const formatDateTime = (iso) =>
  new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
const formatDay = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
const formatTime = (iso) =>
  new Date(iso).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  })

// "2 min 05 s" / "45 s" / "-" between two ISO dates
function duration(from, to) {
  if (!from || !to) return '-'
  const seconds = Math.max(0, Math.round((new Date(to) - new Date(from)) / 1000))
  return seconds < 60 ? `${seconds} s` : `${Math.floor(seconds / 60)} min ${String(seconds % 60).padStart(2, '0')} s`
}

// 16px line icons, one per kind of request (emergencies get the warning triangle).
const ICON_PATHS = {
  [REQUEST_TYPES.SERVICE]: 'M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z',
  [REQUEST_TYPES.TOW]: 'M2 6h12v10H2zM14 9h4l4 4v3h-8M6 19.5h.01M17 19.5h.01',
  [REQUEST_TYPES.PART_QUESTION]: 'M21 8l-9-5-9 5v8l9 5 9-5zM3.3 7.5L12 12l8.7-4.5M12 12v9',
  emergency: 'M12 3l10 18H2zM12 10v5M12 18h.01',
}
function TypeLabel({ type, label, sub, extra = null, urgent = false }) {
  return (
    <span className={styles.type}>
      <svg
        className={urgent ? styles.urgentIcon : styles.icon}
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d={ICON_PATHS[type]} />
      </svg>
      <span>
        <span className={styles.primary}>{label}</span>
        {sub}
        {extra}
      </span>
    </span>
  )
}

// Copy an id from the row menu (the ids used to carry a visible Copy button).
function useCopyId() {
  const toast = useToast()
  return async (id) => {
    try {
      await navigator.clipboard.writeText(id)
      toast.success('ID copied.')
    } catch {
      toast.error("Couldn't copy the ID.")
    }
  }
}

const emergencyTone = {
  completed: 'success',
  cancelled: 'neutral',
  unavailable: 'danger',
}
const emergencyBadge = (e) => (
  <StatusIndicator
    label={EMERGENCY_STATUS_LABELS[e.status]}
    tone={emergencyTone[e.status] ?? (ACTIVE_EMERGENCY.includes(e.status) ? 'danger' : 'info')}
  />
)

// The status of a request: its badge, plus "Disputed" / "Not confirmed yet" when they apply.
function RequestStatus({ request: r }) {
  return (
    <div className={styles.statusStack}>
      <StatusIndicator {...requestStatusBadge(r.status)} />
      {r.disputedAt && <StatusIndicator label="Disputed: didn't happen" tone="danger" />}
      {r.status === 'completed' && !r.customerConfirmedAt && !r.disputedAt && <span className={styles.subline}>Not confirmed yet</span>}
    </div>
  )
}

const dateCell = (iso) => (
  <span className={styles.date}>
    <span className={styles.primary}>{formatDay(iso)}</span>
    <span className={styles.subline}>{formatTime(iso)}</span>
  </span>
)

// A titled group of label/value pairs; omitted when none of its values exist.
function InspectorSection({ title, items }) {
  if (!items.some((item) => item.value)) return null
  return (
    <section className={styles.inspectorSection}>
      <h3 className={styles.inspectorTitle}>{title}</h3>
      <DetailList items={items} />
    </section>
  )
}

// The drawer: the request, who sent it, who it went to, the car and what was asked - existing fields only.
function RequestInspector({ request: r }) {
  const { details = {} } = r
  const car = details.car && formatCar(details.car)
  return (
    <div className={styles.drawerBody}>
      <InspectorSection
        title="Request"
        items={[
          { label: 'Type', value: REQUEST_TYPE_LABELS[r.type] },
          { label: 'Status', value: <RequestStatus request={r} /> },
          { label: 'Sent', value: formatDateTime(r.createdAt) },
          { label: 'Confirmed by sender', value: r.customerConfirmedAt && formatDateTime(r.customerConfirmedAt) },
          { label: 'Marked disputed', value: r.disputedAt && formatDateTime(r.disputedAt) },
          { label: 'ID', value: <ShortId id={r.id} full /> },
        ]}
      />
      <InspectorSection
        title="Sender"
        items={[
          { label: 'Name', value: <Link to={`/admin/users/${r.sender.id}`}>{r.sender.name}</Link> },
          { label: 'Role', value: ACCOUNT_TYPE_LABELS[r.sender.role] },
        ]}
      />
      <InspectorSection
        title="Provider"
        items={[
          { label: 'Name', value: <Link to={TARGET_PATHS[r.target.type](r.target.id)}>{r.target.name}</Link> },
          { label: 'Role', value: ACCOUNT_TYPE_LABELS[r.target.type] },
          { label: 'Part', value: r.target.partName },
        ]}
      />
      <InspectorSection title="Vehicle" items={[{ label: 'Car', value: car }]} />
      <InspectorSection
        title="Service"
        items={[
          { label: 'Mode', value: details.mode && describeServiceMode(details) },
          { label: 'Problem', value: details.problem },
          { label: 'Pickup', value: details.pickup },
          { label: 'Destination', value: details.destination },
          { label: 'Quantity', value: details.quantity },
          { label: 'Message', value: details.message },
          { label: 'Completed', value: r.completion?.completedAt && formatDateTime(r.completion.completedAt) },
          { label: 'Work done', value: r.completion?.workDone },
          { label: 'Total', value: r.completion?.totalIls !== undefined && formatPrice(r.completion.totalIls) },
        ]}
      />
    </div>
  )
}
// Emergency requests (features/requests/emergency): active first, then past ones, with how long it
// took until someone accepted and until they arrived. A row opens its drawer.
function EmergencySection() {
  const { service, emergencies } = useEmergency()
  const copyId = useCopyId()
  const [list, setList] = useState(null)
  const [openId, setOpenId] = useState(null)
  useEffect(() => {
    service.getAllEmergencies().then(setList, () => setList([]))
  }, [service, emergencies])
  const sorted = useMemo(
    () => [...(list ?? [])].sort((a, b) => Number(ACTIVE_EMERGENCY.includes(b.status)) - Number(ACTIVE_EMERGENCY.includes(a.status))),
    [list],
  )
  if (!list) return null
  const open = list.find((e) => e.id === openId) ?? null
  const active = list.filter((e) => ACTIVE_EMERGENCY.includes(e.status)).length
  return (
    <section className={list.length === 0 ? styles.sectionQuiet : styles.section} aria-labelledby="admin-emergencies">
      <h2 id="admin-emergencies" className={styles.heading}>
        Emergencies{' '}
        <span className={styles.count}>
          ({active} active, {list.length} in total)
        </span>
      </h2>
      {list.length === 0 ? (
        <p className={styles.none}>No emergencies yet.</p>
      ) : (
        <FlatDataList
          label="Emergencies"
          widths="minmax(160px, 1.1fr) minmax(120px, 1fr) minmax(130px, 1fr) minmax(140px, 1fr) 105px 72px 44px"
          mediumWidths="minmax(160px, 1.1fr) minmax(130px, 1fr) minmax(130px, 1fr) 105px 72px 44px"
          rows={sorted}
          selectedKey={openId}
          onRowOpen={(e) => setOpenId(e.id)}
          columns={[
            {
              key: 'what',
              header: 'Emergency',
              render: (e) => (
                <TypeLabel
                  type="emergency"
                  urgent={ACTIVE_EMERGENCY.includes(e.status)}
                  label={emergencyKindLabel(e.kind)}
                  sub={<span className={styles.subline}>{emergencyProblemLabel(e.details.problemType)}</span>}
                />
              ),
            },
            {
              key: 'customer',
              header: 'Customer',
              render: (e) => (
                <>
                  {e.customer.userId ? (
                    <Link className={styles.link} to={`/admin/users/${e.customer.userId}`}>
                      {e.customer.name}
                    </Link>
                  ) : (
                    <span className={styles.primary}>{e.customer.name}</span>
                  )}
                  <span className={styles.subline}>{e.customer.userId ? e.customer.phone : `Visitor · ${e.customer.phone}`}</span>
                </>
              ),
            },
            {
              key: 'responder',
              header: 'Responder',
              render: (e) =>
                e.responder ? (
                  <>
                    <Link className={styles.link} to={`/admin/users/${e.responder.id}`}>
                      {e.responder.company}
                    </Link>
                    <span className={styles.subline}>{e.responder.simulated ? 'Simulated driver' : e.responder.name}</span>
                  </>
                ) : (
                  <span className={styles.subline}>{`${e.offers.length} offered, wave ${e.wave}`}</span>
                ),
            },
            {
              key: 'timing',
              header: 'Response time',
              optional: true,
              render: (e) => (
                <>
                  <span className={styles.subline}>
                    Until accepted <b className={styles.value}>{duration(e.createdAt, e.acceptedAt)}</b>
                  </span>
                  <span className={styles.subline}>
                    Until arrival <b className={styles.value}>{duration(e.createdAt, e.arrivedAt)}</b>
                  </span>
                </>
              ),
            },
            { key: 'status', header: 'Status', render: emergencyBadge },
            {
              key: 'date',
              header: 'Date',
              render: (e) => dateCell(e.createdAt),
            },
            {
              key: 'actions',
              header: <span className={styles.srOnly}>Actions</span>,
              align: 'end',
              render: (e) => (
                <ActionMenu
                  label={`Actions for the emergency of ${e.customer.name}`}
                  items={[
                    { label: 'View details', onSelect: () => setOpenId(e.id) },
                    {
                      label: 'Copy emergency ID',
                      onSelect: () => copyId(e.id),
                    },
                  ]}
                />
              ),
            },
          ]}
        />
      )}
      <DetailDrawer open={Boolean(open)} title={open ? `Emergency · ${emergencyKindLabel(open.kind)}` : ''} onClose={() => setOpenId(null)}>
        {open && (
          <div className={styles.drawerBody}>
            {emergencyBadge(open)}
            <DetailList
              items={[
                { label: 'Problem', value: emergencyProblemLabel(open.details.problemType) },
                { label: 'Requested', value: formatDateTime(open.createdAt) },
                {
                  label: 'Customer',
                  value: open.customer.userId ? <Link to={`/admin/users/${open.customer.userId}`}>{open.customer.name}</Link> : `${open.customer.name} (visitor)`,
                },
                { label: 'Phone', value: open.customer.phone },
                {
                  label: 'Responder',
                  value: open.responder ? (
                    <Link to={`/admin/users/${open.responder.id}`}>
                      {open.responder.company}
                      {open.responder.simulated && ' (simulated driver)'}
                    </Link>
                  ) : (
                    `${open.offers.length} offered, wave ${open.wave}`
                  ),
                },
                { label: 'Until accepted', value: duration(open.createdAt, open.acceptedAt) },
                { label: 'Until arrival', value: duration(open.createdAt, open.arrivedAt) },
                { label: 'ID', value: <ShortId id={open.id} full /> },
              ]}
            />
          </div>
        )}
      </DetailDrawer>
    </section>
  )
}

// /admin/requests?type=tow - read-only monitor of every request on the platform. A row opens a
// drawer with its details and links to the sender and the target.
export default function AdminRequests() {
  const { data: requests, error } = useAdminQuery(loadRequests)
  const navigate = useNavigate()
  const copyId = useCopyId()
  const [searchParams, setSearchParams] = useSearchParams()
  const [openId, setOpenId] = useState(null)
  const type = searchParams.get('type') ?? ''
  const emergencyOnly = type === 'emergency'

  const results = useMemo(() => (requests ?? []).filter((r) => !type || r.type === type), [requests, type])
  const filters = [
    { value: '', label: 'All' },
    { value: 'emergency', label: 'Emergency' },
    ...Object.entries(REQUEST_TYPE_LABELS).map(([value, label]) => ({
      value,
      label,
    })),
  ]
  const open = (requests ?? []).find((r) => r.id === openId) ?? null

  return (
    <PageShell>
      <PageIntro
        eyebrow="Operations / Requests"
        title="Requests"
        description="Emergencies first, then every service, tow and part request on MOTEXA, newest first. Requests the sender says did not happen are marked Disputed. Read-only."
      />

      <PageTabs
        label="Request type"
        options={filters}
        value={type}
        onChange={(value) => setSearchParams(value ? { type: value } : {}, { replace: true })}
      />

      {(!type || emergencyOnly) && <EmergencySection />}

      {error && !emergencyOnly && <Notice tone="danger">Couldn't load requests: {error.message}</Notice>}
      {!emergencyOnly && !requests && !error && <SkeletonRows label="Loading…" />}
      {requests && !emergencyOnly && (
        <section className={styles.section} aria-label="Requests">
          <p className={styles.count} aria-live="polite">
            {results.length} {results.length === 1 ? 'request' : 'requests'}
          </p>
          <FlatDataList
            label="Requests"
            widths="minmax(175px, 1.2fr) minmax(120px, 1fr) minmax(120px, 1fr) minmax(150px, 1.6fr) 115px 72px 44px"
            mediumWidths="minmax(240px, 2.2fr) minmax(130px, 1fr) minmax(130px, 1fr) 115px 72px 44px"
            emptyText="No requests yet."
            rows={results}
            selectedKey={openId}
            onRowOpen={(r) => setOpenId(r.id)}
            columns={[
              {
                key: 'request',
                header: 'Request',
                render: (r) => (
                  <TypeLabel
                    type={r.type}
                    label={REQUEST_TYPE_LABELS[r.type]}
                    sub={
                      <code className={styles.id} title={r.id}>
                        {r.id.slice(0, 8)}
                      </code>
                    }
                    extra={<span className={styles.inlineDetails}>{summarizeRequest(r)}</span>}
                  />
                ),
              },
              {
                key: 'sender',
                header: 'Sender',
                render: (r) => (
                  <>
                    <Link className={styles.link} to={`/admin/users/${r.sender.id}`}>
                      {r.sender.name}
                    </Link>
                    <span className={styles.subline}>{ACCOUNT_TYPE_LABELS[r.sender.role]}</span>
                  </>
                ),
              },
              {
                key: 'target',
                header: 'Target',
                render: (r) => (
                  <>
                    <Link className={styles.link} to={TARGET_PATHS[r.target.type](r.target.id)}>
                      {r.target.name}
                    </Link>
                    <span className={styles.subline}>{ACCOUNT_TYPE_LABELS[r.target.type]}</span>
                  </>
                ),
              },
              {
                key: 'details',
                header: 'Details',
                optional: true,
                render: (r) => <span className={styles.details}>{summarizeRequest(r)}</span>,
              },
              {
                key: 'status',
                header: 'Status',
                render: (r) => <RequestStatus request={r} />,
              },
              {
                key: 'date',
                header: 'Date',
                render: (r) => dateCell(r.createdAt),
              },
              {
                key: 'actions',
                header: <span className={styles.srOnly}>Actions</span>,
                align: 'end',
                render: (r) => (
                  <ActionMenu
                    label={`Actions for the ${REQUEST_TYPE_LABELS[r.type].toLowerCase()} from ${r.sender.name}`}
                    items={[
                      {
                        label: 'View details',
                        onSelect: () => setOpenId(r.id),
                      },
                      {
                        label: 'View sender',
                        onSelect: () => navigate(`/admin/users/${r.sender.id}`),
                      },
                      {
                        label: 'View target',
                        onSelect: () => navigate(TARGET_PATHS[r.target.type](r.target.id)),
                      },
                      {
                        label: 'Copy request ID',
                        onSelect: () => copyId(r.id),
                        separated: true,
                      },
                    ]}
                  />
                ),
              },
            ]}
          />
        </section>
      )}

      <DetailDrawer open={Boolean(open)} title={open ? REQUEST_TYPE_LABELS[open.type] : ''} onClose={() => setOpenId(null)}>
        {open && <RequestInspector request={open} />}
      </DetailDrawer>
    </PageShell>
  )
}
