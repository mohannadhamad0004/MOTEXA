import { useLocalSearchParams } from "expo-router";
import { ReviewKind } from "../../../../features/department/departments";
import { ReviewScreen } from "../../../../features/department/review";

export default function DeptReviewRoute() {
  const { kind, id } = useLocalSearchParams<{ kind: ReviewKind; id: string }>();
  return <ReviewScreen kind={kind} id={id} />;
}
