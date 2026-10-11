import { useState } from 'react'
import { TRUCK_STATUSES, TRUCK_TYPES } from '../../../auth/signup/constants.js'
import { truckErrors } from '../../../auth/validation.js'
import Button from '../../../components/Button.jsx'
import FileUpload from '../../../components/FileUpload.jsx'
import { TextField } from '../../../components/FormField.jsx'
import Notice from '../../../components/Notice.jsx'
import { isSameFile } from '../../../utils/files.js'
import { useTrucksService } from '../TrucksContext.js'
import { TruckError } from '../trucksService.js'
import styles from './TruckForm.module.css'

const EMPTY = {
  plateNumber: '',
  type: '',
  maxWeightKg: '',
  status: 'available',
  photos: [],
  registration: null,
  insurance: null,
}

// Would saving these values send the truck back to review? (Same rule as trucksService.js.)
function changesReviewedField(truck, values) {
  if (!truck) return false
  return (
    values.plateNumber.trim() !== truck.plateNumber ||
    values.type !== truck.type ||
    Number(values.maxWeightKg) !== truck.maxWeightKg ||
    !values.registration ||
    !values.insurance ||
    !isSameFile(values.registration, truck.registration) ||
    !isSameFile(values.insurance, truck.insurance)
  )
}

// Add a truck (`truck` null) or edit one: the same details and documents as at signup, plus its
// current status. onDone(message) runs after saving. Field ids match the error keys, so the first
// invalid field gets focus.
export default function TruckForm({ truck = null, onDone, onCancel }) {
  const service = useTrucksService()
  const [values, setValues] = useState(() =>
    truck ? { ...EMPTY, ...truck, maxWeightKg: String(truck.maxWeightKg) } : EMPTY,
  )
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [saving, setSaving] = useState(false)

  const willReview = changesReviewedField(truck, values)

  function setValue(name, value) {
    setValues((current) => ({ ...current, [name]: value }))
    if (errors[name]) setErrors((current) => ({ ...current, [name]: undefined }))
  }

  const bind = (name) => ({
    id: name,
    value: values[name],
    onChange: (event) => setValue(name, event.target.value),
    error: errors[name],
  })

  async function handleSubmit(event) {
    event.preventDefault()
    setFormError(null)
    const found = truckErrors(values)
    setErrors(found)
    const [first] = Object.keys(found)
    if (first) {
      requestAnimationFrame(() => document.getElementById(first)?.focus())
      return
    }

    setSaving(true)
    try {
      if (truck) {
        const { sentForReview } = await service.updateTruck(truck.id, values)
        onDone(
          sentForReview
            ? `${values.plateNumber.trim()} was saved and sent to MOTEXA for review.`
            : `${values.plateNumber.trim()} was saved.`,
        )
      } else {
        await service.addTruck(values)
        onDone(`${values.plateNumber.trim()} was added. It appears on your public profile once MOTEXA approves it.`)
      }
    } catch (error) {
      if (error instanceof TruckError && error.field) {
        setErrors({ [error.field]: error.message })
        requestAnimationFrame(() => document.getElementById(error.field)?.focus())
      } else {
        setFormError(error.message || "Couldn't save the truck. Please try again.")
      }
      setSaving(false)
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      {!truck && (
        <Notice tone="info">
          MOTEXA checks every new truck and its documents before it appears on your public profile.
        </Notice>
      )}

      <div className={styles.grid}>
        <TextField label="Plate number" autoComplete="off" {...bind('plateNumber')} />
        <TextField as="select" label="Truck type" {...bind('type')}>
          <option value="">Choose a type</option>
          {TRUCK_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </TextField>
        <TextField
          label="Max vehicle weight (kg)"
          type="number"
          inputMode="numeric"
          min="500"
          max="60000"
          step="100"
          hint="The heaviest vehicle it can carry."
          {...bind('maxWeightKg')}
        />
        <TextField as="select" label="Status" hint="Not reviewed - change it any time." {...bind('status')}>
          {TRUCK_STATUSES.map((status) => (
            <option key={status.value} value={status.value}>
              {status.label}
            </option>
          ))}
        </TextField>
      </div>

      <FileUpload
        id="photos"
        label="Truck photos"
        hint="At least 1 photo. Show the truck and its plate. New photos don't need a review."
        kind="image"
        multiple
        value={values.photos}
        onChange={(files) => setValue('photos', files)}
        error={errors.photos}
      />
      <div className={styles.documents}>
        <FileUpload
          id="registration"
          label="Registration document"
          kind="document"
          value={values.registration}
          onChange={(file) => setValue('registration', file)}
          error={errors.registration}
        />
        <FileUpload
          id="insurance"
          label="Insurance document"
          kind="document"
          value={values.insurance}
          onChange={(file) => setValue('insurance', file)}
          error={errors.insurance}
        />
      </div>

      {willReview && (
        <Notice tone="warning" title="This change needs a new review">
          A new plate number, type, max weight or document sends this truck back to MOTEXA. It is hidden from
          your public profile until an admin approves it.
        </Notice>
      )}
      {formError && <Notice tone="danger">{formError}</Notice>}

      <div className={styles.actions}>
        <Button variant="secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          {saving ? 'Saving…' : truck ? 'Save truck' : 'Add truck'}
        </Button>
      </div>
    </form>
  )
}
