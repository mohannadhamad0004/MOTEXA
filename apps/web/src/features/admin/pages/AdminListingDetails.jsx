import { useCallback, useState } from 'react'
import { Link, useParams } from 'react-router'
import Button from '../../../components/Button.jsx'
import Notice from '../../../components/Notice.jsx'
import { SkeletonRows } from '../../../components/Skeleton.jsx'
import { formatDate } from '../../../utils/formatDate.js'
import StatusIndicator from '../../../components/StatusIndicator.jsx'
import { CONDITIONS, PART_TYPES } from '../../marketplace/constants.js'
import { formatPartFit, formatPrice } from '../../marketplace/format.js'
import PartPhoto from '../../marketplace/components/PartPhoto.jsx'
import DetailList from '../components/DetailList.jsx'
import ShortId from '../components/ShortId.jsx'
import AdminPage from '../components/AdminPage.jsx'
import ReasonDialog from '../components/ReasonDialog.jsx'
import TagPicker from '../components/TagPicker.jsx'
import { useAdminQuery, useAdminService } from '../AdminContext.js'
import styles from './AdminListingDetails.module.css'

// /admin/listings/:partId - the moderation inspector for one part: its state and hidden reason, a read-only\n// look at the shop's data, its tags, and hide / unhide. Nothing here edits the shop's data.
export default function AdminListingDetails() {
  const { partId } = useParams()
  const service = useAdminService()
  const loadPart = useCallback((s) => s.getListing(partId), [partId])
  const { data: part, error } = useAdminQuery(loadPart)
  const [hiding, setHiding] = useState(false)
  const [notice, setNotice] = useState(null)

  if (error) {
    return (
      <AdminPage title="Part not found">
        <Notice tone="danger">{error.message}</Notice>
        <Button to="/admin/listings" variant="secondary">
          ← All listings
        </Button>
      </AdminPage>
    )
  }
  if (!part) return <SkeletonRows rows={3} label="Loading…" />

  async function hide(reason) {
    await service.hidePart(part.id, reason)
    setHiding(false)
    setNotice({ tone: 'success', text: 'The part is hidden from the marketplace. The shop sees your reason on its dashboard.' })
  }

  async function unhide() {
    try {
      await service.unhidePart(part.id)
      setNotice({ tone: 'success', text: 'The part is visible in the marketplace again.' })
    } catch (err) {
      setNotice({ tone: 'danger', text: err.message })
    }
  }

  return (
    <AdminPage
      title={part.name}
      description={`${part.shopName} · added ${formatDate(part.addedAt)}`}
      actions={
        <>
          <Button to="/admin/listings" variant="secondary">
            ← All listings
          </Button>
          {part.hidden ? (
            <Button onClick={unhide}>Unhide part</Button>
          ) : (
            <Button variant="danger" onClick={() => setHiding(true)}>
              Hide part
            </Button>
          )}
        </>
      }
    >
      {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}

      <section className={styles.moderation} aria-labelledby="moderation-title">
        <h2 id="moderation-title" className={styles.kicker}>
          Moderation
        </h2>
        {part.hidden ? (
          <>
            <p className={styles.stateLine}>
              <StatusIndicator label="Hidden" tone="danger" />
              <span className={styles.muted}>since {formatDate(part.hidden.hiddenAt)}</span>
            </p>
            <p className={styles.reason}>
              <span className={styles.reasonLabel}>Reason shown to the shop</span>
              {part.hidden.reason}
            </p>
          </>
        ) : (
          <>
            <p className={styles.stateLine}>
              <StatusIndicator label="Visible" tone="success" />
              {part.shopSuspended && <StatusIndicator label="Not public: shop suspended" tone="warning" />}
            </p>
            {part.shopSuspended && (
              <p className={styles.muted}>
                This part isn't public because its shop is suspended. <Link to={`/admin/users/${part.shopId}`}>View the shop account</Link>
              </p>
            )}
          </>
        )}
      </section>

      <div className={styles.layout}>
        <div className={styles.image}>
          <PartPhoto part={part} size="large" />
        </div>
        <div className={styles.facts}>
          <section aria-labelledby="part-title" className={styles.group}>
            <h2 id="part-title" className={styles.kicker}>
              Part
            </h2>
            <DetailList
              items={[
                { label: 'Brand', value: part.brand },
                { label: 'OEM number', value: part.oemNumber },
                { label: 'Manufacturer number', value: part.manufacturerNumber },
                { label: 'Category', value: part.category },
                { label: 'Type', value: PART_TYPES.find((t) => t.value === part.type)?.label },
                { label: 'Condition', value: CONDITIONS.find((c) => c.value === part.condition)?.label },
                { label: 'Fits', value: formatPartFit(part) },
              ]}
            />
          </section>
          <section aria-labelledby="shop-title" className={styles.group}>
            <h2 id="shop-title" className={styles.kicker}>
              Shop listing
            </h2>
            <DetailList
              items={[
                { label: 'Shop', value: <Link to={`/admin/users/${part.shopId}`}>{part.shopName}</Link> },
                { label: 'Price', value: <span className={styles.number}>{formatPrice(part.priceIls)}</span> },
                { label: 'Stock', value: <span className={styles.number}>{part.stock}</span> },
                { label: 'Added', value: formatDate(part.addedAt) },
                { label: 'ID', value: <ShortId id={part.id} full /> },
              ]}
            />
            <p className={styles.muted}>Part data belongs to the shop. Admins can hide it or change its tags, not edit it.</p>
          </section>
          <section aria-labelledby="tags-title" className={styles.group}>
            <TagPicker targetType="part" targetId={part.id} tagIds={part.tagIds ?? []} />
          </section>
        </div>
      </div>
      <ReasonDialog
        open={hiding}
        title="Hide this part?"
        label="Reason"
        hint="The shop sees this on its dashboard. E.g. the photos show a different part, or the price is misleading."
        requiredMessage="Write why the part is hidden - the shop will see it."
        confirmLabel="Hide part"
        onCancel={() => setHiding(false)}
        onConfirm={hide}
      />
    </AdminPage>
  )
}
