import Button from '../../components/Button.jsx'
import FileUpload from '../../components/FileUpload.jsx'
import { TextField } from '../../components/FormField.jsx'
import Notice from '../../components/Notice.jsx'
import { useSaveForm } from '../../hooks/useSaveForm.js'
import { SKILLS } from '../signup/constants.js'
import { useProfileService } from '../useAuth.js'
import { skillErrors } from '../validation.js'
import styles from './ProfileForms.module.css'

// "Add a skill" (`skill` null: choose one of the skills not listed yet) or "Update certificate"
// for an existing skill. Either way the skill goes to an admin and stays off the public profile
// until approved. onDone(message) runs after saving.
export default function SkillForm({ skill = null, listedSkills, isOnlyApproved = false, onDone, onCancel }) {
  const service = useProfileService()
  const form = useSaveForm({
    skill: skill?.skill ?? '',
    years: skill ? String(skill.years) : '',
    certificate: skill?.certificate ?? null,
  })
  const { values, setValue, errors } = form
  const available = SKILLS.filter((name) => !listedSkills.includes(name))

  function validate(current) {
    const found = {}
    if (!skill && !current.skill) found.skill = 'Choose a skill.'
    return { ...found, ...skillErrors(current) }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const saved = await form.submit({
      validate,
      save: (current) => (skill ? service.updateSkill(skill.id, current) : service.addSkill(current)),
    })
    if (saved) {
      onDone(
        skill
          ? `${skill.skill} was sent to MOTEXA for review.`
          : `${values.skill} was added. It appears on your public profile once MOTEXA approves it.`,
      )
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      {skill ? (
        <Notice tone={isOnlyApproved ? 'warning' : 'info'}>
          A new certificate or new years of experience sends {skill.skill} back to MOTEXA for review. It is hidden
          from your public profile until it is approved again.
          {isOnlyApproved && ' This is your only approved skill, so your profile will show no skills meanwhile.'}
        </Notice>
      ) : (
        <TextField as="select" label="Skill" {...form.bind('skill')}>
          <option value="">Choose a skill</option>
          {available.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </TextField>
      )}

      <TextField
        label="Years of experience"
        type="number"
        inputMode="numeric"
        min="0"
        max="60"
        step="1"
        {...form.bind('years')}
      />
      <FileUpload
        id="certificate"
        label="Certificate"
        hint={skill ? 'Replace it with the new certificate.' : 'A certificate that proves this skill.'}
        kind="document"
        value={values.certificate}
        onChange={(file) => setValue('certificate', file)}
        error={errors.certificate}
      />

      {form.formError && <Notice tone="danger">{form.formError}</Notice>}
      <div className={styles.actions}>
        <Button variant="secondary" onClick={onCancel} disabled={form.saving}>
          Cancel
        </Button>
        <Button type="submit" loading={form.saving}>
          {form.saving ? 'Sending…' : 'Send for review'}
        </Button>
      </div>
    </form>
  )
}
