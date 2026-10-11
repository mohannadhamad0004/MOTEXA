import { useState } from 'react'
import { useSearchParams } from 'react-router'
import Button from '../../../components/Button.jsx'
import Modal from '../../../components/Modal.jsx'
import Notice from '../../../components/Notice.jsx'
import { useToast } from '../../../components/Toast/ToastContext.js'
import { tagColor } from '../../../utils/tagColors.js'
import AdminPage from '../components/AdminPage.jsx'
import Tabs from '../../../components/Tabs.jsx'
import ActionMenu from '../../../components/ActionMenu.jsx'
import TagForm from '../components/TagForm.jsx'
import { useAdminQuery, useAdminService } from '../AdminContext.js'
import { TAG_TYPES } from '../constants.js'
import styles from './AdminTags.module.css'

const loadTags = (service) => service.getTags()

const ASSIGN_HINTS = {
  part: 'Assign part tags from a part in Listings.',
  mechanic: 'Assign mechanic tags from a mechanic in Users.',
  tow: 'Assign tow tags from a tow company in Users.',
}

// /admin/tags?type=part - create, rename, recolor and delete tags of each type.
export default function AdminTags() {
  const service = useAdminService()
  const { data: tags, error } = useAdminQuery(loadTags)
  const [searchParams, setSearchParams] = useSearchParams()
  const [editingId, setEditingId] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const toast = useToast()

  const typeParam = searchParams.get('type')
  const type = TAG_TYPES.some((t) => t.value === typeParam) ? typeParam : TAG_TYPES[0].value
  const typeInfo = TAG_TYPES.find((t) => t.value === type)
  const inType = (tags ?? []).filter((tag) => tag.type === type)

  async function remove() {
    await service.deleteTag(deleting.id)
    toast.success(`"${deleting.name}" was deleted and removed from every item.`)
    setDeleting(null)
  }

  return (
    <AdminPage title="Tags" description="Colored badges on public cards and profiles. Search matches tag names too.">
      <Tabs
        label="Tag types"
        idPrefix="tags"
        tabs={TAG_TYPES.map((t) => ({
          value: t.value,
          label: t.label,
          count: (tags ?? []).filter((tag) => tag.type === t.value).length,
        }))}
        value={type}
        onChange={(value) => {
          setEditingId(null)
          setSearchParams({ type: value }, { replace: true })
        }}
      />

      <div id="tags-panel" role="tabpanel" aria-labelledby={`tags-tab-${type}`} className={styles.panel}>
        {error && <Notice tone="danger">Couldn't load tags: {error.message}</Notice>}

        <section className={styles.card} aria-labelledby="new-tag-title">
          <h2 id="new-tag-title" className={styles.cardTitle}>
            New {typeInfo.label.toLowerCase().replace(' tags', ' tag')}
          </h2>
          <p className={styles.muted}>{typeInfo.examples}</p>
          <TagForm
            key={type}
            idPrefix="new-tag"
            submitLabel="Create tag"
            onSubmit={async (fields) => {
              const tag = await service.createTag({ type, ...fields })
              toast.success(`"${tag.name}" was created. ${ASSIGN_HINTS[type]}`)
            }}
          />
        </section>

        <section className={styles.card} aria-labelledby="tag-list-title">
          <h2 id="tag-list-title" className={styles.cardTitle}>
            {typeInfo.label} ({inType.length})
          </h2>
          {inType.length === 0 ? (
            <p className={styles.muted}>No tags yet.</p>
          ) : (
            <ul className={styles.list}>
              {inType.map((tag) => (
                <li key={tag.id} className={styles.row}>
                  {editingId === tag.id ? (
                    <TagForm
                      idPrefix={`edit-${tag.id}`}
                      initialName={tag.name}
                      initialColor={tag.color}
                      submitLabel="Save"
                      onCancel={() => setEditingId(null)}
                      onSubmit={async (fields) => {
                        await service.updateTag(tag.id, fields)
                        setEditingId(null)
                        toast.success(`Tag saved.`)
                      }}
                    />
                  ) : (
                    <div className={styles.rowView}>
                      <span className={styles.badge} style={{ backgroundColor: tagColor(tag.color) }}>
                        {tag.name}
                      </span>
                      <span className={styles.muted}>
                        Used on {tag.usage} {tag.usage === 1 ? 'item' : 'items'}
                      </span>
                      <span className={styles.rowActions}>
                        <ActionMenu
                          label={`Actions for the tag ${tag.name}`}
                          items={[
                            { label: 'Rename / color', onSelect: () => setEditingId(tag.id) },
                            { label: 'Delete', onSelect: () => setDeleting(tag), danger: true },
                          ]}
                        />
                      </span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          <p className={styles.muted}>{ASSIGN_HINTS[type]}</p>
        </section>
      </div>

      <Modal open={Boolean(deleting)} title={`Delete "${deleting?.name}"?`} onClose={() => setDeleting(null)}>
        {deleting && <DeleteTagConfirm tag={deleting} onCancel={() => setDeleting(null)} onConfirm={remove} />}
      </Modal>
    </AdminPage>
  )
}

function DeleteTagConfirm({ tag, onCancel, onConfirm }) {
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  return (
    <div className={styles.confirm}>
      <p>
        It will be removed from {tag.usage} {tag.usage === 1 ? 'item' : 'items'}. This can't be undone.
      </p>
      {error && <Notice tone="danger">{error}</Notice>}
      <div className={styles.confirmActions}>
        <Button variant="secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button
          variant="danger"
          disabled={saving}
          onClick={async () => {
            setSaving(true)
            try {
              await onConfirm()
            } catch (err) {
              setError(err.message)
              setSaving(false)
            }
          }}
        >
          Delete tag
        </Button>
      </div>
    </div>
  )
}
