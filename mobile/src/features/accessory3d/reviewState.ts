export type ReviewTarget = {
  generationId: string; model3dKey: string | null; name: string; nameAr: string; has3d: boolean; semanticPart: string;
  partMap: "NOT_REQUIRED" | "CONFIRMED" | "MISSING" | "STALE";
  fit: {state: "NOT_RUN" | "RUNNING" | "PASSED" | "NEEDS_CORRECTION" | "FAILED" | "APPROVED"; current: boolean; approvedAt: string | null; reason: string | null};
  previewCurrent: boolean;
};
export type AccessoryReview = {
  model: {generated: boolean; exists: boolean; optimized: boolean; validation: string; reason: string | null};
  targets: ReviewTarget[];
  publication: {state: string; file?: string | null; canPublish: boolean; blockers: {code: string; message: string; generationId?: string}[]};
  canRetryProcessing: boolean;
  /** a manually imported GLB not yet optimised / validated: "Run validation" (same pipeline as a generated model) */
  canValidateManual?: boolean;
};
export const REVIEW_LABELS: Record<string, [string, string]> = {
  NOT_RUN: ["Not run", "لم يُنفّذ"], RUNNING: ["Running", "جارٍ التنفيذ"], PASSED: ["Passed", "ناجح"],
  NEEDS_CORRECTION: ["Needs correction", "يحتاج إلى تصحيح"], FAILED: ["Failed", "فشل"], APPROVED: ["Approved", "معتمد"],
  NOT_REQUIRED: ["Not required", "غير مطلوبة"], CONFIRMED: ["Confirmed", "مؤكدة"], MISSING: ["Missing", "مفقودة"], STALE: ["Stale", "قديمة"],
  PRIVATE_CANDIDATE: ["Private candidate", "نموذج خاص"], READY_FOR_FINAL_REVIEW: ["Ready for final review", "جاهز للمراجعة النهائية"], PUBLISHED: ["Published", "منشور"],
  UNPUBLISHED: ["Unpublished", "غير منشور"],
};
export const REVIEW_BLOCKERS: Record<string, [string,string]> = {
  REVIEW_CONFLICT:["A private candidate awaiting review is required.","يلزم نموذج خاص ينتظر المراجعة."],
  MOCK_NOT_PUBLISHABLE:["A real successful candidate is required.","يلزم نموذج حقيقي أُنشئ بنجاح."],
  MODEL_REQUIRED:["The generated GLB is missing.","ملف النموذج المُنشأ مفقود."],
  VALIDATION_REJECTED:["Current model validation has not passed.","لم يجتز النموذج الحالي التحقق."],
  OPTIMIZATION_REQUIRED:["Retry processing to complete optimization.","أعد معالجة النموذج لإكمال التحسين."],
  NO_3D_CAR:["A compatible published vehicle is required.","يلزم نموذج سيارة متوافقة ومنشورة."],
  PART_MAP_STALE:["Confirm the current stock-part map for this vehicle.","أكّد خريطة القطع الأصلية الحالية لهذه السيارة."],
  FIT_NOT_READY:["Run automatic fit and wait for its result.","شغّل التركيب التلقائي وانتظر نتيجته."],
  FIT_REVIEW_REQUIRED:["Review and approve the fit on the final-preview vehicle.","راجع التركيب واعتمده على سيارة المعاينة النهائية."],
  STALE_VISUAL_REVIEW:["Render the final preview after the latest fit review.","اعرض المعاينة النهائية بعد آخر مراجعة للتركيب."],
};
/** Choose navigation/actions only. All eligibility and publication decisions come from the backend. */
export function reviewAction(review: AccessoryReview, target: ReviewTarget) {
  if (review.publication.state === "PUBLISHED") return "published";
  if (!review.model.exists || review.model.validation !== "PASSED" || !review.model.optimized) return review.canRetryProcessing ? "retryProcessing" : null;
  if (!target.has3d) return null;
  if (target.partMap === "MISSING" || target.partMap === "STALE") return "partMap";
  if (target.fit.state === "NOT_RUN") return "runFit";
  if (target.fit.state === "NEEDS_CORRECTION" || target.fit.state === "FAILED") return "corrections";
  if (target.fit.state === "PASSED") return "reviewFit";
  if (target.fit.state === "APPROVED") return target.previewCurrent ? "reviewFit" : "preview";
  return null;
}
export function reviewRoute(requestId: string, target: ReviewTarget, mode: "parts" | "fits") {
  const q = new URLSearchParams({mode, model3dKey: target.model3dKey ?? "", key: target.model3dKey ?? "", generationId: target.generationId, accessoryId: requestId, requestId, label: target.semanticPart});
  return `/dept/accessory-zones?${q.toString()}`;
}
