import MechanicInterviewAppointment from './MechanicInterviewAppointment';
import {ReviewMessage,ReviewEmpty} from './MechanicReviewElements';
import { useCallback, useRef, useState } from "react";
import { View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Text } from "./MotexaVisual";
import {
  MechanicChoice,
  MechanicField,
  MechanicNote,
  useMechanicTheme,
} from "./MechanicUI";
import {
  WorkspaceFrame,
  WorkspaceCard,
  WorkspaceHeading,
  WorkspaceButton,
  WorkspaceBadge,
} from "./MechanicWorkspaceUI";
import MotexaDialog from "./MotexaDialog";
import { mechanicApi, type MechanicProfile } from "./mechanic-api";
import {
  workflow,
  type ProfessionalTest,
  type WorkflowNotice,
  type ConversationMessage,
} from "./mechanic-workflow-api";

/** Authenticated mechanic side of the review journey. Does not alter registration. */
export default function MechanicReviewHub() {
  const params=useLocalSearchParams<{tab?:string}>();
  const m = useMechanicTheme(),
    [page, setPage] = useState(params.tab==='conversation'?'conversation':'test'),
    [profile, setProfile] = useState<MechanicProfile | null>(null),
    [tests, setTests] = useState<ProfessionalTest[]>([]),
    [messages, setMessages] = useState<ConversationMessage[]>([]),
    [notices, setNotices] = useState<WorkflowNotice[]>([]),
    [older, setOlder] = useState(false),
    [draft, setDraft] = useState(""),
    [answers, setAnswers] = useState<Record<string, number>>({}),
    [index, setIndex] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [confirm, setConfirm] = useState(false);
  const operating = useRef(false),
    mounted = useRef(false),
    previousTest = useRef("");
  const latest = tests.find(
    (t) => t.submissionVersion === profile?.submissionVersion,
  );
  const load = useCallback(async (id?: string, version?: number) => {
    const p =
      id && version !== undefined
        ? null
        : await mechanicApi<{ profile: MechanicProfile }>("/api/mechanics/me");
    const uid = id ?? p!.profile.userId;
    const [ts, ms, ns] = await Promise.all([
      workflow<{ tests: ProfessionalTest[] }>(
        "/applications/" + uid + "/tests",
      ),
      workflow<{ messages: ConversationMessage[]; hasMore: boolean }>(
        "/applications/" + uid + "/messages",
      ),
      mechanicApi<{ notifications: WorkflowNotice[] }>(
        "/api/mechanics/notifications",
      ),
    ]);
    if (!mounted.current) return;
    if (p) setProfile(p.profile);
    setTests(ts.tests);
    setMessages(ms.messages);
    setOlder(ms.hasMore);
    setNotices(ns.notifications);
    const t = ts.tests.find(
      (t) => t.submissionVersion === (version ?? p!.profile.submissionVersion),
    );
    if (t && previousTest.current !== t.id) {
      previousTest.current = t.id;
      setAnswers({});
      setIndex(0);
    }
  }, []);
  const run = useCallback(async (fn: () => Promise<void>) => {
    if (operating.current) return;
    operating.current = true;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await fn();
    } catch (e) {
      if (mounted.current)
        setError(
          e instanceof Error
            ? e.message
            : (m.ar ? "حاول مجددًا." : "Please try again."),
        );
    } finally {
      operating.current = false;
      if (mounted.current) setBusy(false);
    }
  }, [m.ar]);
  useFocusEffect(
    useCallback(() => {
      mounted.current = true;
      void run(() => load());
      const timer = setInterval(() => {
        if (!operating.current) void load().catch(() => {});
      }, 18000);
      return () => {
        mounted.current = false;
        clearInterval(timer);
      };
    }, [load, run]),
  );
  const date = (s: string) =>
    new Date(s).toLocaleString(m.ar ? "ar" : "en", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  async function submit() {
    setConfirm(false);
    await run(async () => {
      if (!latest) return;
      await workflow("/tests/" + latest.id + "/submit", "POST", {
        answers: latest.items.map((q) => ({
          itemId: q.id,
          answerIndex: answers[q.id],
        })),
      });
      await load();
      setSuccess(
        m.t(
          "Your answers were submitted. Your administrator will review them.",
          "تم إرسال إجاباتك، وسيراجعها أدمن الميكانيك.",
        ),
      );
    });
  }
  return (
    <WorkspaceFrame
      admin={false}
      page={page}
      onNavigate={(p) => {
        setPage(p);
        setError("");
      }}
      busy={busy}
      name={profile?.user.fullName ?? ""}
      unread={notices.filter((n) => !n.readAt).length}
    >
      {profile?.verificationStatus==='PENDING'&&page==='test'&&<View style={{gap:6,marginBottom:16}}><Text accessibilityRole="header" style={{fontSize:23,lineHeight:35,color:m.ink,fontWeight:'600',textAlign:m.align}}>{m.t('Your verification tasks','المطلوب لإكمال تقييمك')}</Text><Text style={{fontSize:12,lineHeight:24,color:m.muted,textAlign:m.align}}>{latest?.submittedAt&&profile.interviewConfirmedAt?m.t('Your tasks are complete. The administrator will record the final review.','اكتملت مهامك. يسجّل الأدمن المراجعة النهائية بعد ذلك.'):m.t('Complete the remaining interview confirmation and questions below. Saved tasks do not need to be repeated.','أكمل تأكيد المقابلة والأسئلة المتبقية أدناه. المهام المحفوظة لا تحتاج تكرارًا.')}</Text></View>}
      {profile?.verificationStatus==='PENDING'&&<MechanicInterviewAppointment profile={profile} onUpdated={setProfile}/>}
      <WorkspaceButton
        small
        secondary
        icon="arrow-back"
        label={profile?.verificationStatus==='VERIFIED'?m.t("Back to my workspace", "العودة لمساحة عملي"):m.t("Back to my application", "العودة لطلبي")}
        onPress={() =>
          router.replace("/mechanic" as import("expo-router").Href)
        }
      />
      <View style={{ height: 17 }} />
      {error && <MechanicNote error>{error}</MechanicNote>}
      {success && <MechanicNote>{success}</MechanicNote>}
      {!profile ? (
        <WorkspaceCard>
          <WorkspaceHeading title={m.t("Application review", "مراجعة الطلب")} />
          <WorkspaceButton
            label={m.t("Retry", "إعادة المحاولة")}
            disabled={busy}
            onPress={() => void run(() => load())}
          />
        </WorkspaceCard>
      ) : !profile.submittedAt&&profile.verificationStatus!=='VERIFIED' ? (
        <MechanicNote>
          {m.t(
            "Complete and submit your professional application first.",
            "أكمل طلبك المهني وأرسله أولًا.",
          )}
        </MechanicNote>
      ) : page === "test" ? (
        <>
          <WorkspaceHeading
            title={m.t("Your professional test", "اختبارك المهني")}
            subtitle={m.t(
              "Two questions selected by your Mechanics Admin.",
              "سؤالان يختارهما أدمن الميكانيك.",
            )}
          />
          <WorkspaceCard>
            {!latest ? (
              <ReviewEmpty icon="clipboard-outline" title={m.t('Your next challenge is on its way.','تقييمك هو الخطوة القادمة.')} description={m.t('No test has been assigned to this application yet. Your administrator will notify you when it is ready.','لم يُرسل اختبار لهذه النسخة من الطلب بعد. سيصلك إشعار عند تجهيزه.')}/>

            ) : latest.submittedAt ? (
              <>
                <WorkspaceBadge
                  label={m.t("Answers submitted", "تم إرسال الإجابات")}
                  tone="green"
                />
                <Text style={{ fontSize: 22, fontWeight: "600", color: m.ink }}>
                  {m.t("Thank you, ", "شكرًا، ") + profile.user.fullName}
                </Text>
                <Text style={{ fontSize: 13, lineHeight: 23, color: m.muted }}>
                  {m.t(
                    "Your administrator will review your test alongside your documents. Submitting a test does not approve your account automatically.",
                    "سيراجع الأدمن اختبارك مع الوثائق. إرسال الاختبار لا يعتمد حسابك تلقائيًا.",
                  )}
                </Text>
                <Text style={{ fontSize: 11, color: m.muted }}>
                  {date(latest.submittedAt)}
                </Text>
                {latest.assessment && (
                  <WorkspaceBadge
                    label={
                      latest.assessment === "PASSED"
                        ? m.t("Assessment completed", "اكتمل التقييم")
                        : m.t(
                            "Administrator review recorded",
                            "تم تسجيل مراجعة الأدمن",
                          )
                    }
                  />
                )}
                <WorkspaceButton
                  secondary
                  icon="chatbubble-outline"
                  label={m.t("Contact my administrator", "التواصل مع الأدمن")}
                  onPress={() => setPage("conversation")}
                />
              </>
            ) : profile.verificationStatus !== "PENDING" ? (
              <MechanicNote>
                {m.t(
                  "This test is not open in the current application status.",
                  "الاختبار غير مفتوح في حالة الطلب الحالية.",
                )}
              </MechanicNote>
            ) : (
              <>
                <View
                  style={{
                    flexDirection: m.row,
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <WorkspaceBadge
                    label={
                      m.t("Question ", "السؤال ") +
                      (index + 1) +
                      m.t(" of 2", " من 2")
                    }
                  />
                  <Text style={{ fontSize: 11, color: m.muted }}>
                    {profile.user.fullName}
                  </Text>
                </View>
                <View
                  accessibilityRole="progressbar"
                  accessibilityValue={{ min: 1, max: 2, now: index + 1 }}
                  style={{
                    height: 4,
                    borderRadius: 9,
                    backgroundColor: m.soft,
                  }}
                >
                  <View
                    style={{
                      height: 4,
                      borderRadius: 9,
                      width: index === 0 ? "50%" : "100%",
                      backgroundColor: "#A87949",
                    }}
                  />
                </View>
                <Text
                  style={{
                    fontSize: 20,
                    lineHeight: 30,
                    fontWeight: "600",
                    color: m.ink,
                    textAlign: m.align,
                  }}
                >
                  {latest.items[index]?.prompt}
                </Text>
                {latest.items[index]?.options.map((value, i) => (
                  <MechanicChoice
                    key={i}
                    label={value}
                    selected={answers[latest.items[index].id] === i}
                    onPress={() =>
                      setAnswers((old) => ({
                        ...old,
                        [latest.items[index].id]: i,
                      }))
                    }
                    disabled={busy}
                  />
                ))}
                <View style={{ flexDirection: m.row, gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <WorkspaceButton
                      secondary
                      label={m.t("Previous", "السابق")}
                      disabled={busy || index === 0}
                      onPress={() => setIndex(0)}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <WorkspaceButton
                      label={
                        index === 0
                          ? m.t("Next question", "السؤال التالي")
                          : m.t("Submit answers", "إرسال الإجابات")
                      }
                      disabled={
                        busy ||
                        (index === 1 &&
                          latest.items.some((q) => answers[q.id] === undefined))
                      }
                      onPress={() =>
                        index === 0 ? setIndex(1) : setConfirm(true)
                      }
                    />
                  </View>
                </View>
                <MechanicNote>
                  {m.t(
                    "Review both answers before submitting. A submitted test cannot be changed. Answers you select are kept on this screen until submission; refreshing clears unsent choices.",
                    "راجع إجابتيك قبل الإرسال. لا يمكن تعديل الاختبار بعد التسليم. الخيارات غير المرسلة تبقى بهذه الشاشة وتزول عند تحديث الصفحة.",
                  )}
                </MechanicNote>
              </>
            )}
            <WorkspaceButton
              small
              secondary
              icon="refresh-outline"
              label={m.t("Refresh test status", "تحديث حالة الاختبار")}
              disabled={busy}
              onPress={() => void run(() => load())}
            />
          </WorkspaceCard>
        </>
      ) : page === "conversation" ? (
        <>
          <WorkspaceHeading
            title={m.t("My administrator", "أدمن الميكانيك")}
            subtitle={m.t(
              "Conversation about your professional application.",
              "محادثة بخصوص طلبك المهني.",
            )}
          />
          <WorkspaceCard>
            {older && (
              <WorkspaceButton
                secondary
                small
                label={m.t("Load older messages", "تحميل رسائل أقدم")}
                onPress={() =>
                  void run(async () => {
                    const data = await workflow<{
                      messages: ConversationMessage[];
                      hasMore: boolean;
                    }>(
                      "/applications/" +
                        profile.userId +
                        "/messages?before=" +
                        encodeURIComponent(messages[0].id),
                    );
                    setMessages((old) => [...data.messages, ...old]);
                    setOlder(data.hasMore);
                  })
                }
              />
            )}
            <View style={{ gap: 13, minHeight: messages.length?180:0 }}>
              {messages.map(msg=><ReviewMessage key={msg.id} sender={msg.sender.fullName} body={msg.body} time={date(msg.createdAt)} mine={msg.senderId===profile.userId}/>)}
              {!messages.length&&<ReviewEmpty title={m.t('Your administrator, within reach.','أدمن الميكانيك، أقرب إليك.')} description={m.t('Ask about your application, documents or next assessment step.','اسأل عن طلبك أو وثائقك أو الخطوة التالية في التقييم.')}/>}
            </View>
            <MechanicField
              label={m.t("Write a message", "اكتب رسالة")}
              value={draft}
              onChangeText={setDraft}
              multiline
              maxLength={2000}
            />
            <WorkspaceButton
              icon="send-outline"
              label={m.t("Send message", "إرسال الرسالة")}
              disabled={busy || !draft.trim()}
              onPress={() =>
                void run(async () => {
                  await workflow(
                    "/applications/" + profile.userId + "/messages",
                    "POST",
                    { body: draft },
                  );
                  setDraft("");
                  await load();
                })
              }
            />
          </WorkspaceCard>
        </>
      ) : (
        <>
          <WorkspaceHeading title={m.t("Notifications", "الإشعارات")} />
          <WorkspaceCard>
            <WorkspaceButton
              small
              secondary
              label={m.t("Mark all read", "تحديد الكل كمقروء")}
              onPress={() =>
                void run(async () => {
                  await workflow("/notifications/read-all", "POST");
                  await load();
                })
              }
            />
            {notices.map((n) => (
              <WorkspaceCard key={n.id}>
                <WorkspaceBadge
                  label={n.readAt ? m.t("Read", "مقروء") : m.t("New", "جديد")}
                />
                <Text style={{ fontSize: 15, color: m.ink, fontWeight: "600" }}>
                  {n.title}
                </Text>
                <Text style={{ fontSize: 12, lineHeight: 21, color: m.muted }}>
                  {n.body}
                </Text>
                <Text style={{ fontSize: 10, color: m.muted }}>
                  {date(n.createdAt)}
                </Text>
                <WorkspaceButton
                  small
                  secondary
                  label={m.t("Open update", "فتح التحديث")}
                  onPress={() =>
                    void run(async () => {
                      await mechanicApi(
                        "/api/mechanics/notifications/" + n.id + "/read",
                        "POST",
                      );
                      if (n.kind === "MESSAGE") setPage("conversation");
                      else if ((n.kind?.startsWith("TEST")||n.kind==='ASSESSMENT_PACKAGE_ASSIGNED')) setPage("test");
                      else
                        router.replace(
                          "/mechanic" as import("expo-router").Href,
                        );
                      await load();
                    })
                  }
                />
              </WorkspaceCard>
            ))}
            {!notices.length && (
              <MechanicNote>
                {m.t("No notifications yet.", "لا توجد إشعارات بعد.")}
              </MechanicNote>
            )}
          </WorkspaceCard>
        </>
      )}
      <MotexaDialog
        visible={confirm}
        title={m.t("Submit your two answers?", "إرسال الإجابتين؟")}
        message={m.t(
          "You cannot edit the test after submission. Your Mechanics Admin will review it before the final decision.",
          "لا يمكن تعديل الاختبار بعد الإرسال. سيراجعه أدمن الميكانيك قبل القرار النهائي.",
        )}
        confirmText={m.t("Submit answers", "إرسال الإجابات")}
        cancelText={m.t("Review again", "مراجعة مجددًا")}
        onConfirm={() => void submit()}
        onCancel={() => setConfirm(false)}
        loading={busy}
      />
    </WorkspaceFrame>
  );
}
