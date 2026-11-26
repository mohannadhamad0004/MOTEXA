// The Parts Admin's 3D request detail: one progress line Photos → 3D model → Checked → Fits approved → Published, the current step and its ONE
// next action. Pure (tests/accessory-progress.test.mjs). A later step done implies the earlier ones (a published model is generated and checked):
// the line never says "not complete" next to "published". All publish decisions stay on the server (review.publication).
import type { AccessoryStatus, FitState } from "./api";
import type { AccessoryReview, ReviewTarget } from "./reviewState";

export type StepKey = "photos" | "model" | "checked" | "fits" | "published";
/** now = the step to act on; attention = something went wrong or waits on someone else; skipped / done / todo as they say */
export type StepState = "done" | "now" | "attention" | "skipped" | "todo";
export type Step = { key: StepKey; state: StepState; note: [string, string] | null };
export type NextAction =
  | { kind: "approve" | "useShopModel" | "start" | "resume" | "retryProcessing" | "validate" | "runFit" | "reviewFits" | "publish" | "reactivate" }
  | { kind: "partMap"; target: ReviewTarget }
  | { kind: "preview"; generationId: string };
export type FitTotals = { total: number; approved: number; toReview: number; failed: number; notComputed: number };
export type ProgressInput = {
  status: AccessoryStatus; hasModel: boolean; partPhotos: unknown[]; shopModel?: unknown | null; provider: string | null; providerState: string | null;
  resumable: boolean; mock: boolean; deactivatedAt?: string | null; lifecycleState?: string; review: AccessoryReview | null;
};

export const STEP_LABELS: Record<StepKey, [string, string]> = {
  photos: ["Photos", "الصور"], model: ["3D model", "النموذج ثلاثي الأبعاد"], checked: ["Checked", "تم الفحص"], fits: ["Fits approved", "اعتماد التركيب"], published: ["Published", "منشور"],
};
export const STATE_LABELS: Record<StepState, [string, string]> = {
  done: ["Done", "تم"], now: ["Now", "الآن"], attention: ["Needs you", "يحتاجك"], skipped: ["Skipped", "تم تخطيها"], todo: ["Later", "لاحقًا"],
};

export function fitTotals(c: Record<FitState, number> | null | undefined): FitTotals | null {
  if (!c) return null;
  const total = Object.values(c).reduce((a, b) => a + b, 0);
  return { total, approved: c.approved, toReview: c.passed + c.needs_correction + c.has_correction, failed: c.failed, notComputed: c.not_computed };
}
const n = (v: number) => String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
/** "N cars" with the Arabic number noun (1 واحدة, 2 مثنى, 3-10 جمع, else مفرد). */
export const carsText = (v: number, ar: boolean) => (!ar ? `${n(v)} ${v === 1 ? "car" : "cars"}` : v === 1 ? "سيارة واحدة" : v === 2 ? "سيارتان" : `${n(v)} ${v <= 10 ? "سيارات" : "سيارة"}`);
/** "21 cars · 18 approved · 2 to review · 1 failed" (zero parts left out). */
export function fitsLine(f: FitTotals, ar: boolean): string {
  const parts = [carsText(f.total, ar), f.approved ? (ar ? `${n(f.approved)} معتمدة` : `${n(f.approved)} approved`) : null,
    f.toReview ? (ar ? `${n(f.toReview)} للمراجعة` : `${n(f.toReview)} to review`) : null, f.failed ? (ar ? `${n(f.failed)} فاشلة` : `${n(f.failed)} failed`) : null,
    f.notComputed ? (ar ? `${n(f.notComputed)} لم تُحسب` : `${n(f.notComputed)} not computed`) : null];
  return parts.filter(Boolean).join(" · ");
}
/** what is left to do: "2 waiting for your review · 1 failed" ("" when nothing is) */
export function fitsLeftLine(f: FitTotals, ar: boolean): string {
  return [f.toReview ? (ar ? `${n(f.toReview)} بانتظار مراجعتك` : `${n(f.toReview)} waiting for your review`) : null, f.failed ? (ar ? `${n(f.failed)} فاشلة` : `${n(f.failed)} failed`) : null,
    f.notComputed ? (ar ? `${n(f.notComputed)} لم تُحسب` : `${n(f.notComputed)} not computed`) : null].filter(Boolean).join(" · ");
}

const FIT_BLOCKERS = ["PART_MAP_STALE", "FIT_NOT_READY", "FIT_REVIEW_REQUIRED", "NO_3D_CAR"];
const PREVIEW_BLOCKERS = ["STALE_VISUAL_REVIEW"];

export function progress(a: ProgressInput, counts: Record<FitState, number> | null | undefined): { steps: Step[]; current: StepKey | null; action: NextAction | null; fits: FitTotals | null } {
  const fits = fitTotals(counts), review = a.review, blockers = review?.publication.blockers.map(b => b.code) ?? [];
  const published = a.status === "PUBLISHED", ready = a.status === "READY_FOR_FINAL_REVIEW";
  const actions: Partial<Record<StepKey, NextAction>> = {};
  const step = (key: StepKey, state: StepState, note: [string, string] | null = null, action?: NextAction): Step => { if (action) actions[key] = action; return { key, state, note }; };

  // 1. photos (skipped when the 3D model did not come from photos)
  const noPhotos = !a.partPhotos.length, shopFile = a.status === "PENDING_REVIEW" && noPhotos && !!a.shopModel && !a.hasModel;
  const photos = a.status === "DRAFT" ? step("photos", "attention", ["The shop has not sent this request yet.", "لم يرسل المتجر هذا الطلب بعد."])
    : a.status === "REJECTED" ? step("photos", "attention", ["Changes requested: waiting for the shop.", "طُلبت تعديلات: بانتظار المتجر."])
    : noPhotos && a.shopModel ? step("photos", "skipped", ["Skipped: the shop sent its own 3D file.", "تم تخطيها: أرسل المتجر ملفه ثلاثي الأبعاد."])
    : noPhotos && (a.hasModel || a.provider === "MANUAL") ? step("photos", "skipped", ["Skipped: the 3D model was imported directly.", "تم تخطيها: استُورد النموذج مباشرة."])
    : a.status === "PENDING_REVIEW" ? step("photos", "now", a.shopModel ? ["The shop also sent its own 3D file: use it (no Meshy credits).", "أرسل المتجر ملفه ثلاثي الأبعاد أيضًا: استخدمه (دون رصيد Meshy)."] : ["Check the photos, then approve them for 3D.", "راجع الصور ثم وافق عليها لإنشاء النموذج."], a.shopModel ? { kind: "useShopModel" } : { kind: "approve" })
    : step("photos", "done");
  const early = ["DRAFT", "REJECTED", "PENDING_REVIEW"].includes(a.status);

  // 2. the 3D model
  const processingFailed = a.lifecycleState === "FAILED" && a.providerState === "SUCCEEDED";
  const model = published || (a.hasModel && !processingFailed) ? step("model", "done")
    : shopFile ? step("model", "now", ["Use the shop's own 3D file (no Meshy credits).", "استخدم ملف المتجر ثلاثي الأبعاد (دون رصيد Meshy)."], { kind: "useShopModel" })
    : processingFailed ? step("model", "attention", ["Processing the model failed.", "تعذّرت معالجة النموذج."], review?.canRetryProcessing ? { kind: "retryProcessing" } : undefined)
    : a.status === "GENERATING" ? step("model", "now", ["Creating the 3D model…", "جارٍ إنشاء النموذج…"])
    : a.status === "APPROVED_FOR_GENERATION" ? step("model", "now", a.resumable ? ["The paid task exists: resume it at no new cost.", "المهمة المدفوعة موجودة: استأنفها دون تكلفة جديدة."] : ["Photos approved: start the 3D generation.", "الصور معتمدة: ابدأ إنشاء النموذج."], a.resumable ? { kind: "resume" } : { kind: "start" })
    : ready ? step("model", "attention", ["The model file is missing.", "ملف النموذج مفقود."])
    : step("model", "todo");

  // 3. checked (validation + optimizing; "not needed" said plainly)
  const m = review?.model, passed = m?.validation === "PASSED";
  const checked = published ? step("checked", "done")
    : model.state !== "done" ? step("checked", "todo")
    : !m ? step("checked", "attention", ["The check status could not be loaded. Refresh.", "تعذّر تحميل حالة الفحص. حدّث الصفحة."])
    : passed && (m.optimized || m.keptOriginal) ? step("checked", "done", m.keptOriginal && !m.optimized ? ["Optimizing not needed: the original is under 8 MB.", "التحسين غير مطلوب: الملف الأصلي أقل من 8 ميغابايت."] : null)
    : passed ? step("checked", "now", ["Optimizing did not finish.", "لم يكتمل التحسين."], review.canRetryProcessing ? { kind: "retryProcessing" } : undefined)
    : review.canValidateManual ? step("checked", "now", ["Not checked yet.", "لم يُفحص بعد."], { kind: "validate" })
    : step("checked", "attention", m.validation === "FAILED" || m.validation === "REJECTED" ? ["The model did not pass the check.", "لم يجتز النموذج الفحص."] : ["Not checked yet.", "لم يُفحص بعد."],
      review.canRetryProcessing ? { kind: "retryProcessing" } : undefined);

  // 4. fits approved (published: what is left to review; before publishing: what blocks it)
  const left = fits ? fits.toReview + fits.failed + fits.notComputed : 0;
  const target = (want: string) => review?.targets.find(t => t.has3d && (want === "partMap" ? t.partMap === "MISSING" || t.partMap === "STALE" : t.fit.state === want));
  let fitStep: Step;
  if (published) fitStep = left ? step("fits", "attention", null, { kind: "reviewFits" }) : step("fits", fits ? "done" : "todo");
  else if (checked.state !== "done") fitStep = step("fits", "todo");
  else if (blockers.includes("NO_3D_CAR")) fitStep = step("fits", "attention", ["No car of this part has a published 3D model yet.", "لا توجد سيارة لهذه القطعة بنموذج منشور بعد."]);
  else if (blockers.some(b => FIT_BLOCKERS.includes(b))) {
    const map = target("partMap");
    fitStep = map ? step("fits", "now", ["Confirm this car's part map first.", "أكّد خريطة قطع هذه السيارة أولًا."], { kind: "partMap", target: map })
      : target("NOT_RUN") && !(fits && fits.total - fits.notComputed > 0) ? step("fits", "now", ["The fits are not computed yet.", "لم يُحسب التركيب بعد."], { kind: "runFit" })
      : target("RUNNING") ? step("fits", "now", ["Computing the fits…", "جارٍ حساب التركيب…"])
      : step("fits", "now", null, { kind: "reviewFits" });
  } else fitStep = step("fits", "done");

  // 5. published
  const before = [photos, model, checked, fitStep].every(s => s.state === "done" || s.state === "skipped");
  const preview = review?.targets.find(t => t.has3d && t.fit.state === "APPROVED" && !t.previewCurrent);
  const pub = published ? (a.deactivatedAt ? step("published", "attention", ["Unpublished: customers do not see it.", "غير منشورة: لا يراها العملاء."], { kind: "reactivate" }) : step("published", "done"))
    : !ready || !before ? step("published", "todo")
    : a.mock ? step("published", "attention", ["A mock model can never be published.", "لا يمكن نشر نموذج تجريبي أبدًا."])
    : blockers.some(b => PREVIEW_BLOCKERS.includes(b)) && preview ? step("published", "now", ["Render the final preview after the last fit review.", "اعرض المعاينة النهائية بعد آخر مراجعة للتركيب."], { kind: "preview", generationId: preview.generationId })
    : review?.publication.canPublish ? step("published", "now", ["Check the six views, then publish.", "راجع المناظر الستة ثم انشر."], { kind: "publish" })
    : step("published", "attention", ["Not ready to publish yet.", "غير جاهزة للنشر بعد."]);

  // nothing after a step that waits is "now" (one current step)
  const steps = [photos, model, checked, fitStep, pub];
  if (early) for (const s of steps.slice(shopFile ? 2 : 1)) if (s.state !== "todo") { s.state = "todo"; s.note = null; }
  const cur = steps.find(s => s.state === "now" || s.state === "attention") ?? null;
  return { steps, current: cur?.key ?? null, action: cur ? actions[cur.key] ?? null : null, fits };
}
