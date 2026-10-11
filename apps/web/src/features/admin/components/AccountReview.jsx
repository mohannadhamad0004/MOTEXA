import { useState } from 'react'
import AccountSummary from '../../../auth/AccountSummary.jsx'
import { SKILL_STATUS, STATUS_BADGES, VERIFICATION_METHODS } from '../../../auth/constants.js'
import { ROLES } from '../../../authorization/roles.js'
import Button from '../../../components/Button.jsx'
import { FieldError, TextField } from '../../../components/FormField.jsx'
import Notice from '../../../components/Notice.jsx'
import StatusIndicator from '../../../components/StatusIndicator.jsx'
import { useAdminService } from '../AdminContext.js'
import { AdminError } from '../adminService.js'
import ReasonDialog from './ReasonDialog.jsx'
import styles from './AccountReview.module.css'

// Review of one pending signup: everything submitted, a decision per skill (mechanics, with a
// reason the mechanic sees for each rejected skill), the verification method (required to
// approve), an optional note, then Approve or Reject. A tow company's trucks are approved with it.
// Closing it without deciding keeps the account pending. Mount with key={account.id}.
export default function AccountReview({ account, onDone }) {
  const service = useAdminService()
  const isMechanic = account.role === ROLES.MECHANIC
  const [skillDecisions, setSkillDecisions] = useState({})
  const [skillReasons, setSkillReasons] = useState({})
  const [method, setMethod] = useState('')
  const [note, setNote] = useState('')
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [rejecting, setRejecting] = useState(false)

  const decided = isMechanic ? account.skills.filter((s) => skillDecisions[s.id]).length : 0
  const approvedCount = isMechanic ? account.skills.filter((s) => skillDecisions[s.id] === SKILL_STATUS.APPROVED).length : 0

  function decide(skillId, decision) {
    setSkillDecisions((current) => ({ ...current, [skillId]: decision }))
    setErrors((current) => ({ ...current, skills: undefined }))
  }

  function validateApproval() {
    const found = {}
    if (isMechanic) {
      const unexplained = account.skills.find(
        (s) => skillDecisions[s.id] === SKILL_STATUS.REJECTED && !skillReasons[s.id]?.trim(),
      )
      if (decided < account.skills.length) found.skills = 'Approve or reject every skill first.'
      else if (approvedCount === 0) found.skills = 'Approve at least one skill, or reject the whole account instead.'
      else if (unexplained) found.skills = `Write why ${unexplained.skill} is rejected - the mechanic will see it.`
    }
    if (!method) found.method = 'Choose how you verified this account before approving it.'
    return found
  }

  async function approve() {
    setFormError(null)
    const found = validateApproval()
    setErrors(found)
    const [first] = Object.keys(found)
    if (first) {
      document.getElementById(first === 'skills' ? 'review-skills' : 'review-method')?.focus()
      return
    }
    setSaving(true)
    try {
      await service.approveAccount(account.id, { method, note, skillDecisions, skillReasons })
      onDone(`${account.name} was approved${isMechanic ? ` for ${approvedCount} of ${account.skills.length} skills` : ''}.`)
    } catch (err) {
      if (err instanceof AdminError && err.field) setErrors({ [err.field]: err.message })
      else setFormError(err.message)
      setSaving(false)
    }
  }

  async function reject(reason) {
    await service.rejectAccount(account.id, { reason, method: method || null, note })
    setRejecting(false)
    onDone(`${account.name} was rejected. They'll see your reason on their status page.`)
  }

  return (
    <div className={styles.review}>
      <div className={styles.main}>
      {isMechanic && (
        <Notice tone="info">
          Approve or reject each skill on its own. Only approved skills appear on the mechanic's public profile.
        </Notice>
      )}

      <AccountSummary
        account={account}
        renderSkillActions={
          isMechanic
            ? (skill) => (
                <SkillDecision
                  skill={skill}
                  value={skillDecisions[skill.id]}
                  onChange={(decision) => decide(skill.id, decision)}
                  reason={skillReasons[skill.id] ?? ''}
                  onReasonChange={(reason) => {
                    setSkillReasons((current) => ({ ...current, [skill.id]: reason }))
                    setErrors((current) => ({ ...current, skills: undefined }))
                  }}
                />
              )
            : null
        }
      />
      </div>

      <aside className={styles.decision} aria-labelledby="decision-title">
        <h3 id="decision-title" className={styles.decisionTitle}>
          Verification
        </h3>
        <StatusIndicator label={STATUS_BADGES[account.status].label} tone={STATUS_BADGES[account.status].tone} />

        {isMechanic && (
          <div id="review-skills" tabIndex={-1} className={styles.skillSummary}>
            <p>
              Skills decided: <strong>{decided}</strong> of {account.skills.length} · approved:{' '}
              <strong>{approvedCount}</strong>
            </p>
            <FieldError id="review-skills-error">{errors.skills}</FieldError>
          </div>
        )}

        <div className={styles.fields}>
          <TextField
            id="review-method"
            as="select"
            label="Verification method"
            hint="Required to approve."
            value={method}
            onChange={(event) => {
              setMethod(event.target.value)
              setErrors((current) => ({ ...current, method: undefined }))
            }}
            error={errors.method}
          >
            <option value="">Choose how you verified them</option>
            {VERIFICATION_METHODS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </TextField>
          <TextField
            id="review-note"
            as="textarea"
            label="Admin note"
            optional
            hint="Only admins see this note."
            rows={2}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </div>

        {formError && <Notice tone="danger">{formError}</Notice>}

        <div className={styles.actions}>
          <Button onClick={approve} loading={saving}>
            {saving ? 'Approving…' : 'Approve'}
          </Button>
          <Button variant="danger" onClick={() => setRejecting(true)} disabled={saving}>
            Reject
          </Button>
          <p className={styles.muted}>Not sure yet? Leave it - the account stays pending.</p>
        </div>
      </aside>

      <ReasonDialog
        open={rejecting}
        title={`Reject ${account.name}?`}
        label="Reason"
        hint="The applicant sees this on their status page. E.g. the business license is unreadable, please upload a clearer scan."
        requiredMessage="Write the reason so the applicant knows what to fix."
        confirmLabel="Reject account"
        onCancel={() => setRejecting(false)}
        onConfirm={reject}
      />
    </div>
  )
}

// Approve / Reject toggle for one skill, and the reason when it is rejected.
function SkillDecision({ skill, value, onChange, reason, onReasonChange }) {
  const options = [
    { value: SKILL_STATUS.APPROVED, label: 'Approve skill', className: styles.approve },
    { value: SKILL_STATUS.REJECTED, label: 'Reject skill', className: styles.reject },
  ]
  return (
    <div className={styles.skillDecisionBlock}>
      <div className={styles.skillDecision} role="group" aria-label={`Decision for ${skill.skill}`}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            className={`${styles.toggle} ${value === option.value ? option.className : ''}`}
            onClick={() => onChange(option.value)}
          >
            {value === option.value ? '✓ ' : ''}
            {option.label}
          </button>
        ))}
      </div>
      {value === SKILL_STATUS.REJECTED && (
        <TextField
          id={`skill-reason-${skill.id}`}
          as="textarea"
          rows={2}
          label="Why is it rejected?"
          hint="The mechanic sees this on their profile."
          value={reason}
          onChange={(event) => onReasonChange(event.target.value)}
        />
      )}
    </div>
  )
}
