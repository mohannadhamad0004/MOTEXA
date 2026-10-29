import { useCallback, useRef, useState } from "react";
import { View, Pressable, useWindowDimensions } from "react-native";
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
export default function MechanicReviewScreen() {
  const m = useMechanicTheme(),
    { width } = useWindowDimensions(),
    wide = width >= 1000;
  const [page, setPage] = useState<Page>("home"),
    [tab, setTab] = useState<DetailTab>("profile"),
    [filter, setFilter] = useState("ALL"),
    [filterOpen, setFilterOpen] = useState(false),
    [query, setQuery] = useState("");
  const [workflowCounts, setWorkflowCounts] = useState<Record<string, number>>(
    {},
  );
  const [cursor, setCursor] = useState<string | null>(null);
  const [rows, setRows] = useState<ApplicationSummary[]>([]),
    [counts, setCounts] = useState<Record<string, number>>({}),
    [user, setUser] = useState<{ id: string; fullName: string } | null>(null),
    [notices, setNotices] = useState<WorkflowNotice[]>([]);
  const [detail, setDetail] = useState<MechanicProfile | null>(null),
    [tests, setTests] = useState<ProfessionalTest[]>([]),
    [reviewed, setReviewed] = useState<string[]>([]),
    [questions, setQuestions] = useState<Question[]>([]),
    [selected, setSelected] = useState<string[]>([]),
    [specialty, setSpecialty] = useState("ALL");
  const [messages, setMessages] = useState<ConversationMessage[]>([]),
    [hasOlder, setHasOlder] = useState(false),
    [draft, setDraft] = useState(""),
    [notes, setNotes] = useState(""),
    [assessment, setAssessment] = useState("PASSED");
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
  const tone = (s: string) =>
    s === "VERIFIED" || s === "READY"
      ? ("green" as const)
      : s === "REJECTED"
        ? ("red" as const)
        : s === "NEW"
          ? ("blue" as const)
          : s === "SUSPENDED"
            ? ("grey" as const)
            : ("bronze" as const);
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
  async function run(fn: () => Promise<void>) {
    if (operation.current) return;
    operation.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : m.t("Please try again.", "حاول مجددًا."),
      );
    } finally {
      operation.current = false;
      setBusy(false);
    }
  }
  async function refresh() {
    const [data, n] = await Promise.all([
      mechanicApi<{
        profiles: ApplicationSummary[];
        counts: Record<string, number>;
        nextCursor: string | null;
        workflowCounts: Record<string, number>;
      }>("/api/mechanics/admin"),
      mechanicApi<{ notifications: WorkflowNotice[] }>(
        "/api/mechanics/notifications",
      ),
    ]);
    setRows((old) =>
      old.length > 100
        ? [
            ...data.profiles,
            ...old.filter((p) => !data.profiles.some((n) => n.id === p.id)),
          ]
        : data.profiles,
    );
    if (!loadedMore.current) setCursor(data.nextCursor);
    setCounts(data.counts);
    setWorkflowCounts(data.workflowCounts);
    setNotices(n.notifications);
  }
  async function reloadDetail(id: string) {
    const data = await getWorkflowDetail(id);
    setDetail(data.profile);
    setTests(data.tests);
    setReviewed(data.reviewed);
    return data;
  }
  async function loadQuestions() {
    const data = await workflow<{ questions: Question[] }>("/questions");
    setQuestions(data.questions);
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
        const me = await mechanicApi<{
          user: { id: string; fullName: string };
        }>("/api/auth/me");
        if (!focused.current) return;
        setUser(me.user);
        await refresh();
      });
      return () => {
        focused.current = false;
      };
    }, []),
  );
  useFocusEffect(
    useCallback(() => {
      const timer = setInterval(() => {
        if (!operation.current && focused.current)
          void refresh().catch(() => {});
      }, 25000);
      return () => clearInterval(timer);
    }, []),
  );
  useFocusEffect(
    useCallback(() => {
      if (page !== "detail" || tab !== "conversation" || !detail) return;
      const timer = setInterval(() => {
        if (!operation.current)
          void loadMessages(detail.userId).catch(() => {});
      }, 12000);
      return () => clearInterval(timer);
    }, [page, tab, detail?.userId]),
  );
  function navigate(next: string) {
    setError("");
    setNotice("");
    if (next === "bank") void run(loadQuestions);
    setPage(next as Page);
  }
  async function open(id: string, target: DetailTab = "profile") {
    await run(async () => {
      await reloadDetail(id);
      setPage("detail");
      setTab(target);
      setNotes("");
      setSelected([]);
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
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
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
      setSelected([]);
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
  function infoRow(icon: WorkspaceIcon, title: string, value: string) {
    return (
      <View style={{ width: wide ? "48%" : "100%", gap: 5 }}>
        <View style={{ flexDirection: m.row, gap: 6, alignItems: "center" }}>
          <Ionicons name={icon} size={15} color={m.muted} />
          <Text style={{ fontSize: 11, color: m.muted }}>{title}</Text>
        </View>
        <Text
          selectable
          style={{
            fontSize: 13,
            lineHeight: 22,
            color: m.ink,
            textAlign: m.align,
          }}
        >
          {value || "—"}
        </Text>
      </View>
    );
  }
  function stats() {
    return (
      <View
        style={{
          flexDirection: m.row,
          flexWrap: "wrap",
          gap: 8,
          marginBottom: 20,
        }}
      >
        {[
          [
            "people-outline",
            m.t("Total mechanics", "إجمالي الميكانيكيين"),
            total,
          ],
          [
            "document-text-outline",
            m.t("New requests", "طلبات جديدة"),
            workflowCounts.NEW ?? 0,
          ],
          [
            "time-outline",
            m.t("In review", "قيد المراجعة"),
            (counts.PENDING ?? 0) + (counts.NEEDS_COMPLETION ?? 0),
          ],
          ["checkmark-outline", m.t("Approved", "معتمد"), counts.VERIFIED ?? 0],
          ["close-outline", m.t("Rejected", "مرفوض"), counts.REJECTED ?? 0],
          ["pause-outline", m.t("Suspended", "موقوف"), counts.SUSPENDED ?? 0],
        ].map(([icon, title, count]) => (
          <View
            key={String(title)}
            style={{
              width: wide ? "15.8%" : "31.3%",
              borderWidth: 1,
              borderColor: m.border,
              borderRadius: 23,
              padding: width < 370 ? 10 : 14,
              backgroundColor: m.surface,
              flexDirection: m.row,
              alignItems: "center",
              gap: 8,
              minHeight: 83,
            }}
          >
            <View
              style={{
                width: 27,
                height: 27,
                borderRadius: 15,
                backgroundColor: m.soft,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons
                name={icon as WorkspaceIcon}
                size={15}
                color={m.muted}
              />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: 24, color: m.ink, fontWeight: "600" }}>
                {count}
              </Text>
              <Text style={{ fontSize: 9, lineHeight: 15, color: m.muted }}>
                {title}
              </Text>
            </View>
          </View>
        ))}
      </View>
    );
  }
  function applicationList() {
    return (
      <WorkspaceCard>
        <View
          style={{
            flexDirection: m.row,
            justifyContent: "space-between",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <View>
            <Text style={{ fontSize: 20, fontWeight: "600", color: m.ink }}>
              {m.t("Mechanic applications", "طلبات الميكانيكيين")}
            </Text>
            <Text style={{ fontSize: 11, color: m.muted, marginTop: 5 }}>
              {m.t(
                "Review, assess and follow every application.",
                "راجع كل طلب وتابع مراحل التقييم.",
              )}
            </Text>
          </View>
          <WorkspaceButton
            small
            secondary
            icon="book-outline"
            label={m.t("Question bank", "بنك الأسئلة")}
            onPress={() => navigate("bank")}
          />
        </View>
        <MechanicField
          label={m.t("Search mechanics", "البحث عن ميكانيكي")}
          icon="search-outline"
          value={query}
          onChangeText={setQuery}
          placeholder={m.t(
            "Name, specialty or city…",
            "الاسم أو التخصص أو المدينة…",
          )}
        />
        <View style={{ flexDirection: m.row, alignItems: "center", gap: 9 }}>
          <Text style={{ fontSize: 11, color: m.muted }}>
            {m.t("Application status", "حالة الطلب")}
          </Text>
          <View style={{ flex: 1 }}>
            <WorkspaceButton
              small
              secondary
              label={label(filter)}
              icon="chevron-down"
              onPress={() => setFilterOpen(true)}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setFilter("ALL");
              setQuery("");
            }}
          >
            <Text style={{ fontSize: 11, color: m.muted }}>
              {m.t("Reset", "مسح")}
            </Text>
          </Pressable>
        </View>
        <Text style={{ fontSize: 10, color: m.muted }}>
          {matches.length +
            " " +
            m.t("loaded matches · Latest first", "نتائج محملة · الأحدث أولًا")}
        </Text>
        {!matches.length && (
          <MechanicNote>
            {m.t(
              "No matching submitted applications.",
              "لا توجد طلبات مرسلة مطابقة.",
            )}
          </MechanicNote>
        )}
        {matches.map((p) => {
          const st = stage(p),
            t = p.tests?.find(
              (t) => t.submissionVersion === p.submissionVersion,
            );
          if (wide)
            return (
              <View
                key={p.id}
                style={{
                  flexDirection: m.row,
                  alignItems: "center",
                  gap: 14,
                  paddingVertical: 17,
                  borderTopWidth: 1,
                  borderTopColor: m.border,
                }}
              >
                <WorkspaceAvatar name={p.user.fullName} />
                <View style={{ flex: 1.5, minWidth: 0 }}>
                  <Text
                    style={{ fontSize: 14, color: m.ink, fontWeight: "600" }}
                  >
                    {p.user.fullName}
                  </Text>
                  <Text style={{ fontSize: 10, color: m.muted, marginTop: 5 }}>
                    {p.specializations.map(spec).join(" · ")}
                  </Text>
                </View>
                <View style={{ flex: 1, gap: 5 }}>
                  <Text style={{ fontSize: 12, color: m.ink }}>{p.city}</Text>
                  <Text style={{ fontSize: 10, color: m.muted }}>
                    {p.yearsOfExperience +
                      " " +
                      m.t("years experience", "سنوات خبرة")}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <WorkspaceBadge label={label(st)} tone={tone(st)} />
                </View>
                <Text style={{ fontSize: 10, color: m.muted, flex: 0.8 }}>
                  {date(p.submittedAt)}
                </Text>
                <WorkspaceButton
                  small
                  secondary
                  label={m.t("Review request", "مراجعة الطلب")}
                  onPress={() => void open(p.userId)}
                />
              </View>
            );
          return (
            <View
              key={p.id}
              style={{
                borderWidth: 1,
                borderColor: m.border,
                borderRadius: 24,
                padding: 16,
                gap: 13,
                backgroundColor: m.surface,
              }}
            >
              <View
                style={{
                  flexDirection: m.row,
                  justifyContent: "space-between",
                }}
              >
                <Text style={{ fontSize: 9, color: m.muted }}>
                  {"MX-" + p.id.slice(0, 8).toUpperCase()}
                </Text>
                <Text style={{ fontSize: 9, color: m.muted }}>
                  {date(p.submittedAt)}
                </Text>
              </View>
              <View
                style={{
                  flexDirection: m.row,
                  gap: 10,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <WorkspaceAvatar name={p.user.fullName} />
                <View style={{ flex: 1, minWidth: 130 }}>
                  <Text
                    style={{ fontSize: 16, fontWeight: "600", color: m.ink }}
                  >
                    {p.user.fullName}
                  </Text>
                  <Text
                    style={{ fontSize: 11, lineHeight: 20, color: m.muted }}
                  >
                    {p.specializations.map(spec).join(" · ")}
                  </Text>
                </View>
                <WorkspaceBadge label={label(st)} tone={tone(st)} />
              </View>
              <View style={{ flexDirection: m.row, flexWrap: "wrap", gap: 6 }}>
                {[
                  p.city,
                  `${p.yearsOfExperience ?? 0} ${m.t("years", "سنوات")}`,
                  p.offersWorkshop ? m.t("Workshop", "ورشة") : "",
                  p.offersOnSite ? m.t("On-site", "ميداني") : "",
                  p.offersOnline ? m.t("Online", "أونلاين") : "",
                ]
                  .filter(Boolean)
                  .map((s) => (
                    <WorkspaceBadge key={s} label={s} />
                  ))}
              </View>
              <View style={{ flexDirection: m.row, gap: 10 }}>
                {[
                  [m.t("Profile", "الملف"), m.t("Submitted", "مرسل")],
                  [
                    m.t("Documents", "الوثائق"),
                    `${p.documents?.length ?? 0} ${m.t("uploaded", "مرفوعة")}`,
                  ],
                  [
                    m.t("Skills test", "الاختبار"),
                    t?.submittedAt
                      ? m.t("Submitted", "مرسل")
                      : t
                        ? m.t("Awaiting answers", "بانتظار الإجابة")
                        : m.t("Not assigned", "لم يرسل"),
                  ],
                ].map(([title, value]) => (
                  <View
                    key={title}
                    style={{
                      flex: 1,
                      borderTopWidth: 2,
                      borderTopColor: m.border,
                      paddingTop: 7,
                      gap: 3,
                    }}
                  >
                    <Text style={{ fontSize: 10, color: m.ink }}>{title}</Text>
                    <Text style={{ fontSize: 9, color: m.muted }}>{value}</Text>
                  </View>
                ))}
              </View>
              <WorkspaceButton
                small
                label={m.t("Review request", "مراجعة الطلب")}
                icon="arrow-forward"
                disabled={busy}
                onPress={() => void open(p.userId)}
              />
            </View>
          );
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
                }>("/api/mechanics/admin?cursor=" + encodeURIComponent(cursor));
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
      </WorkspaceCard>
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
        <WorkspaceCard>
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
              <View
                key={q.id}
                style={{
                  borderRadius: 24,
                  padding: 15,
                  borderWidth: 1,
                  borderColor: selected.includes(q.id) ? "#AC7E4B" : m.border,
                  gap: 10,
                  backgroundColor: selected.includes(q.id) ? m.soft : m.surface,
                }}
              >
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
              </View>
            ))}
          {!questions.length && (
            <MechanicNote>
              {m.t(
                "Your question bank is empty. Add professionally reviewed questions to begin.",
                "بنك الأسئلة فارغ. أضف أسئلة معتمدة مهنيًا للبدء.",
              )}
            </MechanicNote>
          )}
        </WorkspaceCard>
        {assign && (
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
              icon="send-outline"
              label={m.t(
                "Preview & send two questions",
                "معاينة وإرسال السؤالين",
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
      <WorkspaceCard>
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
                <WorkspaceButton
                  label={m.t("Save assessment", "حفظ التقييم")}
                  disabled={busy || notes.trim().length < 5}
                  onPress={() =>
                    void run(async () => {
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
                    setSelected([]);
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
        docsDone && latest?.reviewedAt && latest.assessment === "PASSED";
    return (
      <WorkspaceCard>
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
        ].map(([title, done]) => (
          <View
            key={String(title)}
            style={{
              flexDirection: m.row,
              justifyContent: "space-between",
              gap: 8,
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: 12, color: m.ink, flex: 1 }}>{title}</Text>
            <WorkspaceBadge
              label={
                done ? m.t("Complete", "مكتمل") : m.t("Pending", "بانتظار")
              }
              tone={done ? "green" : "bronze"}
            />
          </View>
        ))}
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
      <WorkspaceCard>
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
        <View style={{ gap: 12, minHeight: 200 }}>
          {messages.map((msg) => (
            <View
              key={msg.id}
              style={{
                maxWidth: "88%",
                alignSelf:
                  msg.senderId === user?.id ? "flex-end" : "flex-start",
                padding: 15,
                borderRadius: 24,
                backgroundColor: msg.senderId === user?.id ? "#573822" : m.soft,
                gap: 5,
              }}
            >
              <Text
                style={{
                  fontSize: 10,
                  color: msg.senderId === user?.id ? "#DDC9AD" : m.muted,
                }}
              >
                {msg.sender.fullName}
              </Text>
              <Text
                selectable
                style={{
                  fontSize: 13,
                  lineHeight: 23,
                  color: msg.senderId === user?.id ? "#FFF6E8" : m.ink,
                }}
              >
                {msg.body}
              </Text>
              <Text
                style={{
                  fontSize: 9,
                  color: msg.senderId === user?.id ? "#DDC9AD" : m.muted,
                }}
              >
                {date(msg.createdAt)}
              </Text>
            </View>
          ))}
          {!messages.length && (
            <MechanicNote>
              {m.t(
                "Start a conversation about this application.",
                "ابدأ محادثة بخصوص هذا الطلب.",
              )}
            </MechanicNote>
          )}
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
    if (!detail) return null;
    const p = detail;
    return (
      <>
        <WorkspaceButton
          secondary
          small
          icon="arrow-back"
          label={m.t("Back to applications", "العودة للطلبات")}
          onPress={() => navigate("applications")}
        />
        <View style={{ height: 14 }} />
        <WorkspaceTabs
          value={tab}
          onChange={changeTab}
          items={[
            ["profile", m.t("Overview", "الملف")],
            ["documents", m.t("Documents", "الوثائق")],
            ["test", m.t("Professional test", "الاختبار")],
            ["conversation", m.t("Conversation", "المحادثة")],
            ["decision", m.t("Decision", "القرار")],
            ["history", m.t("History", "السجل")],
          ].map(([key, label]) => ({ key, label }))}
        />
        <WorkspaceCard>
          <View
            style={{
              flexDirection: m.row,
              alignItems: "center",
              gap: 13,
              flexWrap: "wrap",
            }}
          >
            <WorkspaceAvatar name={p.user.fullName} large />
            <View style={{ flex: 1, minWidth: 160 }}>
              <Text style={{ fontSize: 24, color: m.ink, fontWeight: "600" }}>
                {p.user.fullName}
              </Text>
              <Text style={{ fontSize: 11, lineHeight: 21, color: m.muted }}>
                {p.specializations.map(spec).join(" · ")}
                {"\n"}
                {p.city +
                  " · " +
                  p.yearsOfExperience +
                  " " +
                  m.t("years", "سنوات")}
              </Text>
            </View>
            <WorkspaceBadge
              label={label(p.verificationStatus)}
              tone={tone(p.verificationStatus)}
            />
          </View>
          <View style={{ flexDirection: m.row, gap: 9 }}>
            {[
              m.t("Profile", "الملف"),
              m.t("Documents", "الوثائق"),
              m.t("Test", "الاختبار"),
              m.t("Decision", "القرار"),
            ].map((title, i) => (
              <View
                key={title}
                style={{
                  flex: 1,
                  borderTopWidth: 2,
                  borderTopColor:
                    i === 0 ||
                    (i === 1 && reviewed.length >= p.documents.length) ||
                    (i === 2 && !!latest?.reviewedAt)
                      ? "#8B9A75"
                      : m.border,
                  paddingTop: 8,
                }}
              >
                <Text style={{ fontSize: 10, color: m.muted }}>{title}</Text>
              </View>
            ))}
          </View>
        </WorkspaceCard>
        {tab === "profile" ? (
          <View
            style={{
              flexDirection: wide ? m.row : "column",
              gap: wide ? 18 : 0,
            }}
          >
            <View style={{ flex: wide ? 1.3 : undefined }}>
              <WorkspaceCard>
                <Text style={{ fontSize: 19, color: m.ink, fontWeight: "600" }}>
                  {m.t(
                    "Personal & professional details",
                    "البيانات الشخصية والمهنية",
                  )}
                </Text>
                <View
                  style={{ flexDirection: m.row, flexWrap: "wrap", gap: 20 }}
                >
                  {infoRow(
                    "mail-outline",
                    m.t("Email", "البريد"),
                    p.user.email,
                  )}
                  {infoRow(
                    "call-outline",
                    m.t("Phone", "الهاتف"),
                    p.phoneNumber,
                  )}
                  {infoRow("location-outline", m.t("City", "المدينة"), p.city)}
                  {infoRow(
                    "briefcase-outline",
                    m.t("Experience", "الخبرة"),
                    p.experienceSummary,
                  )}
                  {infoRow(
                    "storefront-outline",
                    m.t("Workshop", "الورشة"),
                    p.offersWorkshop
                      ? [p.workshopName, p.workshopAddress]
                          .filter(Boolean)
                          .join(" · ")
                      : m.t("Not selected", "غير مختار"),
                  )}
                  {infoRow(
                    "navigate-outline",
                    m.t("Coverage", "التغطية"),
                    p.coverageAreas.join(" · "),
                  )}
                </View>
                <View
                  style={{ flexDirection: m.row, flexWrap: "wrap", gap: 7 }}
                >
                  {[
                    p.offersWorkshop ? m.t("Workshop", "ورشة") : "",
                    p.offersOnSite ? m.t("On-site", "ميداني") : "",
                    p.offersOnline
                      ? m.t("Online consultation", "استشارة أونلاين")
                      : "",
                  ]
                    .filter(Boolean)
                    .map((v) => (
                      <WorkspaceBadge key={v} label={v} />
                    ))}
                </View>
              </WorkspaceCard>
            </View>
            <View style={{ flex: wide ? 1 : undefined }}>
              <WorkspaceCard>
                <Text style={{ fontSize: 20, fontWeight: "600", color: m.ink }}>
                  {m.t("Your next step", "الخطوة التالية")}
                </Text>
                <Text style={{ fontSize: 12, lineHeight: 22, color: m.muted }}>
                  {m.t(
                    "Review the documents, send two questions and record your professional assessment.",
                    "راجع الوثائق، وأرسل سؤالين، ثم سجل تقييمك المهني.",
                  )}
                </Text>
                <WorkspaceButton
                  icon="document-text-outline"
                  label={m.t("Review documents", "مراجعة الوثائق")}
                  onPress={() => changeTab("documents")}
                />
                <WorkspaceButton
                  secondary
                  icon="book-outline"
                  label={
                    latest?.submittedAt
                      ? m.t("View test result", "عرض النتيجة")
                      : latest
                        ? m.t("Awaiting answers", "بانتظار الإجابات")
                        : m.t("Prepare professional test", "تجهيز الاختبار")
                  }
                  onPress={() => changeTab("test")}
                />
                <WorkspaceButton
                  secondary
                  icon="chatbubble-outline"
                  label={m.t("Open conversation", "فتح المحادثة")}
                  onPress={() => changeTab("conversation")}
                />
                <WorkspaceButton
                  secondary
                  label={m.t("Review final decision", "مراجعة القرار")}
                  onPress={() => setTab("decision")}
                />
              </WorkspaceCard>
            </View>
          </View>
        ) : tab === "documents" ? (
          <WorkspaceCard>
            <WorkspaceHeading
              title={m.t("Document review", "مراجعة الوثائق")}
              subtitle={m.t(
                "Review each required document and record its review status.",
                "راجع كل وثيقة مطلوبة وسجّل حالة مراجعتها.",
              )}
            />
            <MechanicDocuments
              documents={p.documents}
              includeWorkshopProof={p.offersWorkshop}
            />
            {p.documents.map((d) => (
              <MechanicChoice
                key={d.id}
                label={
                  d.fileName +
                  " · " +
                  m.t("Reviewed and clear", "تمت مراجعتها وواضحة")
                }
                selected={reviewed.includes(d.id)}
                icon="document-text-outline"
                disabled={busy}
                onPress={() =>
                  void run(async () => {
                    await workflow(
                      "/applications/" + p.userId + "/reviews",
                      "POST",
                      {
                        documentId: d.id,
                        reviewed: !reviewed.includes(d.id),
                        submissionVersion: p.submissionVersion,
                      },
                    );
                    await reloadDetail(p.userId);
                  })
                }
              />
            ))}
            <WorkspaceButton
              label={m.t("Continue to assessment", "متابعة للتقييم")}
              onPress={() => changeTab("test")}
            />
          </WorkspaceCard>
        ) : tab === "test" ? (
          resultView()
        ) : tab === "conversation" ? (
          conversation()
        ) : tab === "decision" ? (
          decisionView()
        ) : (
          <WorkspaceCard>
            <WorkspaceHeading
              title={m.t("Activity history", "سجل الإجراءات")}
            />
            {p.history.map((h) => (
              <View
                key={h.id}
                style={{
                  borderLeftWidth: 2,
                  borderLeftColor: m.border,
                  paddingLeft: 14,
                  gap: 5,
                }}
              >
                <Text style={{ fontSize: 12, color: m.ink }}>
                  {h.action.replace("MECHANIC_", "").replaceAll("_", " ")}
                </Text>
                {h.details?.notes && (
                  <Text
                    style={{ fontSize: 12, lineHeight: 22, color: m.muted }}
                  >
                    {h.details.notes}
                  </Text>
                )}
                <Text style={{ fontSize: 10, color: m.muted }}>
                  {date(h.createdAt)}
                </Text>
              </View>
            ))}
          </WorkspaceCard>
        )}
      </>
    );
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
      onNavigate={navigate}
      name={user?.fullName ?? ""}
      unread={unread}
      busy={busy}
    >
      {error && <MechanicNote error>{error}</MechanicNote>}
      {notice && <MechanicNote>{notice}</MechanicNote>}
      {page === "home" ? (
        <>
          <WorkspaceHero name={user?.fullName ?? ""} />
          {stats()}
          {applicationList()}
        </>
      ) : page === "applications" || page === "directory" ? (
        <>
          <WorkspaceHeading
            title={
              page === "directory"
                ? m.t("Mechanics directory", "دليل الميكانيكيين")
                : m.t("Applications", "الطلبات")
            }
            subtitle={m.t(
              "Your mechanics department, connected to live application data.",
              "قسم الميكانيك مرتبط ببيانات الطلبات الفعلية.",
            )}
          />
          {stats()}
          {applicationList()}
        </>
      ) : page === "bank" ? (
        questionBank()
      ) : page === "detail" ? (
        detailView()
      ) : page === "notifications" ? (
        notificationList()
      ) : page === "messages" ? (
        <>
          <WorkspaceHeading
            title={m.t("Application conversations", "محادثات الطلبات")}
          />
          <WorkspaceCard>
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
            <WorkspaceButton
              secondary
              icon="log-out-outline"
              label={m.t("Sign out", "تسجيل الخروج")}
              onPress={() => setConfirm("LOGOUT")}
            />
          </WorkspaceCard>
        </>
      )}
      <WorkspaceSheet
        visible={filterOpen}
        title={m.t("Choose a status", "اختيار الحالة")}
        onClose={() => setFilterOpen(false)}
      >
        {statuses.map(([value, en, ar]) => (
          <MechanicChoice
            key={value}
            label={m.t(en, ar)}
            selected={filter === value}
            onPress={() => {
              setFilter(value);
              setFilterOpen(false);
            }}
          />
        ))}
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
        visible={!!confirm}
        title={confirm ? m.t(...actions[confirm]) : ""}
        message={
          confirm === "SEND"
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
