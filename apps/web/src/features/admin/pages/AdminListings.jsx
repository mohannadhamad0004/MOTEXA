import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import ActionMenu from '../../../components/ActionMenu.jsx'
import Button from '../../../components/Button.jsx'
import DetailDrawer from '../../../components/DetailDrawer.jsx'
import FilterToolbar, { FilterMenu } from '../../../components/FilterToolbar.jsx'
import FlatDataList from '../../../components/FlatDataList.jsx'
import Notice from '../../../components/Notice.jsx'
import PageIntro from '../../../components/PageIntro.jsx'
import PageShell from '../../../components/PageShell.jsx'
import SearchBar from '../../../components/SearchBar.jsx'
import { SkeletonRows } from '../../../components/Skeleton.jsx'
import StatusIndicator from '../../../components/StatusIndicator.jsx'
import TagBadges from '../../../components/TagBadges.jsx'
import { useToast } from '../../../components/Toast/ToastContext.js'
import { resolveTags, useTags } from '../../../context/TagsContext.js'
import { formatDate } from '../../../utils/formatDate.js'
import { createWordIndex, searchWords } from '../../../utils/wordSearch.js'
import PartPhoto from '../../marketplace/components/PartPhoto.jsx'
import { formatPrice } from '../../marketplace/format.js'
import DetailList from '../components/DetailList.jsx'
import ReasonDialog from '../components/ReasonDialog.jsx'
import ShortId from '../components/ShortId.jsx'
import { useAdminQuery, useAdminService } from '../AdminContext.js'
import styles from './AdminListings.module.css'

const loadListings = (service) => service.getListings()

const VISIBILITY = [
  { value: '', label: 'All parts' },
  { value: 'visible', label: 'Visible' },
  { value: 'hidden', label: 'Hidden' },
]

const NONE = []

// The one status of a part: hidden by an admin, its shop is suspended, or visible (text + color).
function PartStatus({ part }) {
  if (part.hidden) return <StatusIndicator label="Hidden" tone="danger" />
  if (part.shopSuspended) return <StatusIndicator label="Shop suspended" tone="warning" />
  return <StatusIndicator label="Visible" tone="success" />
}

// /admin/listings?q=...&show=hidden - every part from every shop, including hidden ones. A row opens
// a quick-detail drawer. An admin can hide or unhide a part (hiding needs a reason the shop sees);
// part data itself belongs to the shop and is never edited here.
export default function AdminListings() {
  const { data, error } = useAdminQuery(loadListings)
  const tags = useTags()
  const navigate = useNavigate()
  const service = useAdminService()
  const toast = useToast()
  const [hiding, setHiding] = useState(null)
  const [openId, setOpenId] = useState(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const query = searchParams.get('q') ?? ''
  const show = searchParams.get('show') ?? ''

  const parts = data ?? NONE
  const index = useMemo(
    () =>
      createWordIndex(parts, (p) => [
        p.name,
        p.oemNumber,
        p.manufacturerNumber,
        p.brand,
        p.category,
        p.shopName,
        ...resolveTags(p.tagIds, tags).map((t) => t.name),
      ]),
    [parts, tags],
  )
  const results = useMemo(
    () => searchWords(index, query).filter((p) => !show || (show === 'hidden') === Boolean(p.hidden)),
    [index, query, show],
  )
  const open = parts.find((p) => p.id === openId) ?? null
  const openTags = resolveTags(open?.tagIds, tags)

  async function unhide(part) {
    try {
      await service.unhidePart(part.id)
      toast.success('The part is visible in the marketplace again.')
    } catch (err) {
      toast.error(err.message)
    }
  }

  async function copyId(part) {
    try {
      await navigator.clipboard.writeText(part.id)
      toast.success('ID copied.')
    } catch {
      toast.error("Couldn't copy the ID.")
    }
  }

  function setFilter(key, value) {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    setSearchParams(next, { replace: true })
  }

  const columns = [
    {
      key: 'part',
      header: 'Part',
      render: (p) => {
        return (
          <span className={styles.part}>
            <span className={styles.thumb}>
              <PartPhoto part={p} />
            </span>
            <span className={styles.who}>
              <button type="button" className={styles.name} onClick={() => setOpenId(p.id)}>
                {p.name}
              </button>
              <span className={styles.meta}>
                {[p.oemNumber, p.brand, p.category].filter(Boolean).join(' · ')}
              </span>
              <span className={styles.shop}>{p.shopName}</span>
            </span>
          </span>
        )
      },
    },
    { key: 'shop', header: 'Shop', optional: true, render: (p) => <span className={styles.shopCell}>{p.shopName}</span> },
    { key: 'price', header: 'Price', align: 'end', cellClassName: styles.priceCell, render: (p) => <strong className={styles.price}>{formatPrice(p.priceIls)}</strong> },
    { key: 'status', header: 'Status', render: (p) => <PartStatus part={p} /> },
    {
      key: 'actions',
      header: <span className={styles.srOnly}>Actions</span>,
      align: 'end',
      render: (p) => (
        <ActionMenu
          label={`Actions for ${p.name}`}
          items={[
            { label: 'View details', onSelect: () => setOpenId(p.id) },
            { label: 'Copy part ID', onSelect: () => copyId(p) },
            p.hidden
              ? { label: 'Unhide part', onSelect: () => unhide(p), separated: true }
              : { label: 'Hide part', onSelect: () => setHiding(p), danger: true, separated: true },
          ]}
        />
      ),
    },
  ]

  return (
    <PageShell>
      <PageIntro
        eyebrow="Operations / Listings"
        title="Listings"
        description="All parts from all shops. Hide a part that breaks the rules; the shop sees your reason."
      />

      <section className={styles.workspace} aria-label="Listings">
        <FilterToolbar
          search={
            <SearchBar
              quiet
              id="listing-search"
              value={query}
              onChange={(value) => setFilter('q', value)}
              label="Search listings"
              placeholder="Part name, number, brand, shop or tag"
            />
          }
          canReset={Boolean(query || show)}
          onReset={() => setSearchParams({}, { replace: true })}
        >
          <FilterMenu label="Show" value={show} onChange={(event) => setFilter('show', event.target.value)}>
            {VISIBILITY.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </FilterMenu>
        </FilterToolbar>

        {error && <Notice tone="danger">Couldn't load listings: {error.message}</Notice>}
        {!data && !error && <SkeletonRows label="Loading…" />}
        {data && (
          <>
            <p className={styles.muted} aria-live="polite">
              {results.length} of {parts.length} parts
            </p>
            <FlatDataList
              label="Parts"
              widths="minmax(300px, 3fr) minmax(140px, 1.2fr) 100px 150px 44px"
              mediumWidths="minmax(300px, 3fr) 100px 150px 44px"
              emptyText="No parts match."
              rows={results}
              selectedKey={openId}
              onRowOpen={(p) => setOpenId(p.id)}
              columns={columns}
            />
          </>
        )}
      </section>

      <DetailDrawer open={Boolean(open)} title={open?.name ?? ''} onClose={() => setOpenId(null)}>
        {open && (
          <div className={styles.drawerBody}>
            <PartStatus part={open} />
            <div className={styles.photo}>
              <PartPhoto part={open} size="large" />
            </div>
            <DetailList
              items={[
                { label: 'Shop', value: open.shopName },
                { label: 'Price', value: formatPrice(open.priceIls) },
                { label: 'Category', value: open.category },
                { label: 'Brand', value: open.brand },
                { label: 'OEM number', value: open.oemNumber },
                { label: 'Manufacturer number', value: open.manufacturerNumber },
                { label: 'Tags', value: openTags.length > 0 ? <TagBadges tags={openTags} /> : null },
                { label: 'Added', value: formatDate(open.addedAt) },
                { label: 'Hidden since', value: open.hidden && formatDate(open.hidden.hiddenAt) },
                { label: 'Reason shown to shop', value: open.hidden?.reason },
                { label: 'ID', value: <ShortId id={open.id} full /> },
              ]}
            />
            <div className={styles.drawerActions}>
              <Button onClick={() => navigate(`/admin/listings/${open.id}`)}>Open full page</Button>
              {open.hidden ? (
                <Button variant="secondary" onClick={() => unhide(open)}>
                  Unhide part
                </Button>
              ) : (
                <Button variant="secondary" onClick={() => setHiding(open)}>
                  Hide part…
                </Button>
              )}
            </div>
          </div>
        )}
      </DetailDrawer>

      <ReasonDialog
        open={Boolean(hiding)}
        title={hiding ? `Hide ${hiding.name}?` : ''}
        label="Reason"
        hint="The shop sees this on its dashboard. E.g. the photos show a different part, or the price is misleading."
        requiredMessage="Write why the part is hidden - the shop will see it."
        confirmLabel="Hide part"
        onCancel={() => setHiding(null)}
        onConfirm={async (reason) => {
          await service.hidePart(hiding.id, reason)
          toast.success('The part is hidden from the marketplace. The shop sees your reason.')
          setHiding(null)
        }}
      />
    </PageShell>
  )
}
