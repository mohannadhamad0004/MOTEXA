import { ROLES } from '../authorization/roles.js'

export const ACCOUNT_STATUS = Object.freeze({
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
})

// Review status of one item an admin checks on its own: a mechanic skill, a tow truck, or a
// change to a business name or license. Only approved skills and trucks are public.
export const REVIEW_STATUS = Object.freeze({
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
})

export const REVIEW_STATUS_BADGES = Object.freeze({
  [REVIEW_STATUS.PENDING]: { label: 'Pending review', tone: 'warning' },
  [REVIEW_STATUS.APPROVED]: { label: 'Approved', tone: 'success' },
  [REVIEW_STATUS.REJECTED]: { label: 'Not approved', tone: 'danger' },
})

// Each mechanic skill is approved or rejected on its own. Only approved skills are public.
export const SKILL_STATUS = REVIEW_STATUS
export const SKILL_STATUS_BADGES = REVIEW_STATUS_BADGES

// Profile fields an admin must check again when they change. The new value waits in
// account.pendingChanges (the approved value stays public) until an admin approves it.
// Photos, descriptions and addresses are not reviewed.
export const REVIEWED_FIELDS = Object.freeze({
  [ROLES.MECHANIC]: ['workshopName'],
  [ROLES.PARTS_SHOP]: ['name', 'businessLicense'],
  [ROLES.TOW]: ['name', 'businessLicense'],
})

export const REVIEWED_FIELD_LABELS = Object.freeze({
  name: 'Business name',
  workshopName: 'Workshop name',
  businessLicense: 'Business license',
})

// Email notifications a user can switch on or off on /account.
export const NOTIFICATION_TYPES = Object.freeze([
  { value: 'requestUpdates', label: 'Request updates', hint: 'When a request you sent or received changes.' },
  { value: 'chatMessages', label: 'Chat messages', hint: 'When someone sends you a message.' },
  { value: 'accountUpdates', label: 'Account updates', hint: 'Approvals, rejections and security alerts.' },
])

export const DEFAULT_NOTIFICATION_PREFS = Object.freeze({
  requestUpdates: true,
  chatMessages: true,
  accountUpdates: true,
})

// How an admin checked an account before approving it (required for approval).
export const VERIFICATION_METHODS = Object.freeze([
  { value: 'documents', label: 'Documents only' },
  { value: 'phone', label: 'Phone call' },
  { value: 'video', label: 'Video call' },
  { value: 'in_person', label: 'In-person visit' },
])

export const verificationMethodLabel = (value) =>
  VERIFICATION_METHODS.find((method) => method.value === value)?.label ?? '—'

// Label and StatusIndicator tone for each status.
export const STATUS_BADGES = Object.freeze({
  [ACCOUNT_STATUS.PENDING]: { label: 'Pending review', tone: 'warning' },
  [ACCOUNT_STATUS.APPROVED]: { label: 'Approved', tone: 'success' },
  [ACCOUNT_STATUS.REJECTED]: { label: 'Rejected', tone: 'danger' },
})

// The status shown on /account: suspension wins over the review status.
export function accountStatusBadge(account) {
  if (account.suspended) return { label: 'Suspended', tone: 'danger' }
  return STATUS_BADGES[account.status]
}

// Roles people can sign up as. Admin accounts are never created through signup.
export const SIGNUP_ROLES = Object.freeze([ROLES.CUSTOMER, ROLES.MECHANIC, ROLES.PARTS_SHOP, ROLES.TOW])

// These roles upload documents and stay "pending" until an admin approves them.
export const ROLES_NEEDING_APPROVAL = Object.freeze([ROLES.MECHANIC, ROLES.PARTS_SHOP, ROLES.TOW])

// Company accounts: they sign up with a company name instead of a person's name.
export const COMPANY_ROLES = Object.freeze([ROLES.PARTS_SHOP, ROLES.TOW])

// Full account type names for signup and admin screens. ROLE_LABELS keeps the short nav labels.
export const ACCOUNT_TYPE_LABELS = Object.freeze({
  [ROLES.CUSTOMER]: 'Customer',
  [ROLES.MECHANIC]: 'Mechanic',
  [ROLES.PARTS_SHOP]: 'Parts Shop',
  [ROLES.TOW]: 'Tow Company',
  [ROLES.ADMIN]: 'Admin',
})
