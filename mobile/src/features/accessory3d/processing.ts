/** A successful provider task is doing local work; never label that work as paid generation. */
const stages: Record<string, [string, string]> = {
  DOWNLOADING: ["Retrieving generated model", "جارٍ جلب النموذج المُنشأ"],
  PREPARING: ["Optimizing generated model", "جارٍ تحسين النموذج المُنشأ"],
  OPTIMIZING: ["Optimizing generated model", "جارٍ تحسين النموذج المُنشأ"],
  VALIDATING: ["Validating generated model", "جارٍ التحقق من النموذج المُنشأ"],
  CHECKING_FIT: ["Checking fit", "جارٍ فحص التركيب"],
};
export function accessoryProcessingLabel(a: {status: string; generationStage: string; providerState: string | null; lifecycleState?: string}): [string, string] | null {
  if (a.lifecycleState === "FAILED" && a.providerState === "SUCCEEDED") return ["Model processing failed", "تعذّرت معالجة النموذج"];
  if (a.status !== "GENERATING") return null;
  return stages[a.generationStage] ?? (a.providerState === "SUCCEEDED" ? stages.DOWNLOADING : null);
}
