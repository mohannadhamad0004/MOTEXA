import { useAuthQuery } from '../../auth/useAuth.js'
import { ROLES } from '../../authorization/roles.js'
import { useMarketplaceQuery } from '../marketplace/MarketplaceContext.js'

// Where the car should go: a MOTEXA mechanic, a parts shop, or any address.
export const DESTINATION_KINDS = Object.freeze([
  { value: 'mechanic', label: 'A MOTEXA mechanic' },
  { value: 'shop', label: 'A parts shop' },
  { value: 'custom', label: 'Another address' },
])

const loadMechanics = (service) => service.getDirectory(ROLES.MECHANIC)
const loadShops = (service) => service.getShops()
const NONE = []

const place = (name, city, address) => [name, address, city].filter(Boolean).join(', ')

/** The mechanics and shops a customer can choose, as { id, label, address }. */
export function useDestinations() {
  const mechanics = useAuthQuery(loadMechanics).data ?? NONE
  const shops = useMarketplaceQuery(loadShops).data ?? NONE
  return {
    mechanic: mechanics.map((m) => ({ id: m.id, label: `${m.workshopName} · ${m.city}`, address: place(m.workshopName, m.city, m.address) })),
    shop: shops.map((s) => ({ id: s.id, label: `${s.name} · ${s.city}`, address: place(s.name, s.city, s.address) })),
  }
}
