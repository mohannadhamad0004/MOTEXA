// The five MOTEXA roles. Use these constants instead of typing role strings by hand.
// parts_shop and tow are company accounts, not individuals.
export const ROLES = Object.freeze({
  CUSTOMER: 'customer',
  MECHANIC: 'mechanic',
  PARTS_SHOP: 'parts_shop',
  TOW: 'tow',
  ADMIN: 'admin',
})

export const ROLE_LABELS = Object.freeze({
  [ROLES.CUSTOMER]: 'Customer',
  [ROLES.MECHANIC]: 'Mechanic',
  [ROLES.PARTS_SHOP]: 'Parts Shop',
  [ROLES.TOW]: 'Tow',
  [ROLES.ADMIN]: 'Admin',
})

// Where each role lands after logging in. Customers have no dashboard - they use the public pages.
export const ROLE_HOME_PATHS = Object.freeze({
  [ROLES.CUSTOMER]: '/',
  [ROLES.MECHANIC]: '/mechanic',
  [ROLES.PARTS_SHOP]: '/parts-shop',
  [ROLES.TOW]: '/tow',
  [ROLES.ADMIN]: '/admin',
})
