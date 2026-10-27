// The old tow / shops admin routes keep working: they render the shared department screens, pinned to their own department.
import { useLocalSearchParams } from "expo-router";
import { DepartmentProvider } from "./DepartmentContext";
import { ReviewScreen } from "./applications";
import { DeptDirectory } from "./screens";

export const TowDirectoryRoute = () => (
  <DepartmentProvider force="MANAGE_TOWING">
    <DeptDirectory />
  </DepartmentProvider>
);
export const ShopsDirectoryRoute = () => (
  <DepartmentProvider force="MANAGE_SPARE_PARTS">
    <DeptDirectory />
  </DepartmentProvider>
);
export function TowReviewRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <DepartmentProvider force="MANAGE_TOWING">
      <ReviewScreen kind="company" id={id} />
    </DepartmentProvider>
  );
}
export function ShopReviewRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <DepartmentProvider force="MANAGE_SPARE_PARTS">
      <ReviewScreen kind="shop" id={id} />
    </DepartmentProvider>
  );
}
