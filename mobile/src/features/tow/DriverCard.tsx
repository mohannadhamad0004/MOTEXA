import { Image } from "expo-image";
import { router } from "expo-router";
import { Pressable, View } from "react-native";
import { Card, GIcon, GText, StatusChip } from "../../components/garage";
import { publicImageUrl } from "../../core/constants/files";
import { useL } from "../../core/hooks/useL";
import { gShape, gType, useGarageTheme } from "../../theme/garage";
import type { DriverCardData, Rating } from "./dispatchService";
import { useTruckLabels } from "./truckBits";

/** "★ 4.7 (12)" or "New" when nobody rated yet (no invented numbers). */
export function RatingText({ rating, style }: { rating: Rating; style?: object }) {
  const { t } = useL();
  const { g } = useGarageTheme();
  return rating.avg === null ? (
    <GText style={[gType.caption, { color: g.soft, fontWeight: "700" }, style]}>{t("New", "جديد")}</GText>
  ) : (
    <GText style={[gType.caption, { color: g.ink, fontWeight: "700" }, style]}>{`★ ${rating.avg.toFixed(1)} (${rating.count})`}</GText>
  );
}

function Avatar({ uri, name, size }: { uri: string | null; name: string; size: number }) {
  const { g } = useGarageTheme();
  const src = publicImageUrl(uri);
  return src ? (
    <Image source={{ uri: src }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: g.tint }} contentFit="cover" accessibilityLabel={name} />
  ) : (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: g.tint, alignItems: "center", justifyContent: "center" }}>
      <GText style={[gType.title, { color: g.accentText }]}>{name.trim().charAt(0).toUpperCase()}</GText>
    </View>
  );
}

/** The responsible company: initials (there is no logo upload), name, verified badge. Tap -> its public profile. */
export function CompanyLine({ company }: { company: { id: string; name: string; verified: boolean; rating?: Rating } }) {
  const { t } = useL();
  const { g, row, align } = useGarageTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${t("Responsible company", "الشركة المسؤولة")}: ${company.name}`}
      onPress={() => router.push({ pathname: "/customer/tow/[id]", params: { id: company.id } })}
      style={[row, { alignItems: "center", gap: 10, minHeight: 48, paddingVertical: 6 }]}
    >
      <View style={{ width: 36, height: 36, borderRadius: gShape.small, backgroundColor: g.tint, alignItems: "center", justifyContent: "center" }}>
        <GText style={[gType.label, { color: g.accentText, fontWeight: "800" }]}>{company.name.trim().slice(0, 2).toUpperCase()}</GText>
      </View>
      <View style={{ flex: 1 }}>
        <GText soft style={[gType.tiny, align]}>{t("Responsible company", "الشركة المسؤولة")}</GText>
        <View style={[row, { alignItems: "center", gap: 6 }]}>
          <GText numberOfLines={1} style={[gType.label, { fontWeight: "800", flexShrink: 1 }, align]}>{company.name}</GText>
          {company.verified ? <GIcon name="checkmark-circle" size={16} color={g.success} /> : null}
        </View>
      </View>
      {company.rating ? <RatingText rating={company.rating} /> : null}
      <GIcon name="chevron-forward" size={18} color={g.soft} />
    </Pressable>
  );
}

/**
 * Where a driver appears to a customer: photo, first name + last initial, rating, completed tows, truck (type, photo, plate
 * partly hidden until assigned) and ALWAYS the responsible company. `extra` = distance / ETA line. Never a phone number.
 */
export function DriverCard({ d, extra, onPress, selected }: { d: DriverCardData; extra?: string | null; onPress?: () => void; selected?: boolean }) {
  const { t } = useL();
  const { type } = useTruckLabels();
  const { g, row, align } = useGarageTheme();
  const truckPhoto = publicImageUrl(d.truck?.photoUri);
  return (
    <Card pad={12} style={selected ? { borderWidth: 2, borderColor: g.accent } : undefined}>
      {/* the company line below is its own button, so only this top part is pressable (no button inside a button) */}
      <Pressable disabled={!onPress} onPress={onPress} accessibilityRole={onPress ? "button" : undefined} accessibilityLabel={d.name}>
      <View style={[row, { alignItems: "center", gap: 12 }]}>
        <Avatar uri={d.photoUri} name={d.name} size={56} />
        <View style={{ flex: 1, gap: 2 }}>
          <GText numberOfLines={1} style={[gType.title, align]}>{d.name}</GText>
          <View style={[row, { alignItems: "center", gap: 8, flexWrap: "wrap" }]}>
            <RatingText rating={d.rating} />
            <GText soft style={gType.caption}>{t(`${d.completedTows} tows`, `${d.completedTows} عملية سحب`)}</GText>
          </View>
          {extra ? <GText soft style={[gType.caption, align]}>{extra}</GText> : null}
        </View>
        {selected ? <StatusChip tone="success" label={t("Chosen", "مختار")} /> : null}
      </View>
      {d.truck ? (
        <View style={[row, { alignItems: "center", gap: 10, marginTop: 10 }]}>
          {truckPhoto ? (
            <Image source={{ uri: truckPhoto }} style={{ width: 64, height: 44, borderRadius: gShape.small, backgroundColor: g.tint }} contentFit="cover" />
          ) : (
            <View style={{ width: 64, height: 44, borderRadius: gShape.small, backgroundColor: g.tint, alignItems: "center", justifyContent: "center" }}>
              <GIcon name="car-outline" size={22} color={g.accentText} />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <GText numberOfLines={1} style={[gType.caption, { fontWeight: "700" }, align]}>{`${type[d.truck.type]} · ${d.truck.make} ${d.truck.model}`}</GText>
            <GText soft style={[gType.caption, { writingDirection: "ltr" }, align]}>{d.truck.plate}</GText>
          </View>
        </View>
      ) : null}
      </Pressable>
      <View style={{ height: 1, backgroundColor: g.line, marginVertical: 6 }} />
      <CompanyLine company={d.company} />
    </Card>
  );
}
