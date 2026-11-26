import { useLocalSearchParams } from "expo-router";
import { AdminMechanicRequest } from "../../../features/department/mechanicsAdmin";

export default function AdminMechanicRequestRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <AdminMechanicRequest id={id} />;
}
