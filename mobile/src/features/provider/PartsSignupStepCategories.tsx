// Parts shop signup, step 3 of 5: categories. The real parts catalogue (CATALOG_GROUPS, the same keys the backend validates and
// PartsShopProfile.categories stores); at least one is required. Kept in the in-memory draft; nothing is sent here.
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { MechanicPage, useMechanicTheme } from "../../components/MechanicUI";
import { Text } from "../../components/MotexaVisual";
import { CATALOG_GROUPS } from "../../core/constants/categories";
import { useDT } from "../department/ui";
import { ProviderButton, ProviderChoice, ProviderNote } from "./kit";
import { getPartsSignupDraft, setPartsCategories } from "./partsSignupDraft";

export default function PartsSignupStepCategories() {
  const d = getPartsSignupDraft();
  if (!d) return <Redirect href={"/provider/parts-signup" as never} />;
  if (d.lat === undefined) return <Redirect href={"/provider/parts-signup/location" as never} />;
  return <Body />;
}

function Body() {
  const m = useMechanicTheme();
  const dt = useDT();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const [picked, setPicked] = useState<string[]>(getPartsSignupDraft()!.categories);
  const [tried, setTried] = useState(false);
  const toggle = (k: string) => {
    const next = picked.includes(k) ? picked.filter((x) => x !== k) : [...picked, k];
    setPicked(next);
    setPartsCategories(next); // the draft always matches what is on screen, so Back and forward keep it
  };
  const next = () => {
    setTried(true);
    if (!picked.length) return;
    if (from === "review") router.back();
    else router.push("/provider/parts-signup/documents" as never);
  };

  return (
    <MechanicPage back title={m.t("What parts does your shop sell?", "ما القطع التي يبيعها متجرك؟")} subtitle={m.t("3 of 5 — Categories", "3 من 5 — الفئات")}>
      <View style={{ flexDirection: m.row, gap: 6, marginTop: -8, marginBottom: 14 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {[0, 1, 2, 3, 4].map((i) => (
          <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= 2 ? "#B18350" : m.border }} />
        ))}
      </View>
      <View style={{ gap: 13 }}>
        <ProviderNote>{m.t("Choose the categories this shop actually provides. These help customers find the right parts and are required before MOTEXA can approve the shop.", "اختر الفئات التي يوفّرها هذا المتجر فعلًا. تساعد هذه الفئات العملاء على إيجاد القطع المناسبة وهي مطلوبة قبل أن تتمكن MOTEXA من اعتماد المتجر.")}</ProviderNote>
        {CATALOG_GROUPS.map((g) => (
          <View key={g.key} style={{ gap: 8 }}>
            <Text accessibilityRole="header" style={{ fontSize: 13, fontWeight: "700", color: dt.ink, textAlign: m.align }}>{m.t(g.en, g.ar)}</Text>
            <View style={{ flexDirection: m.row, flexWrap: "wrap", gap: 8 }}>
              {g.categories.map((c) => (
                <ProviderChoice key={c.key} label={m.t(c.en, c.ar)} selected={picked.includes(c.key)} icon={c.icon} onPress={() => toggle(c.key)} />
              ))}
            </View>
          </View>
        ))}
        <Text accessibilityLiveRegion="polite" style={{ color: tried && !picked.length ? dt.chip("bad").fg : dt.muted, fontSize: 12, lineHeight: 19, textAlign: m.align }}>
          {tried && !picked.length ? m.t("Choose at least one category.", "اختر فئة واحدة على الأقل.") : m.t(`${picked.length} selected`, `${picked.length} مختارة`)}
        </Text>
        <ProviderButton label={from === "review" ? m.t("Save and return to review", "حفظ والعودة إلى المراجعة") : m.t("Continue to documents", "المتابعة إلى المستندات")} onPress={next} disabled={!picked.length} />
        <ProviderButton secondary label={m.t("Back", "رجوع")} onPress={() => router.back()} />
      </View>
    </MechanicPage>
  );
}
