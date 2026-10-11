import Button from '../../components/Button.jsx'
import FileUpload from '../../components/FileUpload.jsx'
import { FieldError, TextField } from '../../components/FormField.jsx'
import { TRUCK_TYPES } from './constants.js'
import { newTruck } from './listEntries.js'
import StepSection from './StepSection.jsx'
import styles from './TrucksStep.module.css'

// Tow company step 4: at least one truck, each with photos, registration and insurance.
export default function TrucksStep({ form, setField, errors }) {
  const { trucks } = form

  const addTruck = () => setField('trucks', [...trucks, newTruck()])
  const removeTruck = (id) => setField('trucks', trucks.filter((truck) => truck.id !== id))
  const updateTruck = (index, changes) =>
    setField(
      'trucks',
      trucks.map((truck, i) => (i === index ? { ...truck, ...changes } : truck)),
    )

  return (
    <StepSection title="Trucks" intro="Add every truck you'll use for MOTEXA tow requests.">
      <FieldError id="trucks">{errors.trucks}</FieldError>

      <ul className={styles.list}>
        {trucks.map((truck, index) => {
          const id = (field) => `trucks.${index}.${field}`
          const field = (name) => ({
            id: id(name),
            value: truck[name],
            onChange: (event) => updateTruck(index, { [name]: event.target.value }),
            error: errors[id(name)],
          })

          return (
            <li key={truck.id} className={styles.card}>
              <div className={styles.cardHeader}>
                <h3 className={styles.cardTitle}>Truck {index + 1}</h3>
                <Button
                  variant="secondary"
                  onClick={() => removeTruck(truck.id)}
                  disabled={trucks.length === 1}
                  title={trucks.length === 1 ? 'You need at least one truck' : undefined}
                >
                  Remove
                </Button>
              </div>

              <div className={styles.grid}>
                <TextField label="Plate number" autoComplete="off" {...field('plateNumber')} />
                <TextField as="select" label="Truck type" {...field('type')}>
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
                  {...field('maxWeightKg')}
                />
              </div>

              <FileUpload
                id={id('photos')}
                label="Truck photos"
                hint="At least 1 photo. Show the truck and its plate."
                kind="image"
                multiple
                value={truck.photos}
                onChange={(files) => updateTruck(index, { photos: files })}
                error={errors[id('photos')]}
              />
              <div className={styles.documents}>
                <FileUpload
                  id={id('registration')}
                  label="Registration document"
                  kind="document"
                  value={truck.registration}
                  onChange={(file) => updateTruck(index, { registration: file })}
                  error={errors[id('registration')]}
                />
                <FileUpload
                  id={id('insurance')}
                  label="Insurance document"
                  kind="document"
                  value={truck.insurance}
                  onChange={(file) => updateTruck(index, { insurance: file })}
                  error={errors[id('insurance')]}
                />
              </div>
            </li>
          )
        })}
      </ul>

      <Button variant="secondary" className={styles.add} onClick={addTruck}>
        + Add another truck
      </Button>
    </StepSection>
  )
}
