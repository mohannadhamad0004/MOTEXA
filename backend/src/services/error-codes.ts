// Stable error codes for the messages users meet most. The app maps `errorCode` -> English/Arabic text
// (mobile/src/core/session/errorText.ts); an unknown code (or none) falls back to the English `message`.
// One table, matched by the start of the message, so a new throw site needs no change here when it reuses an existing message.
// tests/error-codes.test.ts checks that every prefix still exists in the source (a reworded message cannot lose its code silently).
export const ERROR_CODES: readonly [code: string, prefix: string][] = [
  ["PRODUCT_PRICE_INVALID", "Price must be 0 or more"],
  ["PRODUCT_STOCK_INVALID", "Stock must be a whole number from 0"],
  ["TRUCK_UNAVAILABLE", "This truck is not available"],
  ["DOCUMENTS_EXPIRED", "This truck's documents have expired"],
  ["REQUEST_NOT_WAITING", "This request is no longer waiting for an answer"],
  ["ACTIVE_REQUEST_EXISTS", "You already have an active request with this company"],
  ["NO_TRUCK_AVAILABLE", "This company has no available truck right now"],
  ["NO_DRIVER_AVAILABLE", "No driver is available right now"],
  ["CANCEL_NOT_ALLOWED", "This request can no longer be cancelled"],
  ["CANCEL_REASON_REQUIRED", "Please give a reason: your driver is already on the way"],
  ["NOT_APPROVED", "Your application has not been approved yet"],
  ["LICENCE_NOT_APPROVED", "Your licence is not approved yet"],
  ["NO_TRUCK_LINKED", "You have no truck linked"],
  ["DRIVER_NOT_FREE", "This driver is not free right now"],
  ["JOB_CHANGED", "The job changed meanwhile"],
  ["JOB_NOT_WAITING", "This job is no longer waiting for you"],
  ["TRUCK_CANT_WORK", "Your truck can't take work right now"],
  ["CHAT_CLOSED", "Chat is open while the job is active"],
  ["ALREADY_RATED", "You already rated this tow"],
  ["ORDER_CHANGED", "The order changed meanwhile"],
  ["NOT_ENOUGH_STOCK", "Not enough stock of"],
  ["ORDER_CANT_CANCEL", "The shop already accepted this order"],
  ["ORDER_REASON_REQUIRED", "Give the customer a reason"],
  ["SHOP_NO_DELIVERY", "This shop does not deliver"],
  ["TOO_MANY_WAITING", "You already have several orders waiting"],
  ["PART_UNAVAILABLE", "A part in your cart is no longer sold"],
  ["PHONE_INVALID", "A valid contact phone number is required"],
  ["PICKUP_REQUIRED", "Pickup address is required"],
  ["DESTINATION_REQUIRED", "Destination address is required"],
  ["CAR_REQUIRED", "Car make and model are required"],
  ["DRIVER_NOT_FOUND", "Driver not found"],
  ["COMPANY_NOT_FOUND", "Company not found"],
  ["ORDER_NOT_FOUND", "Order not found"],
  ["JOB_NOT_FOUND", "Job not found"],
  ["REQUEST_NOT_FOUND", "Request not found"],
  ["SERVER_ERROR", "Internal server error"],
];
export const errorCodeOf = (message: string): string | undefined => ERROR_CODES.find(([, prefix]) => message.startsWith(prefix))?.[0];
/** JSON body of an error response: message + its stable code when it has one. */
export const errorBody = (message: string, extra: object = {}) => ({ success: false, message, ...(errorCodeOf(message) ? { errorCode: errorCodeOf(message) } : {}), ...extra });
