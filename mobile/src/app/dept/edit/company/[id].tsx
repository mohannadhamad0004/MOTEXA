import { useLocalSearchParams } from "expo-router";
import { CompanyEditor } from "../../../../features/department/manage";

export default function EditCompany() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <CompanyEditor id={id} />;
}
