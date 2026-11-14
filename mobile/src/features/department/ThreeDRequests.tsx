import { Image } from "expo-image";
import { Href, router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { Text } from "../../components/MotexaVisual";
import { publicImageUrl } from "../../core/constants/files";
import { useLoad } from "../../core/hooks/useLoad";
import { ACCESSORY_TYPE_LABELS, STATUS_LABELS, adminAccessoryApi, type AccessoryStatus, type ListedAccessory } from "../accessory3d/api";
import { fmtDateTime } from "../requests/requestBits";
import { ItemRow } from "../../components/ItemActionsMenu";
import { accessoryActions } from "./itemActions";
import { CountBadge, Empty, Load, Pill, cardStyle, useDT } from "./ui";

/** Which requests need the Parts Admin to act: new submissions and models waiting for the final check. */
export const NEEDS_ACTION: AccessoryStatus[] = ["PENDING_REVIEW", "READY_FOR_FINAL_REVIEW"];
const GROUPS: { key: string; en: string; ar: string; of: AccessoryStatus[] | null }[] = [
  { key: "ALL", en: "All", ar: "الكل", of: null },
  { key: "WAITING", en: "Waiting for review", ar: "بانتظار المراجعة", of: ["PENDING_REVIEW"] },
  { key: "PROGRESS", en: "In progress", ar: "قيد الإنشاء", of: ["APPROVED_FOR_GENERATION", "GENERATING"] },
  { key: "FINAL", en: "Final check", ar: "الفحص النهائي", of: ["READY_FOR_FINAL_REVIEW"] },
  { key: "LIVE", en: "Published", ar: "منشور", of: ["PUBLISHED"] },
  { key: "CHANGES", en: "Changes requested", ar: "مطلوب تعديلات", of: ["REJECTED"] },
];
const tone = (s: AccessoryStatus) => (s === "PUBLISHED" ? "ok" : s === "REJECTED" ? "bad" : s === "READY_FOR_FINAL_REVIEW" || s === "PENDING_REVIEW" ? "amber" : "neutral") as "ok" | "bad" | "amber" | "neutral";

/** Count of the requests that need the Parts Admin (for the Home tile and the Requests switch). Polls like the other lists. */
export function useThreeDCount() {
  const list = useLoad(() => adminAccessoryApi.list(), [], 15000);
  return { list, needs: (list.data ?? []).filter((a) => NEEDS_ACTION.includes(a.status)).length };
}

function Thumb({ a }: { a: ListedAccessory }) {
  const d = useDT();
  const pub = publicImageUrl(a.productImageId ? `/files/public/${a.productImageId}` : null);
  const [priv, setPriv] = useState<string | null>(null);
  useEffect(() => {
    if (pub || !a.firstPartPhotoId) return;
    let live = true;
    adminAccessoryApi.asset(a.id, a.firstPartPhotoId).then((b) => live && setPriv(`data:image/jpeg;base64,${b}`), () => undefined);
    return () => { live = false; };
  }, [a.id, a.firstPartPhotoId, pub]);
  const src = pub ?? priv;
  return src ? <Image source={{ uri: src }} style={{ width: 64, height: 64, borderRadius: 12, backgroundColor: d.soft }} contentFit="cover" accessibilityLabel={a.productName} /> : <View style={{ width: 64, height: 64, borderRadius: 12, backgroundColor: d.soft }} />;
}

/**
 * "3D requests": EVERY submitted shop request, of every type, newest submission first, with the part photo, shop, part type, car(s), date
 * and status. Tapping one opens the review screen (photos, sizes, installed photos, start generation, preview, publish / request changes).
 */
export function ThreeDRequests({ list }: { list: ReturnType<typeof useThreeDCount>["list"] }) {
  const d = useDT();
  const [group, setGroup] = useState("ALL");
  const g = GROUPS.find((x) => x.key === group)!;
  return (
    <Load state={list}>
      {(all) => {
        const count = (x: (typeof GROUPS)[number]) => (x.of ? all.filter((a) => x.of!.includes(a.status)).length : all.length);
        const rows = all.filter((a) => !g.of || g.of.includes(a.status));
        return (
          <>
            <View style={{ flexDirection: d.row, flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
              {GROUPS.map((x) => {
                const on = group === x.key;
                return (
                  <Pressable key={x.key} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={`${d.t(x.en, x.ar)} ${count(x)}`} onPress={() => setGroup(x.key)}
                    style={{ flexDirection: d.row, alignItems: "center", gap: 8, paddingHorizontal: 14, minHeight: 42, borderRadius: 21, borderWidth: 1.5, borderColor: on ? d.fill : d.border, backgroundColor: on ? d.fill : d.surface }}>
                    <Text style={{ color: on ? d.fillInk : d.ink, fontSize: 13, lineHeight: 19, fontWeight: "700" }}>{d.t(x.en, x.ar)}</Text>
                    <CountBadge n={count(x)} />
                  </Pressable>
                );
              })}
            </View>
            {!rows.length ? <Empty icon="cube-outline" text={d.t("No 3D requests here.", "لا توجد طلبات ثلاثية الأبعاد هنا.")} hint={d.t("Requests appear as soon as a shop submits them.", "تظهر الطلبات فور إرسالها من المتجر.")} /> : null}
            <View style={{ gap: 10 }}>
              {rows.map((a) => (
                <ItemRow key={a.id} title={`${a.productName}, ${a.shopName}`} box={{ ...cardStyle(d), padding: 14 }} onPress={() => router.push(`/dept/accessory3d/${a.id}` as Href)} actions={accessoryActions(d.t, a, () => list.reload())}>
                  <View style={{ flexDirection: d.row, gap: 12, alignItems: "center" }}>
                    <Thumb a={a} />
                    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                      <Text numberOfLines={2} style={{ color: d.ink, fontSize: 15, lineHeight: 22, fontWeight: "800", textAlign: d.align }}>{a.productName}</Text>
                      <Text numberOfLines={1} style={{ color: d.muted, fontSize: 12, lineHeight: 18, textAlign: d.align }}>{`${a.shopName} · ${d.t(...ACCESSORY_TYPE_LABELS[a.accessoryType])}`}</Text>
                      <Text numberOfLines={2} style={{ color: d.muted, fontSize: 12, lineHeight: 18, textAlign: d.align }}>{a.cars.length ? a.cars.map((c) => (d.ar ? c.nameAr : c.name)).join(d.ar ? "، " : ", ") : d.t("Universal by size", "عام حسب المقاس")}</Text>
                      <Text style={{ color: d.muted, fontSize: 11, lineHeight: 16, textAlign: d.align }}>{`${d.t("Submitted", "أُرسل")} ${a.submittedAt ? fmtDateTime(a.submittedAt) : "–"}`}</Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: d.row, marginTop: 8 }}>
                    <Pill tone={tone(a.status)} label={d.t(...STATUS_LABELS[a.status]).split(":")[0]!} />
                  </View>
                </ItemRow>
              ))}
            </View>
          </>
        );
      }}
    </Load>
  );
}
