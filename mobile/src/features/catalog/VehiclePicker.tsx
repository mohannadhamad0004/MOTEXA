import { useEffect, useState } from "react";
import { View } from "react-native";
import { Chip, Field, GIcon, GText, Note, Tap } from "../../components/garage";
import { gShape, gType, useGarageTheme } from "../../theme/garage";
import { useL } from "../../core/hooks/useL";
import { CatalogVehicle, catalogService } from "./catalogService";

type Car = { make: string; model: string; year: string; trim: string };
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Pick a vehicle from the ones that really appear in the parts' fitment data (so the choice always resolves to the same
 * make / model strings the server filters on), then optionally a year. Typing "mercedes w202" narrows the list; it is
 * never matched against product names.
 */
export function VehiclePicker({ value, onChange }: { value: Car; onChange: (v: Car) => void }) {
  const { g } = useGarageTheme();
  const { t, row, align } = useL();
  const [q, setQ] = useState("");
  const [list, setList] = useState<CatalogVehicle[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    const h = setTimeout(() => {
      catalogService
        .getVehicles(q)
        .then((v) => live && (setList(v), setError(null)))
        .catch((e) => live && setError(e.message));
    }, q ? 250 : 0);
    return () => {
      live = false;
      clearTimeout(h);
    };
  }, [q]);

  const chosen = list?.find((v) => same(v.make, value.make) && same(v.model, value.model)) ?? null;
  return (
    <View>
      <Field
        label={t("Vehicle", "المركبة")}
        value={q}
        onChangeText={setQ}
        placeholder={t("Search make or model, e.g. Mercedes W202", "ابحث بالشركة أو الطراز، مثل Mercedes W202")}
        autoCapitalize="none"
      />
      {value.make ? (
        <GText style={[gType.caption, { color: g.accentText, fontWeight: "800", marginBottom: 8 }, align]}>{`${t("Selected", "المحدد")}: ${value.make} ${value.model}`}</GText>
      ) : null}
      {error ? (
        <Note tone="danger" icon="alert-circle-outline">{error}</Note>
      ) : list && !list.length ? (
        <Note>{t("No vehicle with listed parts matches this search.", "لا توجد مركبة مطابقة لها قطع معروضة.")}</Note>
      ) : (
        <View style={{ gap: 8, marginBottom: 14 }}>
          {(list ?? []).slice(0, 6).map((v) => {
            const on = same(v.make, value.make) && same(v.model, value.model);
            return (
              <Tap
                key={`${v.make}|${v.model}`}
                label={`${v.make} ${v.model}`}
                onPress={() => onChange({ make: v.make, model: v.model, year: on ? value.year : "", trim: on ? value.trim : "" })}
                style={[row, { minHeight: 56, alignItems: "center", gap: 10, paddingHorizontal: 14, borderRadius: gShape.small, borderWidth: 1, borderColor: on ? g.accent : g.line, backgroundColor: on ? g.tint : g.card }]}
              >
                <GIcon name="car-sport-outline" size={20} color={on ? g.accentText : g.soft} />
                <View style={{ flex: 1 }}>
                  <GText numberOfLines={1} style={[gType.label, { fontWeight: "800" }, align]}>{`${v.make} ${v.model}`}</GText>
                  <GText soft numberOfLines={1} style={[gType.caption, align]}>{`${v.yearFrom}–${v.yearTo} · ${v.partCount} ${v.partCount === 1 ? t("part", "قطعة") : t("parts", "قطع")}`}</GText>
                </View>
                {on ? <GIcon name="checkmark-circle" size={20} /> : null}
              </Tap>
            );
          })}
        </View>
      )}
      {value.make ? (
        <Field
          label={t("Year (optional)", "السنة (اختياري)")}
          value={value.year}
          onChangeText={(y) => onChange({ ...value, year: y })}
          placeholder={chosen ? `${chosen.yearFrom}–${chosen.yearTo}` : "2016"}
          keyboardType="number-pad"
          maxLength={4}
        />
      ) : null}
      {chosen && chosen.trims.length ? (
        <View style={{ marginBottom: 14 }}>
          <GText style={[gType.caption, { fontWeight: "700", marginBottom: 7 }, align]}>{t("Engine / variant (optional)", "المحرك / النسخة (اختياري)")}</GText>
          <View style={[row, { flexWrap: "wrap", gap: 8 }]}>
            {chosen.trims.map((tr) => (
              <Chip key={tr} label={tr} on={same(tr, value.trim)} onPress={() => onChange({ ...value, trim: same(tr, value.trim) ? "" : tr })} />
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}
