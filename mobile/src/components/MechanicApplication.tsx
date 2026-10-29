import { useCallback, useEffect, useState } from "react";
import { View, Image, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { Text } from "./MotexaVisual";
import * as Store from "./SessionStore";
import MotexaDialog from "./MotexaDialog";
import {
  MechanicPage,
  MechanicServiceChoice,
  MechanicCard,
  MechanicField,
  MechanicButton,
  MechanicChoice,
  MechanicNote,
  useMechanicTheme,
} from "./MechanicUI";
import {
  mechanicApi,
  mechanicSpecializations,
  type MechanicProfile,
} from "./mechanic-api";
import MechanicDocuments, { pickMechanicDocument } from "./MechanicDocuments";
type Form = {
  city: string;
  phoneNumber: string;
  specializations: string[];
  yearsOfExperience: string;
  experienceSummary: string;
  offersWorkshop: boolean;
  offersOnSite: boolean;
  offersOnline: boolean;
  workshopName: string;
  workshopAddress: string;
  coverageAreas: string;
};
const initial: Form = {
  city: "",
  phoneNumber: "",
  specializations: [],
  yearsOfExperience: "",
  experienceSummary: "",
  offersWorkshop: false,
  offersOnSite: false,
  offersOnline: false,
  workshopName: "",
  workshopAddress: "",
  coverageAreas: "",
};
type Notice = {
  id: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
};
const previewProfile: MechanicProfile = {
  id: "preview",
  userId: "preview",
  city: "",
  phoneNumber: "",
  specializations: [],
  yearsOfExperience: null,
  experienceSummary: "",
  offersWorkshop: false,
  offersOnSite: false,
  offersOnline: false,
  workshopName: "",
  workshopAddress: "",
  coverageAreas: [],
  verificationStatus: "DRAFT",
  submittedAt: null,
  submissionVersion: 0,
  reviewNotes: null,
  interviewResult: null,
  interviewNotes: null,
  canReceiveServices: false,
  documents: [],
  user: { fullName: "", email: "", status: "ACTIVE" },
  history: [],
};
export default function MechanicApplication({
  previewOnly = false,
  initialStep = 0,
  onPreviewStep,
}: {
  previewOnly?: boolean;
  initialStep?: number;
  onPreviewStep?: (step: number) => void;
} = {}) {
  const m = useMechanicTheme(),
    [profile, setProfile] = useState<MechanicProfile | null>(
      previewOnly ? previewProfile : null,
    ),
    [form, setForm] = useState<Form>(initial),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [editing, setEditing] = useState(previewOnly),
    [step, setStep] = useState(initialStep),
    [privacy, setPrivacy] = useState(false),
    [notices, setNotices] = useState<Notice[]>([]),
    [logout, setLogout] = useState(false),
    [message, setMessage] = useState("");
  useEffect(() => {
    if (previewOnly) {
      setStep(Math.max(0, Math.min(3, initialStep)));
      setEditing(true);
    }
  }, [previewOnly, initialStep]);
  function apply(p: MechanicProfile) {
    setProfile(p);
    setForm({
      city: p.city || "",
      phoneNumber: p.phoneNumber || "",
      specializations: p.specializations,
      yearsOfExperience:
        p.yearsOfExperience === null ? "" : String(p.yearsOfExperience),
      experienceSummary: p.experienceSummary || "",
      offersWorkshop: p.offersWorkshop,
      offersOnSite: p.offersOnSite,
      offersOnline: p.offersOnline,
      workshopName: p.workshopName || "",
      workshopAddress: p.workshopAddress || "",
      coverageAreas: p.coverageAreas.join(", "),
    });
  }
  async function refresh() {
    if (previewOnly) return;
    const data = await mechanicApi<{ profile: MechanicProfile }>(
      "/api/mechanics/me",
    );
    apply(data.profile);
    const n = await mechanicApi<{ notifications: Notice[] }>(
      "/api/mechanics/notifications",
    );
    setNotices(n.notifications);
  }
  useFocusEffect(
    useCallback(() => {
      if (previewOnly) return;
      let alive = true;
      setBusy(true);
      void mechanicApi<{ profile: MechanicProfile }>("/api/mechanics/me")
        .then(async (data) => {
          if (!alive) return;
          apply(data.profile);
          const n = await mechanicApi<{ notifications: Notice[] }>(
            "/api/mechanics/notifications",
          );
          if (alive) setNotices(n.notifications);
        })
        .catch((e) => {
          if (alive) setError(e.message);
        })
        .finally(() => {
          if (alive) setBusy(false);
        });
      return () => {
        alive = false;
      };
    }, [previewOnly]),
  );
  async function run(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  function change<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((v) => ({ ...v, [key]: value }));
  }
  async function save() {
    if (previewOnly) {
      setProfile((p) =>
        p
          ? {
              ...p,
              ...form,
              yearsOfExperience:
                form.yearsOfExperience === ""
                  ? null
                  : Number(form.yearsOfExperience),
              coverageAreas: form.coverageAreas
                .split(/[,،]/)
                .map((v) => v.trim())
                .filter(Boolean),
            }
          : p,
      );
      return;
    }
    const data = await mechanicApi<{ profile: MechanicProfile }>(
      "/api/mechanics/me",
      "PUT",
      {
        ...form,
        yearsOfExperience:
          form.yearsOfExperience === "" ? null : Number(form.yearsOfExperience),
        coverageAreas: form.coverageAreas
          .split(/[,،]/)
          .map((v) => v.trim())
          .filter(Boolean),
      },
    );
    apply(data.profile);
  }
  const editable =
    profile &&
    ["DRAFT", "NEEDS_COMPLETION"].includes(profile.verificationStatus);
  const status: Record<string, [string, string]> = {
    DRAFT: ["Let’s build your profile", "لنبدأ ملفك المهني"],
    PENDING: ["Application under review", "طلبك قيد المراجعة"],
    NEEDS_COMPLETION: [
      "A few details need your attention",
      "طلبك يحتاج استكمالًا",
    ],
    VERIFIED: ["Your application is approved", "تم اعتماد طلبك"],
    REJECTED: ["Application not approved", "لم يتم قبول الطلب"],
    SUSPENDED: ["Services temporarily suspended", "الخدمات معلّقة مؤقتًا"],
  };
  const statusCopy = status[profile?.verificationStatus || "DRAFT"];
  const specLabel = (value: string) => {
    const s = mechanicSpecializations.find((s) => s[0] === value);
    return s ? m.t(s[1], s[2]) : value;
  };
  const title = editing
    ? [
        m.t("Professional profile", "الملف المهني"),
        m.t("Service options", "طرق تقديم الخدمة"),
        m.t("Your documents", "وثائق التحقق"),
        m.t("Review and submit", "المراجعة والإرسال"),
      ][step]
    : m.t(statusCopy[0], statusCopy[1]);
  return (
    <MechanicPage
      title={title}
      progress={editing ? step + 2 : undefined}
      photo={!editing && !!profile}
      subtitle={
        profile
          ? profile.user.fullName
          : m.t("Your MOTEXA mechanic account", "حسابك كميكانيكي في MOTEXA")
      }
    >
      {previewOnly && (
        <MechanicNote>
          {m.t(
            "Preview mode · You can explore all steps. Nothing is sent to the database.",
            "وضع المعاينة · تنقّل بين جميع الخطوات. لا تُرسل أي بيانات للداتا بيس.",
          )}
        </MechanicNote>
      )}
      {error && <MechanicNote error>{error}</MechanicNote>}
      {message && <MechanicNote>{message}</MechanicNote>}
        {!previewOnly && !editing && profile?.submittedAt && <MechanicCard><Text style={{fontSize:17,fontWeight:'600',color:m.ink}}>{m.t('Professional review','المراجعة المهنية')}</Text><Text style={{fontSize:12,lineHeight:22,color:m.muted}}>{m.t('Receive your two-question test, follow application updates and contact your Mechanics Admin.','استقبل اختبار السؤالين، وتابع التحديثات وتواصل مع أدمن الميكانيك.')}</Text><MechanicButton label={m.t('Open test & administrator conversation','فتح الاختبار ومحادثة الأدمن')} onPress={()=>router.push('/mechanic/review' as import('expo-router').Href)}/></MechanicCard>}
      {!profile ? (
        <MechanicCard>
          <MechanicButton
            label={m.t("Retry", "إعادة المحاولة")}
            busy={busy}
            onPress={() => void run(refresh)}
          />
          <MechanicButton
            secondary
            label={m.t("Go to sign in", "الذهاب لتسجيل الدخول")}
            onPress={() =>
              router.replace({
                pathname: "/auth/login",
                params: { selectedRole: "mechanic" },
              })
            }
          />
        </MechanicCard>
      ) : editing ? (
        <>
          <Text
            style={{
              fontSize: 11,
              lineHeight: 20,
              color: m.muted,
              marginBottom: 14,
              textAlign: m.align,
            }}
          >
            {m.t(
              "Your progress is saved with Continue or Save draft.",
              "تُحفظ تغييراتك بالمتابعة أو حفظ المسودة.",
            )}
          </Text>
          <MechanicCard>
            {step === 0 ? (
              <>
                <MechanicField
                  icon="location-outline"
                  label={m.t("City", "المدينة")}
                  value={form.city}
                  onChangeText={(v) => change("city", v)}
                  editable={!busy}
                />
                <MechanicField
                  icon="call-outline"
                  label={m.t("Phone number", "رقم الهاتف")}
                  value={form.phoneNumber}
                  onChangeText={(v) => change("phoneNumber", v)}
                  keyboardType="phone-pad"
                  editable={!busy}
                />
                <Text style={{ fontSize: 14, fontWeight: "600", color: m.ink }}>
                  {m.t(
                    "Specializations · Choose one or more",
                    "التخصصات · اختر واحدًا أو أكثر",
                  )}
                </Text>
                {mechanicSpecializations.map(([key, en, ar]) => (
                  <MechanicChoice
                    key={key}
                    icon={
                      (
                        {
                          PETROL_ENGINES: "cog-outline",
                          DIESEL_ENGINES: "construct-outline",
                          ELECTRIC_VEHICLES: "flash-outline",
                          TRANSMISSION: "git-compare-outline",
                          AUTO_ELECTRICAL: "battery-charging-outline",
                          SUSPENSION: "car-sport-outline",
                        } as const
                      )[key]
                    }
                    label={m.t(en, ar)}
                    selected={form.specializations.includes(key)}
                    disabled={busy}
                    onPress={() =>
                      change(
                        "specializations",
                        form.specializations.includes(key)
                          ? form.specializations.filter((s) => s !== key)
                          : [...form.specializations, key],
                      )
                    }
                  />
                ))}
                <MechanicField
                  icon="calendar-outline"
                  label={m.t("Years of experience", "سنوات الخبرة")}
                  value={form.yearsOfExperience}
                  onChangeText={(v) => change("yearsOfExperience", v)}
                  keyboardType="number-pad"
                  maxLength={2}
                  editable={!busy}
                />
                <MechanicField
                  icon="reader-outline"
                  label={m.t("Tell us about your experience", "نبذة عن خبرتك")}
                  value={form.experienceSummary}
                  onChangeText={(v) => change("experienceSummary", v)}
                  multiline
                  maxLength={2000}
                  editable={!busy}
                />
              </>
            ) : step === 1 ? (
              <>
                <Text
                  style={{
                    fontSize: 14,
                    lineHeight: 23,
                    fontWeight: "600",
                    color: m.ink,
                    textAlign: m.align,
                  }}
                >
                  {m.t(
                    "Where will you help customers?",
                    "كيف ستقدم خدماتك للعملاء؟",
                  )}
                </Text>
                <Text
                  style={{
                    fontSize: 11,
                    lineHeight: 20,
                    color: m.muted,
                    textAlign: m.align,
                  }}
                >
                  {m.t(
                    "Choose one or more service modes. Only the relevant details will appear.",
                    "اختر طريقة أو أكثر، وستظهر لك البيانات المطلوبة لكل اختيار.",
                  )}
                </Text>
                <View style={{ gap: 9, marginBottom: 7 }}>
                  <MechanicServiceChoice
                    label={m.t("Workshop service", "الخدمة داخل الورشة")}
                    description={m.t(
                      "Customers visit your workshop",
                      "يأتي العميل لورشتك",
                    )}
                    icon="home-outline"
                    selected={form.offersWorkshop}
                    disabled={busy}
                    onPress={() =>
                      change("offersWorkshop", !form.offersWorkshop)
                    }
                  />
                  <MechanicServiceChoice
                    label={m.t("On-site service", "الخدمة عند العميل")}
                    description={m.t(
                      "Travel to your customer",
                      "تصل إلى موقع العميل",
                    )}
                    icon="car-outline"
                    selected={form.offersOnSite}
                    disabled={busy}
                    onPress={() => change("offersOnSite", !form.offersOnSite)}
                  />
                  <MechanicServiceChoice
                    label={m.t("Online consultation", "استشارة أونلاين")}
                    description={m.t(
                      "Consultations via your WhatsApp number",
                      "استشارة عبر رقمك على واتساب",
                    )}
                    icon="logo-whatsapp"
                    selected={form.offersOnline}
                    disabled={busy}
                    onPress={() => change("offersOnline", !form.offersOnline)}
                  />
                </View>
                {form.offersWorkshop && (
                  <>
                    <View
                      style={{
                        flexDirection: m.row,
                        gap: 8,
                        alignItems: "center",
                        marginTop: 8,
                      }}
                    >
                      <Ionicons
                        name="storefront-outline"
                        size={20}
                        color={m.muted}
                      />
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: "600",
                          color: m.ink,
                        }}
                      >
                        {m.t("Workshop details", "بيانات الورشة")}
                      </Text>
                    </View>
                    <MechanicNote>
                      {m.t(
                        "You will provide ownership, a rental agreement or authorization to use the workshop in Documents.",
                        "سترفق في خطوة الوثائق سند ملكية أو عقد إيجار أو إثبات حق استخدام الورشة.",
                      )}
                    </MechanicNote>
                    <MechanicField
                      icon="storefront-outline"
                      label={m.t("Workshop name", "اسم الورشة")}
                      value={form.workshopName}
                      onChangeText={(v) => change("workshopName", v)}
                      editable={!busy}
                    />
                    <MechanicField
                      icon="map-outline"
                      label={m.t(
                        "Workshop location / address",
                        "موقع وعنوان الورشة",
                      )}
                      value={form.workshopAddress}
                      onChangeText={(v) => change("workshopAddress", v)}
                      editable={!busy}
                      multiline
                    />
                  </>
                )}
                {form.offersOnSite && (
                  <MechanicField
                    icon="navigate-outline"
                    label={m.t(
                      "Coverage cities · Separate with commas",
                      "مدن التغطية · افصل بينها بفاصلة",
                    )}
                    value={form.coverageAreas}
                    onChangeText={(v) => change("coverageAreas", v)}
                    editable={!busy}
                  />
                )}
                {form.offersOnSite && form.coverageAreas && (
                  <View
                    style={{ flexDirection: m.row, gap: 6, flexWrap: "wrap" }}
                  >
                    {form.coverageAreas
                      .split(/[,،]/)
                      .map((v) => v.trim())
                      .filter(Boolean)
                      .map((v, i) => (
                        <View
                          key={i}
                          style={{
                            paddingHorizontal: 12,
                            paddingVertical: 6,
                            borderRadius: 18,
                            backgroundColor: m.soft,
                          }}
                        >
                          <Text style={{ fontSize: 11, color: m.ink }}>
                            {v}
                          </Text>
                        </View>
                      ))}
                  </View>
                )}
                {form.offersOnline && (
                  <View
                    style={{
                      padding: 14,
                      borderRadius: 23,
                      borderWidth: 1,
                      borderColor: m.border,
                      backgroundColor: m.surface,
                      gap: 12,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: m.row,
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <Ionicons
                        name="logo-whatsapp"
                        size={22}
                        color={m.muted}
                      />
                      <Text
                        style={{
                          fontSize: 14,
                          lineHeight: 23,
                          fontWeight: "600",
                          color: m.ink,
                        }}
                      >
                        {m.t("WhatsApp consultation", "استشارة عبر واتساب")}
                      </Text>
                    </View>
                    <MechanicField
                      icon="call-outline"
                      label={m.t(
                        "WhatsApp contact number",
                        "رقم التواصل على واتساب",
                      )}
                      value={form.phoneNumber}
                      onChangeText={(v) => change("phoneNumber", v)}
                      keyboardType="phone-pad"
                      placeholder="+970 59 123 4567"
                      editable={!busy}
                    />
                    <Text
                      style={{
                        fontSize: 11,
                        lineHeight: 21,
                        color: m.muted,
                        textAlign: m.align,
                      }}
                    >
                      {m.t(
                        "Use the number registered on your WhatsApp account. This is your application contact number; the customer starts a call from WhatsApp itself.",
                        "استخدم الرقم المسجّل في حساب واتساب. هذا رقم التواصل في طلبك، وتبدأ المكالمة من تطبيق واتساب نفسه.",
                      )}
                    </Text>
                  </View>
                )}
                {form.offersWorkshop && (
                  <Image
                    accessible={false}
                    source={require("../../assets/images/motexa-mechanic-registration-hero.png")}
                    resizeMode="cover"
                    style={{
                      width: "100%",
                      height: 115,
                      borderRadius: 19,
                      marginTop: 4,
                    }}
                  />
                )}
              </>
            ) : step === 2 ? (
              <>
                <MechanicNote>
                  {m.t(
                    "Identity and a training or experience certificate are required for everyone. Workshop services also need proof of ownership or authorized use. Documents are private.",
                    "الهوية وشهادة تدريب أو خبرة مطلوبة للجميع. عند اختيار الورشة يُطلب إثبات ملكيتها أو حق استخدامها. الوثائق خاصة.",
                  )}
                </MechanicNote>
                <MechanicDocuments
                  editable
                  requireCertificate
                  includeWorkshopProof={form.offersWorkshop}
                  previewOnly={previewOnly}
                  documents={profile.documents}
                  onUpload={(kind) =>
                    void run(async () => {
                      const doc = await pickMechanicDocument(kind);
                      if (!doc) return;
                      if (previewOnly) {
                        setProfile((p) =>
                          p
                            ? {
                                ...p,
                                documents: [
                                  ...p.documents.filter((d) => d.kind !== kind),
                                  {
                                    id: "preview-" + kind,
                                    kind,
                                    fileName: doc.fileName,
                                    mimeType: doc.mimeType || "application/pdf",
                                    size: 0,
                                  },
                                ],
                              }
                            : p,
                        );
                        setMessage(
                          m.t(
                            "Preview document selected locally only.",
                            "تم اختيار المستند للمعاينة محليًا فقط.",
                          ),
                        );
                        return;
                      }
                      const data = await mechanicApi<{
                        profile: MechanicProfile;
                      }>("/api/mechanics/me/documents", "POST", doc);
                      apply(data.profile);
                      setMessage(
                        m.t(
                          "Document saved privately.",
                          "تم حفظ المستند بشكل خاص.",
                        ),
                      );
                    })
                  }
                />
              </>
            ) : (
              <>
                <View
                  style={{
                    flexDirection: m.row,
                    alignItems: "center",
                    gap: 9,
                    marginBottom: 4,
                  }}
                >
                  <Ionicons
                    name="clipboard-outline"
                    size={22}
                    color={m.muted}
                  />
                  <Text
                    style={{
                      fontSize: 15,
                      lineHeight: 24,
                      fontWeight: "600",
                      color: m.ink,
                    }}
                  >
                    {m.t(
                      "Your application at a glance",
                      "ملخص طلبك قبل الإرسال",
                    )}
                  </Text>
                </View>
                {[
                  {
                    key: "personal",
                    icon: "person-outline" as const,
                    title: m.t("Personal details", "المعلومات الشخصية"),
                    target: 0,
                    lines: [
                      profile.user.fullName,
                      profile.user.email,
                      form.city,
                      form.phoneNumber,
                    ],
                  },
                  {
                    key: "expertise",
                    icon: "construct-outline" as const,
                    title: m.t(
                      "Specializations & experience",
                      "التخصصات والخبرة",
                    ),
                    target: 0,
                    lines: [
                      form.specializations.map(specLabel).join("، "),
                      form.yearsOfExperience
                        ? form.yearsOfExperience +
                          " " +
                          m.t("years of experience", "سنوات خبرة")
                        : "",
                      form.experienceSummary,
                    ],
                  },
                  {
                    key: "services",
                    icon: "storefront-outline" as const,
                    title: m.t("Service options", "طرق تقديم الخدمة"),
                    target: 1,
                    lines: [
                      [
                        form.offersWorkshop ? m.t("Workshop", "ورشة") : "",
                        form.offersOnSite ? m.t("On-site", "ميداني") : "",
                        form.offersOnline
                          ? m.t("Online consultation", "أونلاين")
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" · "),
                      form.offersWorkshop ? form.workshopName : "",
                      form.offersWorkshop ? form.workshopAddress : "",
                      form.offersOnSite ? form.coverageAreas : "",
                      form.offersOnline
                        ? m.t("WhatsApp: ", "واتساب: ") + form.phoneNumber
                        : "",
                    ],
                  },
                  {
                    key: "documents",
                    icon: "documents-outline" as const,
                    title: m.t("Required documents", "الوثائق المطلوبة"),
                    target: 2,
                    lines: [
                      m.t("Identity: ", "الهوية: ") +
                        (profile.documents.some((d) => d.kind === "IDENTITY")
                          ? m.t("Uploaded", "مرفوعة")
                          : m.t("Not uploaded yet", "لم تُرفع بعد")),
                      m.t("Certificate: ", "الشهادة: ") +
                        (profile.documents.some((d) => d.kind === "CERTIFICATE")
                          ? m.t("Uploaded", "مرفوعة")
                          : m.t("Not uploaded yet", "لم تُرفع بعد")),
                      form.offersWorkshop
                        ? m.t("Workshop proof: ", "إثبات الورشة: ") +
                          (profile.documents.some(
                            (d) => d.kind === "WORKSHOP_PROOF",
                          )
                            ? m.t("Uploaded", "مرفوع")
                            : m.t("Not uploaded yet", "لم يُرفع بعد"))
                        : "",
                    ],
                  },
                ].map((section) => (
                  <View
                    key={section.key}
                    style={{
                      borderWidth: 1,
                      borderColor: m.border,
                      borderRadius: 22,
                      padding: 13,
                      gap: 10,
                      backgroundColor: m.dark ? "#30241C" : "#FFFCF7",
                    }}
                  >
                    <View
                      style={{
                        flexDirection: m.row,
                        gap: 10,
                        alignItems: "center",
                      }}
                    >
                      <View
                        style={{
                          width: 37,
                          height: 37,
                          borderRadius: 19,
                          backgroundColor: m.soft,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Ionicons
                          name={section.icon}
                          size={19}
                          color={m.muted}
                        />
                      </View>
                      <Text
                        style={{
                          flex: 1,
                          fontSize: 13,
                          lineHeight: 22,
                          fontWeight: "600",
                          color: m.ink,
                          textAlign: m.align,
                        }}
                      >
                        {section.title}
                      </Text>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={
                          m.t("Edit ", "تعديل ") + section.title
                        }
                        disabled={busy}
                        onPress={() =>
                          previewOnly
                            ? onPreviewStep?.(section.target + 2)
                            : setStep(section.target)
                        }
                        style={{
                          minWidth: 36,
                          minHeight: 40,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Ionicons
                          name="create-outline"
                          size={20}
                          color={m.muted}
                        />
                      </Pressable>
                    </View>
                    <View style={{ gap: 5 }}>
                      {section.lines.filter(Boolean).length ? (
                        section.lines.filter(Boolean).map((line, index) => (
                          <Text
                            key={index}
                            style={{
                              fontSize: 12,
                              lineHeight: 22,
                              color: m.muted,
                              textAlign: m.align,
                            }}
                          >
                            {line}
                          </Text>
                        ))
                      ) : (
                        <Text
                          style={{
                            fontSize: 12,
                            lineHeight: 22,
                            color: m.muted,
                            textAlign: m.align,
                          }}
                        >
                          {m.t("Not entered yet", "لم تُدخل البيانات بعد")}
                        </Text>
                      )}
                    </View>
                  </View>
                ))}
                <MechanicChoice
                  label={m.t(
                    "I confirm my information is accurate and consent to private document review by authorized MOTEXA administrators.",
                    "أؤكد صحة بياناتي وأوافق على مراجعة وثائقي بشكل خاص من أدمن MOTEXA المخوّل.",
                  )}
                  selected={privacy}
                  disabled={busy}
                  onPress={() => setPrivacy((v) => !v)}
                />
                <MechanicButton
                  label={m.t("Submit for verification", "إرسال طلب الاعتماد")}
                  disabled={!privacy}
                  busy={busy}
                  onPress={() =>
                    void run(async () => {
                      if (previewOnly) {
                        setMessage(
                          m.t(
                            "Preview only. No application has been submitted.",
                            "معاينة فقط. لم يتم إرسال أي طلب.",
                          ),
                        );
                        return;
                      }
                      await save();
                      const data = await mechanicApi<{
                        profile: MechanicProfile;
                      }>("/api/mechanics/me/submit", "POST", {
                        acceptPrivacy: privacy,
                      });
                      apply(data.profile);
                      setEditing(false);
                      await refresh();
                    })
                  }
                />
              </>
            )}
          </MechanicCard>
          <View style={{ gap: 10 }}>
            {step < 3 && (
              <MechanicButton
                label={m.t("Save and continue", "حفظ ومتابعة")}
                busy={busy}
                onPress={() =>
                  void run(async () => {
                    await save();
                    if (previewOnly) onPreviewStep?.(step + 3);
                    else setStep((v) => v + 1);
                  })
                }
              />
            )}{" "}
            {step > 0 && (
              <MechanicButton
                secondary
                label={m.t("Previous step", "الخطوة السابقة")}
                disabled={busy}
                onPress={() =>
                  previewOnly
                    ? onPreviewStep?.(step + 1)
                    : setStep((v) => v - 1)
                }
              />
            )}
            <MechanicButton
              secondary
              label={m.t("Save draft and close", "حفظ المسودة وإغلاق")}
              busy={busy}
              onPress={() =>
                void run(async () => {
                  if (previewOnly) {
                    setMessage(
                      m.t(
                        "Preview only — changes stay on this screen and are not saved to the database.",
                        "معاينة فقط — التغييرات محلية ولا تُحفظ في قاعدة البيانات.",
                      ),
                    );
                    return;
                  }
                  await save();
                  setEditing(false);
                  setMessage(m.t("Your progress is saved.", "تم حفظ تقدّمك."));
                })
              }
            />
          </View>
        </>
      ) : (
        <>
          <MechanicCard>
            <Text
              style={{
                fontSize: 16,
                lineHeight: 27,
                fontWeight: "600",
                color: m.ink,
                textAlign: m.align,
              }}
            >
              {m.t(statusCopy[0], statusCopy[1])}
            </Text>
            <Text
              style={{
                fontSize: 13,
                lineHeight: 24,
                color: m.muted,
                textAlign: m.align,
              }}
            >
              {profile.verificationStatus === "VERIFIED"
                ? m.t(
                    "Your professional application is approved. Your approved service modes are shown below.",
                    "تم اعتماد طلبك المهني. طرق الخدمة المعتمدة تظهر بالأسفل.",
                  )
                : profile.verificationStatus === "DRAFT"
                  ? m.t(
                      "Complete your professional information, upload your identity and submit for review. You cannot receive service requests before approval.",
                      "استكمل معلوماتك المهنية وارفع الهوية وأرسل طلبك. لا يمكنك استقبال خدمات قبل الاعتماد.",
                    )
                  : m.t(
                      "You can view your status and messages here. Receiving services remains unavailable until approval.",
                      "يمكنك متابعة حالتك ورسائلك هنا. استقبال الخدمات يبقى غير متاح حتى الاعتماد.",
                    )}
            </Text>
            {profile.submittedAt && (
              <Text
                style={{
                  fontSize: 11,
                  lineHeight: 20,
                  color: m.muted,
                  textAlign: m.align,
                }}
              >
                {m.t("Submitted: ", "تاريخ التقديم: ") +
                  new Date(profile.submittedAt).toLocaleString(
                    m.ar ? "ar" : "en",
                  )}
              </Text>
            )}
            {profile.reviewNotes && (
              <MechanicNote>{profile.reviewNotes}</MechanicNote>
            )}
            {profile.verificationStatus === "DRAFT" && (
              <ApplicationChecklist profile={profile} />
            )}
            {profile.submittedAt && <ApplicationTimeline profile={profile} />}
            {editable && (
              <MechanicButton
                label={
                  profile.verificationStatus === "DRAFT"
                    ? m.t("Continue verification", "متابعة الاعتماد")
                    : m.t("Complete requested changes", "استكمال المطلوب")
                }
                onPress={() => {
                  setStep(0);
                  setPrivacy(false);
                  setEditing(true);
                }}
              />
            )}
            <MechanicButton
              secondary
              label={m.t("Refresh status", "تحديث الحالة")}
              busy={busy}
              onPress={() => void run(refresh)}
            />
          </MechanicCard>
          {profile.verificationStatus === "VERIFIED" && (
            <MechanicCard>
              <Text style={{ fontSize: 16, fontWeight: "600", color: m.ink }}>
                {m.t("Approved service modes", "طرق الخدمة المعتمدة")}
              </Text>
              {[
                profile.offersWorkshop
                  ? m.t("Workshop · ", "الورشة · ") + profile.workshopName
                  : "",
                profile.offersOnSite
                  ? m.t("On-site · ", "ميداني · ") +
                    profile.coverageAreas.join("، ")
                  : "",
                profile.offersOnline
                  ? m.t("Online consultation", "استشارات أونلاين")
                  : "",
              ]
                .filter(Boolean)
                .map((v) => (
                  <Text
                    key={v}
                    style={{
                      fontSize: 13,
                      lineHeight: 24,
                      color: m.muted,
                      textAlign: m.align,
                    }}
                  >
                    {v}
                  </Text>
                ))}
            </MechanicCard>
          )}
          {notices.length > 0 && (
            <MechanicCard>
              <Text style={{ fontSize: 16, fontWeight: "600", color: m.ink }}>
                {m.t("Notifications", "الإشعارات")}
              </Text>
              {notices.map((n) => (
                <View
                  key={n.id}
                  style={{
                    gap: 7,
                    borderTopWidth: 1,
                    borderTopColor: m.border,
                    paddingTop: 11,
                  }}
                >
                  <Text
                    style={{ fontSize: 13, fontWeight: "600", color: m.ink }}
                  >
                    {n.title}
                  </Text>
                  <Text
                    style={{ fontSize: 12, lineHeight: 22, color: m.muted }}
                  >
                    {n.body}
                  </Text>
                  {!n.readAt && (
                    <MechanicButton
                      secondary
                      label={m.t("Mark as read", "تعليم كمقروء")}
                      onPress={() =>
                        void run(async () => {
                          await mechanicApi(
                            "/api/mechanics/notifications/" + n.id + "/read",
                            "POST",
                            {},
                          );
                          await refresh();
                        })
                      }
                    />
                  )}
                </View>
              ))}
            </MechanicCard>
          )}
          <MechanicCard>
            <Text style={{ fontSize: 15, fontWeight: "600", color: m.ink }}>
              {m.t("Your documents", "وثائقك")}
            </Text>
            <MechanicDocuments documents={profile.documents} />
          </MechanicCard>
        </>
      )}
      {!previewOnly && (
        <>
          <View style={{ height: 18 }} />
          <MechanicButton
            secondary
            label={m.t("Sign out", "تسجيل الخروج")}
            onPress={() => setLogout(true)}
          />
          <MotexaDialog
            icon="log-out-outline"
            visible={logout}
            title={m.t("Sign out?", "تسجيل الخروج؟")}
            message={m.t(
              "Saved progress will be here when you return.",
              "ستجد تقدّمك المحفوظ عند العودة.",
            )}
            confirmText={m.t("Sign out", "تسجيل الخروج")}
            cancelText={m.t("Stay here", "البقاء هنا")}
            onCancel={() => setLogout(false)}
            onConfirm={() =>
              void run(async () => {
                await Store.deleteItemAsync("motexa_access_token");
                router.replace("/");
              })
            }
          />
        </>
      )}
    </MechanicPage>
  );
}

function ApplicationChecklist({ profile }: { profile: MechanicProfile }) {
  const m = useMechanicTheme();
  const rows: [[string, string], boolean][] = [
    [
      [
        m.t("Professional details", "المعلومات المهنية"),
        m.t("Your skills and experience", "تخصصاتك وخبرتك"),
      ],
      !!profile.specializations.length && profile.yearsOfExperience !== null,
    ],
    [
      [
        m.t("Service options", "طرق تقديم الخدمة"),
        m.t("Choose how you serve customers", "اختر كيف تقدم خدماتك"),
      ],
      profile.offersWorkshop || profile.offersOnSite || profile.offersOnline,
    ],
    [
      [
        m.t("Identity & documents", "الهوية والوثائق"),
        m.t("Private professional verification", "وثائق التحقق الخاصة"),
      ],
      ["IDENTITY", "CERTIFICATE", ...(profile.offersWorkshop ? ["WORKSHOP_PROOF"] : [])].every(kind => profile.documents.some(d => d.kind === kind)),
    ],
    [
      [
        m.t("Review & submit", "المراجعة والإرسال"),
        m.t("Send to your Mechanics Admin", "أرسل طلبك لأدمن الميكانيكي"),
      ],
      !!profile.submittedAt,
    ],
  ];
  return (
    <View style={{ gap: 8 }}>
      {rows.map(([[title, desc], done], i) => (
        <View
          key={title}
          style={{
            flexDirection: m.row,
            gap: 10,
            alignItems: "center",
            padding: 11,
            borderRadius: 18,
            backgroundColor: m.soft,
          }}
        >
          <View
            style={{
              width: 29,
              height: 29,
              borderRadius: 15,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: m.surface,
            }}
          >
            {done ? (
              <Ionicons name="checkmark" size={17} color={m.muted} />
            ) : (
              <Text style={{ fontSize: 11, color: m.muted }}>
                {String(i + 2).padStart(2, "0")}
              </Text>
            )}
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <Text
              style={{
                fontSize: 13,
                fontWeight: "600",
                color: m.ink,
                textAlign: m.align,
              }}
            >
              {title}
            </Text>
            <Text
              style={{
                fontSize: 10,
                lineHeight: 18,
                color: m.muted,
                textAlign: m.align,
              }}
            >
              {desc}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}
function ApplicationTimeline({ profile }: { profile: MechanicProfile }) {
  const m = useMechanicTheme();
  const decided = [
    "VERIFIED",
    "REJECTED",
    "NEEDS_COMPLETION",
    "SUSPENDED",
  ].includes(profile.verificationStatus);
  const rows = [
    {
      title: m.t("Application received", "تم استلام الطلب"),
      detail: profile.submittedAt
        ? new Date(profile.submittedAt).toLocaleString(m.ar ? "ar" : "en")
        : "",
      done: !!profile.submittedAt,
      active: false,
    },
    {
      title: m.t("Administrator review", "مراجعة الأدمن"),
      detail: m.t(
        "Your file is submitted for professional review.",
        "ملفك مرسل للمراجعة المهنية.",
      ),
      done: decided,
      active: profile.verificationStatus === "PENDING",
    },
    {
      title: m.t("Professional interview", "المقابلة المهنية"),
      detail:
        profile.interviewResult === "PASSED"
          ? m.t("Interview passed", "تم اجتياز المقابلة")
          : profile.interviewResult === "FAILED"
            ? m.t("Interview result recorded", "تم تسجيل نتيجة المقابلة")
            : m.t("Waiting for the administrator", "بانتظار الأدمن"),
      done: !!profile.interviewResult,
      active: false,
    },
    {
      title: m.t("Review decision", "قرار المراجعة"),
      detail: decided
        ? m.t(
            "A decision is recorded on your application.",
            "تم تسجيل قرار على طلبك.",
          )
        : m.t("You will be notified in the app.", "سيصلك إشعار داخل التطبيق."),
      done: decided,
      active: false,
    },
  ];
  return (
    <View style={{ paddingTop: 9, gap: 0 }}>
      {rows.map((r, i) => (
        <View
          key={r.title}
          style={{ flexDirection: m.row, gap: 11, minHeight: 69 }}
        >
          <View style={{ alignItems: "center", width: 24 }}>
            <View
              style={{
                width: 23,
                height: 23,
                borderRadius: 12,
                backgroundColor: r.done ? "#80502A" : m.surface,
                borderWidth: r.active ? 2 : 1,
                borderColor: r.done || r.active ? "#A16B36" : m.border,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {r.done ? (
                <Ionicons name="checkmark" size={13} color="#FFF7EA" />
              ) : r.active ? (
                <View
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: 5,
                    backgroundColor: "#A16B36",
                  }}
                />
              ) : null}
            </View>
            {i < rows.length - 1 && (
              <View
                style={{
                  width: 1,
                  flex: 1,
                  backgroundColor: m.border,
                  marginVertical: 3,
                }}
              />
            )}
          </View>
          <View style={{ flex: 1, paddingBottom: 16, gap: 3 }}>
            <Text
              style={{
                fontSize: 13,
                fontWeight: "600",
                color: m.ink,
                textAlign: m.align,
              }}
            >
              {r.title}
            </Text>
            <Text
              style={{
                fontSize: 10,
                lineHeight: 18,
                color: m.muted,
                textAlign: m.align,
              }}
            >
              {r.detail}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}
