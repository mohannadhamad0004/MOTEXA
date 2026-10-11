import Button from '../../../components/Button.jsx'
import { FieldError, TextField } from '../../../components/FormField.jsx'
import Notice from '../../../components/Notice.jsx'
import { useToast } from '../../../components/Toast/ToastContext.js'
import CityTagsInput from '../../../auth/signup/CityTagsInput.jsx'
import { useAuth, useProfileService } from '../../../auth/useAuth.js'
import { useSaveForm } from '../../../hooks/useSaveForm.js'
import { getSellingSettings, getShopCommerce, SELLING_TIME_MAX_LENGTH, sellingSettingsErrors } from '../shopCommerce.js'
import styles from './SellingSettingsForm.module.css'

// The form's flat values <-> the nested SellingSettings the service stores.
function toValues(settings, fallbackAddress) {
  const { delivery, pickup, payments } = settings
  return {
    deliveryEnabled: delivery.enabled,
    deliveryCities: delivery.cities,
    deliveryFee: String(delivery.feeIls ?? 0),
    freeAbove: delivery.freeAboveIls == null ? '' : String(delivery.freeAboveIls),
    estimatedTime: delivery.estimatedTime,
    pickupEnabled: pickup.enabled,
    pickupAddress: pickup.address || fallbackAddress,
    pickupHours: pickup.hours,
    cash: payments.cash,
    card: payments.card,
  }
}

const toSettings = (v) => ({
  delivery: {
    enabled: v.deliveryEnabled,
    cities: v.deliveryCities,
    feeIls: v.deliveryFee,
    freeAboveIls: v.freeAbove,
    estimatedTime: v.estimatedTime,
  },
  pickup: { enabled: v.pickupEnabled, address: v.pickupAddress, hours: v.pickupHours },
  payments: { cash: v.cash, card: v.card },
})

// Parts shops: "Selling settings" on /profile - delivery, pickup and accepted payment methods.
// Until delivery or pickup is on and a payment method is accepted, customers can't buy this
// shop's parts: they only see "Ask about this part".
export default function SellingSettingsForm() {
  const { user } = useAuth()
  const service = useProfileService()
  const toast = useToast()
  const shop = { id: user.id, name: user.name, city: user.city, address: user.address, sellingSettings: user.sellingSettings }
  const selling = getShopCommerce(shop).selling
  const fallbackAddress = [user.address, user.city].filter(Boolean).join(', ')

  const form = useSaveForm(toValues(getSellingSettings(shop), fallbackAddress))
  const { values, setValue, errors } = form

  async function handleSubmit(event) {
    event.preventDefault()
    const saved = await form.submit({
      validate: (current) => sellingSettingsErrors(toSettings(current)),
      save: (current) => service.updateSellingSettings(toSettings(current)),
    })
    if (saved) toast.success('Your selling settings were saved.')
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      {selling ? (
        <Notice tone="success">Customers can buy your parts. Turn a section off any time to stop offering it.</Notice>
      ) : (
        <Notice tone="warning" title="Customers can't buy your parts yet">
          Turn on delivery or pickup and accept at least one payment method, then save. Until then your parts only show &ldquo;Ask about
          this part&rdquo;.
        </Notice>
      )}

      <fieldset id="fulfillment" tabIndex={-1} className={styles.group}>
        <legend className={styles.legend}>How customers get their parts</legend>
        <FieldError id="fulfillment-error">{errors.fulfillment}</FieldError>

        <div className={styles.section}>
          <Toggle
            id="deliveryEnabled"
            checked={values.deliveryEnabled}
            onChange={(checked) => setValue('deliveryEnabled', checked)}
            label="Delivery"
            hint="You bring the parts to the customer."
          />
          {values.deliveryEnabled && (
            <div className={styles.fields}>
              <CityTagsInput
                id="deliveryCities"
                label="Cities you deliver to"
                hint="Type a city and press Enter or Add. Customers can only choose these cities."
                value={values.deliveryCities}
                onChange={(cities) => setValue('deliveryCities', cities)}
                error={errors.deliveryCities}
              />
              <div className={styles.grid}>
                <TextField
                  id="deliveryFee"
                  label="Delivery fee (₪)"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="1"
                  value={values.deliveryFee}
                  onChange={(event) => setValue('deliveryFee', event.target.value)}
                  error={errors.deliveryFee}
                />
                <TextField
                  id="freeAbove"
                  label="Free delivery above (₪)"
                  optional
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="1"
                  hint="Leave empty to always charge the fee."
                  value={values.freeAbove}
                  onChange={(event) => setValue('freeAbove', event.target.value)}
                  error={errors.freeAbove}
                />
              </div>
              <TextField
                id="estimatedTime"
                label="Estimated delivery time"
                hint="For example: Same day in Nablus, 1-2 business days elsewhere."
                maxLength={SELLING_TIME_MAX_LENGTH}
                value={values.estimatedTime}
                onChange={(event) => setValue('estimatedTime', event.target.value)}
                error={errors.estimatedTime}
              />
            </div>
          )}
        </div>

        <div className={styles.section}>
          <Toggle
            id="pickupEnabled"
            checked={values.pickupEnabled}
            onChange={(checked) => setValue('pickupEnabled', checked)}
            label="Pickup"
            hint="Customers collect the parts from you."
          />
          {values.pickupEnabled && (
            <div className={styles.fields}>
              <TextField
                id="pickupAddress"
                label="Pickup address"
                value={values.pickupAddress}
                onChange={(event) => setValue('pickupAddress', event.target.value)}
                error={errors.pickupAddress}
              />
              <TextField
                id="pickupHours"
                label="Pickup hours"
                hint="For example: Sat–Thu 09:00–17:00."
                value={values.pickupHours}
                onChange={(event) => setValue('pickupHours', event.target.value)}
                error={errors.pickupHours}
              />
            </div>
          )}
        </div>
      </fieldset>

      <fieldset id="payments" tabIndex={-1} className={styles.group}>
        <legend className={styles.legend}>Payment methods you accept</legend>
        <FieldError id="payments-error">{errors.payments}</FieldError>
        <div className={styles.section}>
          <Toggle
            id="cash"
            checked={values.cash}
            onChange={(checked) => setValue('cash', checked)}
            label="Cash on delivery / Pay at pickup"
            hint="The customer pays you when the parts arrive or are collected."
          />
          <Toggle
            id="card"
            checked={values.card}
            onChange={(checked) => setValue('card', checked)}
            label="Card payment"
            hint="Paid online through MOTEXA's payment provider; you never handle card details."
          />
        </div>
      </fieldset>

      {form.formError && <Notice tone="danger">{form.formError}</Notice>}
      <div className={styles.actions}>
        <Button type="submit" variant="secondary" loading={form.saving}>
          {form.saving ? 'Saving…' : 'Save selling settings'}
        </Button>
      </div>
    </form>
  )
}

function Toggle({ id, checked, onChange, label, hint }) {
  return (
    <label className={styles.toggle} htmlFor={id}>
      <input id={id} type="checkbox" className={styles.checkbox} checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span className={styles.text}>
        <span className={styles.label}>{label}</span>
        <span className={styles.hint}>{hint}</span>
      </span>
    </label>
  )
}
