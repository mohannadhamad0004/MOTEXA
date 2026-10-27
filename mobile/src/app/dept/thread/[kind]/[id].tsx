import { useLocalSearchParams } from "expo-router";
import { DeptThread } from "../../../../features/department/applications";

export default function DeptThreadRoute() {
  const { kind, id } = useLocalSearchParams<{ kind: string; id: string }>();
  return <DeptThread kind={kind === "PARTS" ? "PARTS" : "TOW"} id={id} />;
}
