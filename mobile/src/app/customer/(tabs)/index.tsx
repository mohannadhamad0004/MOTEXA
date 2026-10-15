import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { CustomerScreen } from "../../../features/catalog/CustomerScreen";
import { C } from "../../../features/shared/palette";
import { useSessionUser } from "../../../features/shared/session";
import { Badge, Button, Card, Header, SearchBar, Section, useL } from "../../../features/shared/ui";

type IconName = keyof typeof Ionicons.glyphMap;

export default function CustomerHome() {
  const user = useSessionUser();
  const { t, row, align } = useL();
  const [q, setQ] = useState("");

  const action = (icon: IconName, title: string, text: string, onPress: () => void) => (
    <Card label={title} onPress={onPress}>
      <View style={[row, { alignItems: "center", gap: 14 }]}>
        <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: C.accentSoft, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name={icon} size={26} color={C.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={[{ color: C.text, fontSize: 17, fontWeight: "800" }, align]}>{title}</Text>
          <Text numberOfLines={2} style={[{ color: C.textMuted, fontSize: 12, marginTop: 3, lineHeight: 18 }, align]}>{text}</Text>
        </View>
        <Ionicons name={row.flexDirection === "row-reverse" ? "chevron-back" : "chevron-forward"} size={19} color={C.accent} />
      </View>
    </Card>
  );

  return (
    <CustomerScreen tabs>
      <Header brand="MOTEXA" title={`${t("Hello", "مرحبًا")}, ${user.fullName}`} subtitle={t("What do you need today?", "ماذا تحتاج اليوم؟")} />
      <SearchBar value={q} onChange={setQ} placeholder={t("Search parts by name or part number", "ابحث عن قطعة بالاسم أو رقم القطعة")} />
      <Button
        icon="search-outline"
        label={t("Search parts", "ابحث عن القطع")}
        onPress={() => router.navigate({ pathname: "/customer/parts", params: q.trim() ? { q: q.trim() } : {} })}
      />

      <Section title={t("What do you need?", "ماذا تحتاج؟")} />
      {action("cube-outline", t("Find parts", "ابحث عن قطع"), t("Search spare parts, or only those that fit your car.", "ابحث عن قطع الغيار، أو القطع المناسبة لسيارتك فقط."), () => router.navigate("/customer/parts"))}
      {action("car-outline", t("Tow a car", "اسحب سيارة"), t("See approved tow companies and their trucks.", "تعرّف على شركات السحب المعتمدة وشاحناتها."), () => router.navigate("/customer/tow"))}
      {action("build-outline", t("Find a mechanic", "ابحث عن ميكانيكي"), t("Mechanic profiles are coming soon.", "ملفات الميكانيكيين قادمة قريبًا."), () => router.navigate("/customer/mechanics"))}

      <Card>
        <View style={[row, { alignItems: "center", gap: 14 }]}>
          <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: C.accentSoft, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="sparkles-outline" size={26} color={C.textMuted} />
          </View>
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={[{ color: C.text, fontSize: 17, fontWeight: "800" }, align]}>{t("AI car diagnosis", "تشخيص السيارة بالذكاء الاصطناعي")}</Text>
            <Text numberOfLines={2} style={[{ color: C.textMuted, fontSize: 12, marginTop: 3, lineHeight: 18 }, align]}>
              {t("Describe a problem and get help. Not available yet.", "صف المشكلة واحصل على المساعدة. غير متاح بعد.")}
            </Text>
          </View>
        </View>
        <View style={[row, { marginTop: 12 }]}>
          <Badge tone="neutral" icon="time-outline" label={t("Coming soon", "قريبًا")} />
        </View>
      </Card>
    </CustomerScreen>
  );
}
