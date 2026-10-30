import { ServiceMapScreen } from "../../../features/shared/ServiceMapScreen";

// Full-screen map of approved parts shops with a stored location (shared map screen, "parts" layer). ?focus=<shopId> opens that shop.
export default function PartsShopsMap() {
  return <ServiceMapScreen mode="parts" />;
}
