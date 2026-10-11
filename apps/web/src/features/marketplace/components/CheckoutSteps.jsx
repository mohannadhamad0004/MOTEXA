import { useId, useState } from 'react'
import Badge from '../../../components/Badge.jsx'
import Button from '../../../components/Button.jsx'
import Card from '../../../components/Card.jsx'
import { TextField } from '../../../components/FormField.jsx'
import Notice from '../../../components/Notice.jsx'
import { formatDateTime } from '../../requests/format.js'
import { addressProblem, choiceFor, feeFor, findAddress } from '../checkout.js'
import { CITIES } from '../constants.js'
import { formatPrice } from '../format.js'
import { FULFILLMENT_METHODS, PAYMENT_METHODS, paymentLabel } from '../shopCommerce.js'
import CartChangesNotice from './CartChangesNotice.jsx'
import styles from './CheckoutSteps.module.css'

// The four checkout steps. Each shows one card per shop in the cart, because every shop gets its
// own order. `choices` / `onChange(shopId, changes)` hold the buyer's picks (see checkout.js).

const { DELIVERY, PICKUP } = FULFILLMENT_METHODS

// A radio that looks like a selectable card.
function ChoiceCard({ name, value, checked, disabled = false, onChange, title, children }) {
  return (
    <label className={`${styles.choice} ${checked ? styles.choiceChecked : ''} ${disabled ? styles.choiceDisabled : ''}`}>
      <input type="radio" name={name} value={value} checked={checked} disabled={disabled} onChange={() => onChange(value)} />
      <span className={styles.choiceBody}>
        <span className={styles.choiceTitle}>{title}</span>
        {children}
      </span>
    </label>
  )
}

function ShopStepCard({ group, children }) {
  return (
    <Card flat as="section" aria-labelledby={`step-${group.shop.id}`} className={styles.shopCard}>
      <header className={styles.shopHeader}>
        <h2 id={`step-${group.shop.id}`} className={styles.shopName}>
          {group.shop.name}
        </h2>
        <span className={styles.muted}>
          {group.lines.length} {group.lines.length === 1 ? 'item' : 'items'} · {formatPrice(group.subtotalIls)}
        </span>
      </header>
      {children}
    </Card>
  )
}

// --- Step 1: delivery or pickup, per shop -------------------------------------------------------

export function DeliveryStep({ view, choices, addresses, errors, onChange, onAddAddress }) {
  return (
    <div className={styles.stack}>
      <p className={styles.intro}>Choose how you want to get the parts from each shop.</p>
      {view.groups.map((group) => (
        <DeliveryGroup
          key={group.shop.id}
          group={group}
          choice={choiceFor(group, choices)}
          addresses={addresses}
          error={errors[group.shop.id]}
          onChange={(changes) => onChange(group.shop.id, changes)}
          onAddAddress={onAddAddress}
        />
      ))}
    </div>
  )
}

function DeliveryGroup({ group, choice, addresses, error, onChange, onAddAddress }) {
  const { commerce, shop } = group
  const name = `method-${shop.id}`
  const fee = feeFor(group, { ...choice, method: DELIVERY })
  const untilFree =
    commerce.delivery?.freeAboveIls != null && fee > 0 ? commerce.delivery.freeAboveIls - group.subtotalIls : 0

  return (
    <ShopStepCard group={group}>
      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>Get these parts by</legend>
        <div className={styles.choices}>
          <ChoiceCard
            name={name}
            value={DELIVERY}
            checked={choice.method === DELIVERY}
            disabled={!commerce.delivery}
            onChange={(method) => onChange({ method })}
            title="Delivery"
          >
            <span className={styles.muted}>
              {commerce.delivery
                ? fee === 0
                  ? 'Free delivery'
                  : `${formatPrice(commerce.delivery.feeIls)} delivery fee`
                : "This shop doesn't deliver"}
            </span>
          </ChoiceCard>
          <ChoiceCard
            name={name}
            value={PICKUP}
            checked={choice.method === PICKUP}
            disabled={!commerce.pickup}
            onChange={(method) => onChange({ method })}
            title="Pickup"
          >
            <span className={styles.muted}>{commerce.pickup ? 'Free, from the shop' : "This shop doesn't offer pickup"}</span>
          </ChoiceCard>
        </div>
      </fieldset>

      {choice.method === DELIVERY && commerce.delivery && (
        <div className={styles.panel}>
          <p className={styles.panelNote}>
            Delivers to {commerce.delivery.cities.join(', ')}.
            {commerce.delivery.estimatedTime && ` Estimated delivery: ${commerce.delivery.estimatedTime}.`}{' '}
            {commerce.delivery.freeAboveIls != null &&
              (untilFree > 0
                ? `Add ${formatPrice(untilFree)} more from this shop for free delivery.`
                : `Free delivery above ${formatPrice(commerce.delivery.freeAboveIls)}: you qualify.`)}
          </p>
          <AddressPicker
            group={group}
            addresses={addresses}
            selectedId={choice.addressId}
            onSelect={(addressId) => onChange({ addressId })}
            onAddAddress={onAddAddress}
          />
        </div>
      )}

      {choice.method === PICKUP && commerce.pickup && (
        <div className={styles.panel}>
          <dl className={styles.facts}>
            <div>
              <dt>Pickup address</dt>
              <dd>{commerce.pickup.address}</dd>
            </div>
            <div>
              <dt>Pickup hours</dt>
              <dd>{commerce.pickup.hours}</dd>
            </div>
          </dl>
          <a href={commerce.pickup.mapUrl} target="_blank" rel="noopener noreferrer" className={styles.mapLink}>
            Open in maps<span className={styles.srOnly}> (opens in a new tab)</span> ↗
          </a>
        </div>
      )}

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </ShopStepCard>
  )
}

function AddressPicker({ group, addresses, selectedId, onSelect, onAddAddress }) {
  const name = useId()
  const adding = selectedId === 'new'
  const { commerce } = group

  return (
    <fieldset className={styles.fieldset}>
      <legend className={styles.legend}>Delivery address</legend>
      <div className={styles.choices}>
        {addresses.map((address) => {
          const problem = addressProblem(commerce, address)
          return (
            <ChoiceCard
              key={address.id}
              name={name}
              value={address.id}
              checked={selectedId === address.id}
              disabled={Boolean(problem)}
              onChange={onSelect}
              title={address.label}
            >
              <span>
                {address.address}, {address.city}
              </span>
              {problem && <span className={styles.problem}>{problem}</span>}
            </ChoiceCard>
          )
        })}
        <ChoiceCard name={name} value="new" checked={adding} onChange={onSelect} title="Add a new address" />
      </div>
      {adding && (
        <NewAddressForm
          cities={commerce.delivery.cities}
          onSave={async (address) => onSelect((await onAddAddress(address)).id)}
        />
      )}
    </fieldset>
  )
}

function NewAddressForm({ cities, onSave }) {
  const [values, setValues] = useState({ label: '', address: '', city: '' })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const set = (field) => (event) => {
    setValues((current) => ({ ...current, [field]: event.target.value }))
    setErrors({})
  }

  async function handleSave() {
    const next = {}
    if (!values.address.trim()) next.address = 'Enter the street and building.'
    if (!values.city) next.city = 'Choose the city.'
    else if (!cities.includes(values.city)) next.city = `This shop only delivers to ${cities.join(', ')}.`
    if (Object.keys(next).length > 0) {
      setErrors(next)
      return
    }
    setSaving(true)
    try {
      await onSave(values)
    } catch (error) {
      setErrors({ address: error.message })
      setSaving(false)
    }
  }

  return (
    <div className={styles.newAddress}>
      <TextField id="address-label" label="Name" optional hint="For example Home or Work" value={values.label} onChange={set('label')} />
      <TextField id="address-street" label="Street and building" value={values.address} onChange={set('address')} error={errors.address} autoComplete="street-address" />
      <TextField id="address-city" as="select" label="City" value={values.city} onChange={set('city')} error={errors.city}>
        <option value="">Choose a city</option>
        {CITIES.map((city) => (
          <option key={city} value={city}>
            {city}
          </option>
        ))}
      </TextField>
      <Button variant="secondary" loading={saving} onClick={handleSave}>
        Save and use this address
      </Button>
    </div>
  )
}

// --- Step 2: payment, per shop ---------------------------------------------------------------------

export function PaymentStep({ view, choices, errors, onChange }) {
  return (
    <div className={styles.stack}>
      <p className={styles.intro}>Pay each shop with a method it accepts.</p>
      {view.groups.map((group) => {
        const choice = choiceFor(group, choices)
        const name = `payment-${group.shop.id}`
        return (
          <ShopStepCard key={group.shop.id} group={group}>
            <fieldset className={styles.fieldset}>
              <legend className={styles.legend}>Payment method</legend>
              <div className={styles.choices}>
                {group.commerce.payments.map((method) => (
                  <ChoiceCard
                    key={method}
                    name={name}
                    value={method}
                    checked={choice.payment === method}
                    onChange={(payment) => onChange(group.shop.id, { payment })}
                    title={paymentLabel(method, choice.method)}
                  >
                    <span className={styles.muted}>
                      {method === PAYMENT_METHODS.CARD
                        ? 'Pay online, securely'
                        : choice.method === PICKUP
                          ? 'Pay the shop when you collect your parts'
                          : 'Pay the courier when your parts arrive'}
                    </span>
                  </ChoiceCard>
                ))}
              </div>
            </fieldset>

            {choice.payment === PAYMENT_METHODS.CARD && <CardPaymentPlaceholder />}
            {errors[group.shop.id] && (
              <p className={styles.error} role="alert">
                {errors[group.shop.id]}
              </p>
            )}
          </ShopStepCard>
        )
      })}
    </div>
  )
}

// TODO: replace with the payment provider's hosted checkout. Card details are entered on the
// provider's page and never reach MOTEXA, so there are deliberately no card fields here.
function CardPaymentPlaceholder() {
  return (
    <div className={styles.cardPlaceholder} role="note">
      <Badge tone="info">Placeholder</Badge>
      <p className={styles.placeholderTitle}>Secure card payment will open here</p>
      <p className={styles.muted}>
        You&apos;ll pay on our payment provider&apos;s secure page. MOTEXA never sees or stores your card number.
      </p>
    </div>
  )
}

// --- Step 3 (mechanics only): link to a service request ------------------------------------------

export function ServiceRequestStep({ requests, value, onChange, workshop, view }) {
  const chosen = requests.find((request) => request.id === value)
  // Shops that can't deliver to the workshop: the buyer has to pick another option for them.
  const notAtWorkshop = chosen && workshop ? view.groups.filter((group) => addressProblem(group.commerce, workshop)) : []

  return (
    <div className={styles.stack}>
      <p className={styles.intro}>Buying parts for a job? Link the purchase to the service request.</p>
      <Card flat className={styles.shopCard}>
        <TextField
          id="service-request"
          as="select"
          label="This purchase is for a service request"
          optional
          hint="The parts will show in that request's “parts used” and in its final report."
          value={value}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">Not for a service request</option>
          {requests.map((request) => (
            <option key={request.id} value={request.id}>
              {request.id} · {request.sender.name} · {request.details.car ? `${request.details.car.make} ${request.details.car.model}` : 'Online consultation'}
            </option>
          ))}
        </TextField>
        {requests.length === 0 && <p className={styles.muted}>You have no active service requests right now.</p>}
        {chosen && (
          <p className={styles.requestSummary}>
            <strong>{chosen.details.problem}</strong>
            <span className={styles.muted}> · received {formatDateTime(chosen.createdAt)}</span>
          </p>
        )}
      </Card>
      {chosen && workshop && (
        <Notice tone="info" title="Delivery set to your workshop">
          {workshop.address}, {workshop.city}.
          {notAtWorkshop.length > 0 && ` ${notAtWorkshop.map((g) => g.shop.name).join(', ')} can't deliver there, so choose another option for ${notAtWorkshop.length === 1 ? 'it' : 'them'} on the Delivery step.`}
        </Notice>
      )}
      {chosen && !workshop && (
        <Notice tone="warning">Add your workshop address on your profile to have parts delivered there by default.</Notice>
      )}
    </div>
  )
}

// --- Step 4: review ---------------------------------------------------------------------------------

export function ReviewStep({ view, choices, addresses, request, error, placing, onPlace }) {
  const fees = view.groups.reduce((sum, group) => sum + feeFor(group, choiceFor(group, choices)), 0)
  const grandTotal = view.subtotalIls + fees
  const blocked = view.changes.length > 0

  return (
    <div className={styles.stack}>
      <p className={styles.intro}>
        Check everything before you order. This creates {view.groups.length} {view.groups.length === 1 ? 'order' : 'orders'}, one per shop.
      </p>

      <CartChangesNotice changes={view.changes} />

      {request && (
        <Notice tone="info">
          For service request <strong>{request.id}</strong> ({request.sender.name}). The parts will be added to it.
        </Notice>
      )}

      {view.groups.map((group) => {
        const choice = choiceFor(group, choices)
        const fee = feeFor(group, choice)
        const address = findAddress(addresses, choice.addressId)
        return (
          <ShopStepCard key={group.shop.id} group={group}>
            <ul className={styles.items}>
              {group.lines.map(({ part, quantity, lineTotalIls }) => (
                <li key={part.id}>
                  <span>
                    {quantity} × {part.name}
                  </span>
                  <span>{formatPrice(lineTotalIls)}</span>
                </li>
              ))}
            </ul>
            <dl className={styles.facts}>
              <div>
                <dt>{choice.method === DELIVERY ? 'Delivery to' : 'Pickup at'}</dt>
                <dd>
                  {choice.method === DELIVERY
                    ? address && `${address.address}, ${address.city}`
                    : `${group.commerce.pickup.address} (${group.commerce.pickup.hours})`}
                </dd>
              </div>
              <div>
                <dt>Payment</dt>
                <dd>{paymentLabel(choice.payment, choice.method)}</dd>
              </div>
            </dl>
            <dl className={styles.totals}>
              <div>
                <dt>Items</dt>
                <dd>{formatPrice(group.subtotalIls)}</dd>
              </div>
              <div>
                <dt>{choice.method === DELIVERY ? 'Delivery fee' : 'Pickup'}</dt>
                <dd>{fee === 0 ? 'Free' : formatPrice(fee)}</dd>
              </div>
              <div className={styles.totalRow}>
                <dt>Order total</dt>
                <dd>{formatPrice(group.subtotalIls + fee)}</dd>
              </div>
            </dl>
          </ShopStepCard>
        )
      })}

      <Card elevated className={styles.grand}>
        <div className={styles.grandRow}>
          <span>Grand total</span>
          <strong className={styles.grandAmount}>{formatPrice(grandTotal)}</strong>
        </div>
        {error && <Notice tone="danger">{error}</Notice>}
        <Button size="lg" fullWidth loading={placing} disabled={blocked} onClick={onPlace}>
          Place order
        </Button>
        {blocked && <p className={styles.muted}>Accept the changes above to place your order.</p>}
      </Card>
    </div>
  )
}
