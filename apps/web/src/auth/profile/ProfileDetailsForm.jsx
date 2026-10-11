import { ROLES } from '../../authorization/roles.js'
import Button from '../../components/Button.jsx'
import FileUpload from '../../components/FileUpload.jsx'
import { TextField } from '../../components/FormField.jsx'
import Notice from '../../components/Notice.jsx'
import { useToast } from '../../components/Toast/ToastContext.js'
import { useSaveForm } from '../../hooks/useSaveForm.js'
import { REVIEW_STATUS, REVIEWED_FIELD_LABELS, REVIEWED_FIELDS } from '../constants.js'
import { PHOTO_MINIMUMS, PROFILE_FIELDS, profileErrors } from '../profileRules.js'
import { changeOf } from '../reviewItems.js'
import CityTagsInput from '../signup/CityTagsInput.jsx'
import { DESCRIPTION_MAX_LENGTH } from '../signup/constants.js'
import { useAuth, useProfileService } from '../useAuth.js'
import ChangeStatusNotice from './ChangeStatusNotice.jsx'
import styles from './ProfileForms.module.css'

// Labels and hints per role. Fields not listed for a role aren't on its form.
const LABELS = {
  [ROLES.CUSTOMER]: { profilePhoto: 'Profile photo', name: 'Full name', city: 'City' },
  [ROLES.ADMIN]: { profilePhoto: 'Profile photo', name: 'Full name' },
  [ROLES.MECHANIC]: {
    profilePhoto: 'Profile photo',
    name: 'Full name',
    workshopName: 'Workshop name',
    city: 'City',
    address: 'Workshop address',
    description: 'About your workshop',
    workshopPhotos: 'Workshop photos',
  },
  [ROLES.PARTS_SHOP]: {
    profilePhoto: 'Shop logo',
    name: 'Shop name',
    city: 'City',
    address: 'Shop address',
    description: 'Short description',
    shopPhotos: 'Shop photos',
  },
  [ROLES.TOW]: {
    profilePhoto: 'Company logo',
    name: 'Company name',
    city: 'City',
    address: 'Company address',
    description: 'Short description',
    serviceArea: 'Service area',
  },
}

// Edited in their own sections (ServicesForm, SkillsManager, BusinessLicenseCard).
const OTHER_SECTIONS = ['serviceModes', 'onSiteCities']

const EMPTY_VALUES = { workshopPhotos: [], shopPhotos: [], serviceArea: [], profilePhoto: null }

// The form starts from the saved profile, with a pending name change instead of the approved name
// (so saving other fields again doesn't withdraw it).
function initialValues(user) {
  const fields = PROFILE_FIELDS[user.role].filter((field) => !OTHER_SECTIONS.includes(field))
  return Object.fromEntries(
    fields.map((field) => {
      const change = changeOf(user, field)
      const value = change?.status === REVIEW_STATUS.PENDING ? change.value : user[field]
      return [field, value ?? EMPTY_VALUES[field] ?? '']
    }),
  )
}

// The public details of the logged-in user's profile, for every role. Names that identify a
// business (shop / company name, workshop name) go to an admin first; everything else is saved
// right away.
export default function ProfileDetailsForm() {
  const { user } = useAuth()
  const service = useProfileService()
  const toast = useToast()
  const form = useSaveForm(() => initialValues(user))
  const { values, setValue, errors } = form

  const labels = LABELS[user.role]
  const reviewed = REVIEWED_FIELDS[user.role] ?? []
  const isCustomerOrAdmin = user.role === ROLES.CUSTOMER || user.role === ROLES.ADMIN
  const has = (field) => field in values

  async function handleSubmit(event) {
    event.preventDefault()
    const result = await form.submit({
      // Service modes are checked too (mechanics), from what is saved.
      validate: (current) => profileErrors(user.role, { ...user, ...current }),
      save: (current) => service.updateProfile(current),
    })
    if (!result) return
    const sent = result.sentForReview.map((field) => REVIEWED_FIELD_LABELS[field].toLowerCase())
    toast.success(
      sent.length
        ? `Saved. Your new ${sent.join(' and ')} was sent to MOTEXA for review.`
        : 'Your profile was saved.',
    )
  }

  // Text field for one profile value, with the review notice under reviewed fields.
  function field(name, props = {}) {
    if (!has(name)) return null
    const isReviewed = reviewed.includes(name)
    const change = isReviewed ? changeOf(user, name) : null
    return (
      <div className={styles.field}>
        <TextField
          id={name}
          label={labels[name]}
          value={values[name]}
          onChange={(event) => setValue(name, event.target.value)}
          error={errors[name]}
          {...props}
          hint={
            isReviewed
              ? `Changing this sends it to MOTEXA for review. Your public profile shows "${user[name]}" until it is approved.`
              : props.hint
          }
        />
        <ChangeStatusNotice change={change} onWithdrawn={() => setValue(name, user[name])}>
          {change && <p>New {labels[name].toLowerCase()}: “{change.value}”</p>}
        </ChangeStatusNotice>
      </div>
    )
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <FileUpload
        id="profilePhoto"
        label={labels.profilePhoto}
        hint={isCustomerOrAdmin ? 'Shown next to your name.' : 'Shown on your public profile.'}
        optional={isCustomerOrAdmin}
        kind="image"
        value={values.profilePhoto}
        onChange={(file) => setValue('profilePhoto', file)}
        error={errors.profilePhoto}
      />

      <div className={styles.grid}>
        {field('name', { autoComplete: isCustomerOrAdmin || user.role === ROLES.MECHANIC ? 'name' : 'organization' })}
        {field('workshopName', { autoComplete: 'organization' })}
        {field('city', { autoComplete: 'address-level2', optional: user.role === ROLES.CUSTOMER })}
        {field('address', { autoComplete: 'street-address' })}
      </div>

      {has('description') && (
        <TextField
          id="description"
          as="textarea"
          label={labels.description}
          optional={user.role !== ROLES.PARTS_SHOP}
          hint={`${values.description.length}/${DESCRIPTION_MAX_LENGTH} characters.`}
          rows={4}
          maxLength={DESCRIPTION_MAX_LENGTH}
          value={values.description}
          onChange={(event) => setValue('description', event.target.value)}
          error={errors.description}
        />
      )}

      {has('serviceArea') && (
        <CityTagsInput
          id="serviceArea"
          label={labels.serviceArea}
          hint="Cities you cover. Type a city and press Enter or Add."
          value={values.serviceArea}
          onChange={(cities) => setValue('serviceArea', cities)}
          error={errors.serviceArea}
        />
      )}

      {['workshopPhotos', 'shopPhotos'].filter(has).map((name) => (
        <FileUpload
          key={name}
          id={name}
          label={labels[name]}
          hint={`At least ${PHOTO_MINIMUMS[name]}. Add or remove photos any time - they don't need a review.`}
          kind="image"
          multiple
          value={values[name]}
          onChange={(files) => setValue(name, files)}
          error={errors[name]}
        />
      ))}

      {form.formError && <Notice tone="danger">{form.formError}</Notice>}
      <div className={styles.actions}>
        <Button type="submit" loading={form.saving}>
          {form.saving ? 'Saving…' : 'Save profile'}
        </Button>
      </div>
    </form>
  )
}
