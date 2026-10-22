import { router } from "expo-router";
import { ReactNode } from "react";
import { View } from "react-native";
import { BlueprintPage, CarTop, H1, Icon, IconName, Mono, Pill, PrimaryButton, Press, Rise, SettingsControls, Tag } from "../../../components/blueprint";
import { Text } from "../../../components/ui/Text";
import { useL } from "../../../core/hooks/useL";
import { carName } from "../../../features/catalog/catalogBits";
import { currentCar } from "../../../features/catalog/catalogService";
import { signOut, useSessionUser } from "../../../features/shared/session";
import { useTheme } from "../../../theme/useTheme";

function Group({ title, children }: { title: string; children: ReactNode }) {
  const { c } = useTheme();
  return (
    <Rise style={{ marginTop: 32 }}>
      <View style={{ marginBottom: 8 }}>
        <Tag color={c.soft}>{title}</Tag>
      </View>
      <View style={{ borderRadius: 20, borderWidth: 1, borderColor: c.line, backgroundColor: c.field, paddingHorizontal: 16 }}>{children}</View>
    </Rise>
  );
}

function Item({ icon, label, sub, onPress }: { icon: IconName; label: string; sub?: string; onPress: () => void }) {
  const { c, row, align } = useTheme();
  return (
    <Press accessibilityLabel={label} onPress={onPress} style={[row, { minHeight: 56, alignItems: "center", gap: 12, paddingVertical: 8 }]}>
      <Icon name={icon} size={20} color={c.bronze} />
      <View style={{ flex: 1 }}>
        <Text style={[{ color: c.ink, fontSize: 14, fontWeight: "600" }, align]}>{label}</Text>
        {sub ? <Text numberOfLines={1} style={[{ color: c.soft, fontSize: 12 }, align]}>{sub}</Text> : null}
      </View>
      <Icon name="chev" size={16} color={c.soft} />
    </Press>
  );
}

export default function CustomerProfile() {
  const user = useSessionUser();
  const { c } = useTheme();
  const { t } = useL();
  const car = currentCar();
  const plate = car ? [`${car.make} ${car.model}`.trim(), car.year].filter(Boolean).join(" · ") : null;
  return (
    <BlueprintPage
      tabs
      hero={{
        tl: t("Your MOTEXA workspace", "مساحتك في موتكسا"),
        tr: "M / 05",
        br: plate ? (
          <View style={{ maxWidth: "62%", borderRadius: 6, borderWidth: 1, borderColor: c.bronzeLight, paddingHorizontal: 8, paddingVertical: 4 }}>
            <Mono color={c.bronzeLight} numberOfLines={1}>{plate.toUpperCase()}</Mono>
          </View>
        ) : undefined,
        art: (
          <View style={{ width: "100%", maxWidth: 280, height: "100%" }}>
            <CarTop animate />
          </View>
        ),
      }}
    >
      <Pill icon={<Icon name="shield" size={16} color={c.bronze} />}>{t("Car owner", "صاحب سيارة")}</Pill>
      <H1>{user.fullName}</H1>
      <View style={{ marginTop: 8 }}>
        <Mono>{user.email}</Mono>
      </View>

      <Group title={t("My car", "سيارتي")}>
        <Item
          icon="car"
          label={car ? carName(car) : t("Set your car", "حدّد سيارتك")}
          sub={car ? undefined : t("To see parts that fit it", "لعرض القطع المناسبة لها")}
          onPress={() => router.navigate({ pathname: "/customer/parts", params: { fit: "1" } })}
        />
      </Group>

      <Group title={t("Activity", "النشاط")}>
        <Item icon="list" label={t("My requests", "طلباتي")} onPress={() => router.push("/customer/requests")} />
      </Group>

      <Group title={t("Settings", "الإعدادات")}>
        <SettingsControls />
      </Group>

      <PrimaryButton style={{ marginTop: 32 }} variant="danger" icon="logout" label={t("Sign out", "تسجيل الخروج")} onPress={signOut} />
    </BlueprintPage>
  );
}
