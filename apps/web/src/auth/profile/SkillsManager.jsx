import { useState } from 'react'
import Button from '../../components/Button.jsx'
import FilePreview from '../../components/FilePreview.jsx'
import Modal from '../../components/Modal.jsx'
import Notice from '../../components/Notice.jsx'
import StatusIndicator from '../../components/StatusIndicator.jsx'
import { useToast } from '../../components/Toast/ToastContext.js'
import { formatDate } from '../../utils/formatDate.js'
import { REVIEW_STATUS, REVIEW_STATUS_BADGES } from '../constants.js'
import { SKILLS } from '../signup/constants.js'
import { useAuth, useProfileService } from '../useAuth.js'
import SkillForm from './SkillForm.jsx'
import styles from './SkillsManager.module.css'

const years = (count) => `${count} ${count === 1 ? 'year' : 'years'} of experience`

// Mechanics: their skills with review status. Rejected skills show the admin's reason.
// "Add a skill" and "Update certificate" send the skill to an admin; only approved skills are public.
export default function SkillsManager() {
  const { user } = useAuth()
  const service = useProfileService()
  const toast = useToast()
  // { mode: 'add' } or { mode: 'update', skill }
  const [editing, setEditing] = useState(null)
  const [removing, setRemoving] = useState(null)
  const [removeError, setRemoveError] = useState(null)
  const [busy, setBusy] = useState(false)

  const approvedCount = user.skills.filter((s) => s.status === REVIEW_STATUS.APPROVED).length
  const listed = user.skills.map((s) => s.skill)
  const allListed = SKILLS.every((name) => listed.includes(name))

  async function remove() {
    setBusy(true)
    setRemoveError(null)
    try {
      await service.removeSkill(removing.id)
      toast.success(`${removing.skill} was removed from your profile.`)
      setRemoving(null)
    } catch (error) {
      setRemoveError(error.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.manager}>
      <ul className={styles.list}>
        {user.skills.map((skill) => {
          const badge = REVIEW_STATUS_BADGES[skill.status]
          const rejected = skill.status === REVIEW_STATUS.REJECTED
          const isOnlyApproved = skill.status === REVIEW_STATUS.APPROVED && approvedCount === 1
          return (
            <li key={skill.id} className={`${styles.skill} ${styles[skill.status]}`}>
              <div className={styles.header}>
                <div>
                  <h3 className={styles.name}>{skill.skill}</h3>
                  <p className={styles.muted}>{years(skill.years)}</p>
                </div>
                <StatusIndicator label={badge.label} tone={badge.tone} />
              </div>

              {skill.status === REVIEW_STATUS.PENDING && (
                <p className={styles.muted}>
                  Sent {formatDate(skill.submittedAt)}. Not on your public profile until MOTEXA approves it.
                </p>
              )}
              {rejected && (
                <Notice tone="danger" title="Why it wasn't approved">
                  {skill.rejectionReason || 'No reason was given. Contact MOTEXA support if you have questions.'}
                </Notice>
              )}

              <div className={styles.certificate}>
                <p className={styles.certificateTitle}>Certificate</p>
                <FilePreview file={skill.certificate} />
              </div>

              <div className={styles.actions}>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setEditing({ mode: 'update', skill, isOnlyApproved })}
                >
                  {rejected ? 'Send a new certificate' : 'Update certificate'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className={styles.remove}
                  onClick={() => {
                    setRemoveError(null)
                    setRemoving(skill)
                  }}
                >
                  Remove
                </Button>
              </div>
            </li>
          )
        })}
      </ul>

      <div>
        <Button variant="secondary" onClick={() => setEditing({ mode: 'add' })} disabled={allListed}>
          + Add a skill
        </Button>
      </div>

      <Modal
        open={Boolean(editing)}
        title={editing?.mode === 'update' ? `Update ${editing.skill.skill}` : 'Add a skill'}
        onClose={() => setEditing(null)}
      >
        {editing && (
          <SkillForm
            skill={editing.mode === 'update' ? editing.skill : null}
            isOnlyApproved={Boolean(editing.isOnlyApproved)}
            listedSkills={listed}
            onCancel={() => setEditing(null)}
            onDone={(message) => {
              setEditing(null)
              toast.success(message)
            }}
          />
        )}
      </Modal>

      <Modal open={Boolean(removing)} title={removing ? `Remove ${removing.skill}?` : ''} onClose={() => setRemoving(null)}>
        {removing && (
          <div className={styles.dialog}>
            <p>
              It disappears from your profile. To list it again later, add it with a certificate and wait for MOTEXA
              to approve it.
            </p>
            {removeError && <Notice tone="danger">{removeError}</Notice>}
            <div className={styles.dialogActions}>
              <Button variant="secondary" onClick={() => setRemoving(null)} disabled={busy}>
                Cancel
              </Button>
              <Button variant="danger" onClick={remove} loading={busy}>
                Remove skill
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
