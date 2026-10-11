import { useState } from 'react'
import Button from '../../../components/Button.jsx'
import Card from '../../../components/Card.jsx'
import Input from '../../../components/Input.jsx'
import Select from '../../../components/Select.jsx'
import { useMarketplaceService } from '../MarketplaceContext.js'
import { CATEGORIES, CONDITIONS, PART_TYPES } from '../constants.js'
import styles from './PartForm.module.css'

const MIN_YEAR = 1950
const MAX_YEAR = new Date().getFullYear() + 1

const EMPTY_VEHICLE = { make: '', model: '', yearFrom: '', yearTo: '' }
const EMPTY_FORM = {
  name: '',
  oemNumber: '',
  manufacturerNumber: '',
  brand: '',
  category: '',
  type: 'aftermarket',
  condition: 'new',
  priceIls: '',
  stock: '',
  fitments: [EMPTY_VEHICLE],
}

// Form values are strings; the service takes a Part without id, shopId and addedAt.
function toPart(form) {
  return {
    name: form.name.trim(),
    oemNumber: form.oemNumber.trim(),
    manufacturerNumber: form.manufacturerNumber.trim(),
    brand: form.brand.trim(),
    category: form.category,
    type: form.type,
    condition: form.condition,
    priceIls: Number(form.priceIls),
    stock: Number(form.stock),
    fitments: form.fitments.map((f) => ({
      make: f.make.trim(),
      model: f.model.trim(),
      yearFrom: Number(f.yearFrom),
      yearTo: Number(f.yearTo),
    })),
  }
}

// A stored part as form values (strings), for editing.
function toForm(part) {
  return {
    name: part.name,
    oemNumber: part.oemNumber,
    manufacturerNumber: part.manufacturerNumber ?? '',
    brand: part.brand,
    category: part.category,
    type: part.type,
    condition: part.condition,
    priceIls: String(part.priceIls),
    stock: String(part.stock),
    fitments: part.fitments.map((f) => ({ ...f, yearFrom: String(f.yearFrom), yearTo: String(f.yearTo) })),
  }
}

// Lets a parts shop list a new part, or edit one of its own parts when `part` is given.
// The service rejects changes to another shop's part. `vehicles` (from getVehicleOptions) only
// feeds the make/model suggestions - shops can type any car.
// onSaved(part) is called with the stored part.
export default function PartForm({ shopId, part = null, vehicles, onSaved, onCancel }) {
  const service = useMarketplaceService()
  const editing = Boolean(part)
  const [form, setForm] = useState(() => (part ? toForm(part) : EMPTY_FORM))
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  const setField = (field) => (event) => setForm((f) => ({ ...f, [field]: event.target.value }))

  const setVehicleField = (index, field) => (event) =>
    setForm((f) => ({
      ...f,
      fitments: f.fitments.map((v, i) => (i === index ? { ...v, [field]: event.target.value } : v)),
    }))

  const addVehicle = () => setForm((f) => ({ ...f, fitments: [...f.fitments, EMPTY_VEHICLE] }))
  const removeVehicle = (index) =>
    setForm((f) => ({ ...f, fitments: f.fitments.filter((_, i) => i !== index) }))

  const modelsFor = (make) =>
    vehicles.find((v) => v.make.toLowerCase() === make.trim().toLowerCase())?.models ?? []

  async function handleSubmit(event) {
    event.preventDefault()
    const badRow = form.fitments.findIndex((f) => Number(f.yearFrom) > Number(f.yearTo))
    if (badRow !== -1) {
      setError(`Vehicle ${badRow + 1}: "Year from" can't be after "Year to".`)
      return
    }

    setSaving(true)
    setError(null)
    try {
      const saved = editing ? await service.updatePart(part.id, toPart(form)) : await service.addPart(shopId, toPart(form))
      onSaved(saved)
    } catch (err) {
      setError(err.message || `Couldn't ${editing ? 'save' : 'add'} the part. Please try again.`)
      setSaving(false)
    }
  }

  return (
    <Card flat as="form" padding="lg" className={styles.form} onSubmit={handleSubmit} aria-labelledby="part-form-title">
      <h2 id="part-form-title" className={styles.title}>
        {editing ? `Edit "${part.name}"` : 'Add a part'}
      </h2>

      <div className={styles.grid}>
        <label className={`${styles.field} ${styles.wide}`}>
          <span>Part name</span>
          <Input required value={form.name} onChange={setField('name')} placeholder="Front brake pad set" />
        </label>
        <label className={styles.field}>
          <span>OEM number</span>
          <Input required value={form.oemNumber} onChange={setField('oemNumber')} placeholder="58101-1RA00" />
        </label>
        <label className={styles.field}>
          <span>
            Manufacturer number <small>(optional)</small>
          </span>
          <Input
            value={form.manufacturerNumber}
            onChange={setField('manufacturerNumber')}
            placeholder="0 986 494 562"
          />
        </label>
        <label className={styles.field}>
          <span>Brand</span>
          <Input required value={form.brand} onChange={setField('brand')} placeholder="Bosch" />
        </label>
        <label className={styles.field}>
          <span>Category</span>
          <Select required value={form.category} onChange={setField('category')}>
            <option value="">Choose a category</option>
            {CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </Select>
        </label>
        <label className={styles.field}>
          <span>Type</span>
          <Select value={form.type} onChange={setField('type')}>
            {PART_TYPES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </label>
        <label className={styles.field}>
          <span>Condition</span>
          <Select value={form.condition} onChange={setField('condition')}>
            {CONDITIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </label>
        <label className={styles.field}>
          <span>Price (₪)</span>
          <Input
            required
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={form.priceIls}
            onChange={setField('priceIls')}
          />
        </label>
        <label className={styles.field}>
          <span>Stock</span>
          <Input
            required
            type="number"
            min="0"
            step="1"
            inputMode="numeric"
            value={form.stock}
            onChange={setField('stock')}
          />
        </label>
      </div>

      <fieldset className={styles.vehicles}>
        <legend className={styles.legend}>Compatible vehicles</legend>
        <datalist id="add-part-makes">
          {vehicles.map((v) => (
            <option key={v.make} value={v.make} />
          ))}
        </datalist>

        {form.fitments.map((vehicle, index) => (
          <div key={index} className={styles.vehicleRow}>
            <label className={styles.field}>
              <span>Make</span>
              <Input
                required
                list="add-part-makes"
                value={vehicle.make}
                onChange={setVehicleField(index, 'make')}
                placeholder="Hyundai"
              />
            </label>
            <label className={styles.field}>
              <span>Model</span>
              <Input
                required
                list={`add-part-models-${index}`}
                value={vehicle.model}
                onChange={setVehicleField(index, 'model')}
                placeholder="Accent"
              />
              <datalist id={`add-part-models-${index}`}>
                {modelsFor(vehicle.make).map((model) => (
                  <option key={model.name} value={model.name} />
                ))}
              </datalist>
            </label>
            <label className={styles.field}>
              <span>Year from</span>
              <Input
                required
                type="number"
                min={MIN_YEAR}
                max={MAX_YEAR}
                value={vehicle.yearFrom}
                onChange={setVehicleField(index, 'yearFrom')}
              />
            </label>
            <label className={styles.field}>
              <span>Year to</span>
              <Input
                required
                type="number"
                min={MIN_YEAR}
                max={MAX_YEAR}
                value={vehicle.yearTo}
                onChange={setVehicleField(index, 'yearTo')}
              />
            </label>
            <Button
              variant="secondary"
              className={styles.removeVehicle}
              onClick={() => removeVehicle(index)}
              disabled={form.fitments.length === 1}
              aria-label={`Remove vehicle ${index + 1}`}
            >
              Remove
            </Button>
          </div>
        ))}

        <Button variant="secondary" className={styles.addVehicle} onClick={addVehicle}>
          + Add another vehicle
        </Button>
      </fieldset>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <div className={styles.actions}>
        <Button type="submit" loading={saving}>
          {editing ? (saving ? 'Saving…' : 'Save changes') : saving ? 'Adding…' : 'Add part'}
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </Card>
  )
}
