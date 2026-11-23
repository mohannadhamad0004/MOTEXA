import MechanicAssessmentPackage from './MechanicAssessmentPackage';
import MechanicInterviewScheduler from './MechanicInterviewScheduler';
import {ReviewQuestionSurface,ReviewCheckpoint,ReviewMessage,ReviewEmpty} from './MechanicReviewElements';
import MechanicDossierContact from './MechanicDossierContact';
import MechanicDossierFocus from './MechanicDossierFocus';
import MechanicDossierHistory from './MechanicDossierHistory';
import MechanicReviewStudio from './MechanicReviewStudio';
import ApplicationStatusOptions from './ApplicationStatusOptions';
import ApplicationQueueHeading from './ApplicationQueueHeading';
import ApplicationResultsState from './ApplicationResultsState';
import ApplicationSearchTools from './ApplicationSearchTools';
import ApplicationReviewCard from './ApplicationReviewCard';
import MechanicReviewBrief from './MechanicReviewBrief';
import {ServiceModeOverview,ServiceModeDossier,type ServiceModeKey} from './MechanicServiceModes';
import SignOutAction from './SignOutAction';

import Pressable from "./MotionPressable";
import { useCallback, useRef, useState } from "react";
import { View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "./MotexaVisual";
import * as Store from "./SessionStore";
import MotexaDialog from "./MotexaDialog";
import {
  MechanicField,
  MechanicNote,
  MechanicChoice,
  useMechanicTheme,
} from "./MechanicUI";
import {
  WorkspaceFrame,
  WorkspaceCard,
  WorkspaceButton,
  WorkspaceBadge,
  WorkspaceAvatar,
  WorkspaceHeading,
  WorkspaceTabs,
  WorkspaceSheet,
  WorkspaceHero,
  type WorkspaceIcon,
} from "./MechanicWorkspaceUI";
import {
  mechanicApi,
  MechanicApiError,
  mechanicSpecializations,
  type MechanicProfile,
} from "./mechanic-api";
import {
  workflow,
  getWorkflowDetail,
  type Question,
  type ProfessionalTest,
  type ApplicationSummary,
  type WorkflowNotice,
  type ConversationMessage,
} from "./mechanic-workflow-api";
import MechanicDocuments from "./MechanicDocuments";

type Page =
  | "home"
  | "applications"
  | "directory"
  | "bank"
  | "notifications"
  | "messages"
  | "more"
  | "detail";
type DetailTab =
  | "profile"
  | "documents"
  | "test"
  | "conversation"
  | "decision"
  | "history";
const statuses = [
  ["ALL", "All applications", "كل الطلبات"],
  ["NEW", "New", "جديد"],
  ["AWAITING_TEST", "Awaiting test", "بانتظار الاختبار"],
  ["READY", "Ready for decision", "جاهز للقرار"],
  ["PENDING", "In review", "قيد المراجعة"],
  ["NEEDS_COMPLETION", "Needs completion", "يحتاج استكمالًا"],
  ["VERIFIED", "Approved", "معتمد"],
  ["REJECTED", "Rejected", "مرفوض"],
  ["SUSPENDED", "Suspended", "موقوف"],
] as const;
const blankQuestion = {
  explanation: "",
  sourceUrl: "",
  sourceReference: "",
  difficulty: "INTERMEDIATE",
  prompt: "",
  specialization: "PETROL_ENGINES",
  options: ["", "", "", ""],
  correctIndex: 0,
  active: true,
};

function DocumentReviewChoice({label,selected,disabled,userId,documentId,submissionVersion,onReview}:{label:string;selected:boolean;disabled:boolean;userId:string;documentId:string;submissionVersion:number;onReview:(userId:string,documentId:string,submissionVersion:number,reviewed:boolean)=>Promise<void>}) {
  return <MechanicChoice label={label} selected={selected} disabled={disabled} icon="document-text-outline" onPress={()=>{void onReview(userId,documentId,submissionVersion,!selected);}}/>;
}

export default function MechanicReviewScreen() {
  const m = useMechanicTheme();
  const [page, setPage] = useState<Page>("home"),
    [tab, setTab] = useState<DetailTab>("profile"),
    [filter, setFilter] = useState("ALL"),
    [filterOpen, setFilterOpen] = useState(false),
    [query, setQuery] = useState("");
  const [serviceMode,setServiceMode]=useState<ServiceModeKey|'ALL'>('ALL');
  const [totalMechanics,setTotalMechanics]=useState<number|null>(null);
  const [serviceCounts,setServiceCounts]=useState<Partial<Record<ServiceModeKey,number>>>({});
  const [questionsLoaded,setQuestionsLoaded]=useState(false);
  const [summaryLoaded,setSummaryLoaded]=useState(false);
  const [dossierOffsets,setDossierOffsets]=useState<Record<string,number>>({});
  const [cursor, setCursor] = useState<string | null>(null);
  const [rows, setRows] = useState<ApplicationSummary[]>([]),
    [counts, setCounts] = useState<Record<string, number>>({}),
    [user, setUser] = useState<{ id: string; fullName: string; role?:string } | null>(null),
    [notices, setNotices] = useState<WorkflowNotice[]>([]);
  const [detail, setDetail] = useState<MechanicProfile | null>(null),
    [tests, setTests] = useState<ProfessionalTest[]>([]),
    [reviewed, setReviewed] = useState<string[]>([]),
    [questions, setQuestions] = useState<Question[]>([]),
    [selected, setSelected] = useState<string[]>([]),
    [manualQuestions,setManualQuestions]=useState(false),
    [specialty, setSpecialty] = useState("ALL");
  const [messages, setMessages] = useState<ConversationMessage[]>([]),
    [hasOlder, setHasOlder] = useState(false),
    [draft, setDraft] = useState(""),
    [notes, setNotes] = useState(""),
    [assessment, setAssessment] = useState("PASSED"),
    [interviewChoice,setInterviewChoice]=useState(''),
    [interviewNotesDraft,setInterviewNotesDraft]=useState('');
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [confirm, setConfirm] = useState(""),
    [questionOpen, setQuestionOpen] = useState(false),
    [editId, setEditId] = useState<string | null>(null),
    [form, setForm] = useState(blankQuestion);
  const operation = useRef(false),
    focused = useRef(false),
    loadedMore = useRef(false);
  const stage = (p: ApplicationSummary) => {
    if (p.verificationStatus !== "PENDING") return p.verificationStatus;
    const t = p.tests?.find((t) => t.submissionVersion === p.submissionVersion);
    return t?.submittedAt ? "READY" : t ? "AWAITING_TEST" : "NEW";
  };
  const label = (s: string) => {
    const r = statuses.find((v) => v[0] === s);
    return r ? m.t(r[1], r[2]) : s;
  };
  const spec = (s: string) => {
    const row = mechanicSpecializations.find((v) => v[0] === s);
    return row
      ? m.t(row[1], row[2])
      : s === "SAFETY"
        ? m.t("Safety", "السلامة")
        : s;
  };
  const date = (s: string) =>
    new Date(s).toLocaleString(m.ar ? "ar" : "en", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  const latest = tests.find(
    (t) => t.submissionVersion === detail?.submissionVersion,
  );
  const run = useCallback(async (fn: () => Promise<void>) => {
    if (operation.current) return;
    operation.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      if(e instanceof MechanicApiError&&e.status===401){router.replace({pathname:'/auth/login',params:{selectedRole:'mechanics-admin'}});return;}
      setError(
        e instanceof Error
          ? e.message
          : (m.ar ? "حاول مجددًا." : "Please try again."),
      );
    } finally {
      operation.current = false;
      setBusy(false);
    }
  }, [m.ar]);
  const refresh = useCallback(async () => {
    const [data, n] = await Promise.all([
      mechanicApi<{
        profiles: ApplicationSummary[];
        counts: Record<string, number>;
        nextCursor: string | null;
        workflowCounts: Record<string, number>;
        serviceCounts?:Partial<Record<ServiceModeKey,number>>;
        registeredServiceCounts?:Partial<Record<ServiceModeKey,number>>;
        totalMechanics?:number;
      }>("/api/mechanics/admin?mode="+serviceMode),
      mechanicApi<{ notifications: WorkflowNotice[] }>(
        "/api/mechanics/notifications",
      ),
    ]);
    setRows(data.profiles);
    loadedMore.current=false;
    setCursor(data.nextCursor);
    setServiceCounts(data.registeredServiceCounts??data.serviceCounts??{});
    setTotalMechanics(typeof data.totalMechanics==='number'?data.totalMechanics:null);
    setCounts(data.counts);
    setSummaryLoaded(true);
    setNotices(n.notifications);
  }, [serviceMode]);
  async function reloadDetail(id: string) {
    const data = await getWorkflowDetail(id);
    setDetail(data.profile);
    setInterviewChoice(data.profile.interviewRecorded?data.profile.interviewResult??'':'');
    setInterviewNotesDraft(data.profile.interviewRecorded?data.profile.interviewNotes??'':'');
    setTests(data.tests);
    setReviewed(data.reviewed);
    return data;
  }
  async function loadQuestions() {
    const data = await workflow<{ questions: Question[] }>("/questions");
    setQuestions(data.questions);
    setQuestionsLoaded(true);
  }
  async function loadMessages(id: string, older = false) {
    const before =
      older && messages[0]
        ? "?before=" + encodeURIComponent(messages[0].id)
        : "";
    const data = await workflow<{
      messages: ConversationMessage[];
      hasMore: boolean;
    }>("/applications/" + id + "/messages" + before);
    setMessages((old) => (older ? [...data.messages, ...old] : data.messages));
    setHasOlder(data.hasMore);
  }
  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      void run(async () => {
        const session=await Store.getItemAsync('motexa_access_token');
        if(!focused.current)return;
        if(!session){router.replace({pathname:'/auth/login',params:{selectedRole:'mechanics-admin'}});return;}
        const me = await mechanicApi<{
          user: { id: string; fullName: string; role?:string };
        }>("/api/auth/me");
        if (!focused.current) return;
        setUser(me.user);
        await refresh();
      });
      return () => {
        focused.current = false;
      };
    }, [run, refresh]),
  );
  useFocusEffect(
    useCallback(() => {
      const timer = setInterval(() => {
        if (!operation.current && focused.current)
          void refresh().catch(() => {});
      }, 25000);
      return () => clearInterval(timer);
    }, [refresh]),
  );
  const conversationUserId=detail?.userId;
  useFocusEffect(
    useCallback(() => {
      if (page !== "detail" || tab !== "conversation" || !conversationUserId) return;
      const timer = setInterval(() => {
        if (!operation.current)
          void workflow<{messages:ConversationMessage[];hasMore:boolean}>("/applications/"+conversationUserId+"/messages").then(data=>{setMessages(data.messages);setHasOlder(data.hasMore);}).catch(() => {});
      }, 12000);
      return () => clearInterval(timer);
    }, [page, tab, conversationUserId]),
  );
  async function reviewDocument(userId:string,documentId:string,submissionVersion:number,isReviewed:boolean) {
    await run(async()=>{
      await workflow("/applications/"+userId+"/reviews","POST",{documentId,reviewed:isReviewed,submissionVersion});
      await reloadDetail(userId);
    });
  }
  function navigate(next: string) {
    setError("");
    setNotice("");
    if(next === "home") setServiceMode("ALL");
    if (next === "bank") void run(loadQuestions);
    setPage(next as Page);
  }
  async function open(id: string, target: DetailTab = "documents") {
    await run(async () => {
      await reloadDetail(id);
      setDossierOffsets({});
      setPage("detail");
      setTab(target);
      setNotes("");
      setSelected([]);setManualQuestions(false);
      if (target === "test") await loadQuestions();
      if (target === "conversation") await loadMessages(id);
    });
  }
  function changeTab(value: string) {
    setTab(value as DetailTab);
    setError("");
    if (value === "test") void run(loadQuestions);
    if (value === "conversation" && detail)
      void run(() => loadMessages(detail.userId));
  }
  const unread = notices.filter((n) => !n.readAt).length;
  const matches = rows.filter(
    (p) =>
      (page !== "directory" ||
        ["VERIFIED", "SUSPENDED"].includes(p.verificationStatus)) &&
      (filter === "ALL" ||
        (filter === "PENDING"
          ? p.verificationStatus === "PENDING"
          : stage(p) === filter)) &&
      `${p.user.fullName} ${p.city} ${p.specializations.map(spec).join(" ")}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const actions: Record<string, [string, string]> = {
    APPROVE: ["Approve application", "اعتماد الطلب"],
    NEEDS_COMPLETION: ["Request completion", "طلب استكمال"],
    REJECT: ["Reject application", "رفض الطلب"],
    SUSPEND: ["Suspend account", "إيقاف الحساب"],
    REACTIVATE: ["Reactivate account", "إعادة تفعيل الحساب"],
    SEND: ["Send two questions", "إرسال سؤالين"],
    LOGOUT: ["Sign out", "تسجيل الخروج"],
  };
  async function confirmAction() {
    const action = confirm;
    setConfirm("");
    await run(async () => {
      if (action === "LOGOUT") {
        await Store.deleteItemAsync("motexa_access_token");
        router.replace("/");
        return;
      }
      if (!detail) return;
      if (action === "SEND") {
        await workflow("/applications/" + detail.userId + "/tests", "POST", {
          submissionVersion: detail.submissionVersion,
          questionIds: selected,
        });
        setNotice(
          m.t(
            "The test was sent to the mechanic account.",
            "تم إرسال الاختبار لحساب الميكانيكي.",
          ),
        );
      } else {
        await mechanicApi(
          "/api/mechanics/admin/" + detail.userId + "/decision",
          "POST",
          { action, notes, submissionVersion: detail.submissionVersion },
        );
        setNotice(
          m.t(
            "Decision saved and mechanic notified.",
            "تم حفظ القرار وإشعار الميكانيكي.",
          ),
        );
        setNotes("");
      }
      await reloadDetail(detail.userId);
      await refresh();
    });
  }
  function selectQuestion(q: Question) {
    setSelected((old) =>
      old.includes(q.id)
        ? old.filter((id) => id !== q.id)
        : old.length < 2
          ? [...old, q.id]
          : old,
    );
  }
  const [reviewQuestion, setReviewQuestion] = useState<Question | null>(null);
  const [reviewerName, setReviewerName] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  async function reviewBankQuestion(q: Question, status: string) {
    await run(async () => {
      await workflow("/questions/" + q.id + "/review", "POST", {
        status,
        revision: q.revision,
        reviewerName,
        reviewNotes,
        confirmReviewed: reviewConfirmed,
      });
      await loadQuestions();
      setReviewQuestion(null);
      setSelected([]);setManualQuestions(false);
    });
  }
  function editQuestion(q?: Question) {
    setEditId(q?.id ?? null);
    setForm(
      q
        ? {
            prompt: q.prompt,
            specialization: q.specialization,
            options: [...q.options],
            correctIndex: q.correctIndex,
            active: q.active,
            explanation: q.explanation,
            sourceUrl: q.sourceUrl,
            sourceReference: q.sourceReference,
            difficulty: q.difficulty,
          }
        : { ...blankQuestion, options: ["", "", "", ""] },
    );
    setQuestionOpen(true);
  }
  async function saveQuestion() {
    await run(async () => {
      const old = questions.find((q) => q.id === editId);
      await workflow(
        "/questions" + (editId ? "/" + editId : ""),
        editId ? "PUT" : "POST",
        { ...form, ...(old ? { revision: old.revision } : {}) },
      );
      await loadQuestions();
      setQuestionOpen(false);
      setNotice(
        m.t(
          "Draft saved. Technical review is required before sending. Previously sent tests remain unchanged.",
          "تم حفظ المسودة. يلزم اعتماد المراجعة قبل الإرسال. الاختبارات السابقة لا تتغير.",
        ),
      );
    });
  }
  async function readNotice(n: WorkflowNotice) {
    await run(async () => {
      await mechanicApi(
        "/api/mechanics/notifications/" + n.id + "/read",
        "POST",
      );
      if (n.relatedUserId) {
        await reloadDetail(n.relatedUserId);
        setPage("detail");
        setTab(
          n.kind === "MESSAGE"
            ? "conversation"
            : n.kind === "TEST_SUBMITTED"
              ? "test"
              : "profile",
        );
        if (n.kind === "MESSAGE") await loadMessages(n.relatedUserId);
        if (n.kind === "TEST_SUBMITTED") await loadQuestions();
      }
      await refresh();
    });
  }
  function applicationList() {
    return (
      <View style={{gap:10}}>
        <ServiceModeOverview total={totalMechanics} counts={serviceCounts} selected={serviceMode} disabled={busy} onSelect={mode=>{if(mode!==serviceMode){setRows([]);setServiceMode(mode);}}}/>
        <ApplicationSearchTools query={query} onQuery={setQuery} statusLabel={label(filter)} onStatus={()=>setFilterOpen(true)} filtered={!!query||filter!=='ALL'||serviceMode!=='ALL'} onReset={()=>{setFilter('ALL');setQuery('');setServiceMode('ALL');}}/>
        <ApplicationQueueHeading hasResults={matches.length>0} onBank={()=>navigate('bank')}/>
        {!matches.length&&<ApplicationResultsState loading={busy} loaded={summaryLoaded} filtered={!!query||filter!=='ALL'||serviceMode!=='ALL'||page==='directory'} onRetry={()=>void run(refresh)} onClear={()=>{setFilter('ALL');setQuery('');setServiceMode('ALL');}}/>}
        {matches.map((p,index) => {
          const st = stage(p);
          return <ApplicationReviewCard key={p.id} delay={Math.min(index,4)*45} profile={p} status={st} statusLabel={label(st)} specialties={p.specializations.map(spec).join(' · ')} date={date(p.submittedAt)} disabled={busy} onReview={()=>void open(p.userId)}/>;
        })}
        {cursor && (
          <WorkspaceButton
            secondary
            label={m.t("Load more applications", "تحميل طلبات إضافية")}
            disabled={busy}
            onPress={() =>
              void run(async () => {
                const data = await mechanicApi<{
                  profiles: ApplicationSummary[];
                  nextCursor: string | null;
                }>("/api/mechanics/admin?mode="+serviceMode+"&cursor=" + encodeURIComponent(cursor));
                setRows((old) => [
                  ...old,
                  ...data.profiles.filter(
                    (p) => !old.some((r) => r.id === p.id),
                  ),
                ]);
                loadedMore.current = true;
                setCursor(data.nextCursor);
              })
            }
          />
        )}
      </View>
    );
  }
  function questionBank(assign = false) {
    return (
      <>
        <WorkspaceHeading
          title={
            assign
              ? m.t("Prepare professional test", "تجهيز الاختبار المهني")
              : m.t("Professional question bank", "بنك الأسئلة المهنية")
          }
          subtitle={
            assign
              ? m.t(
                  "Choose exactly two active questions relevant to this mechanic.",
                  "اختر سؤالين فعالين يناسبان تخصص الميكانيكي.",
                )
              : m.t(
                  "Add, edit or deactivate questions. Sent tests keep their own snapshots.",
                  "أضف وعدّل وعطّل الأسئلة. الاختبارات المرسلة تحتفظ بنسختها.",
                )
          }
        />
        {!assign&&<View style={{flexDirection:m.row,alignItems:'center',gap:10,marginBottom:15,paddingBottom:13,borderBottomWidth:1,borderColor:m.border}}><Ionicons name="library-outline" size={22} color={m.muted}/><Text style={{flex:1,fontSize:12,lineHeight:23,color:m.muted,textAlign:m.align}}>{questionsLoaded?questions.filter(q=>q.active&&q.reviewStatus==='APPROVED').length+' '+m.t('approved active questions · ','أسئلة فعالة ومعتمدة · ')+questions.length+' '+m.t('total','بالإجمالي'):m.t('Retrieving your saved question library','جارٍ استرجاع مكتبة الأسئلة المحفوظة')}</Text></View>}
        {assign&&<>
          {detail&&<MechanicAssessmentPackage profile={detail} latest={latest} questionIds={selected} questions={questions} onSuggested={async ids=>{await loadQuestions();setSelected(ids);}} onSent={async()=>{await reloadDetail(detail.userId);setNotice(m.t('Questions and interview sent together. The mechanic can now complete the assigned tasks.','تم إرسال الأسئلة وموعد المقابلة معًا. يمكن للميكانيكي الآن إكمال المطلوب.'));}}/>}
          <WorkspaceButton secondary label={manualQuestions?m.t('Hide manual question selection','إخفاء اختيار الأسئلة يدويًا'):m.t('Choose questions manually','اختيار الأسئلة يدويًا')} onPress={()=>setManualQuestions(v=>!v)}/>
        </>}
        {(!assign||manualQuestions)&&<WorkspaceCard flat={assign}>
          <WorkspaceButton
            secondary
            icon="add"
            label={m.t("Add question", "إضافة سؤال")}
            onPress={() => editQuestion()}
          />
          <WorkspaceTabs
            value={specialty}
            onChange={setSpecialty}
            items={[
              { key: "ALL", label: m.t("All specialties", "كل التخصصات") },
              ...mechanicSpecializations.map((s) => ({
                key: s[0],
                label: spec(s[0]),
              })),
              { key: "SAFETY", label: spec("SAFETY") },
            ]}
          />
          {questions
            .filter(
              (q) =>
                (specialty === "ALL" || q.specialization === specialty) &&
                (!assign ||
                  (q.active &&
                    q.reviewStatus === "APPROVED" &&
                    (q.specialization === "SAFETY" ||
                      detail?.specializations.includes(q.specialization)))),
            )
            .map((q) => (
              <ReviewQuestionSurface key={q.id} selected={selected.includes(q.id)}>
                <View
                  style={{
                    flexDirection: m.row,
                    justifyContent: "space-between",
                    gap: 7,
                  }}
                >
                  <WorkspaceBadge label={spec(q.specialization)} />
                  <WorkspaceBadge
                    label={
                      q.reviewStatus === "APPROVED"
                        ? m.t("Approved", "معتمد")
                        : q.reviewStatus === "DISABLED"
                          ? m.t("Disabled", "معطل")
                          : m.t("Draft · needs review", "مسودة · تحتاج مراجعة")
                    }
                    tone={q.active ? "green" : "grey"}
                  />
                </View>
                {assign ? (
                  <MechanicChoice
                    label={q.prompt}
                    selected={selected.includes(q.id)}
                    onPress={() => selectQuestion(q)}
                    disabled={
                      busy ||
                      (!selected.includes(q.id) && selected.length === 2)
                    }
                  />
                ) : (
                  <Text
                    style={{
                      fontSize: 14,
                      lineHeight: 23,
                      color: m.ink,
                      textAlign: m.align,
                    }}
                  >
                    {q.prompt}
                  </Text>
                )}
                <Text style={{ fontSize: 11, color: m.muted }}>
                  {m.t("Correct answer: ", "الإجابة الصحيحة: ") +
                    q.options[q.correctIndex]}
                </Text>
                {!assign && (
                  <>
                    <WorkspaceBadge
                      label={
                        q.difficulty === "ADVANCED"
                          ? m.t("Advanced", "متقدم")
                          : q.difficulty === "FOUNDATION"
                            ? m.t("Foundation", "أساسي")
                            : m.t("Intermediate", "متوسط")
                      }
                    />
                    <Text
                      selectable
                      style={{ color: m.ink, fontSize: 12, lineHeight: 21 }}
                    >
                      {q.explanation}
                    </Text>
                    <Text selectable style={{ color: m.muted, fontSize: 11 }}>
                      {q.sourceReference + "\n" + q.sourceUrl}
                    </Text>
                    {q.reviewerName && (
                      <Text style={{ color: m.muted, fontSize: 11 }}>
                        {m.t("Reviewed by: ", "راجعه: ") +
                          q.reviewerName +
                          " · " +
                          (q.reviewedAt
                            ? new Date(q.reviewedAt).toLocaleDateString()
                            : "")}
                      </Text>
                    )}
                    {q.reviewStatus !== "APPROVED" ? (
                      <WorkspaceButton
                        small
                        secondary
                        icon="checkmark-circle-outline"
                        label={m.t("Review & approve", "مراجعة واعتماد")}
                        onPress={() => {
                          setReviewQuestion(q);
                          setReviewerName("");
                          setReviewNotes("");
                          setReviewConfirmed(false);
                        }}
                      />
                    ) : (
                      <WorkspaceButton
                        small
                        secondary
                        label={m.t("Disable question", "تعطيل السؤال")}
                        onPress={() => void reviewBankQuestion(q, "DISABLED")}
                      />
                    )}
                  </>
                )}
                <WorkspaceButton
                  small
                  secondary
                  icon="create-outline"
                  label={m.t("Edit question", "تعديل السؤال")}
                  onPress={() => editQuestion(q)}
                />
              </ReviewQuestionSurface>
            ))}
          {!questionsLoaded&&<View style={{gap:10}}><MechanicNote>{busy?m.t('Loading your question bank…','جارٍ تحميل بنك الأسئلة…'):m.t('The question bank has not loaded. Retry to retrieve your saved questions.','لم يتم تحميل بنك الأسئلة. أعد المحاولة لاسترجاع الأسئلة المحفوظة.')}</MechanicNote><WorkspaceButton secondary disabled={busy} icon="refresh-outline" label={m.t('Reload question bank','إعادة تحميل بنك الأسئلة')} onPress={()=>void run(loadQuestions)}/></View>}
          {questionsLoaded&&questions.length>0&&!questions.some(q=>(specialty==='ALL'||q.specialization===specialty)&&(!assign||(q.active&&q.reviewStatus==='APPROVED'&&(q.specialization==='SAFETY'||detail?.specializations.includes(q.specialization)))))&&<MechanicNote>{m.t('No questions match this specialty or test eligibility. Choose another specialty.','لا توجد أسئلة مطابقة للتخصص أو شروط الاختبار. اختر تخصصًا آخر.')}</MechanicNote>}
          {questionsLoaded&&!questions.length && (
            <MechanicNote>
              {m.t(
                "Your question bank is empty. Add professionally reviewed questions to begin.",
                "بنك الأسئلة فارغ. أضف أسئلة معتمدة مهنيًا للبدء.",
              )}
            </MechanicNote>
          )}
        </WorkspaceCard>}
        {assign && manualQuestions && (
          <WorkspaceCard>
            <Text style={{ fontSize: 17, fontWeight: "600", color: m.ink }}>
              {m.t("Selected questions", "الأسئلة المختارة") +
                " · " +
                selected.length +
                "/2"}
            </Text>
            {selected.map((id) => (
              <Text
                key={id}
                style={{ fontSize: 13, lineHeight: 22, color: m.ink }}
              >
                {questions.find((q) => q.id === id)?.prompt}
              </Text>
            ))}
            <MechanicNote>
              {m.t(
                "Correct answers are never included in the mechanic test response. The mechanic submits both answers once.",
                "الإجابات الصحيحة لا تظهر للميكانيكي. يرسل إجابتيه مرة واحدة.",
              )}
            </MechanicNote>

            <WorkspaceButton
              secondary
              icon="send-outline"
              label={m.t(
                "Send questions only",
                "إرسال الأسئلة فقط",
              )}
              disabled={
                busy ||
                selected.length !== 2 ||
                (!!latest && !latest.submittedAt) ||
                detail?.verificationStatus !== "PENDING"
              }
              onPress={() => setConfirm("SEND")}
            />
          </WorkspaceCard>
        )}
      </>
    );
  }
  function resultView() {
    return (
      <WorkspaceCard flat>
        <Text style={{ fontSize: 20, fontWeight: "600", color: m.ink }}>
          {m.t("Professional test", "الاختبار المهني")}
        </Text>
        {!latest ? (
          <>
            <MechanicNote>
              {m.t(
                "No test assigned for this application submission.",
                "لم يرسل اختبار لهذه النسخة من الطلب.",
              )}
            </MechanicNote>
            {detail?.verificationStatus === "PENDING" && questionBank(true)}
          </>
        ) : !latest.submittedAt ? (
          <>
            <WorkspaceBadge
              label={m.t(
                "Awaiting mechanic answers",
                "بانتظار إجابات الميكانيكي",
              )}
            />
            <Text style={{ fontSize: 12, color: m.muted }}>
              {m.t("Sent: ", "أرسل: ") + date(latest.assignedAt)}
            </Text>
            {latest.items.map((q, i) => (
              <Text
                key={q.id}
                style={{ fontSize: 13, lineHeight: 23, color: m.ink }}
              >
                {i + 1 + ". " + q.prompt}
              </Text>
            ))}
            <WorkspaceButton
              secondary
              label={m.t("Refresh answers", "تحديث الإجابات")}
              onPress={() =>
                void run(async () => {
                  if (detail) await reloadDetail(detail.userId);
                })
              }
            />
          </>
        ) : (
          <>
            <View
              style={{
                backgroundColor: m.soft,
                padding: 20,
                borderRadius: 24,
                flexDirection: m.row,
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Text style={{ fontSize: 32, color: m.ink, fontWeight: "600" }}>
                {latest.score} / 2
              </Text>
              <Text style={{ fontSize: 12, color: m.muted }}>
                {m.t("Submitted", "تم التسليم")}
              </Text>
            </View>
            {latest.items.map((q) => (
              <View
                key={q.id}
                style={{
                  borderWidth: 1,
                  borderColor: m.border,
                  borderRadius: 23,
                  padding: 15,
                  gap: 8,
                }}
              >
                <Text style={{ fontSize: 14, lineHeight: 23, color: m.ink }}>
                  {q.prompt}
                </Text>
                <WorkspaceBadge
                  label={
                    q.answerIndex === q.correctIndex
                      ? m.t("Correct", "صحيح")
                      : m.t("Incorrect", "غير صحيح")
                  }
                  tone={q.answerIndex === q.correctIndex ? "green" : "red"}
                />
                <Text style={{ fontSize: 12, lineHeight: 21, color: m.ink }}>
                  {m.t("Submitted answer: ", "الإجابة المرسلة: ") +
                    q.options[q.answerIndex ?? 0]}
                </Text>
                <Text style={{ fontSize: 12, lineHeight: 21, color: m.muted }}>
                  {m.t("Correct answer: ", "الإجابة الصحيحة: ") +
                    q.options[q.correctIndex ?? 0]}
                </Text>
              </View>
            ))}
            {latest.reviewedAt && (
              <MechanicNote>
                {m.t("Assessment recorded: ", "التقييم المسجل: ") +
                  latest.assessment +
                  "\n" +
                  latest.reviewNotes}
              </MechanicNote>
            )}
            {detail?.verificationStatus === "PENDING" && (
              <>
                <MechanicField
                  label={m.t("Admin assessment notes", "ملاحظات التقييم")}
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                />
                {[
                  ["PASSED", "Passed", "اجتاز"],
                  [
                    "NEEDS_CLARIFICATION",
                    "Needs clarification",
                    "يحتاج توضيحًا",
                  ],
                  ["NOT_READY", "Not ready", "غير جاهز"],
                ].map(([v, en, ar]) => (
                  <MechanicChoice
                    key={v}
                    label={m.t(en, ar)}
                    selected={assessment === v}
                    onPress={() => setAssessment(v)}
                  />
                ))}
                {notes.trim().length<5&&<Text accessibilityLiveRegion="polite" style={{fontSize:12,lineHeight:23,color:m.muted,textAlign:m.align}}>{m.t('Add assessment notes above (at least 5 characters), then save.','اكتب ملاحظات التقييم في الحقل أعلاه (5 أحرف على الأقل)، ثم احفظ.')}</Text>}
                <WorkspaceButton
                  label={m.t("Save assessment", "حفظ التقييم")}
                  disabled={busy}
                  onPress={() =>
                    void run(async () => {
                      if(notes.trim().length<5)throw Error(m.t('Write assessment notes above before saving (at least 5 characters).','اكتب ملاحظات التقييم في الحقل أعلاه قبل الحفظ (5 أحرف على الأقل).'));
                      await workflow(
                        "/tests/" + latest.id + "/review",
                        "POST",
                        { notes, assessment },
                      );
                      await reloadDetail(detail!.userId);
                      setNotice(
                        m.t(
                          "Assessment saved. Final approval remains your decision.",
                          "تم حفظ التقييم، والاعتماد النهائي يبقى بقرارك.",
                        ),
                      );
                    })
                  }
                />
                <WorkspaceButton
                  secondary
                  label={m.t("Prepare another test", "تجهيز اختبار آخر")}
                  onPress={() => {
                    setSelected([]);setManualQuestions(false);
                    setTests((old) => old);
                    setTab("test");
                    setSpecialty("ALL");
                    setNotice(
                      m.t(
                        "Select two questions below to send another attempt.",
                        "اختر سؤالين بالأسفل لإرسال محاولة جديدة.",
                      ),
                    );
                  }}
                />
                {questionBank(true)}
              </>
            )}
            <WorkspaceButton
              secondary
              label={m.t("Review final decision", "مراجعة القرار النهائي")}
              onPress={() => setTab("decision")}
            />
          </>
        )}
        {tests.length > 1 && (
          <View style={{ gap: 8 }}>
            <Text style={{ color: m.ink, fontWeight: "600" }}>
              {m.t("Test history", "سجل الاختبارات")}
            </Text>
            {tests.map((t) => (
              <Text
                key={t.id}
                style={{ fontSize: 11, lineHeight: 20, color: m.muted }}
              >
                {m.t("Submission ", "نسخة الطلب ") +
                  t.submissionVersion +
                  " · " +
                  m.t("Attempt ", "المحاولة ") +
                  t.attempt +
                  " · " +
                  (t.submittedAt
                    ? `${t.score}/2`
                    : m.t("Awaiting answers", "بانتظار الإجابات"))}
              </Text>
            ))}
          </View>
        )}
      </WorkspaceCard>
    );
  }
  function decisionView() {
    if (!detail) return null;
    const p = detail,
      required = [
        "IDENTITY",
        "CERTIFICATE",
        ...(p.offersWorkshop ? ["WORKSHOP_PROOF"] : []),
      ],
      docsDone = required.every((k) =>
        p.documents.some((d) => d.kind === k && reviewed.includes(d.id)),
      ),
      canApprove =
        docsDone && latest?.reviewedAt && latest.assessment === "PASSED" && p.interviewRecorded === true && p.interviewResult === "PASSED";
    return (
      <WorkspaceCard flat>
        <WorkspaceHeading title={m.t('Professional interview','المقابلة المهنية')} subtitle={m.t('Record this only after the interview takes place. Test grading does not record an interview.','سجّل النتيجة بعد إجراء المقابلة فقط. تقييم الاختبار لا يسجّل مقابلة.')}/>
        <MechanicInterviewScheduler key={p.id+'-'+(p.interviewScheduleId??'new')} profile={p} onSaved={()=>reloadDetail(p.userId)}/>
        {p.interviewRecorded&&<MechanicNote>{m.t('Recorded interview: ','نتيجة المقابلة المسجّلة: ')+(p.interviewResult==='PASSED'?m.t('Passed','اجتاز'):m.t('Not passed','لم يجتز'))+'\n'+(p.interviewNotes??'')}</MechanicNote>}
        {p.verificationStatus==='PENDING'&&!!p.interviewConfirmedAt&&<>
          <MechanicField label={m.t('Professional interview notes','ملاحظات المقابلة المهنية')} value={interviewNotesDraft} onChangeText={setInterviewNotesDraft} multiline editable={!busy}/>
          {[['PASSED','Interview passed','اجتاز المقابلة'],['FAILED','Interview not passed','لم يجتز المقابلة']].map(([value,en,ar])=><MechanicChoice key={value} label={m.t(en,ar)} selected={interviewChoice===value} onPress={()=>setInterviewChoice(value)} disabled={busy}/>) }
          <Text style={{fontSize:12,lineHeight:23,color:m.muted,textAlign:m.align}}>{m.t('Choose the interview outcome and add at least 5 characters of notes.','اختر نتيجة المقابلة وأضف ملاحظات من 5 أحرف على الأقل.')}</Text>
          <WorkspaceButton icon="chatbubbles-outline" label={m.t('Save interview result','حفظ نتيجة المقابلة')} disabled={busy} onPress={()=>void run(async()=>{
            if(!['PASSED','FAILED'].includes(interviewChoice)||interviewNotesDraft.trim().length<5)throw Error(m.t('Choose the interview outcome and write interview notes before saving.','اختر نتيجة المقابلة واكتب ملاحظاتها قبل الحفظ.'));
            await mechanicApi('/api/mechanics/admin/'+p.userId+'/interview','POST',{result:interviewChoice,notes:interviewNotesDraft.trim(),submissionVersion:p.submissionVersion,scheduleId:p.interviewScheduleId});
            await reloadDetail(p.userId);
            setNotice(m.t('Interview result saved. Final approval is still a separate action.','تم حفظ نتيجة المقابلة. الموافقة النهائية إجراء منفصل.'));
          })}/>
        </>}
        <WorkspaceHeading
          title={m.t("Review final decision", "مراجعة القرار النهائي")}
          subtitle={m.t(
            "Review the complete application. Passing a test never activates an account automatically.",
            "راجع الطلب كاملًا. اجتياز الاختبار لا يفعّل الحساب تلقائيًا.",
          )}
        />
        {[
          [
            m.t("Required documents reviewed", "مراجعة الوثائق المطلوبة"),
            docsDone,
          ],
          [m.t("Test submitted", "تسليم الاختبار"), !!latest?.submittedAt],
          [
            m.t("Professional assessment passed", "اجتياز التقييم المهني"),
            latest?.assessment === "PASSED",
          ],
          [m.t('Professional interview passed','اجتياز المقابلة المهنية'),p.interviewRecorded===true&&p.interviewResult==='PASSED'],
        ].map(([title, done]) => <ReviewCheckpoint key={String(title)} label={String(title)} complete={!!done}/>)}
        {p.reviewNotes && <MechanicNote>{p.reviewNotes}</MechanicNote>}
        <MechanicField
          multiline
          label={m.t(
            "Decision notes / required changes",
            "ملاحظات القرار أو المطلوب استكماله",
          )}
          value={notes}
          onChangeText={setNotes}
        />
        {p.verificationStatus === "PENDING" ? (
          <>
            {["APPROVE", "NEEDS_COMPLETION", "REJECT"].map((a) => (
              <WorkspaceButton
                key={a}
                label={m.t(...actions[a])}
                secondary={a !== "APPROVE"}
                disabled={
                  busy ||
                  (a === "APPROVE" ? !canApprove : notes.trim().length < 5)
                }
                icon={
                  a === "APPROVE"
                    ? "checkmark-circle-outline"
                    : a === "REJECT"
                      ? "close-circle-outline"
                      : "document-text-outline"
                }
                onPress={() => setConfirm(a)}
              />
            ))}
          </>
        ) : p.verificationStatus === "VERIFIED" ? (
          <WorkspaceButton
            secondary
            label={m.t(...actions.SUSPEND)}
            disabled={busy || notes.trim().length < 5}
            onPress={() => setConfirm("SUSPEND")}
          />
        ) : p.verificationStatus === "SUSPENDED" ? (
          <WorkspaceButton
            label={m.t(...actions.REACTIVATE)}
            disabled={busy}
            onPress={() => setConfirm("REACTIVATE")}
          />
        ) : (
          <MechanicNote>
            {m.t(
              "A decision is recorded. Wait for resubmission if completion was requested.",
              "القرار مسجّل. انتظر إعادة الإرسال إن طلبت استكمالًا.",
            )}
          </MechanicNote>
        )}
      </WorkspaceCard>
    );
  }
  function conversation() {
    return (
      <WorkspaceCard flat>
        <WorkspaceHeading
          title={m.t("Application conversation", "محادثة الطلب")}
          subtitle={detail?.user.fullName}
        />
        {hasOlder && (
          <WorkspaceButton
            secondary
            small
            label={m.t("Load older messages", "تحميل رسائل أقدم")}
            onPress={() => void run(() => loadMessages(detail!.userId, true))}
          />
        )}
        <View style={{ gap: 12, minHeight: messages.length?180:0 }}>
          {messages.map(msg=><ReviewMessage key={msg.id} sender={msg.sender.fullName} body={msg.body} time={date(msg.createdAt)} mine={msg.senderId===user?.id}/>)}
          {!messages.length&&<ReviewEmpty title={m.t('A direct line to clarity.','تواصل يجعل الخطوة أوضح.')} description={m.t('Discuss documents, assessments and requested updates in this application.','ناقش الوثائق والتقييم والتعديلات المطلوبة ضمن هذا الطلب.')}/>}
        </View>
        <MechanicField
          label={m.t("Write a message", "اكتب رسالة")}
          multiline
          value={draft}
          onChangeText={setDraft}
          maxLength={2000}
        />
        <WorkspaceButton
          icon="send-outline"
          label={m.t("Send message", "إرسال الرسالة")}
          disabled={busy || !draft.trim()}
          onPress={() =>
            void run(async () => {
              await workflow(
                "/applications/" + detail!.userId + "/messages",
                "POST",
                { body: draft },
              );
              setDraft("");
              await loadMessages(detail!.userId);
            })
          }
        />
      </WorkspaceCard>
    );
  }
  function detailView() {
    if(!detail)return null;
    const p=detail;
    const position=(key:string,y:number)=>setDossierOffsets(old=>old[key]===y?old:{...old,[key]:y});
    const required=['IDENTITY','CERTIFICATE',...(p.offersWorkshop?['WORKSHOP_PROOF']:[])];
    const reviewedCount=required.filter(kind=>p.documents.some(document=>document.kind===kind&&reviewed.includes(document.id))).length;
    const testState=latest?.reviewedAt?m.t('Assessment recorded','التقييم مسجّل'):latest?.submittedAt?m.t('Answers submitted','تم إرسال الإجابات'):latest?m.t('Awaiting answers','بانتظار الإجابات'):m.t('No test assigned','لا يوجد اختبار مُرسل');
    return <MechanicReviewStudio profile={p} statusLabel={label(p.verificationStatus)} specialties={p.specializations.map(spec)} section={tab} reviewedCount={reviewedCount} requiredCount={required.length} testState={testState} onSection={changeTab} onPosition={position}>
      {tab==='profile'&&<View style={{padding:18,gap:18}}><MechanicDossierContact profile={p} specialties={p.specializations.map(spec)}/><ServiceModeDossier compact profile={p} onDocuments={()=>changeTab('documents')}/></View>}
      {tab==='documents'&&<WorkspaceCard flat><WorkspaceHeading title={m.t('A closer look.','نظرة أقرب.')} subtitle={m.t('Review the original files before recording your decision.','راجع الملفات الأصلية قبل تسجيل قرارك.')}/><MechanicDocuments documents={p.documents} includeWorkshopProof={p.offersWorkshop}/>{p.documents.map(d=><DocumentReviewChoice key={d.id} label={d.fileName+' · '+m.t('Reviewed and clear','تمت مراجعتها وواضحة')} selected={reviewed.includes(d.id)} disabled={busy} userId={p.userId} documentId={d.id} submissionVersion={p.submissionVersion} onReview={reviewDocument}/>)}<WorkspaceButton label={m.t('Continue to assessment','متابعة للتقييم')} onPress={()=>changeTab('test')}/></WorkspaceCard>}
      {tab==='test'&&resultView()}
      {tab==='conversation'&&conversation()}
      {tab==='decision'&&decisionView()}
      {tab==='history'&&<WorkspaceCard flat><WorkspaceHeading title={m.t('Activity history','سجل الإجراءات')}/><MechanicDossierHistory events={p.history}/></WorkspaceCard>}
    </MechanicReviewStudio>;
  }
  function notificationList() {
    return (
      <WorkspaceCard>
        <View
          style={{
            flexDirection: m.row,
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Text style={{ fontSize: 20, color: m.ink, fontWeight: "600" }}>
            {m.t("Notifications", "الإشعارات")}
          </Text>
          <WorkspaceButton
            small
            secondary
            label={m.t("Mark all read", "قراءة الكل")}
            onPress={() =>
              void run(async () => {
                await workflow("/notifications/read-all", "POST");
                await refresh();
              })
            }
          />
        </View>
        {notices.map((n) => (
          <Pressable
            key={n.id}
            accessibilityRole="button"
            onPress={() => void readNotice(n)}
            style={{
              flexDirection: m.row,
              gap: 11,
              padding: 14,
              borderRadius: 22,
              borderWidth: 1,
              borderColor: m.border,
              backgroundColor: n.readAt ? m.surface : m.soft,
            }}
          >
            <Ionicons
              name={
                n.kind === "MESSAGE"
                  ? "chatbubble-outline"
                  : n.kind?.startsWith("TEST")
                    ? "book-outline"
                    : "document-text-outline"
              }
              size={20}
              color={m.muted}
            />
            <View style={{ flex: 1, gap: 5 }}>
              <Text style={{ fontSize: 13, color: m.ink, fontWeight: "600" }}>
                {n.title}
              </Text>
              <Text style={{ fontSize: 11, lineHeight: 20, color: m.muted }}>
                {n.body}
              </Text>
              <Text style={{ fontSize: 9, color: m.muted }}>
                {date(n.createdAt)}
              </Text>
            </View>
            {!n.readAt && (
              <View
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 5,
                  backgroundColor: "#AB7948",
                }}
              />
            )}
          </Pressable>
        ))}
        {!notices.length && (
          <MechanicNote>
            {m.t("No notifications yet.", "لا توجد إشعارات بعد.")}
          </MechanicNote>
        )}
      </WorkspaceCard>
    );
  }
  return (
    <WorkspaceFrame
      page={page === "detail" ? tab : page}
      hideNavigation={page==='detail'}
      onNavigate={navigate}
      onSignOut={()=>setConfirm("LOGOUT")}
      name={user?.fullName ?? ""}
      unread={unread}
      busy={busy}
    >
      {error && <MechanicNote error>{error}</MechanicNote>}
      {notice && <MechanicNote>{notice}</MechanicNote>}
      {page === "home" ? (
        <>
          <WorkspaceHero name={user?.fullName ?? ""} unread={unread} onNotifications={()=>navigate("notifications")} />
          <MechanicReviewBrief loaded={summaryLoaded} counts={counts} rows={rows} loading={busy} error={error} onRetry={()=>void run(refresh)} onApplications={status=>{setQuery('');setFilter(status);setServiceMode('ALL');navigate('applications');}} onOpen={id=>void open(id,'profile')} onBank={()=>navigate('bank')} onMessages={()=>navigate('messages')}/>
        </>
      ) : page === "applications" || page === "directory" ? (
        <>
          {page==='directory'&&<WorkspaceHeading title={m.t('Mechanics directory','دليل الميكانيكيين')}/>}
          {applicationList()}
        </>
      ) : page === "bank" ? (
        questionBank()
      ) : page === "detail" ? (
        null
      ) : page === "notifications" ? (
        notificationList()
      ) : page === "messages" ? (
        <>
          <WorkspaceHeading
            title={m.t("Application conversations", "محادثات الطلبات")}
          />
          <WorkspaceCard>
            {!rows.length&&<MechanicNote>{m.t("No application conversations yet. Open an application to start its review conversation.","لا توجد محادثات طلبات حاليًا. افتح طلبًا لبدء محادثة مراجعته.")}</MechanicNote>}
            {rows.map((p) => (
              <Pressable
                key={p.id}
                accessibilityRole="button"
                onPress={() => void open(p.userId, "conversation")}
                style={{
                  flexDirection: m.row,
                  gap: 12,
                  alignItems: "center",
                  padding: 15,
                  borderRadius: 23,
                  borderWidth: 1,
                  borderColor: m.border,
                }}
              >
                <WorkspaceAvatar name={p.user.fullName} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, color: m.ink }}>
                    {p.user.fullName}
                  </Text>
                  <Text style={{ fontSize: 11, color: m.muted }}>
                    {p.city + " · " + p.specializations.map(spec).join(" · ")}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={m.muted} />
              </Pressable>
            ))}
          </WorkspaceCard>
        </>
      ) : (
        <>
          <WorkspaceHeading
            title={m.t("Your workspace", "مساحة عملك")}
            subtitle={user?.fullName}
          />
          <WorkspaceCard>
            {[
              [
                "notifications",
                "notifications-outline",
                m.t("Notifications", "الإشعارات"),
              ],
              [
                "messages",
                "chatbubbles-outline",
                m.t("Conversations", "المحادثات"),
              ],
              [
                "directory",
                "people-outline",
                m.t("Mechanics directory", "دليل الميكانيكيين"),
              ],
              ["bank", "book-outline", m.t("Question bank", "بنك الأسئلة")],
            ].map(([p, icon, title]) => (
              <WorkspaceButton
                key={p}
                secondary
                icon={icon as WorkspaceIcon}
                label={title}
                onPress={() => navigate(p)}
              />
            ))}
            <SignOutAction onPress={() => setConfirm("LOGOUT")} />
          </WorkspaceCard>
        </>
      )}
      <MechanicDossierFocus visible={page==='detail'&&!!detail} section={tab} targetOffset={dossierOffsets[tab]} busy={busy} onClose={()=>navigate('applications')}>
        {error&&<MechanicNote error>{error}</MechanicNote>}
        {notice&&<MechanicNote>{notice}</MechanicNote>}
        {page==='detail'&&detailView()}
      </MechanicDossierFocus>
      <WorkspaceSheet
        visible={filterOpen}
        editorial
        title={m.t("Choose a status", "اختيار الحالة")}
        onClose={() => setFilterOpen(false)}
      >
        <ApplicationStatusOptions items={statuses} selected={filter} onSelect={value=>{setFilter(value);setFilterOpen(false);}}/>
      </WorkspaceSheet>
      <WorkspaceSheet
        visible={questionOpen}
        title={
          editId
            ? m.t("Edit question", "تعديل السؤال")
            : m.t("Add question", "إضافة سؤال")
        }
        onClose={() => {
          if (!busy) setQuestionOpen(false);
        }}
      >
        {error && <MechanicNote error>{error}</MechanicNote>}
        <MechanicField
          label={m.t("Question text", "نص السؤال")}
          value={form.prompt}
          onChangeText={(prompt) => setForm((v) => ({ ...v, prompt }))}
          maxLength={800}
          multiline
        />
        <Text style={{ fontSize: 12, color: m.ink }}>
          {m.t("Specialty", "التخصص")}
        </Text>
        <WorkspaceTabs
          value={form.specialization}
          onChange={(specialization) =>
            setForm((v) => ({ ...v, specialization }))
          }
          items={[
            ...mechanicSpecializations.map((s) => ({
              key: s[0],
              label: spec(s[0]),
            })),
            { key: "SAFETY", label: spec("SAFETY") },
          ]}
        />
        {form.options.map((option, i) => (
          <View key={i} style={{ gap: 7 }}>
            <MechanicField
              label={m.t("Answer ", "الإجابة ") + (i + 1)}
              value={option}
              maxLength={300}
              onChangeText={(value) =>
                setForm((v) => ({
                  ...v,
                  options: v.options.map((o, n) => (n === i ? value : o)),
                }))
              }
            />
            <MechanicChoice
              label={m.t("Correct answer", "الإجابة الصحيحة")}
              selected={form.correctIndex === i}
              onPress={() => setForm((v) => ({ ...v, correctIndex: i }))}
            />
          </View>
        ))}
        <MechanicNote>
          {m.t(
            "Saving creates a draft and requires a new technical review.",
            "الحفظ ينشئ مسودة تحتاج مراجعة فنية جديدة.",
          )}
        </MechanicNote>
        <MechanicField
          label={m.t("Answer explanation", "تفسير الإجابة")}
          value={form.explanation}
          multiline
          maxLength={2000}
          onChangeText={(explanation) =>
            setForm((v) => ({ ...v, explanation }))
          }
        />
        <MechanicField
          label={m.t("Source URL (HTTPS)", "رابط المصدر (HTTPS)")}
          value={form.sourceUrl}
          maxLength={1000}
          onChangeText={(sourceUrl) => setForm((v) => ({ ...v, sourceUrl }))}
        />
        <MechanicField
          label={m.t("Source section / page", "قسم المصدر / الصفحة")}
          value={form.sourceReference}
          maxLength={500}
          onChangeText={(sourceReference) =>
            setForm((v) => ({ ...v, sourceReference }))
          }
        />
        <WorkspaceTabs
          value={form.difficulty}
          onChange={(difficulty) => setForm((v) => ({ ...v, difficulty }))}
          items={[
            { key: "FOUNDATION", label: m.t("Foundation", "أساسي") },
            { key: "INTERMEDIATE", label: m.t("Intermediate", "متوسط") },
            { key: "ADVANCED", label: m.t("Advanced", "متقدم") },
          ]}
        />
        <WorkspaceButton
          label={m.t("Save question", "حفظ السؤال")}
          disabled={
            busy ||
            form.prompt.trim().length < 10 ||
            form.options.some((s) => !s.trim())
          }
          onPress={() => void saveQuestion()}
        />
      </WorkspaceSheet>
      <WorkspaceSheet
        visible={!!reviewQuestion}
        title={m.t("Technical review", "المراجعة الفنية")}
        onClose={() => {
          if (!busy) setReviewQuestion(null);
        }}
      >
        {error && <MechanicNote error>{error}</MechanicNote>}
        <Text style={{ color: m.ink, fontSize: 14, lineHeight: 23 }}>
          {reviewQuestion?.prompt}
        </Text>
        <MechanicNote>
          {m.t(
            "Confirm only after a human technical reviewer checks the question, options, explanation and reference. Source citation alone is not professional approval.",
            "اعتمد فقط بعد مراجعة فنية بشرية للسؤال والخيارات والتفسير والمرجع. وجود مصدر وحده لا يعني اعتمادًا مهنيًا.",
          )}
        </MechanicNote>
        <MechanicField
          label={m.t("Technical reviewer name", "اسم المراجع الفني")}
          value={reviewerName}
          maxLength={120}
          onChangeText={setReviewerName}
        />
        <MechanicField
          label={m.t("Technical review notes", "ملاحظات المراجعة الفنية")}
          value={reviewNotes}
          maxLength={1500}
          multiline
          onChangeText={setReviewNotes}
        />
        <MechanicChoice
          label={m.t(
            "I confirm the technical review has been completed",
            "أؤكد إتمام المراجعة الفنية",
          )}
          selected={reviewConfirmed}
          onPress={() => setReviewConfirmed((v) => !v)}
        />
        <WorkspaceButton
          label={m.t("Approve question", "اعتماد السؤال")}
          disabled={
            busy ||
            !reviewConfirmed ||
            reviewerName.trim().length < 3 ||
            reviewNotes.trim().length < 10
          }
          onPress={() => {
            if (reviewQuestion)
              void reviewBankQuestion(reviewQuestion, "APPROVED");
          }}
        />
      </WorkspaceSheet>
      <MotexaDialog
        icon={confirm==="LOGOUT"?"log-out-outline":undefined}
        visible={!!confirm}
        title={confirm ? m.t(...actions[confirm]) : ""}
        message={
          confirm === "LOGOUT"
            ? m.t("Sign out of your current account? You can sign in again at any time.","هل تريد إنهاء جلستك الحالية؟ يمكنك تسجيل الدخول مجددًا في أي وقت.")
            : confirm === "SEND"
            ? selected
                .map((id) => questions.find((q) => q.id === id)?.prompt)
                .join("\n\n")
            : m.t(
                "Confirm this action. It will be saved in the account history and the mechanic will be notified.",
                "أكد الإجراء. سيحفظ بسجل الحساب ويصل إشعار للميكانيكي.",
              )
        }
        confirmText={m.t("Confirm", "تأكيد")}
        cancelText={m.t("Cancel", "إلغاء")}
        onCancel={() => setConfirm("")}
        onConfirm={() => void confirmAction()}
        loading={busy}
      />
    </WorkspaceFrame>
  );
}
