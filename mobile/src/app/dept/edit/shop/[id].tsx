import { useLocalSearchParams } from "expo-router";
import { ShopEditor } from "../../../../features/department/manage";

export default function EditShop() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ShopEditor id={id} />;
}
