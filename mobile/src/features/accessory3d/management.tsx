// /dept/3d/requests (the two kinds of 3D requests) and /dept/3d/accessories (every accessory 3D model) on the one UI system.
import { router, type Href } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { FilterChips, ManageEntry, ManagePage, ManageRow } from "../../components/manage/ManagePage";
import { Page } from "../../components/manage/Page";
import { useL } from "../../core/hooks/useL";
import { useLoad } from "../../core/hooks/useLoad";
import { accessoryActions } from "../department/itemActions";
import { useThreeDCount } from "../department/partsAdmin";
import { threeDError } from "../vehicleCatalog/lifecycleText";
import { ACCESSORY_TYPE_LABELS, STATUS_LABELS, adminAccessoryApi, type ListedAccessory } from "./api";
import { accessoryProcessingLabel } from "./processing";

const go = (path: string) => router.push(path as Href);

export function ThreeDRequestsHub() {
  const { t } = useL();
  const { needs } = useThreeDCount();
  return (
    <Page title={t("3D requests", "طلبات ثلاثية الأبعاد")} line={t("Review eligibility before starting generation.", "راجع أهلية الطلب قبل بدء الإنشاء.")}>
      <View style={{ gap: 8 }}>
        <ManageEntry icon="cube-outline" title={t("Parts shop accessory requests", "طلبات قطع المتاجر")} sub={needs ? t(`${needs} waiting for you`, `${needs} بانتظارك`) : undefined} onPress={() => go("/dept/accessory3d")} />
        <ManageEntry icon="car-sport-outline" title={t("Customer vehicle requests", "طلبات سيارات العملاء")} onPress={() => go("/dept/vehicles/requests")} />
      </View>
    </Page>
  );
}

type Group = "ALL" | "PROGRESS" | "LIVE" | "OFF" | "FAILED";
const groupOf = (a: ListedAccessory): Group => a.lifecycleState === "FAILED" ? "FAILED" : a.deactivatedAt ? "OFF" : a.status === "PUBLISHED" ? "LIVE" : "PROGRESS";
export function AccessoryModels() {
  const { t } = useL();
  const data = useLoad(adminAccessoryApi.list, [], 8000);
  const [q, setQ] = useState(""), [group, setGroup] = useState<Group>("ALL");
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const matching = (data.data ?? []).filter(a => { const hay = `${a.productName} ${a.shopName}`.toLowerCase(); return words.every(w => hay.includes(w)); });
  const rows = matching.filter(a => group === "ALL" || groupOf(a) === group).sort((a, b) => Number(groupOf(b) === "FAILED") - Number(groupOf(a) === "FAILED"));
  const label = (a: ListedAccessory) => accessoryProcessingLabel(a) ? t(...accessoryProcessingLabel(a)!) : a.lifecycleState === "FAILED" ? t("Generation failed", "تعذّر الإنشاء") : a.deactivatedAt ? t("Unpublished", "غير منشور") : t(...STATUS_LABELS[a.status]).split(":")[0]!;
  const tone = (a: ListedAccessory) => ({ FAILED: "danger", OFF: "neutral", LIVE: "success", PROGRESS: "accent", ALL: "neutral" } as const)[groupOf(a)];
  const groups: { key: Group; en: string; ar: string }[] = [{ key: "ALL", en: "All", ar: "الكل" }, { key: "PROGRESS", en: "In progress", ar: "قيد التنفيذ" }, { key: "LIVE", en: "Published", ar: "منشور" }, { key: "OFF", en: "Unpublished", ar: "غير منشور" }, { key: "FAILED", en: "Failed", ar: "فشل" }];
  return (
    <ManagePage title={t("Accessory 3D models", "نماذج الإكسسوارات")} line={data.data ? t(`${data.data.length} models`, `${data.data.length} نموذج`) : undefined}
      search={{ value: q, onChange: setQ, placeholder: t("Search product or shop", "البحث عن قطعة أو متجر") }}
      filters={<FilterChips value={group} onChange={setGroup} filters={groups.map(x => ({ key: x.key, label: t(x.en, x.ar), count: data.data ? matching.filter(a => x.key === "ALL" || groupOf(a) === x.key).length : undefined }))} />}
      items={rows} keyOf={a => a.id}
      renderItem={a => <ManageRow title={a.productName} status={{ label: label(a), tone: tone(a) }}
        sub={[a.shopName, t(...ACCESSORY_TYPE_LABELS[a.accessoryType]), `${t("Revision", "الإصدار")} ${a.revision}`, a.providerProgress !== null ? `${a.providerProgress}%` : null, a.cars.map(c => t(c.name, c.nameAr)).join(", ")].filter(Boolean).join(" · ")}
        onPress={() => go(`/dept/accessory3d/${a.id}`)} actions={accessoryActions(t, a, () => data.reload())} />}
      loading={!data.data && !data.error} error={data.error ? threeDError({ message: data.error }, t) : null} onRetry={() => void data.reload()}
      empty={{ text: q || group !== "ALL" ? t("Nothing matches.", "لا توجد نتائج مطابقة.") : t("No accessory 3D model yet.", "لا توجد نماذج إكسسوارات بعد."), action: q || group !== "ALL" ? { label: t("Clear filters", "مسح الفلاتر"), onPress: () => { setQ(""); setGroup("ALL"); } } : undefined }}
      onRefresh={() => void data.reload()} refreshing={false}
      detailHint={t("Tap a model to open its request.", "اضغط على نموذج لفتح طلبه.")} />
  );
}
