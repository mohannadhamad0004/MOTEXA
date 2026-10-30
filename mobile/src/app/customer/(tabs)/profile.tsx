import { router } from "expo-router";
import { View } from "react-native";
import { Card, Chip, GarageHero, GaragePage, GButton, GIcon, GText, ListRow, Section } from "../../../components/garage";
import { useAppearance } from "../../../components/Appearance";
import { useL } from "../../../core/hooks/useL";
import { useLanguage } from "../../../i18n/LanguageContext";
import { carName } from "../../../features/catalog/catalogBits";
import { currentCar } from "../../../features/catalog/catalogService";
import { signOut, useSessionUser } from "../../../features/shared/session";
import { gShape, gType, useGarageTheme } from "../../../theme/garage";

export default function CustomerProfile() {
  const user = useSessionUser();
  const { g, row, align } = useGarageTheme();
  const { t } = useL();
  const { language, setLanguage } = useLanguage();
  const { mode, setMode } = useAppearance();
  const car = currentCar();
  const setCar = () => router.navigate({ pathname: "/customer/parts", params: { fit: "1" } });
  const initial = (user.fullName.trim()[0] ?? "?").toUpperCase();

  return (
    <GaragePage
      tabs
      entry="profile"
      hero={
        <GarageHero
          title={user.fullName}
          line={user.email}
          visual={
            <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: g.accent, alignItems: "center", justifyContent: "center" }}>
              <GText style={{ fontSize: 34, lineHeight: 42, fontWeight: "800", color: g.onAccent }}>{initial}</GText>
            </View>
          }
        />
      }
    >
      <Card onPress={setCar} label={car ? carName(car) : t("Set your car", "حدّد سيارتك")}>
        <View style={[row, { alignItems: "center", gap: 14 }]}>
          <View style={{ width: 52, height: 52, borderRadius: gShape.small, backgroundColor: g.tint, alignItems: "center", justifyContent: "center" }}>
            <GIcon name="car-sport-outline" size={26} />
          </View>
          <View style={{ flex: 1 }}>
            <GText soft style={[gType.caption, { fontWeight: "700" }, align]}>{t("My car", "سيارتي")}</GText>
            <GText numberOfLines={2} style={[gType.label, { fontWeight: "800", fontSize: 16 }, align]}>{car ? carName(car) : t("Set your car", "حدّد سيارتك")}</GText>
            {!car ? <GText soft style={[gType.caption, align]}>{t("To see parts that fit it", "لعرض القطع المناسبة لها")}</GText> : null}
          </View>
          <GIcon name="chevron-forward" size={18} color={g.soft} flip />
        </View>
      </Card>

      <Section title={t("Activity", "النشاط")}>
        <Card pad={12}>
          <ListRow icon="document-text-outline" title={t("My requests", "طلباتي")} sub={t("Questions, tow and mechanic requests", "الأسئلة وطلبات السحب والميكانيكي")} onPress={() => router.push("/customer/requests")} />
          <ListRow divider icon="notifications-outline" title={t("Notifications", "الإشعارات")} sub={t("Request updates show in My requests", "تظهر تحديثات الطلبات في طلباتي")} onPress={() => router.push("/customer/requests")} />
        </Card>
      </Section>

      <Section title={t("Settings", "الإعدادات")}>
        <Card pad={12}>
          <ListRow icon="language-outline" title={t("Language", "اللغة")} />
          <View style={[row, { gap: 8, paddingBottom: 10 }]}>
            <Chip label="English" on={language === "en"} onPress={() => setLanguage("en")} />
            <Chip label="العربية" on={language === "ar"} onPress={() => setLanguage("ar")} />
          </View>
          <ListRow divider icon="contrast-outline" title={t("Appearance", "المظهر")} />
          <View style={[row, { gap: 8, paddingBottom: 10, flexWrap: "wrap" }]}>
            <Chip icon="sunny-outline" label={t("Light", "فاتح")} on={mode === "light"} onPress={() => setMode("light")} />
            <Chip icon="moon-outline" label={t("Dark", "داكن")} on={mode === "dark"} onPress={() => setMode("dark")} />
            <Chip icon="phone-portrait-outline" label={t("System", "النظام")} on={mode === "system"} onPress={() => setMode("system")} />
          </View>
          <ListRow divider icon="car-sport-outline" title={t("My car", "سيارتي")} sub={car ? carName(car) : t("Not set", "غير محددة")} onPress={setCar} />
        </Card>
      </Section>

      {__DEV__ ? (
        <Section title="Dev">
          <Card pad={12}>
            <ListRow icon="color-palette-outline" title="DEV: Garage lab" sub="Every garage component" onPress={() => router.push("/dev/garage-lab" as never)} />
            <ListRow divider icon="sparkles-outline" title="DEV: Motion lab" sub="Every motion piece with Replay" onPress={() => router.push("/dev/motion-lab" as never)} />
          </Card>
        </Section>
      ) : null}

      <View style={{ marginTop: 28 }}>
        <GButton variant="danger" icon="log-out-outline" label={t("Sign out", "تسجيل الخروج")} onPress={signOut} />
      </View>
    </GaragePage>
  );
}
