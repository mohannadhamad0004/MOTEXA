// Parts shop signup, step 1 of 4: shop details. One account = ONE physical shop / branch (brand and branch name are optional labels).
// Validates with the same rules as POST /auth/provider/register and keeps the values in an in-memory draft; nothing is sent to the server.
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { MechanicField, MechanicPage, useMechanicTheme } from "../../components/MechanicUI";
import { Text } from "../../components/MotexaVisual";
import { CITIES, cityLabel } from "../../core/constants/cities";
import { useDT } from "../department/ui";
import { ProviderButton, ProviderCard, ProviderChoice, ProviderNote } from "./kit";
import { getPartsSignupDraft, setPartsSignupDraft } from "./partsSignupDraft";

type Form = { businessName: string; brandName: string; branchName: string; fullName: string; phone: string; confirmPhone: string; email: string; password: string; confirm: string; city: string; address: string };
type Errors = Partial<Record<keyof Form, string>>;

const digits = (v: string) => v.replace(/\D/g, "");

export default function PartsSignupStep1() {
  const m = useMechanicTheme();
  const d = useDT();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const saved = getPartsSignupDraft();
  const [f, setF] = useState<Form>({
    businessName: saved?.shopName ?? "",
    brandName: saved?.brandName ?? "",
    branchName: saved?.branchName ?? "",
    fullName: saved?.ownerName ?? "",
    phone: saved?.phone ?? "",
    confirmPhone: saved?.phone ?? "",
    email: saved?.email ?? "",
    password: saved?.password ?? "",
    confirm: saved?.password ?? "",
    city: saved?.city ?? "",
    address: saved?.address ?? "",
  });
  const [tried, setTried] = useState(false);
  const set = (k: keyof Form) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  // the same rules the server applies on register
  const errors: Errors = {};
  if (f.businessName.trim().length < 2) errors.businessName = m.t("Enter the shop name.", "أدخل اسم المتجر.");
  // brand and branch are optional labels: no rule beyond a length cap (the inputs have maxLength)
  if (f.fullName.trim().length < 3) errors.fullName = m.t("Enter the owner or manager full name.", "أدخل الاسم الكامل للمالك أو المدير.");
  if (!/^\+?[0-9 ()-]{8,24}$/.test(f.phone.trim())) errors.phone = m.t("Enter a valid mobile number.", "أدخل رقم هاتف صحيحًا.");
  if (!f.confirmPhone.trim()) errors.confirmPhone = m.t("Confirm the phone number.", "أكّد رقم الهاتف.");
  else if (digits(f.confirmPhone) !== digits(f.phone) || f.confirmPhone.trim().startsWith("+") !== f.phone.trim().startsWith("+")) errors.confirmPhone = m.t("The phone numbers do not match.", "رقما الهاتف غير متطابقين.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim()) || f.email.trim().length > 254) errors.email = m.t("Enter a valid email address.", "أدخل بريدًا إلكترونيًا صحيحًا.");
  if (f.password.length < 8 || f.password.length > 128 || !/[A-Z]/.test(f.password) || !/[a-z]/.test(f.password) || !/[0-9]/.test(f.password) || !/[^\w\s]/.test(f.password))
    errors.password = m.t("Use 8 to 128 characters with uppercase, lowercase, a number and a symbol.", "استخدم من 8 إلى 128 حرفًا مع حرف كبير وصغير ورقم ورمز.");
  if (!f.confirm) errors.confirm = m.t("Confirm the password.", "أكّد كلمة المرور.");
  else if (f.confirm !== f.password) errors.confirm = m.t("The passwords do not match.", "كلمتا المرور غير متطابقتين.");
  if (!f.city) errors.city = m.t("Choose a city.", "اختر المدينة.");
  if (f.address.trim().length < 3) errors.address = m.t("Enter the business address.", "أدخل عنوان النشاط.");

  const err = (k: keyof Form) => (tried ? errors[k] : undefined);
  const bad = d.chip("bad").fg;
  const field = (k: keyof Form, label: string, icon: string, extra: object = {}) => (
    <View>
      <MechanicField label={label} icon={icon as never} value={f[k]} onChangeText={set(k)} {...extra} />
      {err(k) ? (
        <Text accessibilityRole="alert" style={{ color: bad, fontSize: 12, lineHeight: 18, marginTop: 4, textAlign: m.align }}>{err(k)}</Text>
      ) : null}
    </View>
  );

  const next = () => {
    setTried(true);
    if (Object.keys(errors).length) return;
    setPartsSignupDraft({ shopName: f.businessName.trim(), brandName: f.brandName.trim() || null, branchName: f.branchName.trim() || null, ownerName: f.fullName.trim(), phone: f.phone.trim(), email: f.email.trim().toLowerCase(), password: f.password, city: f.city, address: f.address.trim() });
    if (from === "review") router.back(); // editing from the review screen: straight back to it
    else router.push("/provider/parts-signup/location" as never);
  };

  return (
    <MechanicPage back title={m.t("Create your parts shop account", "أنشئ حساب متجر قطع الغيار")} subtitle={m.t("1 of 5 — Shop details", "1 من 5 — بيانات المتجر")}>
      <View style={{ flexDirection: m.row, gap: 6, marginTop: -8, marginBottom: 14 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {[0, 1, 2, 3, 4].map((i) => (
          <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i === 0 ? "#B18350" : m.border }} />
        ))}
      </View>
      <ProviderCard>
        <View style={{ gap: 13 }}>
          {tried && Object.keys(errors).length ? <ProviderNote error>{m.t("Check the highlighted fields.", "راجع الحقول المطلوبة.")}</ProviderNote> : null}
          {field("businessName", m.t("Shop name", "اسم المتجر"), "storefront-outline", { maxLength: 120 })}
          {field("brandName", m.t("Brand / company name (optional)", "اسم العلامة / الشركة (اختياري)"), "pricetag-outline", { maxLength: 120 })}
          {field("branchName", m.t("Branch name (optional)", "اسم الفرع (اختياري)"), "git-branch-outline", { maxLength: 120 })}
          {field("fullName", m.t("Owner or manager full name", "الاسم الكامل للمالك أو المدير"), "person-outline", { maxLength: 120, autoComplete: "name" })}
          {field("phone", m.t("Mobile phone number", "رقم الهاتف المحمول"), "call-outline", { keyboardType: "phone-pad", maxLength: 24, autoComplete: "tel" })}
          {field("confirmPhone", m.t("Confirm phone number", "تأكيد رقم الهاتف"), "call-outline", { keyboardType: "phone-pad", maxLength: 24 })}
          {field("email", m.t("Email", "البريد الإلكتروني"), "mail-outline", { autoCapitalize: "none", keyboardType: "email-address", autoComplete: "email", maxLength: 254 })}
          {field("password", m.t("Password", "كلمة المرور"), "lock-closed-outline", { secureTextEntry: true, autoCapitalize: "none", autoComplete: "new-password", maxLength: 128 })}
          {err("password") ? null : (
  <Text style={{ fontSize: 11, lineHeight: 18, color: m.muted, textAlign: m.align, marginTop: -6 }}>
              {m.t("8 to 128 characters with uppercase, lowercase, a number and a symbol.", "من 8 إلى 128 حرفًا مع حرف كبير وصغير ورقم ورمز.")}
            </Text>
          )}
          {field("confirm", m.t("Confirm password", "تأكيد كلمة المرور"), "lock-closed-outline", { secureTextEntry: true, autoCapitalize: "none", autoComplete: "new-password", maxLength: 128 })}
          <View style={{ gap: 6 }}>
            <Text style={{ fontSize: 12, lineHeight: 20, fontWeight: "600", color: m.ink, textAlign: m.align }}>{m.t("City", "المدينة")}</Text>
            <View style={{ flexDirection: m.row, flexWrap: "wrap", gap: 8 }}>
              {CITIES.map((c) => (
                <ProviderChoice key={c.name} label={cityLabel(c.name, m.ar)} selected={f.city === c.name} onPress={() => set("city")(c.name)} />
              ))}
            </View>
            {err("city") ? <Text accessibilityRole="alert" style={{ color: bad, fontSize: 12, lineHeight: 18, textAlign: m.align }}>{err("city")}</Text> : null}
          </View>
          {field("address", m.t("Business address", "عنوان النشاط"), "location-outline", { maxLength: 200, autoComplete: "street-address" })}
          <ProviderButton label={from === "review" ? m.t("Save and return to review", "حفظ والعودة إلى المراجعة") : m.t("Continue to location", "المتابعة إلى الموقع")} onPress={next} />
          <ProviderButton secondary label={m.t("I already have an account", "لدي حساب بالفعل")} onPress={() => router.replace({ pathname: "/auth/login", params: { selectedRole: "parts" } })} />
          <Text style={{ fontSize: 12, lineHeight: 19, color: m.muted, textAlign: m.align }}>
            {m.t("You’ll add your shop location and business documents in the next steps.", "ستضيف موقع متجرك ومستندات نشاطك في الخطوات التالية.")}
          </Text>
        </View>
      </ProviderCard>
    </MechanicPage>
  );
}
