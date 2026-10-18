import { apiUrl } from "../../features/shared/api";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { ReactNode, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
} from "react-native";

import { useLanguage } from "../../i18n/LanguageContext";

// Mechanic verification application. Visual language copied from auth/signup.tsx
// (same gradient, card, label and input styles); steps live in this one screen.

const TOTAL = 7;
const MAX_BYTES = 5 * 1024 * 1024;

// Stable English names are what the backend stores, whatever language the applicant uses.
const SKILLS = [
  { name: "Engine", key: "skillEngine" },
  { name: "Brakes", key: "skillBrakes" },
  { name: "Electrical", key: "skillElectrical" },
  { name: "Diagnostics", key: "skillDiagnostics" },
  { name: "Air conditioning", key: "skillAc" },
  { name: "Transmission", key: "skillTransmission" },
  { name: "Suspension & steering", key: "skillSuspension" },
  { name: "Bodywork", key: "skillBodywork" },
] as const;

type Img = { mimeType: string; dataBase64: string; name: string };
type Cert = { title: string; image: Img | null };

const isRealDate = (v: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
};

export default function MechanicSignUpScreen() {
  const { toggleLanguage, language, t, isArabic } = useLanguage();
  const m = t.mechanicSignup;

  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [certs, setCerts] = useState<Cert[]>([]);
  const [workshopName, setWorkshopName] = useState("");
  const [workshopAddress, setWorkshopAddress] = useState("");
  const [licenceNumber, setLicenceNumber] = useState("");
  const [holder, setHolder] = useState("");
  const [authority, setAuthority] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [licenceImage, setLicenceImage] = useState<Img | null>(null);
  const [agreed, setAgreed] = useState(false);

  const titles = [
    m.stepAccount, m.stepProfile, m.stepSkills, m.stepWorkshop, m.stepLicence, m.stepAuthorization, m.stepReview,
  ];
  const descs = [
    m.descAccount, m.descProfile, m.descSkills, m.descWorkshop, m.descLicence, m.descAuthorization, m.descReview,
  ];

  const pick = async (): Promise<Img | null> => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.5, base64: true });
    if (r.canceled) return null;
    const a = r.assets[0];
    if (!a.base64 || a.base64.length * 0.75 > MAX_BYTES) {
      setError(m.errFileSize);
      return null;
    }
    setError(null);
    return { mimeType: a.mimeType ?? "image/jpeg", dataBase64: a.base64, name: a.fileName ?? "image" };
  };

  // Returns an error message for the given step, or null when it is valid.
  const validate = (s: number): string | null => {
    if (s === 0) {
      if (!fullName.trim() || !email.trim() || !password) return m.errRequired;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return m.errEmail;
      if (password.length < 8) return m.errPassword;
      if (password !== confirm) return m.errPasswordMatch;
    }
    if (s === 1 && (!phone.trim() || !city.trim())) return m.errRequired;
    if (s === 2) {
      if (!skills.length) return m.errSkills;
      if (certs.some((c) => !c.title.trim() || !c.image)) return m.errRequired;
    }
    if (s === 3 && (!workshopName.trim() || !workshopAddress.trim())) return m.errRequired;
    if (s === 4) {
      if (!licenceNumber.trim() || !holder.trim() || !authority.trim()) return m.errRequired;
      if ((issueDate && !isRealDate(issueDate)) || (expiryDate && !isRealDate(expiryDate))) return m.errDate;
      if (issueDate && expiryDate && expiryDate < issueDate) return m.errDateOrder;
      if (!licenceImage) return m.errLicenceDoc;
    }
    if (s === 5 && !agreed) return m.errAuth;
    return null;
  };

  const next = () => {
    const e = validate(step);
    setError(e);
    if (!e) setStep(step + 1);
  };

  const submit = async () => {
    // re-validate everything: a user can edit earlier steps from the review page
    for (let s = 0; s < TOTAL - 1; s++) {
      const e = validate(s);
      if (e) {
        setError(e);
        setStep(s);
        return;
      }
    }
    const api = apiUrl();
    if (!api) return setError(m.errNetwork);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${api}/mechanic-applications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim(),
          password,
          phone: phone.trim(),
          city: city.trim(),
          skills,
          workshopName: workshopName.trim(),
          workshopAddress: workshopAddress.trim(),
          licenceNumber: licenceNumber.trim(),
          licenceHolderName: holder.trim(),
          issuingAuthority: authority.trim(),
          licenceIssueDate: issueDate || undefined,
          licenceExpiryDate: expiryDate || undefined,
          authorizationAccepted: agreed,
          documents: [
            { kind: "LICENCE", title: "Licence / credential", mimeType: licenceImage!.mimeType, dataBase64: licenceImage!.dataBase64 },
            ...certs.map((c) => ({ kind: "CERTIFICATE", title: c.title.trim(), mimeType: c.image!.mimeType, dataBase64: c.image!.dataBase64 })),
          ],
        }),
      });
      if (res.status === 201) {
        router.replace("/auth/mechanic-pending");
        return;
      }
      if (res.status === 409) {
        setError(m.errEmailTaken);
        setStep(0);
      } else {
        const data = await res.json().catch(() => null);
        setError(typeof data?.message === "string" ? data.message : m.errNetwork);
      }
    } catch {
      setError(m.errNetwork);
    } finally {
      setBusy(false);
    }
  };

  const toggleSkill = (name: string) =>
    setSkills(skills.includes(name) ? skills.filter((s) => s !== name) : [...skills, name]);

  const skillLabel = (name: string) => m[SKILLS.find((s) => s.name === name)!.key];
  const rtl = isArabic && styles.rowReverse;

  return (
    <LinearGradient colors={["#120D0A", "#1C120D", "#2B1B13"]} style={styles.background}>
      <View style={styles.glowTop} />
      <View style={styles.glowBottom} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            {/* Top Bar */}
            <View style={[styles.topBar, rtl]}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => (step > 0 ? (setError(null), setStep(step - 1)) : router.back())}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={m.back}
              >
                <Ionicons name={isArabic ? "arrow-forward" : "arrow-back"} size={21} color="#E5B081" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.languageButton} onPress={toggleLanguage} activeOpacity={0.75}>
                <Ionicons name="language-outline" size={17} color="#E0A36F" />
                <Text style={styles.languageText}>{language === "en" ? "العربية" : "EN"}</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.tagline, isArabic && styles.arabicTagline]}>{m.system}</Text>

            {/* Progress */}
            <View style={[styles.progress, rtl]}>
              {Array.from({ length: TOTAL }).map((_, i) => (
                <View key={i} style={[styles.progressSeg, i <= step && styles.progressSegOn]} />
              ))}
            </View>
            <Text style={[styles.stepText, isArabic && styles.arabicText]}>
              {m.step} {step + 1} {m.of} {TOTAL}
            </Text>

            <View style={styles.headingSection}>
              <Text style={[styles.heading, isArabic && styles.arabicText]}>{titles[step]}</Text>
              <Text style={[styles.description, isArabic && styles.arabicText]}>{descs[step]}</Text>
            </View>

            <View style={styles.card}>
              {step === 0 && (
                <>
                  <Input label={t.signup.fullName} icon="person-outline" value={fullName} onChangeText={setFullName} placeholder={t.signup.fullNamePlaceholder} />
                  <Input label={t.common.email} icon="mail-outline" value={email} onChangeText={setEmail} placeholder={t.common.emailPlaceholder} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
                  <Input label={t.common.password} icon="lock-closed-outline" value={password} onChangeText={setPassword} placeholder={t.signup.passwordPlaceholder} secureTextEntry={!showPw}
                    right={<TouchableOpacity style={styles.eyeButton} onPress={() => setShowPw(!showPw)}><Ionicons name={showPw ? "eye-outline" : "eye-off-outline"} size={21} color="#A99181" /></TouchableOpacity>} />
                  <Input label={t.signup.confirmPassword} icon="lock-closed-outline" value={confirm} onChangeText={setConfirm} placeholder={t.signup.confirmPasswordPlaceholder} secureTextEntry={!showPw} />
                </>
              )}

              {step === 1 && (
                <>
                  <Input label={m.phone} icon="call-outline" value={phone} onChangeText={setPhone} placeholder={m.phonePlaceholder} keyboardType="phone-pad" />
                  <Input label={m.city} icon="location-outline" value={city} onChangeText={setCity} placeholder={m.cityPlaceholder} />
                </>
              )}

              {step === 2 && (
                <>
                  <Label text={m.skillsLabel} />
                  <View style={[styles.chips, rtl]}>
                    {SKILLS.map((s) => {
                      const on = skills.includes(s.name);
                      return (
                        <TouchableOpacity
                          key={s.name}
                          onPress={() => toggleSkill(s.name)}
                          style={[styles.chip, on && styles.chipOn]}
                          accessibilityRole="button"
                          accessibilityState={{ selected: on }}
                        >
                          <Text style={[styles.chipText, on && styles.chipTextOn]}>{m[s.key]}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <Label text={m.certsLabel} />
                  {certs.map((c, i) => (
                    <View key={i} style={styles.certBox}>
                      <Input label="" icon="ribbon-outline" value={c.title} placeholder={m.certTitlePlaceholder}
                        onChangeText={(v) => setCerts(certs.map((x, j) => (j === i ? { ...x, title: v } : x)))} />
                      <View style={[styles.certActions, rtl]}>
                        <TouchableOpacity
                          style={styles.ghostButton}
                          onPress={async () => {
                            const img = await pick();
                            if (img) setCerts(certs.map((x, j) => (j === i ? { ...x, image: img } : x)));
                          }}
                        >
                          <Ionicons name={c.image ? "checkmark-circle-outline" : "attach-outline"} size={18} color="#D99B69" />
                          <Text style={styles.ghostText}>{c.image ? m.attached : m.addCertificate}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.ghostButton} onPress={() => setCerts(certs.filter((_, j) => j !== i))}>
                          <Text style={styles.ghostText}>{m.remove}</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                  {certs.length < 5 && (
                    <TouchableOpacity style={styles.ghostButton} onPress={() => setCerts([...certs, { title: "", image: null }])}>
                      <Ionicons name="add-outline" size={18} color="#D99B69" />
                      <Text style={styles.ghostText}>{m.addCertificate}</Text>
                    </TouchableOpacity>
                  )}
                  <Text style={[styles.note, isArabic && styles.arabicText]}>{m.certsPrivate}</Text>
                </>
              )}

              {step === 3 && (
                <>
                  <Input label={m.workshopName} icon="business-outline" value={workshopName} onChangeText={setWorkshopName} placeholder={m.workshopNamePlaceholder} />
                  <Input label={m.workshopAddress} icon="map-outline" value={workshopAddress} onChangeText={setWorkshopAddress} placeholder={m.workshopAddressPlaceholder} />
                </>
              )}

              {step === 4 && (
                <>
                  <Input label={m.licenceNumber} icon="document-text-outline" value={licenceNumber} onChangeText={setLicenceNumber} placeholder={m.licenceNumberPlaceholder} />
                  <Input label={m.licenceHolder} icon="person-outline" value={holder} onChangeText={setHolder} placeholder={m.licenceHolderPlaceholder} />
                  <Input label={m.authority} icon="shield-outline" value={authority} onChangeText={setAuthority} placeholder={m.authorityPlaceholder} />
                  <Input label={m.issueDate} icon="calendar-outline" value={issueDate} onChangeText={setIssueDate} placeholder={m.datePlaceholder} keyboardType="numbers-and-punctuation" autoCapitalize="none" />
                  <Input label={m.expiryDate} icon="calendar-outline" value={expiryDate} onChangeText={setExpiryDate} placeholder={m.datePlaceholder} keyboardType="numbers-and-punctuation" autoCapitalize="none" />
                  <Label text={m.licenceDoc} />
                  <TouchableOpacity
                    style={styles.ghostButton}
                    onPress={async () => {
                      const img = await pick();
                      if (img) setLicenceImage(img);
                    }}
                  >
                    <Ionicons name={licenceImage ? "checkmark-circle-outline" : "attach-outline"} size={18} color="#D99B69" />
                    <Text style={styles.ghostText}>{licenceImage ? m.attached : m.attachLicence}</Text>
                  </TouchableOpacity>
                  <Text style={[styles.note, isArabic && styles.arabicText]}>{m.reviewNote}</Text>
                </>
              )}

              {step === 5 && (
                <>
                  {[m.consent1, m.consent2, m.consent3, m.consent4].map((c, i) => (
                    <View key={i} style={[styles.consentRow, rtl]}>
                      <Ionicons name="checkmark-outline" size={16} color="#C98B5B" />
                      <Text style={[styles.consentText, isArabic && styles.arabicText]}>{c}</Text>
                    </View>
                  ))}
                  <TouchableOpacity
                    style={[styles.agreeRow, rtl]}
                    onPress={() => setAgreed(!agreed)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: agreed }}
                  >
                    <View style={[styles.checkbox, agreed && styles.checkboxOn]}>
                      {agreed && <Ionicons name="checkmark" size={16} color="#20120B" />}
                    </View>
                    <Text style={[styles.agreeText, isArabic && styles.arabicText]}>{m.authAgree}</Text>
                  </TouchableOpacity>
                </>
              )}

              {step === 6 && (
                <>
                  <Section title={m.stepAccount} onEdit={() => setStep(0)} edit={m.edit} rtl={rtl}>
                    <Row k={t.signup.fullName} v={fullName} />
                    <Row k={t.common.email} v={email} />
                  </Section>
                  <Section title={m.stepProfile} onEdit={() => setStep(1)} edit={m.edit} rtl={rtl}>
                    <Row k={m.phone} v={phone} />
                    <Row k={m.city} v={city} />
                  </Section>
                  <Section title={m.stepSkills} onEdit={() => setStep(2)} edit={m.edit} rtl={rtl}>
                    <Row k={m.skillsLabel} v={skills.map(skillLabel).join("، ").replace(/، /g, isArabic ? "، " : ", ")} />
                    <Row k={m.certsLabel} v={certs.length ? certs.map((c) => c.title).join(", ") : m.none} />
                  </Section>
                  <Section title={m.stepWorkshop} onEdit={() => setStep(3)} edit={m.edit} rtl={rtl}>
                    <Row k={m.workshopName} v={workshopName} />
                    <Row k={m.workshopAddress} v={workshopAddress} />
                  </Section>
                  <Section title={m.stepLicence} onEdit={() => setStep(4)} edit={m.edit} rtl={rtl}>
                    <Row k={m.licenceNumber} v={licenceNumber} />
                    <Row k={m.licenceHolder} v={holder} />
                    <Row k={m.authority} v={authority} />
                    <Row k={m.issueDate} v={issueDate || "—"} />
                    <Row k={m.expiryDate} v={expiryDate || "—"} />
                    <Row k={m.licenceDoc} v={licenceImage ? m.attached : "—"} />
                  </Section>
                  <Section title={m.stepAuthorization} onEdit={() => setStep(5)} edit={m.edit} rtl={rtl}>
                    <Row k={m.authAgree} v={agreed ? "✓" : "—"} />
                  </Section>
                  <Text style={[styles.note, isArabic && styles.arabicText]}>{m.reviewNote}</Text>
                </>
              )}

              {error ? (
                <View style={[styles.errorBox, rtl]}>
                  <Ionicons name="alert-circle-outline" size={18} color="#F0A28E" />
                  <Text style={[styles.errorText, isArabic && styles.arabicText]}>{error}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                activeOpacity={0.85}
                disabled={busy}
                onPress={step === TOTAL - 1 ? submit : next}
                style={[styles.buttonWrapper, busy && { opacity: 0.6 }]}
                accessibilityRole="button"
              >
                <LinearGradient colors={["#F0C49A", "#D99B69", "#B87345"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.createButton}>
                  <Text style={styles.buttonText}>{step === TOTAL - 1 ? m.submit : m.next}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

function Label({ text }: { text: string }) {
  const { isArabic } = useLanguage();
  if (!text) return null;
  return <Text style={[styles.label, isArabic && styles.arabicLabel]}>{text}</Text>;
}

function Input({ label, icon, right, ...p }: TextInputProps & { label: string; icon: keyof typeof Ionicons.glyphMap; right?: ReactNode }) {
  const { isArabic } = useLanguage();
  return (
    <>
      <Label text={label} />
      <View style={[styles.inputContainer, isArabic && styles.rowReverse]}>
        <View style={styles.inputIcon}>
          <Ionicons name={icon} size={20} color="#C98B5B" />
        </View>
        <TextInput
          style={[styles.input, isArabic && styles.arabicInput]}
          placeholderTextColor="#806F64"
          accessibilityLabel={label || p.placeholder}
          {...p}
        />
        {right}
      </View>
    </>
  );
}

function Section({ title, edit, onEdit, rtl, children }: { title: string; edit: string; onEdit: () => void; rtl: false | object; children: ReactNode }) {
  const { isArabic } = useLanguage();
  return (
    <View style={styles.reviewSection}>
      <View style={[styles.reviewHead, rtl]}>
        <Text style={[styles.reviewTitle, isArabic && styles.arabicText, { flex: 1 }]}>{title}</Text>
        <TouchableOpacity onPress={onEdit} accessibilityRole="button" style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 6 }}>
          <Text style={styles.loginText}>{edit}</Text>
        </TouchableOpacity>
      </View>
      {children}
    </View>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  const { isArabic } = useLanguage();
  return (
    <View style={[styles.reviewRow, isArabic && styles.rowReverse]}>
      <Text style={styles.reviewKey}>{k}</Text>
      <Text style={[styles.reviewVal, isArabic ? { textAlign: "left" } : { textAlign: "right" }]}>{v || "—"}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1 },
  scrollContainer: { flexGrow: 1, paddingHorizontal: 25, paddingTop: 45, paddingBottom: 100 },
  content: { width: "100%", maxWidth: 430, alignSelf: "center" },
  glowTop: { position: "absolute", width: 260, height: 260, borderRadius: 130, backgroundColor: "rgba(198, 123, 72, 0.09)", top: -90, right: -90 },
  glowBottom: { position: "absolute", width: 230, height: 230, borderRadius: 115, backgroundColor: "rgba(139, 79, 43, 0.08)", bottom: -80, left: -90 },
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 18 },
  backButton: { width: 44, height: 44, borderRadius: 14, backgroundColor: "rgba(201,139,91,0.10)", borderWidth: 1, borderColor: "rgba(201,139,91,0.22)", justifyContent: "center", alignItems: "center" },
  languageButton: { height: 44, flexDirection: "row", alignItems: "center", paddingHorizontal: 13, borderRadius: 13, backgroundColor: "rgba(201,139,91,0.09)", borderWidth: 1, borderColor: "rgba(201,139,91,0.20)" },
  languageText: { color: "#DCA578", fontSize: 12, fontWeight: "700", marginLeft: 7 },
  tagline: { color: "#A99181", fontSize: 9, fontWeight: "600", letterSpacing: 2, textAlign: "center", marginBottom: 16 },
  arabicTagline: { letterSpacing: 0, fontSize: 11 },
  progress: { flexDirection: "row", gap: 5, marginBottom: 10 },
  progressSeg: { flex: 1, height: 4, borderRadius: 2, backgroundColor: "#49352A" },
  progressSegOn: { backgroundColor: "#D99B69" },
  stepText: { color: "#9C8A7E", fontSize: 11, fontWeight: "600", letterSpacing: 1 },
  headingSection: { marginTop: 16, marginBottom: 18 },
  heading: { color: "#FFF5EA", fontSize: 25, fontWeight: "700", marginBottom: 6 },
  description: { color: "#9C8A7E", fontSize: 13, lineHeight: 20 },
  arabicText: { textAlign: "right", writingDirection: "rtl" },
  card: { backgroundColor: "rgba(45, 31, 24, 0.78)", borderWidth: 1, borderColor: "rgba(205, 150, 108, 0.15)", borderRadius: 24, padding: 21 },
  label: { color: "#BDAA9C", fontSize: 10, fontWeight: "700", letterSpacing: 1.3, marginBottom: 9, marginLeft: 2 },
  arabicLabel: { textAlign: "right", writingDirection: "rtl", letterSpacing: 0, fontSize: 12, marginLeft: 0, marginRight: 2 },
  inputContainer: { minHeight: 54, flexDirection: "row", alignItems: "center", backgroundColor: "rgba(20, 14, 11, 0.65)", borderWidth: 1, borderColor: "#49352A", borderRadius: 15, marginBottom: 17 },
  inputIcon: { width: 49, alignItems: "center", justifyContent: "center" },
  input: { flex: 1, height: "100%", minHeight: 54, color: "#FFF5EA", fontSize: 14, paddingRight: 15 },
  arabicInput: { textAlign: "right", writingDirection: "rtl", paddingHorizontal: 5 },
  eyeButton: { width: 48, height: "100%", alignItems: "center", justifyContent: "center" },
  rowReverse: { flexDirection: "row-reverse" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 },
  chip: { minHeight: 44, paddingHorizontal: 14, borderRadius: 13, borderWidth: 1, borderColor: "#49352A", backgroundColor: "rgba(20, 14, 11, 0.65)", alignItems: "center", justifyContent: "center" },
  chipOn: { backgroundColor: "#D99B69", borderColor: "#D99B69" },
  chipText: { color: "#BDAA9C", fontSize: 13, fontWeight: "700" },
  chipTextOn: { color: "#20120B" },
  certBox: { marginBottom: 6 },
  certActions: { flexDirection: "row", gap: 8, marginBottom: 14 },
  ghostButton: { minHeight: 46, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: "rgba(201,139,91,0.22)", backgroundColor: "rgba(201,139,91,0.10)", alignSelf: "flex-start" },
  ghostText: { color: "#D99B69", fontSize: 13, fontWeight: "700" },
  note: { color: "#8F7E73", fontSize: 12, lineHeight: 18, marginTop: 14 },
  consentRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 12 },
  consentText: { flex: 1, color: "#BDAA9C", fontSize: 13, lineHeight: 20 },
  agreeRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 10, minHeight: 48 },
  checkbox: { width: 26, height: 26, borderRadius: 8, borderWidth: 1.5, borderColor: "#C98B5B", alignItems: "center", justifyContent: "center" },
  checkboxOn: { backgroundColor: "#D99B69" },
  agreeText: { flex: 1, color: "#FFF5EA", fontSize: 14, fontWeight: "600" },
  reviewSection: { marginBottom: 16, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: "rgba(205,150,108,0.12)" },
  reviewHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  reviewTitle: { color: "#E8D8CC", fontSize: 12, fontWeight: "800", letterSpacing: 1 },
  reviewRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, gap: 12 },
  reviewKey: { color: "#8F7E73", fontSize: 11, fontWeight: "700", flexShrink: 0, maxWidth: "45%" },
  reviewVal: { color: "#FFF5EA", fontSize: 13, flex: 1 },
  errorBox: { flexDirection: "row", alignItems: "center", gap: 9, padding: 12, marginTop: 14, borderRadius: 14, borderWidth: 1, backgroundColor: "rgba(190,75,65,0.12)", borderColor: "rgba(240,162,142,0.25)" },
  errorText: { flex: 1, color: "#F0A28E", fontSize: 13, lineHeight: 19 },
  buttonWrapper: { borderRadius: 15, overflow: "hidden", marginTop: 20 },
  createButton: { height: 56, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  buttonText: { color: "#20120B", fontSize: 15, fontWeight: "800" },
  loginText: { color: "#D99B69", fontSize: 13, fontWeight: "700" },
});
