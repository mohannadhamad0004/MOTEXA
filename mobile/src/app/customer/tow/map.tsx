import { ServiceMapScreen } from "../../../features/shared/ServiceMapScreen";

// Full-screen map of tow companies (no tab bar: it is a stack screen outside the tabs).
export default function TowMapPage() {
  return <ServiceMapScreen mode="tow" />;
}
