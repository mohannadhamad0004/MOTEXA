// Before a shop submits or the Parts Admin starts generation: warn when a chosen car's 3D model has no separate piece for this part,
// so a replacement of it can never be shown on that car (backend car-part-map partLimit, GET /catalog/accessory-3d/support).
import { Note } from "../../components/garage";
import { api } from "../../core/config/api";
import { useL } from "../../core/hooks/useL";
import { useLoad } from "../../core/hooks/useLoad";
import { ACCESSORY_TYPE_LABELS } from "./api";
import type { AccessoryType } from "../car3d/modelConfig";

export const accessorySupport = async (type: AccessoryType) =>
  (await api<{ unsupported: { generationId: string; model3dKey: string; reason: string }[] }>("GET", `/catalog/accessory-3d/support?type=${type}`)).unsupported;

export function SupportWarning({ type, generationIds, name }: { type: AccessoryType | null; generationIds: string[]; name: (id: string) => string }) {
  const { t } = useL();
  const data = useLoad(() => (type ? accessorySupport(type) : Promise.resolve([])), [type]);
  if (!type || !data.data) return null;
  const bad = data.data.filter(u => generationIds.includes(u.generationId));
  if (!bad.length) return null;
  const part = t(...ACCESSORY_TYPE_LABELS[type]).toLowerCase();
  return <>{bad.map(u => <Note key={u.generationId} tone="warning">{`${name(u.generationId)}: ${t(`This car's 3D model can't show a replacement ${part}. A better model of this car is needed.`, `لا يمكن لنموذج هذه السيارة ثلاثي الأبعاد عرض ${part} بديل. يلزم نموذج أفضل لهذه السيارة.`)}`}</Note>)}</>;
}
