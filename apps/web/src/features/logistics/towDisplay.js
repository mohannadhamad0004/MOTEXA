import { TOW_SERVICES } from './constants.js'
import { formatWeight, truckTypesSummary } from './format.js'

// How a tow company's public data is put into words on the directory, the map and the inspector.

/** How many trucks are free right now and how many the company has (approved trucks only). */
export const truckCounts = (company) => ({ available: company.availableTrucks ?? company.trucks.length, total: company.trucks.length })

/** ["Local towing", "Roadside assistance"]: what the company offers, in the TOW_SERVICES order. */
export const serviceLabels = (company) => TOW_SERVICES.filter((service) => company.towServices?.includes(service.value)).map((service) => service.label)

/** "3 trucks · Flatbed, Wheel-lift · up to 7,500 kg": the public fleet, or '' when it has no approved truck. */
export function fleetSummary(company) {
  if (company.trucks.length === 0) return ''
  const heaviest = Math.max(...company.trucks.map((truck) => truck.maxWeightKg))
  const count = company.trucks.length
  return `${count} ${count === 1 ? 'truck' : 'trucks'} · ${truckTypesSummary(company.trucks)} · up to ${formatWeight(heaviest)}`
}
