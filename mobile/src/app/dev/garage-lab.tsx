// DEV ONLY: every garage component in the current Light/Dark x EN/AR (switch both at the top). Linked from Profile in dev.
import { Redirect, router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import {
  Badge,
  Bubble,
  Card,
  Chip,
  DateSeparator,
  EmptyState,
  ErrorState,
  GarageFonts,
  GarageHero,
  GaragePage,
  GButton,
  GIcon,
  GText,
  IconButton,
  ListRow,
  MoClip,
  Photo,
  Rail,
  SearchBar,
  Section,
  ServiceCard,
  SkeletonCards,
  StatusChip,
  StepperHeader,
  SystemPill,
  Tabs,
  Timeline,
  Toggle,
} from "../../components/garage";
import { useAppearance } from "../../components/Appearance";
import { useLanguage } from "../../i18n/LanguageContext";
import { PHOTO_KEYS } from "../../theme/photos";
import { gType, useGarageTheme } from "../../theme/garage";

function Lab() {
  const { mode, setMode } = useAppearance();
  const { isArabic, toggleLanguage } = useLanguage();
  const { g, row } = useGarageTheme();
  const [q, setQ] = useState("");
  const [on, setOn] = useState(true);
  const [tab, setTab] = useState<"a" | "p">("a");
  const t = (en: string, ar: string) => (isArabic ? ar : en);
  return (
    <GaragePage
      hero={
        <GarageHero
          onBack={() => router.back()}
          title={t("Good morning, Lab", "صباح الخير يا مختبر")}
          line={t("12 parts fit your Toyota Corolla", "12 قطعة تناسب تويوتا كورولا")}
          chip={{ label: "Toyota Corolla · 2018", onPress: () => {} }}
          action={{ icon: "notifications-outline", label: "Notifications", onPress: () => {}, badge: 2 }}
          visual={<MoClip clip="home" width={150} label="Mo" />}
        />
      }
    >
      <Card>
        <View style={[row, { gap: 8, flexWrap: "wrap" }]}>
          {(["light", "dark", "system"] as const).map((m) => (
            <Chip key={m} label={m} on={mode === m} onPress={() => setMode(m)} />
          ))}
          <Chip label={isArabic ? "EN" : "AR"} icon="language-outline" onPress={toggleLanguage} />
        </View>
      </Card>

      <Section title="SearchBar · Toggle · Tabs">
        <View style={{ gap: 12 }}>
          <SearchBar value={q} onChangeText={setQ} placeholder={t("Search parts, OEM, brand", "ابحث عن قطعة أو رقم أو ماركة")} />
          <Card>
            <Toggle label={t("Fits my car", "تناسب سيارتي")} sub="Toyota Corolla 2018" value={on} onChange={setOn} />
          </Card>
          <Tabs value={tab} onChange={setTab} options={[{ key: "a", label: t("Active", "النشطة"), count: 2 }, { key: "p", label: t("Past", "السابقة") }]} />
        </View>
      </Section>

      <Section title="ServiceCard">
        <View style={[row, { gap: 10 }]}>
          <ServiceCard photo="service.tow" title={t("Tow", "سحب")} sub={t("4 trucks free", "4 شاحنات متاحة")} primary onPress={() => {}} />
          <ServiceCard photo="service.parts" title={t("Parts", "قطع")} sub={t("12 fit you", "12 تناسبك")} onPress={() => {}} />
          <ServiceCard photo="service.mechanics" title={t("Mechanics", "ميكانيكي")} sub={t("8 verified", "8 موثّقون")} onPress={() => {}} />
        </View>
      </Section>

      <Section title="Buttons · chips · badges">
        <View style={{ gap: 10 }}>
          <GButton label={t("Request nearest", "اطلب الأقرب")} icon="navigate-outline" onPress={() => {}} />
          <View style={[row, { gap: 10 }]}>
            <GButton flex variant="secondary" label={t("View", "عرض")} onPress={() => {}} />
            <GButton flex variant="ghost" label={t("Cancel", "إلغاء")} onPress={() => {}} />
          </View>
          <GButton variant="danger" label={t("Sign out", "تسجيل الخروج")} onPress={() => {}} />
          <View style={[row, { gap: 8, alignItems: "center" }]}>
            <IconButton icon="map-outline" label="Map" onPress={() => {}} />
            <IconButton icon="notifications-outline" label="Bell" badge={3} onPress={() => {}} />
            <IconButton icon="arrow-forward" label="Go" tone="accent" onPress={() => {}} flip />
          </View>
          <View style={[row, { gap: 6, flexWrap: "wrap" }]}>
            <StatusChip label={t("Draft", "مسودة")} tone="neutral" />
            <StatusChip label={t("Submitted", "مُرسل")} tone="accent" />
            <StatusChip label={t("Needs changes", "يحتاج تعديلات")} tone="warning" />
            <StatusChip label={t("Approved", "معتمد")} tone="success" />
            <StatusChip label={t("Rejected", "مرفوض")} tone="danger" />
          </View>
          <View style={[row, { gap: 6, flexWrap: "wrap" }]}>
            <Badge label="−20%" tone="danger" />
            <Badge label={t("Sold out", "نفدت الكمية")} tone="dark" />
            <Badge label={t("Only 2 left", "بقي 2 فقط")} tone="warning" />
            <Badge label={t("New", "جديد")} tone="success" />
            <Badge label={t("Used", "مستعمل")} tone="neutral" />
          </View>
        </View>
      </Section>

      <Section title="ListRow">
        <Card pad={12}>
          <ListRow icon="car-sport-outline" title={t("My car", "سيارتي")} sub="Toyota Corolla · 2018" onPress={() => {}} />
          <ListRow divider icon="language-outline" title={t("Language", "اللغة")} end={<GText soft>{isArabic ? "العربية" : "English"}</GText>} />
          <ListRow divider icon="log-out-outline" title={t("Sign out", "تسجيل الخروج")} danger onPress={() => {}} />
        </Card>
      </Section>

      <Section title="Stepper · Timeline">
        <Card>
          <StepperHeader steps={[t("Part", "القطعة"), t("Details", "التفاصيل"), t("Send", "الإرسال")]} index={1} label={(i, n) => t(`Step ${i} of ${n}`, `الخطوة ${i} من ${n}`)} />
          <Timeline
            steps={[
              { label: t("Requested", "تم الطلب"), at: "10:02", state: "done" },
              { label: t("Accepted", "مقبول"), at: "10:05", state: "done" },
              { label: t("On the way", "في الطريق"), state: "current" },
              { label: t("Completed", "مكتمل"), state: "todo" },
            ]}
          />
        </Card>
      </Section>

      <Section title="Chat">
        <Card soft>
          <DateSeparator label={t("Today", "اليوم")} />
          <SystemPill text={t("Question sent to the shop", "تم إرسال السؤال إلى المتجر")} />
          <Bubble mine text={t("Do you have it for a 2018 Corolla?", "هل تتوفر لكورولا 2018؟")} meta="10:12" />
          <Bubble mine={false} text={t("Yes, two in stock.", "نعم، قطعتان متوفرتان.")} meta="10:20" />
        </Card>
      </Section>

      <Section title="States">
        <Card>
          <EmptyState photo="empty.requests" text={t("No requests yet.", "لا توجد طلبات بعد.")} action={{ label: t("Find parts", "ابحث عن قطع"), onPress: () => {} }} />
          <ErrorState text={t("Could not load. Check your connection.", "تعذّر التحميل. تحقق من الاتصال.")} onRetry={() => {}} retryLabel={t("Retry", "إعادة المحاولة")} />
          <SkeletonCards count={2} />
        </Card>
      </Section>

      <Section title={`Photo keys (${PHOTO_KEYS.length})`}>
        <Rail>
          {PHOTO_KEYS.map((k) => (
            <View key={k} style={{ width: 120, gap: 6 }}>
              <Photo k={k} style={{ width: 120, height: 90 }} radius={16} />
              <GText soft numberOfLines={1} style={gType.tiny}>{k}</GText>
            </View>
          ))}
        </Rail>
      </Section>

      <Section title="Tokens">
        <View style={[row, { flexWrap: "wrap", gap: 8 }]}>
          {Object.entries(g).map(([k, v]) => (
            <View key={k} style={{ width: 96, gap: 4 }}>
              <View style={{ height: 36, borderRadius: 10, backgroundColor: v, borderWidth: 1, borderColor: g.line }} />
              <GText soft numberOfLines={1} style={gType.tiny}>{`${k} ${v}`}</GText>
            </View>
          ))}
        </View>
        <View style={[row, { gap: 6, alignItems: "center", marginTop: 12 }]}>
          <GIcon name="sparkles-outline" />
          <GText style={gType.display}>Display 26</GText>
        </View>
      </Section>
    </GaragePage>
  );
}

export default function GarageLab() {
  if (!__DEV__) return <Redirect href="/" />;
  return (
    <GarageFonts>
      <Lab />
    </GarageFonts>
  );
}
