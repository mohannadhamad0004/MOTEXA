export const runningImport=(status:string)=>["QUEUED","DOWNLOADING","CONVERTING","OPTIMIZING","VALIDATING","GENERATING_PART_MAP"].includes(status);
export const IMPORT_LABELS:Record<string,[string,string]>={INSPECTED:["Inspected","تم الفحص"],QUEUED:["Queued","في قائمة الانتظار"],DOWNLOADING:["Downloading","جارٍ التنزيل"],CONVERTING:["Converting","جارٍ التحويل"],OPTIMIZING:["Optimizing","جارٍ التحسين"],VALIDATING:["Validating","جارٍ التحقق"],GENERATING_PART_MAP:["Detecting vehicle parts","جارٍ اكتشاف قطع المركبة"],READY:["Ready for review","جاهز للمراجعة"],FAILED:["Failed","فشل الاستيراد"],PUBLISHED:["Published","منشور"],DISCARDED:["Discarded","تم الاستبعاد"],DRAFT:["Awaiting validation","بانتظار التحقق"]};
export const IMPORT_ERROR_LABELS:Record<string,[string,string]>={
 BAD_LINK:["Enter a valid Sketchfab model URL.","أدخل رابط نموذج صالحًا من Sketchfab."],
 SKETCHFAB_NOT_FOUND:["Unable to read this Sketchfab model.","تعذّرت قراءة هذا النموذج من Sketchfab."],
 SKETCHFAB_API_FAILED:["Unable to read this Sketchfab model.","تعذّرت قراءة هذا النموذج من Sketchfab."],
 NOT_DOWNLOADABLE:["This model is not downloadable through Sketchfab.","هذا النموذج غير متاح للتنزيل عبر Sketchfab."],
 LICENSE_NOT_ALLOWED:["This model cannot be imported because its license does not allow the required use.","لا يمكن استيراد هذا النموذج لأن ترخيصه لا يسمح بالاستخدام المطلوب أو لا يمكن التحقق منه."],
 DUPLICATE_IMPORT:["This Sketchfab model has already been imported.","سبق استيراد هذا النموذج من Sketchfab."],
 DOWNLOAD_FAILED:["The Sketchfab download failed.","فشل تنزيل النموذج من Sketchfab."],
 DOWNLOAD_TOO_LARGE:["The source download exceeds the 128 MiB limit.","يتجاوز حجم التنزيل الأصلي الحد المسموح وهو ١٢٨ ميبيبايت."],
 ARCHIVE_INVALID:["The model archive is invalid or exceeds safe extraction limits.","أرشيف النموذج غير صالح أو يتجاوز حدود فك الضغط الآمن."],
 CONVERSION_FAILED:["The model could not be converted to a supported GLB.","تعذّر تحويل النموذج إلى ملف GLB مدعوم."],
 OPTIMIZATION_FAILED:["The model could not be optimized safely.","تعذّر تحسين النموذج بأمان."],
 FINAL_ASSET_TOO_LARGE:["The optimized model is larger than 8 MiB.","يتجاوز حجم النموذج المحسّن ٨ ميبيبايت."],
 VALIDATION_REJECTED:["The model did not pass the required technical or quality validation.","لم يجتز النموذج فحوص الجودة أو التحقق التقني المطلوبة."],
 PUBLICATION_CONFLICT:["The current model changed. Reload before confirming replacement.","تغيّر النموذج الحالي. أعد التحميل قبل تأكيد استبداله."],
 GENERATION_YEARS:["Use the selected generation's production years, or edit it in the managed catalog.","استخدم سنوات إنتاج الجيل المحدد أو عدّلها في كتالوج المركبات."],
 MODEL_REJECTED:["This model failed the quality gate. Review the reported reasons.","لم يجتز النموذج بوابة الجودة. راجع الأسباب المعروضة."],
};
export const importError=(e:unknown,t:(en:string,ar:string)=>string)=>{
 const code=(e as {data?:{code?:string}})?.data?.code;
 const labels=code?IMPORT_ERROR_LABELS[code]:null;
 return labels?t(...labels):t("Could not complete the import action. Check your connection and Parts Admin access.","تعذّر إكمال إجراء الاستيراد. تحقق من الاتصال وصلاحية إدارة قطع الغيار.");
};
export const validYears=(from:number,to:number)=>Number.isInteger(from)&&Number.isInteger(to)&&from>=1886&&to<=new Date().getFullYear()+2&&from<=to;
