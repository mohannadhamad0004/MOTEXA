import MechanicType from './MechanicType';
import MechanicAccountSpace from './MechanicAccountSpace';
import MechanicInterviewAppointment from './MechanicInterviewAppointment';
import {mechanicDraftStore} from './MechanicDraftStore';
import {draftStageLimit,type MechanicDraftForm} from './mechanic-draft-store';
import MechanicApplicationSummary from './MechanicApplicationSummary';
import MechanicProfileComposer from './MechanicProfileComposer';
import MechanicStageActions from './MechanicStageActions';
import MechanicStageSurface from './MechanicStageSurface';
import {MechanicFormSection} from './MechanicFormSection';
import MechanicProgressPanel from './MechanicProgressPanel';
import {ServiceModeChoices} from './MechanicServiceModes';
import SignOutAction from './SignOutAction';
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, View, Image} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { Text } from "./MotexaVisual";
import * as Store from "./SessionStore";
import MotexaDialog from "./MotexaDialog";
import {
  MechanicPage,
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
type Form = MechanicDraftForm;
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
    [storedStep, setStep] = useState(initialStep),
    [privacy, setPrivacy] = useState(false),
    [notices, setNotices] = useState<Notice[]>([]),
    [logout, setLogout] = useState(false),
    [message, setMessage] = useState(""),
    [draftReady,setDraftReady]=useState(false),
    [draftStatus,setDraftStatus]=useState<'saving'|'local'|'error'>('saving');
  const pendingDraft=useRef<{userId:string;draft:import('./mechanic-draft-store').MechanicDraft}|null>(null);
  const step=previewOnly?Math.max(0,Math.min(3,initialStep)):storedStep;

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
          const p=data.profile;
          if (['DRAFT','NEEDS_COMPLETION'].includes(p.verificationStatus)) {
            const saved=await mechanicDraftStore.read(p.userId);
            if(!alive)return;
            if(saved?.profileId===p.id&&saved.submissionVersion===p.submissionVersion){
              const restored={...initial,...saved.form};
              setForm(restored);
              setStep(Math.min(saved.step,draftStageLimit(restored,p.documents)));
            }else{
              const restored={...p,yearsOfExperience:p.yearsOfExperience===null?'':String(p.yearsOfExperience),coverageAreas:p.coverageAreas.join(', ')};
              setStep(draftStageLimit(restored,p.documents));
            }
            setEditing(true);
          }else {setEditing(false);await mechanicDraftStore.clear(p.userId);}
          setDraftReady(true);
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
  // Passwords, document contents, approval state and preview fixtures are never cached.
  useEffect(()=>{
    if(previewOnly||!draftReady||!profile||!editing||!['DRAFT','NEEDS_COMPLETION'].includes(profile.verificationStatus)){
      pendingDraft.current=null;
      if(!previewOnly&&profile&&!['DRAFT','NEEDS_COMPLETION'].includes(profile.verificationStatus))void mechanicDraftStore.clear(profile.userId).catch(()=>{});
      return;
    }
    const snapshot={userId:profile.userId,draft:{version:1 as const,form,step,profileId:profile.id,submissionVersion:profile.submissionVersion}};
    pendingDraft.current=snapshot;
    let active=true;
    const timer=setTimeout(()=>{
      setDraftStatus('saving');
      void mechanicDraftStore.write(snapshot.userId,snapshot.draft)
        .then(()=>{if(active)setDraftStatus('local');}).catch(()=>{if(active)setDraftStatus('error');});
    },250);
    return()=>{active=false;clearTimeout(timer);};
  },[previewOnly,draftReady,profile,editing,form,step]);
  useEffect(()=>{
    const flush=()=>{const snapshot=pendingDraft.current;if(snapshot)void mechanicDraftStore.write(snapshot.userId,snapshot.draft).catch(()=>{});};
    const listener=AppState.addEventListener('change',state=>{if(state!=='active')flush();});
    return()=>{listener.remove();flush();};
  },[]);
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
    await mechanicDraftStore.write(data.profile.userId,{version:1,form,step,profileId:data.profile.id,submissionVersion:data.profile.submissionVersion});
  }
  function validateStage(target: number) {
    if (previewOnly) return;
    if (target === 0 && (!form.city.trim() || !form.phoneNumber.trim() || !form.specializations.length || !form.experienceSummary.trim() || form.yearsOfExperience.trim() === '' || !Number.isInteger(Number(form.yearsOfExperience)) || Number(form.yearsOfExperience) < 0))
      throw Error(m.t('Complete your city, phone, specialties and experience before continuing.','أكمل المدينة ورقم الهاتف والتخصصات وبيانات الخبرة قبل المتابعة.'));
    if (target === 1 && ((!form.offersWorkshop && !form.offersOnSite && !form.offersOnline) || (form.offersWorkshop && (!form.workshopName.trim() || !form.workshopAddress.trim())) || (form.offersOnSite && !form.coverageAreas.split(/[,،]/).some(item=>item.trim())) || (form.offersOnline && !form.phoneNumber.trim())))
      throw Error(m.t('Choose a service and complete its required details before continuing.','اختر طريقة تقديم الخدمة وأكمل بياناتها المطلوبة قبل المتابعة.'));
    if (target === 2) {
      const required=['IDENTITY','CERTIFICATE',...(form.offersWorkshop?['WORKSHOP_PROOF']:[])];
      if (!required.every(kind=>profile?.documents.some(document=>document.kind===kind)))
        throw Error(m.t('Upload the required documents before continuing.','ارفع الوثائق المطلوبة قبل المتابعة.'));
    }
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
  if(!previewOnly&&profile&&!editing&&(profile.submittedAt||profile.verificationStatus==='VERIFIED')){
    return <MechanicType><MechanicAccountSpace profile={profile} notices={notices} busy={busy} error={error} onRefresh={refresh} onUpdated={apply} onEdit={()=>{setStep(0);setPrivacy(false);setEditing(true);}}/></MechanicType>;
  }
  return (
    <MechanicPage
      title={title}
      progress={editing ? step + 2 : undefined}
      stepsDisabled={busy}
      canSelectStep={value=>previewOnly||(value>1&&value<=step+3)}
      onStep={editing?value=>{if(previewOnly){onPreviewStep?.(value);return;}if(value<2||value===step+2||value>step+3)return;void run(async()=>{if(value>step+2)validateStage(step);await save();setPrivacy(false);setStep(value-2);});}:undefined}
      photo={!editing && !!profile}
      subtitle={
        profile
          ? profile.user.fullName
          : m.t("Your MOTEXA mechanic account", "حسابك كميكانيكي في MOTEXA")
      }
    >
      {previewOnly&&<View style={{flexDirection:m.row,alignItems:'center',gap:7,paddingVertical:10,marginBottom:10,borderBottomWidth:1,borderColor:m.border}}><Ionicons name="eye-outline" size={15} color={m.muted}/><Text style={{fontSize:11,lineHeight:22,color:m.muted,flex:1,textAlign:m.align}}>{m.t('Preview only · Nothing is saved or submitted.','معاينة فقط · لا يتم حفظ أو إرسال أي بيانات.')}</Text></View>}
      {error && <MechanicNote error>{error}</MechanicNote>}
      {message && <MechanicNote>{message}</MechanicNote>}
        {!previewOnly&&!editing&&profile&&<MechanicInterviewAppointment profile={profile} onUpdated={apply}/>}
        {!previewOnly&&!editing&&profile?.submittedAt&&<MechanicProgressPanel profile={profile} onEdit={()=>{setStep(0);setPrivacy(false);setEditing(true);}}/>}
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
          {!previewOnly&&<Text style={{fontSize:11,lineHeight:21,color:m.muted,marginBottom:12,textAlign:m.align}}>{draftStatus==='saving'?m.t('Saving draft on this device…','جارٍ حفظ المسودة على هذا الجهاز…'):draftStatus==='local'?m.t('Draft saved on this device · Continue or Save draft syncs it to your account.','المسودة محفوظة على هذا الجهاز · المتابعة أو حفظ المسودة يزامنها مع حسابك.'):m.t('Device save failed. Use Save draft to save to your account.','تعذّر الحفظ على الجهاز. استخدم حفظ المسودة لحفظها في حسابك.')}</Text>}
          <MechanicStageSurface stage={step+2}>
            {step === 0 ? (
              <MechanicProfileComposer name={profile.user.fullName} value={form} disabled={busy} onChange={patch=>setForm(old=>({...old,...patch}))}/>
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
                    "Choose your primary service. Each mode has its own required details.",
                    "اختر خدمتك الأساسية؛ لكل مسار بيانات ومتطلبات مستقلة.",
                  )}
                </Text>
                <ServiceModeChoices value={form} disabled={busy} onChange={field=>setForm(old=>({...old,offersWorkshop:false,offersOnSite:false,offersOnline:false,[field]:true}))}/>
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
                      maxLength={120}
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
                      maxLength={250}
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
                    source={require("../../assets/images/department-workshop-mathias.jpg")}
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
                <MechanicFormSection icon="shield-checkmark-outline" number="04" title={m.t('Your professional credentials','وثائقك المهنية')} description={profile.documents.filter(d=>['IDENTITY','CERTIFICATE',...(form.offersWorkshop?['WORKSHOP_PROOF']:[])].includes(d.kind)).length+'/'+(form.offersWorkshop?3:2)+' '+m.t('required files uploaded','ملفات مطلوبة مرفوعة')}/>
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
                <MechanicApplicationSummary name={profile.user.fullName} email={profile.user.email} value={form} specialties={form.specializations.map(specLabel)} documents={profile.documents} disabled={busy} onEdit={target=>{if(previewOnly)onPreviewStep?.(target+2);else setStep(target);}}/>
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
                      await mechanicDraftStore.clear(data.profile.userId);
                      await refresh();
                    })
                  }
                />
              </>
            )}
          </MechanicStageSurface>
          <MechanicStageActions step={step} busy={busy} onContinue={()=>void run(async()=>{validateStage(step);await save();if(previewOnly)onPreviewStep?.(step+3);else setStep(v=>v+1);})} onPrevious={()=>{if(previewOnly)onPreviewStep?.(step+1);else setStep(v=>v-1);}} onSave={()=>void run(async()=>{if(previewOnly){setMessage(m.t('Preview only — changes stay on this screen and are not saved to the database.','معاينة فقط — التغييرات محلية ولا تُحفظ في قاعدة البيانات.'));return;}await save();setEditing(false);setMessage(m.t('Your progress is saved.','تم حفظ تقدّمك.'));})}/>
        </>
      ) : (
        <>
          {(!profile.submittedAt||profile.verificationStatus==='DRAFT')&&<MechanicCard>
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

            {editable && (
              <MechanicButton
                label={
                  profile.verificationStatus === "DRAFT"
                    ? m.t("Continue verification", "متابعة الاعتماد")
                    : m.t("Complete requested changes", "استكمال المطلوب")
                }
                onPress={() => {
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
          </MechanicCard>}
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
          <SignOutAction onPress={() => setLogout(true)} />
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
