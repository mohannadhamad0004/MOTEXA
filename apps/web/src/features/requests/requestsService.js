// TODO: replace with real API calls
//
// Requests from customers and mechanics to a mechanic (service), a tow company (tow) or a parts
// shop (question about a part), and their end: the provider marks a request completed with the
// final details, which become the customer's report (/reports) and the car's maintenance history.
// Every function returns a Promise, like the real API will. Chats (chatService.js) and reviews
// (reviewsService.js) are attached to requests.
//
// For now requests live in React state inside RequestsProvider, which passes a small store
// ({ read, write }) plus the auth and marketplace services (to know who is sending, and to check
// the target exists). Components get the service with useRequestsService(). Memory only - a page
// reload clears every request. Attached files stay as File objects; nothing is uploaded.

import { ACCOUNT_STATUS } from '../../auth/constants.js'
import { SERVICE_MODES, serviceModeLabel } from '../../auth/signup/constants.js'
import { PERMISSIONS } from '../../authorization/permissions.js'
import { ROLES } from '../../authorization/roles.js'
import { deepCopy } from '../../utils/deepCopy.js'
import { REPORT_TYPES, REQUEST_PERMISSIONS, REQUEST_STATUS, REQUEST_TYPES } from './constants.js'

/** @typedef {import('./types.js').Request} Request */

// Thrown for problems the user can fix. `field` names the form field it belongs to, if any.
export class RequestError extends Error {
  constructor(message, field = null) {
    super(message)
    this.name = 'RequestError'
    this.field = field
  }
}

const isBlank = (value) => !String(value ?? '').trim()

// "r-7" -> next id "r-8"
function nextRequestId(requests) {
  const max = requests.reduce((highest, request) => Math.max(highest, Number(request.id.slice(2)) || 0), 0)
  return `r-${max + 1}`
}

// The api repeats these checks; the forms check the same things first for quick feedback.
function validateDetails(type, data) {
  if (type === REQUEST_TYPES.SERVICE) {
    if (!SERVICE_MODES.some((mode) => mode.value === data.mode)) {
      throw new RequestError('Choose how you want the service.', 'mode')
    }
    if (data.mode === 'on_site' && isBlank(data.location)) {
      throw new RequestError('Enter where the car is, so the mechanic can come to you.', 'location')
    }
    if (data.mode === 'workshop') {
      const preferred = new Date(data.preferredAt ?? '')
      if (Number.isNaN(preferred.getTime())) throw new RequestError('Choose a date and time.', 'preferredDate')
      if (preferred < new Date()) throw new RequestError('Choose a date and time in the future.', 'preferredDate')
    }
    // Online consultations are advice through chat: no car details needed.
    if (data.mode !== 'online' && (isBlank(data.car?.make) || isBlank(data.car?.model))) {
      throw new RequestError('Tell us which car it is.', 'make')
    }
    if (isBlank(data.problem)) throw new RequestError('Describe the problem.', 'problem')
  }
  if (type === REQUEST_TYPES.TOW) {
    if (isBlank(data.pickup)) throw new RequestError('Enter the pickup location.', 'pickup')
    if (isBlank(data.destination)) throw new RequestError('Enter the destination.', 'destination')
    const spot = data.pickupPosition
    if (spot && !(Math.abs(spot.lat) <= 90 && Math.abs(spot.lng) <= 180)) {
      throw new RequestError('The pin on the map is not a valid location.', 'pickup')
    }
    if (isBlank(data.car?.make) || isBlank(data.car?.model)) throw new RequestError('Tell us which car it is.', 'make')
  }
  if (type === REQUEST_TYPES.PART_QUESTION) {
    if (isBlank(data.message)) throw new RequestError('Write your message to the shop.', 'message')
    if (!Number.isInteger(data.quantity) || data.quantity < 1) {
      throw new RequestError('Enter a quantity of 1 or more.', 'quantity')
    }
  }
}

/**
 * @param {{ read: () => { requests: Request[] }, write: (next: { requests: Request[] }) => void }} store
 * @param {{ auth: Object, marketplace: Object }} services  auth and marketplace services
 */
export function createRequestsService(store, { auth, marketplace }) {
  // Who the request goes to, as { id, type, name }. Rejects unknown or unapproved targets.
  async function findTarget(type, targetId, data) {
    if (type === REQUEST_TYPES.SERVICE) {
      const mechanic = await auth.getDirectoryEntry(ROLES.MECHANIC, targetId)
      if (!mechanic) throw new RequestError('This mechanic is not available on MOTEXA.')
      if (!mechanic.serviceModes.includes(data.mode)) {
        throw new RequestError(`${mechanic.workshopName} doesn't offer ${serviceModeLabel(data.mode)}.`, 'mode')
      }
      return { id: mechanic.id, type: ROLES.MECHANIC, name: mechanic.workshopName }
    }
    if (type === REQUEST_TYPES.TOW) {
      const company = await auth.getDirectoryEntry(ROLES.TOW, targetId)
      if (!company) throw new RequestError('This tow company is not available on MOTEXA.')
      return { id: company.id, type: ROLES.TOW, name: company.name }
    }
    // Part question: the target is the shop; the part must be one of that shop's parts.
    const [shop, shopParts] = await Promise.all([
      marketplace.getShopById(targetId),
      marketplace.getPartsByShop(targetId),
    ])
    const part = shopParts.find((p) => p.id === data.partId)
    if (!shop || !part) throw new RequestError('This part is no longer listed.')
    return { id: shop.id, type: ROLES.PARTS_SHOP, name: shop.name, partName: part.name }
  }

  /**
   * @param {'service' | 'tow' | 'part_question'} type
   * @param {string} targetId  mechanic id, tow company id, or shop id (part_question)
   * @param {Object} data      service: { mode, location?, preferredAt?, car, problem, media } - the mode
   *                           must be one the mechanic offers; tow: { pickup, destination, car, note };
   *                           part_question: { partId, message, quantity }
   * @returns {Promise<Request>}
   */
  async function createRequest(type, targetId, data) {
    const permission = REQUEST_PERMISSIONS[type]
    if (!permission) throw new RequestError(`Unknown request type: ${type}`)

    const user = await auth.getCurrentUser()
    if (!user) throw new RequestError('Log in to send a request.')
    if (user.status !== ACCOUNT_STATUS.APPROVED || !PERMISSIONS[user.role]?.includes(permission)) {
      throw new RequestError("Your account can't send this kind of request.")
    }

    validateDetails(type, data)
    const target = await findTarget(type, targetId, data)

    const details = deepCopy(data)
    // An attached AI report is a copy of the report; the original photo/video/sound isn't sent.
    if (details.diagnosis) {
      delete details.diagnosis.file
      delete details.diagnosis.userId
    }

    const current = store.read()
    const request = {
      id: nextRequestId(current.requests),
      type,
      status: REQUEST_STATUS.PENDING,
      createdAt: new Date().toISOString(),
      sender: { id: user.id, role: user.role, name: user.name },
      target,
      details,
    }
    store.write({ ...current, requests: [...current.requests, request] })
    return deepCopy(request)
  }

  const newestFirst = (a, b) => b.createdAt.localeCompare(a.createdAt)

  /** @returns {Promise<Request[]>} requests the logged-in user sent, newest first */
  async function getMyRequests() {
    const user = await auth.getCurrentUser()
    if (!user) throw new RequestError('Log in to see your requests.')
    return deepCopy(
      store
        .read()
        .requests.filter((request) => request.sender.id === user.id)
        .sort(newestFirst),
    )
  }

  /**
   * One request, for the customer who sent it or the mechanic / company / shop it went to.
   * @returns {Promise<Request | null>} null when it doesn't exist or isn't theirs
   */
  async function getRequest(requestId) {
    const user = await auth.getCurrentUser()
    const request = store.read().requests.find((r) => r.id === requestId)
    if (!user || !request || (request.sender.id !== user.id && request.target.id !== user.id)) return null
    return deepCopy(request)
  }

  /**
   * Completed service and tow requests the logged-in user sent: their final reports (/reports).
   * @returns {Promise<Request[]>} newest completion first
   */
  async function getMyReports() {
    const user = await auth.getCurrentUser()
    if (!user) throw new RequestError('Log in to see your reports.')
    return deepCopy(
      store
        .read()
        .requests.filter(
          (r) => r.sender.id === user.id && r.status === REQUEST_STATUS.COMPLETED && REPORT_TYPES.includes(r.type),
        )
        .sort((a, b) => b.completion.completedAt.localeCompare(a.completion.completedAt)),
    )
  }

  /**
   * The maintenance history of one of the customer's cars: completed service requests for it.
   * @returns {Promise<Request[]>} newest first
   */
  async function getCarHistory(carId) {
    const user = await auth.getCurrentUser()
    if (!user) throw new RequestError('Log in to see your car history.')
    return deepCopy(
      store
        .read()
        .requests.filter(
          (r) =>
            r.sender.id === user.id &&
            r.type === REQUEST_TYPES.SERVICE &&
            r.status === REQUEST_STATUS.COMPLETED &&
            r.details.carId === carId,
        )
        .sort((a, b) => b.completion.completedAt.localeCompare(a.completion.completedAt)),
    )
  }

  /**
   * Marks a request completed with the final details. Only the mechanic, tow company or shop the
   * request went to can do this, once (a tow needs "Arrived" first). The sender then confirms it
   * (confirmCompleted) and can review the provider.
   * @param {string} requestId
   * @param {Object} data  service: { confirmedDiagnosis, workDone, partsUsed: [{ name, quantity, priceIls }],
   *                       laborIls }; tow: { truckId, totalIls }; part_question: { note?, totalIls? }
   * @returns {Promise<Request>}
   */
  async function completeRequest(requestId, data) {
    const user = await auth.getCurrentUser()
    const request = store.read().requests.find((r) => r.id === requestId)
    if (!user || !request || request.target.id !== user.id) {
      throw new RequestError('Only the mechanic, company or shop that got this request can complete it.')
    }
    if (request.status === REQUEST_STATUS.COMPLETED) throw new RequestError('This request is already completed.')
    if (request.type === REQUEST_TYPES.TOW && !request.arrivedAt) throw new RequestError('Mark "Arrived" before completing a tow.')

    const completion = { completedAt: new Date().toISOString(), ...checkCompletion(request.type, data, user) }
    addPurchasedParts(completion, request)
    const changes = { status: REQUEST_STATUS.COMPLETED, completion }
    if (completion.truck) changes.assignedTruckId = completion.truck.id

    const current = store.read()
    const updated = { ...request, ...changes }
    store.write({ ...current, requests: current.requests.map((r) => (r.id === requestId ? updated : r)) })
    return deepCopy(updated)
  }

  // --- Arrival, and the sender's confirmation (reviews open after it) --------------------------

  const saveRequest = (updated) => {
    const current = store.read()
    store.write({ ...current, requests: current.requests.map((r) => (r.id === updated.id ? updated : r)) })
    return deepCopy(updated)
  }

  /** Tow company: the truck arrived at the pickup. Needed before the tow can be completed. @returns {Promise<Request>} */
  async function markArrived(requestId) {
    const user = await auth.getCurrentUser()
    const request = store.read().requests.find((r) => r.id === requestId)
    if (!user || !request || request.target.id !== user.id || request.type !== REQUEST_TYPES.TOW) {
      throw new RequestError('Only the tow company that got this request can mark it as arrived.')
    }
    if (request.status === REQUEST_STATUS.COMPLETED || request.arrivedAt) throw new RequestError('Already marked as arrived.')
    return saveRequest({ ...request, status: REQUEST_STATUS.IN_PROGRESS, arrivedAt: new Date().toISOString() })
  }

  // The sender (the customer, or the mechanic for a part question) of a request the provider completed.
  function findUnconfirmed(requestId, user) {
    const request = store.read().requests.find((r) => r.id === requestId)
    if (!user || !request || request.sender.id !== user.id) throw new RequestError('Only the sender of this request can confirm it.')
    if (request.status !== REQUEST_STATUS.COMPLETED) throw new RequestError('The provider has not marked this request as completed yet.')
    if (request.customerConfirmedAt || request.disputedAt) throw new RequestError('You already answered for this request.')
    return request
  }

  /** The sender confirms the work was done: stores customerConfirmedAt and opens reviews. @returns {Promise<Request>} */
  async function confirmCompleted(requestId) {
    const request = findUnconfirmed(requestId, await auth.getCurrentUser())
    return saveRequest({ ...request, customerConfirmedAt: new Date().toISOString() })
  }

  /** "This didn't happen": stores disputedAt and flags the request for the admins. No review is possible. @returns {Promise<Request>} */
  async function disputeCompleted(requestId) {
    const request = findUnconfirmed(requestId, await auth.getCurrentUser())
    return saveRequest({ ...request, disputedAt: new Date().toISOString() })
  }

  /**
   * What the logged-in mechanic, tow company or shop has to do: requests sent to them that are not
   * completed, or completed and still waiting for the sender to answer. Newest first.
   * @returns {Promise<Request[]>}
   */
  async function getIncomingRequests() {
    const user = await auth.getCurrentUser()
    if (!user) throw new RequestError('Log in to see your requests.')
    return deepCopy(
      store
        .read()
        .requests.filter(
          (r) => r.target.id === user.id && (r.status !== REQUEST_STATUS.COMPLETED || !(r.customerConfirmedAt || r.disputedAt)),
        )
        .sort(newestFirst),
    )
  }

  // --- Parts bought through MOTEXA for a service request (features/marketplace orders) ----------

  /**
   * The service requests the logged-in mechanic is working on (not completed yet): the ones a parts
   * purchase can be linked to.
   * @returns {Promise<Request[]>} newest first
   */
  async function getActiveServiceRequests() {
    const user = await auth.getCurrentUser()
    if (!user) throw new RequestError('Log in to see your requests.')
    return deepCopy(
      store
        .read()
        .requests.filter(
          (r) => r.target.id === user.id && r.type === REQUEST_TYPES.SERVICE && r.status !== REQUEST_STATUS.COMPLETED,
        )
        .sort(newestFirst),
    )
  }

  /**
   * Records the parts of placed orders on a service request (request.purchasedParts), so they show in
   * the request, pre-fill "parts used" when the mechanic completes it, and end up in the final
   * report. Only the mechanic the request went to can do this.
   * @param {string} requestId
   * @param {import('../marketplace/ordersService.js').Order[]} orders
   * @returns {Promise<void>}
   */
  async function attachPurchasedParts(requestId, orders) {
    const user = await auth.getCurrentUser()
    const request = store.read().requests.find((r) => r.id === requestId)
    if (!user || !request || request.target.id !== user.id || request.type !== REQUEST_TYPES.SERVICE) {
      throw new RequestError('Only the mechanic this service request went to can add parts to it.')
    }
    if (request.status === REQUEST_STATUS.COMPLETED) throw new RequestError('This request is already completed.')

    const added = orders.flatMap((order) =>
      order.items.map((item) => ({
        orderId: order.id,
        checkoutNumber: order.checkoutNumber,
        shopName: order.shopName,
        name: item.name,
        quantity: item.quantity,
        priceIls: item.priceIls,
      })),
    )
    const current = store.read()
    const updated = { ...request, purchasedParts: [...(request.purchasedParts ?? []), ...added] }
    store.write({ ...current, requests: current.requests.map((r) => (r.id === requestId ? updated : r)) })
  }

  /** Takes a cancelled order's parts off the request again. @returns {Promise<void>} */
  async function removePurchasedParts(requestId, orderId) {
    const current = store.read()
    const request = current.requests.find((r) => r.id === requestId)
    if (!request?.purchasedParts) return
    const updated = { ...request, purchasedParts: request.purchasedParts.filter((part) => part.orderId !== orderId) }
    store.write({ ...current, requests: current.requests.map((r) => (r.id === requestId ? updated : r)) })
  }

  return {
    createRequest,
    getMyRequests,
    getRequest,
    getMyReports,
    getCarHistory,
    completeRequest,
    markArrived,
    confirmCompleted,
    disputeCompleted,
    getIncomingRequests,
    getActiveServiceRequests,
    attachPurchasedParts,
    removePurchasedParts,
  }
}

// Parts the mechanic bought through MOTEXA for this request always end up in the final report,
// even if the row was removed from the completion form: they are added (and counted in the total)
// unless a "parts used" row with the same name is already there.
function addPurchasedParts(completion, request) {
  if (request.type !== REQUEST_TYPES.SERVICE || !request.purchasedParts?.length) return
  const names = new Set(completion.partsUsed.map((part) => part.name.toLowerCase()))
  for (const { name, quantity, priceIls } of request.purchasedParts) {
    if (names.has(name.toLowerCase())) continue
    completion.partsUsed.push({ name, quantity, priceIls })
    completion.totalIls += quantity * priceIls
  }
}

const isAmount = (value) => value !== '' && value !== null && Number.isFinite(Number(value)) && Number(value) >= 0

// The completion details for each request type, checked and cleaned. `user` is the provider.
function checkCompletion(type, data, user) {
  if (type === REQUEST_TYPES.SERVICE) {
    if (isBlank(data.confirmedDiagnosis)) throw new RequestError('Write the diagnosis you confirmed.', 'confirmedDiagnosis')
    if (isBlank(data.workDone)) throw new RequestError('Describe the work you did.', 'workDone')
    const partsUsed = (data.partsUsed ?? []).map((part, i) => {
      if (isBlank(part.name)) throw new RequestError('Name every part, or remove the empty row.', `parts.${i}.name`)
      const quantity = Number(part.quantity)
      if (!Number.isInteger(quantity) || quantity < 1) throw new RequestError('Enter a quantity of 1 or more.', `parts.${i}.quantity`)
      if (!isAmount(part.priceIls)) throw new RequestError('Enter the price in ₪.', `parts.${i}.priceIls`)
      return { name: part.name.trim(), quantity, priceIls: Number(part.priceIls) }
    })
    if (!isAmount(data.laborIls)) throw new RequestError('Enter the labor cost in ₪ (0 if none).', 'laborIls')
    const laborIls = Number(data.laborIls)
    const partsTotal = partsUsed.reduce((sum, part) => sum + part.quantity * part.priceIls, 0)
    return {
      confirmedDiagnosis: data.confirmedDiagnosis.trim(),
      workDone: data.workDone.trim(),
      partsUsed,
      laborIls,
      totalIls: partsTotal + laborIls,
    }
  }

  if (type === REQUEST_TYPES.TOW) {
    const truck = (user.trucks ?? []).find((t) => t.id === data.truckId && t.reviewStatus === 'approved')
    if (!truck) throw new RequestError('Choose the truck that did the job.', 'truckId')
    if (!isAmount(data.totalIls)) throw new RequestError('Enter the cost in ₪.', 'totalIls')
    return {
      truck: { id: truck.id, plateNumber: truck.plateNumber, type: truck.type },
      totalIls: Number(data.totalIls),
    }
  }

  // Part question: the sale or pickup is done.
  if (data.totalIls !== undefined && data.totalIls !== '' && !isAmount(data.totalIls)) {
    throw new RequestError('Enter the amount in ₪, or leave it empty.', 'totalIls')
  }
  return {
    note: String(data.note ?? '').trim(),
    ...(data.totalIls !== undefined && data.totalIls !== '' && { totalIls: Number(data.totalIls) }),
  }
}
