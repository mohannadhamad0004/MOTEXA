import { useLocalSearchParams } from "expo-router";
import { ProductEditor } from "../../../../features/department/manage";

export default function EditProduct() {
  const { id, shopId } = useLocalSearchParams<{ id: string; shopId?: string }>();
  return <ProductEditor id={id} shopId={shopId} />;
}
