// TODO: replace mock implementation with real API calls
//
// Every auth call goes through this service and returns a Promise, so pages already use the same
// call style they will use with the real API (apps/api/src/modules/auth).
//
// For now the accounts live in React state inside AuthProvider (AuthContext.jsx). The provider
// passes a small store ({ read, write }) to createAuthService, and components get the service
// with useAuth(). AuthProvider also keeps the state in sessionStorage (sessionPersistence.js), so
// a refresh keeps you logged in; closing the tab resets it. Passwords are stored in plain text only because this is a mock - the api must hash
// them. Uploaded files stay as File objects in memory; nothing is uploaded yet.
//
// Admin actions (approvals, suspending, tags) live in features/admin/adminService.js. Editing your
// own account and profile is in profileService.js, and tow trucks in features/logistics/trucksService.js.

import { ROLES } from '../authorization/roles.js'
import { deepCopy } from '../utils/deepCopy.js'
import {
  ACCOUNT_STATUS,
  DEFAULT_NOTIFICATION_PREFS,
  REVIEW_STATUS,
  ROLES_NEEDING_APPROVAL,
  SIGNUP_ROLES,
  SKILL_STATUS,
} from './constants.js'
import { isApprovedTruck } from './reviewItems.js'
import { isValidEmail, passwordError } from './validation.js'

/** @typedef {import('./types.js').Account} Account */
/** @typedef {import('./types.js').Role} Role */
/** @typedef {import('./types.js').PublicMechanic} PublicMechanic */
/** @typedef {import('./types.js').PublicTowCompany} PublicTowCompany */

/**
 * @typedef {Account & { password: string }} StoredUser
 * @typedef {{ token: string, userId: string, expiresAt: number }} ResetToken
 * @typedef {{ users: StoredUser[], sessionUserId: string | null, resetTokens: ResetToken[] }} AuthData
 * @typedef {{ read: () => AuthData, write: (next: AuthData) => void }} MockStore
 */

const RESET_LINK_LIFETIME_MS = 30 * 60 * 1000

// Thrown for problems the user can fix. `field` names the form field it belongs to, if any.
export class AuthError extends Error {
  constructor(message, field = null) {
    super(message)
    this.name = 'AuthError'
    this.field = field
  }
}

const copy = deepCopy

/** @returns {Account} the user without their password */
export function toPublicUser(user) {
  const account = copy(user)
  delete account.password
  return account
}

export const normalizeEmail = (email) => String(email ?? '').trim().toLowerCase()
const now = () => new Date().toISOString()

// "u-7" -> next id "u-8"
function nextUserId(users) {
  const max = users.reduce((highest, user) => {
    const number = Number(user.id.replace(/^u-/, ''))
    return Number.isFinite(number) ? Math.max(highest, number) : highest
  }, 0)
  return `u-${max + 1}`
}

// Shown publicly: approved and not suspended.
export const isPubliclyVisible = (user) => user.status === ACCOUNT_STATUS.APPROVED && !user.suspended

// Public profiles leave out contact details and every document: no email, phone, certificates,
// licenses, plate numbers or truck papers - only admins see those. Mechanics show approved
// skills only.
function toPublicMechanic(user) {
  return copy({
    id: user.id,
    name: user.name,
    profilePhoto: user.profilePhoto,
    city: user.city,
    workshopName: user.workshopName,
    address: user.address,
    description: user.description ?? '',
    skills: user.skills
      .filter((skill) => skill.status === SKILL_STATUS.APPROVED)
      .map(({ id, skill, years }) => ({ id, skill, years })),
    workshopPhotos: user.workshopPhotos,
    serviceModes: user.serviceModes ?? [],
    onSiteCities: user.onSiteCities ?? [],
    makes: user.makes ?? [],
    base: user.base ?? null,
    tagIds: user.tagIds ?? [],
    verified: true,
  })
}

// Trucks waiting for review (new, or with a changed plate or documents) are not public.
function toPublicTowCompany(user) {
  return copy({
    id: user.id,
    name: user.name,
    profilePhoto: user.profilePhoto,
    city: user.city,
    address: user.address ?? '',
    description: user.description ?? '',
    serviceArea: user.serviceArea,
    base: user.base ?? null,
    towServices: user.towServices ?? [],
    trucks: user.trucks
      .filter(isApprovedTruck)
      .map(({ id, type, maxWeightKg, photos }) => ({ id, type, maxWeightKg, photos })),
    // Approved trucks the company marked available right now (the status itself stays private).
    availableTrucks: user.trucks.filter((truck) => isApprovedTruck(truck) && truck.status === 'available').length,
    tagIds: user.tagIds ?? [],
    verified: true,
  })
}

const PUBLIC_PROFILES = { [ROLES.MECHANIC]: toPublicMechanic, [ROLES.TOW]: toPublicTowCompany }

/** @param {MockStore} store */
export function createAuthService(store) {
  const currentUser = (data) => data.users.find((user) => user.id === data.sessionUserId) ?? null

  /**
   * Creates an account and logs it in. Customers are approved right away; mechanics, parts shops
   * and tow companies start as "pending" until an admin reviews their documents. Each mechanic
   * skill is reviewed on its own, so skills start "pending" too.
   * @param {Role} role
   * @param {Object} data   form fields (name, email, phone, password, city, skills, trucks, ...).
   *                        Skills and trucks carry their own files.
   * @param {Object<string, File | File[] | null>} files  top-level uploads (profilePhoto, shopPhotos, ...)
   * @returns {Promise<Account>}
   */
  async function register(role, data, files = {}) {
    if (!SIGNUP_ROLES.includes(role)) throw new AuthError('Choose an account type.', 'role')

    const state = store.read()
    const email = normalizeEmail(data.email)
    if (!isValidEmail(email)) throw new AuthError('Enter a valid email address.', 'email')
    const badPassword = passwordError(data.password)
    if (badPassword) throw new AuthError(badPassword, 'password')
    if (state.users.some((user) => user.email === email)) {
      throw new AuthError('An account with this email already exists. Log in instead.', 'email')
    }

    const id = nextUserId(state.users)
    const createdAt = now()
    const fields = copy(data)
    // Form inputs are strings; store numbers like the api will. Skills and trucks are reviewed
    // with the account, so they start pending too.
    if (fields.skills) {
      fields.skills = fields.skills.map((skill) => ({
        ...skill,
        years: Number(skill.years),
        status: SKILL_STATUS.PENDING,
        rejectionReason: null,
        submittedAt: createdAt,
      }))
    }
    if (fields.trucks) {
      fields.trucks = fields.trucks.map((truck, i) => ({
        ...truck,
        id: `${id}-truck-${i + 1}`,
        maxWeightKg: Number(truck.maxWeightKg),
        status: 'available',
        reviewStatus: REVIEW_STATUS.PENDING,
        rejectionReason: null,
        submittedAt: createdAt,
      }))
    }
    // Mechanics start with workshop visits only; they can add on-site and online on /profile.
    const roleDefaults = {
      [ROLES.MECHANIC]: { description: '', serviceModes: ['workshop'], onSiteCities: [], makes: [] },
    }[role]

    const user = {
      ...roleDefaults,
      ...fields,
      ...files,
      id,
      role,
      email,
      status: ROLES_NEEDING_APPROVAL.includes(role) ? ACCOUNT_STATUS.PENDING : ACCOUNT_STATUS.APPROVED,
      rejectionReason: null,
      createdAt,
      reviewedAt: null,
      verification: null,
      suspended: false,
      suspendedAt: null,
      suspensionReason: null,
      tagIds: [],
      notificationPrefs: { ...DEFAULT_NOTIFICATION_PREFS },
      sessionsRevokedAt: null,
      ...(ROLES_NEEDING_APPROVAL.includes(role) && { pendingChanges: [] }),
    }
    delete user.confirmPassword

    store.write({ ...state, users: [...state.users, user], sessionUserId: user.id })
    return toPublicUser(user)
  }

  /**
   * Logs in any existing account, including pending and rejected ones - the app sends those to
   * /pending-approval instead of their dashboard. Suspended accounts can't log in.
   * @returns {Promise<Account>}
   */
  async function login(email, password) {
    const state = store.read()
    const user = state.users.find((u) => u.email === normalizeEmail(email))
    // Same message for an unknown email and a wrong password, so it doesn't reveal which emails exist.
    if (!user || user.password !== password) throw new AuthError('Email or password is incorrect.')
    if (user.suspended) {
      throw new AuthError('This account is suspended. Contact MOTEXA support if you think this is a mistake.')
    }

    store.write({ ...state, sessionUserId: user.id })
    return toPublicUser(user)
  }

  /** @returns {Promise<void>} */
  async function logout() {
    store.write({ ...store.read(), sessionUserId: null })
  }

  /** @returns {Promise<Account | null>} null when nobody is logged in */
  async function getCurrentUser() {
    const user = currentUser(store.read())
    return user ? toPublicUser(user) : null
  }

  /**
   * Always resolves the same way, whether or not the email is registered.
   * Mock only: the reset link is printed to the browser console instead of being emailed.
   * @returns {Promise<void>}
   */
  async function requestPasswordReset(email) {
    const state = store.read()
    const user = state.users.find((u) => u.email === normalizeEmail(email))
    if (!user) return

    // Mock token. crypto.randomUUID is missing on plain-http LAN addresses (phone testing).
    const token = crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
    const resetTokens = [
      ...state.resetTokens.filter((entry) => entry.userId !== user.id),
      { token, userId: user.id, expiresAt: Date.now() + RESET_LINK_LIFETIME_MS },
    ]
    store.write({ ...state, resetTokens })
    console.info(
      `[mock auth] Password reset link for ${user.email}: ${window.location.origin}/reset-password?token=${token}`,
    )
  }

  /** @returns {Promise<void>} */
  async function resetPassword(token, newPassword) {
    const state = store.read()
    const entry = state.resetTokens.find((item) => item.token === token)
    if (!entry || entry.expiresAt < Date.now()) {
      throw new AuthError('This reset link is invalid or has expired. Request a new one.')
    }
    const badPassword = passwordError(newPassword)
    if (badPassword) throw new AuthError(badPassword, 'password')

    store.write({
      ...state,
      users: state.users.map((user) => (user.id === entry.userId ? { ...user, password: newPassword } : user)),
      resetTokens: state.resetTokens.filter((item) => item.token !== token),
    })
  }

  // --- Public directory ---------------------------------------------------------------------
  // In the real app: GET /api/mechanics(/:id) and /api/tow-companies(/:id). Anyone can call these,
  // logged in or not, so they return approved, non-suspended accounts only, with public fields only.

  /**
   * @param {'mechanic' | 'tow'} role
   * @returns {Promise<Array<PublicMechanic | PublicTowCompany>>} oldest first
   */
  async function getDirectory(role) {
    const toPublic = PUBLIC_PROFILES[role]
    if (!toPublic) throw new AuthError(`There is no public directory for ${role}.`)
    return store
      .read()
      .users.filter((user) => user.role === role && isPubliclyVisible(user))
      .map(toPublic)
  }

  /** @returns {Promise<PublicMechanic | PublicTowCompany | null>} null when not found or not public */
  async function getDirectoryEntry(role, id) {
    const toPublic = PUBLIC_PROFILES[role]
    if (!toPublic) throw new AuthError(`There is no public directory for ${role}.`)
    const user = store.read().users.find((u) => u.id === id && u.role === role && isPubliclyVisible(u))
    return user ? toPublic(user) : null
  }

  return {
    register,
    login,
    logout,
    getCurrentUser,
    requestPasswordReset,
    resetPassword,
    getDirectory,
    getDirectoryEntry,
  }
}
