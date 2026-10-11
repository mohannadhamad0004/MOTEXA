import { ROLES } from '../../authorization/roles.js'

// Skills a mechanic can list, each with its own certificate.
export const SKILLS = Object.freeze([
  'Engine',
  'Electrical',
  'Brakes',
  'Suspension',
  'Transmission',
  'AC & Cooling',
  'Body Work & Paint',
  'Computer Diagnostics',
  'Tires & Wheels',
  'Hybrid/EV',
])

// How a mechanic can work with a customer. A mechanic offers at least one; on-site also lists the
// cities they drive to. New mechanics start with a workshop only and change it on /profile.
export const SERVICE_MODES = Object.freeze([
  { value: 'on_site', label: 'On-site', description: 'Comes to the customer' },
  { value: 'workshop', label: 'Workshop visit', description: 'The customer brings the car' },
  { value: 'online', label: 'Online consultation', description: 'Advice through chat' },
])

export const serviceModeLabel = (value) => SERVICE_MODES.find((mode) => mode.value === value)?.label ?? value

export const TRUCK_TYPES = Object.freeze([
  { value: 'flatbed', label: 'Flatbed' },
  { value: 'wheel_lift', label: 'Wheel-lift' },
  { value: 'other', label: 'Other' },
])

// What a truck is doing right now; the tow company sets it on /tow/trucks.
export const TRUCK_STATUSES = Object.freeze([
  { value: 'available', label: 'Available', tone: 'success' },
  { value: 'en_route', label: 'En route', tone: 'info' },
  { value: 'busy', label: 'Busy', tone: 'warning' },
  { value: 'out_of_service', label: 'Out of service', tone: 'neutral' },
])

export const DESCRIPTION_MAX_LENGTH = 300

// The account type cards on the first signup screen.
export const ROLE_CHOICES = Object.freeze([
  {
    role: ROLES.CUSTOMER,
    title: 'Customer',
    text: 'Report car problems, get an AI first diagnosis and book a mechanic.',
    needsApproval: false,
  },
  {
    role: ROLES.MECHANIC,
    title: 'Mechanic',
    text: 'Receive service requests and confirm diagnoses. Upload your certificates.',
    needsApproval: true,
  },
  {
    role: ROLES.PARTS_SHOP,
    title: 'Parts Shop',
    text: 'Open your shop on the MOTEXA marketplace and sell parts.',
    needsApproval: true,
  },
  {
    role: ROLES.TOW,
    title: 'Tow Company',
    text: 'Register your trucks and accept tow requests near you.',
    needsApproval: true,
  },
])
