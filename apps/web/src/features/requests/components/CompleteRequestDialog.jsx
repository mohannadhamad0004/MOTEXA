import { useState } from 'react'
import Button from '../../../components/Button.jsx'
import { TextField } from '../../../components/FormField.jsx'
import Modal from '../../../components/Modal.jsx'
import Notice from '../../../components/Notice.jsx'
import { useToast } from '../../../components/Toast/ToastContext.js'
import { truckTypeLabel } from '../../logistics/format.js'
import { formatPrice } from '../../marketplace/format.js'
import { completeLabel, REQUEST_TYPES } from '../constants.js'
import { useRequestsService } from '../RequestsContext.js'
import { RequestError } from '../requestsService.js'
import styles from './CompleteRequestDialog.module.css'

let lastRowId = 0
const newPart = () => ({ key: `part-${++lastRowId}`, name: '', quantity: '1', priceIls: '' })

const DESCRIPTIONS = {
  [REQUEST_TYPES.SERVICE]:
    'Write what you found and did. The customer gets it as a report, and it goes into the car’s maintenance history.',
  [REQUEST_TYPES.TOW]: 'Choose the truck that did the job and the price. The customer gets it as a report.',
  [REQUEST_TYPES.PART_QUESTION]: 'Mark the sale or pickup as done.',
}

// For the mechanic, tow company or shop: "Mark as completed" with the final details. Afterwards the
// customer can rate them, and service and tow requests become a printable report.
// `trucks` are the tow company's approved trucks.
export default function CompleteRequestDialog({ request, trucks = [], open, onClose }) {
  return (
    <Modal open={open} title={`Complete request ${request.id}`} onClose={onClose} wide>
      {open && <CompleteForm request={request} trucks={trucks} onClose={onClose} />}
    </Modal>
  )
}

function CompleteForm({ request, trucks, onClose }) {
  const service = useRequestsService()
  const toast = useToast()
  const [values, setValues] = useState({
    confirmedDiagnosis: request.details.diagnosis?.possibleCauses[0]?.cause ?? '',
    workDone: '',
    // Parts bought through MOTEXA for this request start as "parts used"
    parts: request.purchasedParts?.length
      ? request.purchasedParts.map(({ name, quantity, priceIls }) => ({
          ...newPart(),
          name,
          quantity: String(quantity),
          priceIls: String(priceIls),
        }))
      : [newPart()],
    laborIls: '',
    truckId: request.assignedTruckId ?? trucks[0]?.id ?? '',
    totalIls: '',
    note: '',
  })
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [saving, setSaving] = useState(false)

  const set = (name, value) => {
    setValues((current) => ({ ...current, [name]: value }))
    setErrors({})
  }
  const setPart = (index, changes) =>
    set(
      'parts',
      values.parts.map((part, i) => (i === index ? { ...part, ...changes } : part)),
    )
  const bind = (name) => ({ id: name, value: values[name], onChange: (event) => set(name, event.target.value), error: errors[name] })

  // Empty part rows are left out.
  const filledParts = values.parts.filter((part) => part.name.trim() || part.priceIls !== '')
  const serviceTotal =
    filledParts.reduce((sum, part) => sum + (Number(part.quantity) || 0) * (Number(part.priceIls) || 0), 0) +
    (Number(values.laborIls) || 0)

  function dataForType() {
    if (request.type === REQUEST_TYPES.SERVICE) {
      return {
        confirmedDiagnosis: values.confirmedDiagnosis,
        workDone: values.workDone,
        partsUsed: filledParts.map(({ name, quantity, priceIls }) => ({ name, quantity, priceIls })),
        laborIls: values.laborIls,
      }
    }
    if (request.type === REQUEST_TYPES.TOW) return { truckId: values.truckId, totalIls: values.totalIls }
    return { note: values.note, totalIls: values.totalIls }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setFormError(null)
    setSaving(true)
    try {
      await service.completeRequest(request.id, dataForType())
      toast.success(`Request ${request.id} is completed. The customer will be asked to confirm it, then they can rate you.`)
      onClose()
    } catch (error) {
      if (error instanceof RequestError && error.field) {
        // Part rows are numbered among the filled rows; map back to the row on screen.
        const match = /^parts\.(\d+)\.(\w+)$/.exec(error.field)
        const field = match
          ? `parts.${values.parts.indexOf(filledParts[Number(match[1])])}.${match[2]}`
          : error.field
        setErrors({ [field]: error.message })
        requestAnimationFrame(() => document.getElementById(field)?.focus())
      } else {
        setFormError(error.message)
      }
      setSaving(false)
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <p className={styles.muted}>{DESCRIPTIONS[request.type]}</p>

      {request.type === REQUEST_TYPES.SERVICE && (
        <>
          <TextField
            as="textarea"
            rows={2}
            label="Confirmed diagnosis"
            hint={request.details.diagnosis ? 'Starts from the AI report - confirm or correct it.' : undefined}
            {...bind('confirmedDiagnosis')}
          />
          <TextField as="textarea" rows={3} label="Work done" {...bind('workDone')} />

          <fieldset className={styles.parts}>
            <legend className={styles.legend}>Parts used</legend>
            {values.parts.map((part, index) => (
              <div key={part.key} className={styles.partRow}>
                <TextField
                  id={`parts.${index}.name`}
                  label="Part"
                  value={part.name}
                  onChange={(event) => setPart(index, { name: event.target.value })}
                  error={errors[`parts.${index}.name`]}
                />
                <TextField
                  id={`parts.${index}.quantity`}
                  label="Qty"
                  type="number"
                  min="1"
                  step="1"
                  inputMode="numeric"
                  value={part.quantity}
                  onChange={(event) => setPart(index, { quantity: event.target.value })}
                  error={errors[`parts.${index}.quantity`]}
                />
                <TextField
                  id={`parts.${index}.priceIls`}
                  label="Price each (₪)"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={part.priceIls}
                  onChange={(event) => setPart(index, { priceIls: event.target.value })}
                  error={errors[`parts.${index}.priceIls`]}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className={styles.removePart}
                  onClick={() =>
                    set(
                      'parts',
                      values.parts.filter((_, i) => i !== index),
                    )
                  }
                  aria-label={`Remove part ${index + 1}`}
                >
                  Remove
                </Button>
              </div>
            ))}
            <div>
              <Button variant="secondary" size="sm" onClick={() => set('parts', [...values.parts, newPart()])}>
                + Add part
              </Button>
            </div>
          </fieldset>

          <TextField
            label="Labor (₪)"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            className={styles.short}
            {...bind('laborIls')}
          />
          <p className={styles.total}>
            Total for the customer: <strong>{formatPrice(serviceTotal)}</strong>
          </p>
        </>
      )}

      {request.type === REQUEST_TYPES.TOW && (
        <>
          {trucks.length === 0 ? (
            <Notice tone="warning">You need an approved truck to complete a tow request.</Notice>
          ) : (
            <TextField as="select" label="Truck" {...bind('truckId')}>
              <option value="">Choose a truck</option>
              {trucks.map((truck) => (
                <option key={truck.id} value={truck.id}>
                  {truck.plateNumber} · {truckTypeLabel(truck.type)}
                </option>
              ))}
            </TextField>
          )}
          <TextField
            label="Cost (₪)"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            className={styles.short}
            {...bind('totalIls')}
          />
        </>
      )}

      {request.type === REQUEST_TYPES.PART_QUESTION && (
        <>
          <TextField label="Note" optional hint="E.g. Picked up 2 discs at the shop." {...bind('note')} />
          <TextField
            label="Amount paid (₪)"
            optional
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            className={styles.short}
            {...bind('totalIls')}
          />
        </>
      )}

      {formError && <Notice tone="danger">{formError}</Notice>}
      <div className={styles.actions}>
        <Button variant="secondary" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          {saving ? 'Saving…' : completeLabel(request)}
        </Button>
      </div>
    </form>
  )
}
