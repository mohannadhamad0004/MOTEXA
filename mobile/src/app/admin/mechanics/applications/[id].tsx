import { Steps } from "../../../../components/blueprint";
import { hapticError, hapticSuccess } from "../../../../motion";
import { Async, Notice } from "../../../../components/ui/Feedback";
import { Badge } from "../../../../components/ui/Badge";
import { Button } from "../../../../components/ui/Button";
import { Card } from "../../../../components/ui/Card";
import { Input } from "../../../../components/ui/Input";
import { DashboardLayout } from "../../../../components/layout/DashboardLayout";
import { ReasonPanel } from "../../../../components/ui/ReasonPanel";
import { SectionHeader } from "../../../../components/ui/SectionHeader";
import { useL } from "../../../../core/hooks/useL";
import { useLoad } from "../../../../core/hooks/useLoad";
import { Text } from "../../../../components/ui/Text";
import { useTheme } from "../../../../theme/useTheme";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import {
  ApplicationDetail, OBSERVATIONS, Observation, mechanicReviewService,
} from "../../../../features/mechanic-review/mechanicReviewService";
import {
  ReviewStatusBadge, SkillStatusBadge, useReviewLabels,
} from "../../../../features/mechanic-review/reviewBits";
import { HistoryList, KV, fmtDate, isExpired } from "../../../../features/shared/blocks";
import { privateImageSource } from "../../../../features/shared/api";

type Run = (fn: () => Promise<unknown>) => Promise<void>;

function PreReviewBox({ id, target, current, note, run }: {
  id: string; target: "PROFESSIONAL" | "WORKSHOP"; current: Observation; note: string | null; run: Run;
}) {
  const { c: col } = useTheme();
  const { t, row } = useL();
  const labels = useReviewLabels().observation;
  const [obs, setObs] = useState<Observation>(current);
  const [text, setText] = useState(note ?? "");
  return (
    <View style={{ marginTop: 10 }}>
      <Text style={{ color: col.text, fontSize: 11, fontWeight: "800", letterSpacing: 1, marginBottom: 8 }}>
        {t("PRE-REVIEW OBSERVATION", "ملاحظة المراجعة الأولية")}
      </Text>
      <View style={[row, { flexWrap: "wrap", gap: 8, marginBottom: 12 }]}>
        {OBSERVATIONS.map((o) => (
          <Button key={o} variant={obs === o ? "primary" : "ghost"} label={labels[o]} onPress={() => setObs(o)} />
        ))}
      </View>
      <Input label={t("Note (optional)", "ملاحظة (اختياري)")} value={text} onChangeText={setText} multiline />
      <Button
        variant="ghost"
        icon="save-outline"
        label={t("Save observation", "حفظ الملاحظة")}
        disabled={obs === "NOT_REVIEWED" || (obs === current && text.trim() === (note ?? ""))}
        onPress={() => run(() => mechanicReviewService.preReview(id, target, obs, text.trim() || undefined))}
      />
      <Text style={{ color: col.textDim, fontSize: 11, marginTop: 8, lineHeight: 16 }}>
        {t("An observation is not a verification result.", "الملاحظة ليست نتيجة تحقق.")}
      </Text>
    </View>
  );
}

function DocViewer({ appId, doc }: { appId: string; doc: ApplicationDetail["documents"][number] }) {
  const { c: col } = useTheme();
  const { t, row } = useL();
  const [src, setSrc] = useState<{ uri: string; headers: Record<string, string> } | null>(null);
  return (
    <View style={{ paddingVertical: 8 }}>
      <View style={[row, { alignItems: "center", gap: 12 }]}>
        <Ionicons name="document-lock-outline" size={22} color={col.accent} />
        <View style={{ flex: 1 }}>
          <Text numberOfLines={2} style={{ color: col.text, fontSize: 13, fontWeight: "700" }}>{doc.title}</Text>
          <Text style={{ color: col.textDim, fontSize: 11, marginTop: 2 }}>
            {doc.kind === "LICENCE" ? t("Licence / credential", "الرخصة / الاعتماد") : t("Certificate", "شهادة")} · {Math.round(doc.sizeBytes / 1024)} KB
          </Text>
        </View>
        <View style={{ minWidth: 96 }}>
          <Button
            variant="ghost"
            icon={src ? "eye-off-outline" : "eye-outline"}
            label={src ? t("Hide", "إخفاء") : t("View", "عرض")}
            onPress={async () => setSrc(src ? null : await privateImageSource(`/mechanic-applications/${appId}/documents/${doc.id}`))}
          />
        </View>
      </View>
      {src && <Image source={src} style={{ width: "100%", height: 260, borderRadius: 14, marginTop: 10, backgroundColor: col.surface }} contentFit="contain" />}
    </View>
  );
}

function Inspector({ a, reload }: { a: ApplicationDetail; reload: () => void }) {
  const { c: col } = useTheme();
  const { t, row, align } = useL();
  const labels = useReviewLabels();
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rejectingSkill, setRejectingSkill] = useState<string | null>(null);
  const [panel, setPanel] = useState<null | "correction" | "manual" | "reject">(null);
  const locked = a.reviewStatus === "REJECTED";

  const run: Run = async (fn) => {
    setBusy(true);
    setErr(null);
    try {
      await fn();
      hapticSuccess();
      setRejectingSkill(null);
      setPanel(null);
      reload();
    } catch (e: any) {
      hapticError();
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const history = a.history.map((h) => ({
    ...h,
    action: labels.history[h.action] ?? h.action,
    danger: ["REJECTED", "SKILL_REJECTED", "NEEDS_CORRECTION"].includes(h.action),
    reason: [h.skill, h.observation ? labels.observation[h.observation as Observation] : null, h.reason].filter(Boolean).join(" — ") || undefined,
  }));

  return (
    <>
      <View style={{ alignItems: "flex-start", gap: 8 }}>
        <ReviewStatusBadge value={a.reviewStatus} />
        <View style={{ alignSelf: "stretch" }}>
          <Steps
            labels={[t("Submitted", "مقدّم"), t("In review", "قيد المراجعة"), t("Decision", "القرار")]}
            index={a.reviewStatus === "PENDING_REVIEW" ? 0 : a.reviewStatus === "READY_FOR_AUTHORITY" ? 2 : 1}
            tone={a.reviewStatus === "REJECTED" ? "danger" : a.reviewStatus === "READY_FOR_AUTHORITY" ? "success" : "brand"}
          />
        </View>
        <Text style={{ color: col.textDim, fontSize: 11 }}>{t("Application", "الطلب")} {a.id}</Text>
      </View>
      {a.reviewReason && (a.reviewStatus === "NEEDS_CORRECTION" || a.reviewStatus === "REJECTED" || a.reviewStatus === "MANUAL_REVIEW") ? (
        <View style={{ marginTop: 12 }}>
          <Notice tone={a.reviewStatus === "REJECTED" ? "danger" : "accent"} icon="chatbox-ellipses-outline">{a.reviewReason}</Notice>
        </View>
      ) : null}
      {err ? <View style={{ marginTop: 12 }}><Notice tone="danger" icon="alert-circle-outline">{err}</Notice></View> : null}

      <SectionHeader title={t("Account", "الحساب")} />
      <Card>
        <KV k={t("Name", "الاسم")} v={a.account.fullName} />
        <KV k={t("Email", "البريد")} v={a.account.email} />
        <KV k={t("Account status", "حالة الحساب")} v={a.account.status} />
        <KV k={t("Submitted", "تاريخ التقديم")} v={fmtDate(a.submittedAt)} />
      </Card>

      <SectionHeader title={t("Mechanic profile", "الملف المهني")} />
      <Card>
        <KV k={t("Phone", "الهاتف")} v={a.profile.phone} />
        <KV k={t("City", "المدينة")} v={a.profile.city} />
      </Card>

      <SectionHeader title={`${t("Skills", "المهارات")} (${a.skills.length})`} />
      <Text style={[{ color: col.textDim, fontSize: 11, marginBottom: 10, lineHeight: 16 }, align]}>
        {t("Each skill is reviewed on its own. Approving one does not approve the others.", "تتم مراجعة كل مهارة على حدة. الموافقة على مهارة لا تعني الموافقة على الباقي.")}
      </Text>
      {a.skills.map((s) => (
        <Card key={s.id}>
          <View style={[row, { justifyContent: "space-between", alignItems: "center", gap: 10 }]}>
            <Text numberOfLines={2} style={{ color: col.text, fontSize: 15, fontWeight: "800", flex: 1 }}>{s.name}</Text>
            <SkillStatusBadge value={s.status} />
          </View>
          {s.rejectionReason ? <View style={{ marginTop: 10 }}><Notice tone="danger" icon="close-circle-outline">{s.rejectionReason}</Notice></View> : null}
          {!locked && rejectingSkill !== s.id && (
            <View style={[row, { gap: 8, marginTop: 12 }]}>
              {s.status !== "APPROVED" && (
                <View style={{ flex: 1 }}>
                  <Button label={t("Approve", "موافقة")} icon="checkmark-outline" disabled={busy} onPress={() => run(() => mechanicReviewService.reviewSkill(a.id, s.id, "APPROVED"))} />
                </View>
              )}
              {s.status !== "REJECTED" && (
                <View style={{ flex: 1 }}>
                  <Button variant="danger" label={t("Reject", "رفض")} disabled={busy} onPress={() => setRejectingSkill(s.id)} />
                </View>
              )}
            </View>
          )}
          {rejectingSkill === s.id && (
            <ReasonPanel
              title={t("Reason for rejecting this skill (required)", "سبب رفض هذه المهارة (مطلوب)")}
              confirmLabel={t("Confirm rejection", "تأكيد الرفض")}
              onCancel={() => setRejectingSkill(null)}
              onConfirm={(reason) => run(() => mechanicReviewService.reviewSkill(a.id, s.id, "REJECTED", reason))}
            />
          )}
        </Card>
      ))}

      <SectionHeader title={t("Workshop", "الورشة")} />
      <Card>
        <KV k={t("Name", "الاسم")} v={a.workshop.name} />
        <KV k={t("Address", "العنوان")} v={a.workshop.address} />
        <KV k={t("Pre-review", "المراجعة الأولية")} v={labels.observation[a.workshop.preReview]} />
        {a.workshop.preReviewNote ? <Text style={[{ color: col.textMuted, fontSize: 12, marginTop: 4 }, align]}>{a.workshop.preReviewNote}</Text> : null}
        {!locked && <PreReviewBox key={a.workshop.preReview + a.workshop.preReviewNote} id={a.id} target="WORKSHOP" current={a.workshop.preReview} note={a.workshop.preReviewNote} run={run} />}
      </Card>

      <SectionHeader title={t("Licence / credential", "الرخصة / الاعتماد")} />
      <Card>
        <KV k={t("Number", "الرقم")} v={a.licence.number} />
        <KV k={t("Holder", "صاحب الرخصة")} v={a.licence.holderName} />
        <KV k={t("Issuing authority", "الجهة المصدِرة")} v={a.licence.issuingAuthority} />
        <KV k={t("Issue date", "تاريخ الإصدار")} v={fmtDate(a.licence.issueDate)} />
        <KV k={t("Expiry date", "تاريخ الانتهاء")} v={fmtDate(a.licence.expiryDate)} />
        {isExpired(a.licence.expiryDate) && (
          <View style={{ marginTop: 6 }}><Badge tone="danger" icon="alert-circle-outline" label={t("Expiry date has passed", "تاريخ الانتهاء قد مضى")} /></View>
        )}
        <KV k={t("Pre-review", "المراجعة الأولية")} v={labels.observation[a.licence.preReview]} />
        {a.licence.preReviewNote ? <Text style={[{ color: col.textMuted, fontSize: 12, marginTop: 4 }, align]}>{a.licence.preReviewNote}</Text> : null}
        <Notice icon="information-circle-outline">
          {t("An uploaded licence is not a verified licence. Authenticity is confirmed later with the issuing authority.", "الرخصة المرفوعة ليست رخصة تم التحقق منها. تُؤكَّد صحتها لاحقًا مع الجهة المصدِرة.")}
        </Notice>
        {!locked && <PreReviewBox key={a.licence.preReview + a.licence.preReviewNote} id={a.id} target="PROFESSIONAL" current={a.licence.preReview} note={a.licence.preReviewNote} run={run} />}
      </Card>

      <SectionHeader title={t("Documents (private)", "المستندات (خاصة)")} />
      <Card>
        {a.documents.map((d) => <DocViewer key={d.id} appId={a.id} doc={d} />)}
        <Text style={{ color: col.textDim, fontSize: 11, marginTop: 6 }}>
          {t("Private: loaded through authorized access only. Only JPEG and PNG images are supported; PDF is not.", "خاصة: تُحمَّل عبر وصول مصرّح فقط. تُدعم صور JPEG و PNG فقط ولا يُدعم PDF.")}
        </Text>
      </Card>

      <SectionHeader title={t("Verification authorization", "تفويض التحقق")} />
      <Card>
        <KV k={t("Accepted", "تمت الموافقة")} v={a.authorization.accepted ? t("Yes", "نعم") : t("No", "لا")} />
        <KV k={t("Accepted at", "وقت الموافقة")} v={a.authorization.acceptedAt ? a.authorization.acceptedAt.replace("T", " ").slice(0, 16) : ""} />
      </Card>

      <SectionHeader title={t("Review decision", "قرار المراجعة")} />
      <Card>
        {locked ? (
          <Notice icon="lock-closed-outline">{t("This application was rejected. It is kept for the record and can no longer be changed.", "تم رفض هذا الطلب. يُحفظ للسجل ولا يمكن تعديله.")}</Notice>
        ) : (
          <>
            <Notice icon="information-circle-outline">
              {t("These decisions do not activate the mechanic. The account stays pending until authority verification.", "هذه القرارات لا تفعّل حساب الميكانيكي. يبقى الحساب قيد الانتظار حتى التحقق من الجهة.")}
            </Notice>
            {!a.authorization.accepted && (
              <Notice tone="danger" icon="alert-circle-outline">{t("Authorization was not accepted, so this application cannot move to authority verification.", "لم تتم الموافقة على التفويض، لذلك لا يمكن نقل الطلب إلى التحقق من الجهة.")}</Notice>
            )}
            {panel === null && (
              <View style={{ gap: 8 }}>
                <Button label={t("Ready for authority", "جاهز للتحقق من الجهة")} icon="paper-plane-outline" disabled={busy || !a.authorization.accepted || a.reviewStatus === "READY_FOR_AUTHORITY"} onPress={() => run(() => mechanicReviewService.review(a.id, "READY_FOR_AUTHORITY"))} />
                <Button variant="ghost" label={t("Needs correction", "يحتاج تصحيحًا")} icon="create-outline" onPress={() => setPanel("correction")} />
                <Button variant="ghost" label={t("Manual review", "مراجعة يدوية")} icon="eye-outline" onPress={() => setPanel("manual")} />
                <Button variant="danger" label={t("Reject application", "رفض الطلب")} onPress={() => setPanel("reject")} />
              </View>
            )}
            {panel === "correction" && (
              <ReasonPanel title={t("What needs to be corrected (required)", "ما الذي يجب تصحيحه (مطلوب)")} confirmLabel={t("Request correction", "طلب التصحيح")} onCancel={() => setPanel(null)} onConfirm={(r) => run(() => mechanicReviewService.review(a.id, "NEEDS_CORRECTION", r))} />
            )}
            {panel === "manual" && (
              <ReasonPanel required={false} title={t("Note (optional)", "ملاحظة (اختياري)")} confirmLabel={t("Mark for manual review", "تحديد للمراجعة اليدوية")} onCancel={() => setPanel(null)} onConfirm={(r) => run(() => mechanicReviewService.review(a.id, "MANUAL_REVIEW", r || undefined))} />
            )}
            {panel === "reject" && (
              <ReasonPanel title={t("Rejection reason (required)", "سبب الرفض (مطلوب)")} confirmLabel={t("Confirm rejection", "تأكيد الرفض")} onCancel={() => setPanel(null)} onConfirm={(r) => run(() => mechanicReviewService.review(a.id, "REJECT", r))} />
            )}
          </>
        )}
      </Card>

      <SectionHeader title={t("Review history", "سجل المراجعة")} />
      <HistoryList items={history} />
    </>
  );
}

export default function MechanicApplicationInspector() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const state = useLoad(() => mechanicReviewService.get(id), [id]);
  const { t } = useL();
  return (
    <DashboardLayout tag="REVIEW / A4" kind="wrench" brand="MOTEXA ADMIN" title={state.data?.account.fullName ?? t("Application", "الطلب")} back>
      <Async state={state}>{(a) => <Inspector a={a} reload={state.reload} />}</Async>
    </DashboardLayout>
  );
}
