import { REQUEST_TYPES } from '../constants.js'
import PartQuestionForm from './PartQuestionForm.jsx'
import RequestAction from './RequestAction.jsx'
import ServiceRequestForm from './ServiceRequestForm.jsx'
import TowRequestForm from './TowRequestForm.jsx'

// Ready-made request buttons for the public pages. Each hides itself for roles that can't use it
// and sends logged-out visitors to log in first (see RequestAction).

/** "Request service" on a mechanic's profile. Customers only. */
export function RequestServiceButton({ mechanic, className, variant = 'primary' }) {
  return (
    <RequestAction
      type={REQUEST_TYPES.SERVICE}
      label="Request service"
      title={`Request service from ${mechanic.workshopName}`}
      variant={variant}
      className={className}
      renderForm={(props) => <ServiceRequestForm mechanic={mechanic} {...props} />}
    />
  )
}

/** "Request tow" on a tow company's profile. Customers only. */
export function RequestTowButton({ company, pickupPosition = null, className, variant = 'primary' }) {
  return (
    <RequestAction
      type={REQUEST_TYPES.TOW}
      label="Request tow"
      title={`Request a tow from ${company.name}`}
      variant={variant}
      className={className}
      renderForm={(props) => <TowRequestForm company={company} pickupPosition={pickupPosition} {...props} />}
    />
  )
}

/** "Ask about this part" on a part card. Customers and mechanics. */
export function AskAboutPartButton({ part, shop, className }) {
  if (!shop) return null
  return (
    <RequestAction
      type={REQUEST_TYPES.PART_QUESTION}
      label="Ask about this part"
      title="Ask the shop about this part"
      variant="secondary"
      className={className}
      renderForm={(props) => <PartQuestionForm part={part} shop={shop} {...props} />}
    />
  )
}
