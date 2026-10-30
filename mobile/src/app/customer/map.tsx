import { ServiceMapScreen } from "../../features/shared/ServiceMapScreen";

// Full-screen map of every place (tow companies, parts shops, mechanics) with layer chips; opened from the Home hero.
export default function CustomerMapPage() {
  return <ServiceMapScreen mode="all" />;
}
