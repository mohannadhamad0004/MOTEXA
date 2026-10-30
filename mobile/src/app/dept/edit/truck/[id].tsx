import { useLocalSearchParams } from "expo-router";
import { TruckEditor } from "../../../../features/department/manage";

export default function EditTruck() {
  const { id, companyId } = useLocalSearchParams<{ id: string; companyId?: string }>();
  return <TruckEditor id={id} companyId={companyId} />;
}
