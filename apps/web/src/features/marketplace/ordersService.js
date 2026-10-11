// TODO: replace with real API calls
//
// Checkout and orders for parts. Every function returns a Promise, like the real API will. Only
// customers and mechanics can buy; the api must check that, and that an order belongs to the
// logged-in user, the same way.
//
// One checkout creates ONE ORDER PER SHOP (each shop confirms, prepares and delivers its own
// parts), all sharing one checkout number. Placing an order re-checks stock and prices against the
// marketplace; if anything changed since the buyer added it to the cart, it refuses with
// OrderError code 'changed' until the buyer accepts the changes (cartService.acceptChanges).
//
// Card payments: card details never touch MOTEXA. The real flow redirects to the payment
// provider's hosted checkout and the provider tells our api when the payment went through. The
// mock marks card orders as paid right away and shows a placeholder where the hosted page opens.
//
// Mechanics can link an order to one of their active service requests: the parts then appear in
// that request's "parts used" and in its final report (requestsService.attachPurchasedParts).
//
// Order statuses (orderConstants.js): placed -> confirmed -> preparing -> out for delivery / ready
// for pickup -> delivered / picked up -> completed, or cancelled. The buyer can cancel only while
// the order is still "placed". The shop confirms or rejects it (rejecting needs a reason), then moves
// it along step by step, and marks cash orders as paid when the money is received (a cash order
// can't be completed before that). An admin can cancel any order that isn't finished, with a reason.
//
// Ownership: a shop reads and changes only its own orders (order.shopId === the logged-in shop),
// the same rule as parts. A buyer reads only their own. The api must enforce both.
//
// Stock (order.stockState): reserved when the order is placed (buyers can no longer order those
// units), deducted when the shop confirms, released if the order is cancelled or rejected before
// that, returned to the shelf if it is cancelled after (marketplaceService.adjustStock).
//
// Notifications (notificationsService.js): the buyer hears about every status change, the shop about
// new and cancelled orders.
//
// Mock: orders live in OrdersProvider's React state (memory only, reset on refresh).

import { ACCOUNT_STATUS } from '../../auth/constants.js'
import { PERMISSIONS } from '../../authorization/permissions.js'
import { ROLES } from '../../authorization/roles.js'
import { BUY_PERMISSION } from './cartService.js'
import { ORDER_FLOWS, ORDER_STATUS, orderStatusBadge } from './orderConstants.js'
import { deliveryFee, FULFILLMENT_METHODS, PAYMENT_METHODS } from './shopCommerce.js'

/**
 * @typedef {Object} OrderItem   a snapshot of the part when the order was placed
 * @property {string} partId
 * @property {string} name
 * @property {string} partNumber
 * @property {string} brand
 * @property {number} priceIls
 * @property {number} quantity
 */

/**
 * @typedef {Object} Order   one shop's part of a checkout
 * @property {string} id
 * @property {string} checkoutId
 * @property {string} checkoutNumber      shared by every order of the same checkout, e.g. "FF-10002"
 * @property {string} buyerId
 * @property {'customer' | 'mechanic'} buyerRole
 * @property {string} buyerName
 * @property {string} shopId
 * @property {string} shopName
 * @property {string} createdAt            ISO date
 * @property {string} status               ORDER_STATUS
 * @property {OrderItem[]} items
 * @property {{ method: 'delivery', address: DeliveryAddress, feeIls: number }
 *          | { method: 'pickup', address: string, hours: string, mapUrl: string }} fulfillment
 * @property {number} subtotalIls
 * @property {number} deliveryFeeIls
 * @property {number} totalIls
 * @property {{ method: 'cash' | 'card', status: 'unpaid' | 'paid' | 'refunded' }} payment
 * @property {string | null} serviceRequestId   mechanics: the service request the parts are for
 * @property {string | null} chatRequestId      the request (and chat) used to talk to the shop
 * @property {{ status: string, at: string }[]} timeline
 * @property {{ reason: string, at: string, by: 'buyer' | 'shop' | 'admin' } | null} cancellation
 *   by 'shop' means the shop rejected it
 * @property {'reserved' | 'deducted' | 'released' | 'returned'} stockState
 *   reserved: held for the buyer, not yet taken off the shelf · deducted: the shop confirmed ·
 *   released: cancelled before confirming · returned: cancelled after confirming
 */

/**
 * @typedef {Object} DeliveryAddress
 * @property {string} label
 * @property {string} address   street and details
 * @property {string} city
 */

export class OrderError extends Error {
  /** @param {string} code  'changed': stock or prices changed, ask the buyer to confirm */
  constructor(message, code = null) {
    super(message)
    this.name = 'OrderError'
    this.code = code
  }
}

const copy = (value) => structuredClone(value)
const isBlank = (value) => !String(value ?? '').trim()
const newestFirst = (a, b) => b.createdAt.localeCompare(a.createdAt)

const highestNumber = (items, prefix) =>
  items.reduce((max, item) => Math.max(max, Number(String(item.id).slice(prefix.length)) || 0), 0)

/**
 * @param {{ read: () => { orders: Order[], addresses: Object<string, (DeliveryAddress & { id: string })[]> },
 *           write: (next: Object) => void }} store
 * @param {{ auth: Object, marketplace: Object, requests: Object, cart: Object, notifications: Object }} services
 */
export function createOrdersService(store, { auth, marketplace, requests, cart, notifications }) {
  async function requireBuyer() {
    const user = await auth.getCurrentUser()
    if (!user) throw new OrderError('Log in to see your orders.')
    if (user.status !== ACCOUNT_STATUS.APPROVED || !PERMISSIONS[user.role]?.includes(BUY_PERMISSION)) {
      throw new OrderError('Only customers and mechanics can buy parts.')
    }
    return user
  }

  // An approved parts shop. Every shop-side call then looks orders up with findShopOrder, so a shop
  // can never read or change another shop's order.
  async function requireShop() {
    const user = await auth.getCurrentUser()
    if (!user || user.role !== ROLES.PARTS_SHOP || user.status !== ACCOUNT_STATUS.APPROVED) {
      throw new OrderError('Only parts shops can manage shop orders.')
    }
    return user
  }

  async function requireAdmin() {
    const user = await auth.getCurrentUser()
    if (!user || user.role !== ROLES.ADMIN || user.status !== ACCOUNT_STATUS.APPROVED) {
      throw new OrderError('Only admins can do this.')
    }
    return user
  }

  const findOwn = (orderId, user) =>
    store.read().orders.find((order) => order.id === orderId && order.buyerId === user.id) ?? null

  const findShopOrder = (orderId, shop) => {
    const order = store.read().orders.find((o) => o.id === orderId) ?? null
    if (order && order.shopId !== shop.id) throw new OrderError('You can only manage your own shop’s orders.')
    return order
  }

  function replaceOrder(updated) {
    const current = store.read()
    store.write({ ...current, orders: current.orders.map((order) => (order.id === updated.id ? updated : order)) })
  }

  const statusLabel = (status) => orderStatusBadge(status).label
  const withStep = (order, status, extra = {}) => ({
    ...order,
    ...extra,
    status,
    timeline: [...order.timeline, { status, at: new Date().toISOString() }],
  })

  // Stock moves for an order's items (see marketplaceService.adjustStock).
  const stockMoves = (order, kind) =>
    order.items.map(({ partId, quantity }) => ({
      partId,
      ...(kind === 'deduct' && { stockDelta: -quantity, reservedDelta: -quantity }),
      ...(kind === 'release' && { reservedDelta: -quantity }),
      ...(kind === 'return' && { stockDelta: quantity }),
    }))

  // Cancels an order for any reason: puts the stock back (released if the shop hadn't confirmed,
  // returned if it had), refunds a payment already taken, takes the parts off the mechanic's
  // service request and tells the other side. `by`: who cancelled.
  async function cancelInternal(order, { by, reason }) {
    const next = order.stockState === 'reserved' ? 'released' : order.stockState === 'deducted' ? 'returned' : order.stockState
    if (next !== order.stockState) {
      await marketplace.adjustStock(stockMoves(order, next === 'released' ? 'release' : 'return'), { lenient: true })
    }
    const updated = withStep(order, ORDER_STATUS.CANCELLED, {
      stockState: next,
      cancellation: { reason, at: new Date().toISOString(), by },
      payment: { ...order.payment, status: order.payment.status === 'paid' ? 'refunded' : order.payment.status },
    })
    replaceOrder(updated)
    if (order.serviceRequestId) await requests.removePurchasedParts(order.serviceRequestId, order.id)

    const refund = updated.payment.status === 'refunded' ? ' Your payment is being refunded.' : ''
    if (by !== 'buyer') {
      notifications.notify(order.buyerId, {
        title: by === 'shop' ? 'Order rejected' : 'Order cancelled by MOTEXA',
        body: `${order.shopName} · ${order.checkoutNumber}: ${reason}.${refund}`,
        link: `/orders/${order.id}`,
      })
    }
    if (by !== 'shop') {
      notifications.notify(order.shopId, {
        title: 'Order cancelled',
        body: `${order.buyerName} · ${order.checkoutNumber} (${order.id}): ${reason}`,
        link: `/parts-shop/orders/${order.id}`,
      })
    }
    return updated
  }

  // Tells the buyer their order moved to a new status.
  const tellBuyer = (order, title, body) =>
    notifications.notify(order.buyerId, { title, body: `${order.shopName} · ${order.checkoutNumber}. ${body}`, link: `/orders/${order.id}` })

  // --- Checkout --------------------------------------------------------------------------------

  /**
   * What the checkout steps need besides the cart: the buyer's saved delivery addresses (a
   * mechanic's workshop first), and for mechanics their active service requests.
   * @returns {Promise<{ addresses: (DeliveryAddress & { id: string })[], workshop: (DeliveryAddress & { id: string }) | null,
   *   serviceRequests: import('../requests/types.js').Request[] }>}
   */
  async function getCheckoutOptions() {
    const user = await requireBuyer()
    const saved = store.read().addresses[user.id] ?? []
    const isMechanic = user.role === ROLES.MECHANIC
    const workshop =
      isMechanic && user.address && user.city
        ? { id: 'workshop', label: `Workshop${user.workshopName ? `: ${user.workshopName}` : ''}`, address: user.address, city: user.city }
        : null
    return copy({
      addresses: workshop ? [workshop, ...saved] : saved,
      workshop,
      serviceRequests: isMechanic ? await requests.getActiveServiceRequests() : [],
    })
  }

  /** Saves a delivery address for next time. @returns {Promise<DeliveryAddress & { id: string }>} */
  async function addAddress({ label, address, city }) {
    const user = await requireBuyer()
    if (isBlank(address)) throw new OrderError('Enter the street and building.')
    if (isBlank(city)) throw new OrderError('Choose the city.')
    const current = store.read()
    const mine = current.addresses[user.id] ?? []
    const number = mine.reduce((max, a) => Math.max(max, Number(a.id.slice(2)) || 0), 0) + 1
    const created = { id: `a-${number}`, label: label?.trim() || 'Address', address: address.trim(), city }
    store.write({ ...current, addresses: { ...current.addresses, [user.id]: [...mine, created] } })
    return copy(created)
  }

  /**
   * Places the order(s) for everything in the cart.
   * @param {Object} draft
   * @param {Object<string, { method: 'delivery' | 'pickup', payment: 'cash' | 'card', address?: DeliveryAddress }>} draft.groups
   *   the choice for each shop id in the cart; `address` is required for delivery
   * @param {string | null} [draft.serviceRequestId]  mechanics: link the purchase to a service request
   * @returns {Promise<{ checkoutId: string, checkoutNumber: string, orders: Order[], grandTotalIls: number }>}
   */
  async function placeOrder(draft) {
    const user = await requireBuyer()

    // Stock and prices are re-checked here, not trusted from the checkout page.
    const view = await cart.getCartView()
    if (view.groups.length === 0) throw new OrderError('Your cart is empty.')
    if (view.changes.length > 0) {
      throw new OrderError('Some prices or stock changed since you added these parts. Review the changes first.', 'changed')
    }

    let request = null
    if (draft.serviceRequestId) {
      if (user.role !== ROLES.MECHANIC) throw new OrderError('Only mechanics can link a purchase to a service request.')
      request = (await requests.getActiveServiceRequests()).find((r) => r.id === draft.serviceRequestId)
      if (!request) throw new OrderError('That service request is no longer active.')
    }

    const planned = view.groups.map(({ shop, commerce, lines, subtotalIls }) => {
      const choice = draft.groups?.[shop.id]
      if (!choice) throw new OrderError(`Choose delivery or pickup for ${shop.name}.`)

      let fulfillment
      if (choice.method === FULFILLMENT_METHODS.DELIVERY) {
        if (!commerce.delivery) throw new OrderError(`${shop.name} doesn't deliver.`)
        const address = choice.address
        if (isBlank(address?.address) || isBlank(address?.city)) throw new OrderError(`Enter a delivery address for ${shop.name}.`)
        if (!commerce.delivery.cities.includes(address.city)) {
          throw new OrderError(`${shop.name} doesn't deliver to ${address.city}. It delivers to ${commerce.delivery.cities.join(', ')}.`)
        }
        fulfillment = {
          method: FULFILLMENT_METHODS.DELIVERY,
          address: { label: address.label ?? '', address: address.address.trim(), city: address.city },
          feeIls: deliveryFee(commerce, subtotalIls),
        }
      } else if (choice.method === FULFILLMENT_METHODS.PICKUP) {
        if (!commerce.pickup) throw new OrderError(`${shop.name} doesn't offer pickup.`)
        const { address, hours, mapUrl } = commerce.pickup
        fulfillment = { method: FULFILLMENT_METHODS.PICKUP, address, hours, mapUrl }
      } else {
        throw new OrderError(`Choose delivery or pickup for ${shop.name}.`)
      }

      if (!commerce.payments.includes(choice.payment)) throw new OrderError(`Choose how to pay ${shop.name}.`)
      return { shop, lines, subtotalIls, fulfillment, payment: choice.payment }
    })

    try {
      // Reserve the units: no one else can order them, but they stay on the shelf until the shop confirms.
      await marketplace.adjustStock(planned.flatMap(({ lines }) => lines.map((l) => ({ partId: l.partId, reservedDelta: l.quantity }))))
    } catch {
      throw new OrderError('Some parts just ran out of stock. Review your cart.', 'changed')
    }

    const current = store.read()
    const number = highestNumber(current.orders, 'o-')
    const checkoutNumber = current.orders.reduce((max, o) => Math.max(max, Number(o.checkoutId.slice(3)) || 0), 0) + 1
    const checkoutId = `co-${checkoutNumber}`
    const now = new Date().toISOString()

    /** @type {Order[]} */
    const orders = planned.map(({ shop, lines, subtotalIls, fulfillment, payment }, index) => {
      const deliveryFeeIls = fulfillment.method === FULFILLMENT_METHODS.DELIVERY ? fulfillment.feeIls : 0
      return {
        id: `o-${number + index + 1}`,
        checkoutId,
        checkoutNumber: `FF-${10000 + checkoutNumber}`,
        buyerId: user.id,
        buyerRole: user.role,
        buyerName: user.name,
        shopId: shop.id,
        shopName: shop.name,
        createdAt: now,
        status: ORDER_STATUS.PLACED,
        items: lines.map(({ part, quantity }) => ({
          partId: part.id,
          name: part.name,
          partNumber: part.oemNumber || part.manufacturerNumber,
          brand: part.brand,
          priceIls: part.priceIls,
          quantity,
        })),
        fulfillment,
        subtotalIls,
        deliveryFeeIls,
        totalIls: subtotalIls + deliveryFeeIls,
        // Mock: the hosted card payment succeeds immediately.
        payment: { method: payment, status: payment === PAYMENT_METHODS.CARD ? 'paid' : 'unpaid' },
        serviceRequestId: request?.id ?? null,
        chatRequestId: null,
        timeline: [{ status: ORDER_STATUS.PLACED, at: now }],
        cancellation: null,
        stockState: 'reserved',
      }
    })

    store.write({ ...current, orders: [...current.orders, ...orders] })
    await cart.clear()
    for (const order of orders) {
      const count = order.items.reduce((sum, item) => sum + item.quantity, 0)
      notifications.notify(order.shopId, {
        title: 'New order',
        body: `${order.buyerName} ordered ${count} ${count === 1 ? 'part' : 'parts'} (${order.checkoutNumber}).`,
        link: `/parts-shop/orders/${order.id}`,
      })
    }
    if (request) await requests.attachPurchasedParts(request.id, orders)
    return copy({
      checkoutId,
      checkoutNumber: orders[0].checkoutNumber,
      orders,
      grandTotalIls: orders.reduce((sum, order) => sum + order.totalIls, 0),
    })
  }

  // --- The buyer's orders ----------------------------------------------------------------------

  /** @returns {Promise<Order[]>} the logged-in user's orders, newest first */
  async function getMyOrders() {
    const user = await requireBuyer()
    return copy(store.read().orders.filter((order) => order.buyerId === user.id).sort(newestFirst))
  }

  /** @returns {Promise<Order | null>} null when it doesn't exist or isn't the user's */
  async function getOrder(orderId) {
    const user = await requireBuyer()
    const order = findOwn(orderId, user)
    return order ? copy(order) : null
  }

  /** All orders of one checkout, for the confirmation page. @returns {Promise<{ checkoutNumber: string, orders: Order[], grandTotalIls: number } | null>} */
  async function getCheckout(checkoutId) {
    const user = await requireBuyer()
    const orders = store.read().orders.filter((order) => order.checkoutId === checkoutId && order.buyerId === user.id)
    if (orders.length === 0) return null
    return copy({
      checkoutNumber: orders[0].checkoutNumber,
      orders,
      grandTotalIls: orders.reduce((sum, order) => sum + order.totalIls, 0),
    })
  }

  /**
   * Cancels an order the shop hasn't confirmed yet: the stock goes back on sale, and a card payment
   * is refunded (mock: marked "refunded"). Later, the buyer has to ask the shop.
   * @param {string} orderId
   * @param {string} [reason]
   * @returns {Promise<Order>}
   */
  async function cancelOrder(orderId, reason = '') {
    const user = await requireBuyer()
    const order = findOwn(orderId, user)
    if (!order) throw new OrderError('Order not found.')
    if (order.status !== ORDER_STATUS.PLACED) {
      throw new OrderError("This order can't be cancelled any more because the shop already confirmed it. Message the shop instead.")
    }
    return copy(await cancelInternal(order, { by: 'buyer', reason: reason.trim() || 'Cancelled by the buyer' }))
  }

  /**
   * Puts the order's parts back in the cart (as many as are in stock). Parts that are no longer for
   * sale or out of stock are skipped.
   * @returns {Promise<{ added: number, skipped: string[] }>} how many parts were added, and the names that weren't
   */
  async function buyAgain(orderId) {
    const user = await requireBuyer()
    const order = findOwn(orderId, user)
    if (!order) throw new OrderError('Order not found.')
    let added = 0
    const skipped = []
    for (const item of order.items) {
      try {
        await cart.addItem(item.partId, item.quantity)
        added += 1
      } catch {
        skipped.push(item.name)
      }
    }
    return { added, skipped }
  }

  /**
   * The chat with the shop about an order. Chats belong to requests (features/requests), so the first
   * time this sends the shop a question about the order's first part and remembers it.
   * @returns {Promise<string>} the request id; the chat is /chats/<id>
   */
  async function openShopChat(orderId) {
    const user = await requireBuyer()
    const order = findOwn(orderId, user)
    if (!order) throw new OrderError('Order not found.')
    if (order.chatRequestId) return order.chatRequestId

    const [item] = order.items
    let request
    try {
      request = await requests.createRequest('part_question', order.shopId, {
        partId: item.partId,
        message: `Question about my order ${order.checkoutNumber} (${order.id}).`,
        quantity: item.quantity,
      })
    } catch {
      throw new OrderError("We couldn't open a chat with this shop right now. Try again later.")
    }
    replaceOrder({ ...order, chatRequestId: request.id })
    return request.id
  }

  // --- Shop side (/parts-shop/orders): only the shop's own orders -------------------------------

  /** @returns {Promise<Order[]>} the logged-in shop's orders, newest first */
  async function getShopOrders() {
    const shop = await requireShop()
    return copy(store.read().orders.filter((order) => order.shopId === shop.id).sort(newestFirst))
  }

  /**
   * @returns {Promise<Order | null>} null when it doesn't exist; rejects when it belongs to another shop
   */
  async function getShopOrder(orderId) {
    const shop = await requireShop()
    const order = findShopOrder(orderId, shop)
    return order ? copy(order) : null
  }

  async function ownedOrder(orderId) {
    const shop = await requireShop()
    const order = findShopOrder(orderId, shop)
    if (!order) throw new OrderError('Order not found.')
    return order
  }

  /**
   * The shop accepts a new order: the reserved stock is now deducted from the shelf.
   * @returns {Promise<Order>}
   */
  async function confirmOrder(orderId) {
    const order = await ownedOrder(orderId)
    if (order.status !== ORDER_STATUS.PLACED) throw new OrderError('Only new orders can be confirmed.')
    try {
      await marketplace.adjustStock(stockMoves(order, 'deduct'))
    } catch {
      throw new OrderError('You no longer have enough of these parts in stock. Update your stock, or reject the order.')
    }
    const updated = withStep(order, ORDER_STATUS.CONFIRMED, { stockState: 'deducted' })
    replaceOrder(updated)
    tellBuyer(order, 'Order confirmed', 'The shop confirmed your order and will prepare it.')
    return copy(updated)
  }

  /**
   * The shop turns down a new order, with a reason the buyer sees. The reserved stock is released
   * and a card payment is refunded.
   * @returns {Promise<Order>}
   */
  async function rejectOrder(orderId, reason) {
    const order = await ownedOrder(orderId)
    if (order.status !== ORDER_STATUS.PLACED) throw new OrderError('Only new orders can be rejected.')
    if (isBlank(reason)) throw new OrderError('Write the reason, so the customer knows why.')
    return copy(await cancelInternal(order, { by: 'shop', reason: reason.trim() }))
  }

  /**
   * Moves a confirmed order one step on: preparing -> out for delivery / ready for pickup ->
   * delivered / picked up -> completed. A cash order can't be completed before it is marked paid.
   * @returns {Promise<Order>}
   */
  async function advanceOrder(orderId) {
    const order = await ownedOrder(orderId)
    if (order.status === ORDER_STATUS.PLACED) throw new OrderError('Confirm the order first.')
    const flow = ORDER_FLOWS[order.fulfillment.method]
    const next = flow[flow.indexOf(order.status) + 1]
    if (order.status === ORDER_STATUS.CANCELLED || !next) throw new OrderError('This order has no next step.')
    if (next === ORDER_STATUS.COMPLETED && order.payment.status !== 'paid') {
      throw new OrderError('Mark the order as paid before completing it.')
    }
    const updated = withStep(order, next)
    replaceOrder(updated)
    tellBuyer(order, statusLabel(next), `Your order is now: ${statusLabel(next).toLowerCase()}.`)
    return copy(updated)
  }

  /**
   * The shop received the cash (on delivery or at pickup).
   * @returns {Promise<Order>}
   */
  async function markOrderPaid(orderId) {
    const order = await ownedOrder(orderId)
    if (order.payment.method !== PAYMENT_METHODS.CASH) throw new OrderError('Card payments are marked paid automatically.')
    if (order.status === ORDER_STATUS.PLACED || order.status === ORDER_STATUS.CANCELLED) {
      throw new OrderError('Confirm the order before taking payment.')
    }
    if (order.payment.status === 'paid') throw new OrderError('This order is already marked as paid.')
    const updated = { ...order, payment: { ...order.payment, status: 'paid' } }
    replaceOrder(updated)
    tellBuyer(order, 'Payment received', 'The shop marked your cash payment as received.')
    return copy(updated)
  }

  // --- Admin (features/admin/adminService.js calls this after its own admin check) -----------

  /**
   * An admin cancels an order that has a problem. Needs a reason; the buyer and the shop are told.
   * Finished (completed or already cancelled) orders can't be cancelled.
   * @returns {Promise<Order>}
   */
  async function cancelOrderAsAdmin(orderId, reason) {
    await requireAdmin()
    const order = store.read().orders.find((o) => o.id === orderId)
    if (!order) throw new OrderError('Order not found.')
    if (order.status === ORDER_STATUS.CANCELLED || order.status === ORDER_STATUS.COMPLETED) {
      throw new OrderError('This order is already finished.')
    }
    if (isBlank(reason)) throw new OrderError('Write the reason for cancelling this order.')
    return copy(await cancelInternal(order, { by: 'admin', reason: reason.trim() }))
  }

  return {
    getCheckoutOptions,
    addAddress,
    placeOrder,
    getMyOrders,
    getOrder,
    getCheckout,
    cancelOrder,
    buyAgain,
    openShopChat,
    getShopOrders,
    getShopOrder,
    confirmOrder,
    rejectOrder,
    advanceOrder,
    markOrderPaid,
    cancelOrderAsAdmin,
  }
}
