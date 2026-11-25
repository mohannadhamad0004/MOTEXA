export const runningImport=(status:string)=>["QUEUED","DOWNLOADING","CONVERTING","OPTIMIZING","VALIDATING","GENERATING_PART_MAP"].includes(status);
export const IMPORT_LABELS:Record<string,[string,string]>={INSPECTED:["Inspected","تم الفحص"],QUEUED:["Queued","في قائمة الانتظار"],DOWNLOADING:["Downloading","جارٍ التنزيل"],CONVERTING:["Converting","جارٍ التحويل"],OPTIMIZING:["Optimizing","جارٍ التحسين"],VALIDATING:["Validating","جارٍ التحقق"],GENERATING_PART_MAP:["Detecting vehicle parts","جارٍ اكتشاف قطع المركبة"],READY:["Ready for review","جاهز للمراجعة"],FAILED:["Failed","فشل الاستيراد"],PUBLISHED:["Published","منشور"],DISCARDED:["Discarded","تم الاستبعاد"],DRAFT:["Awaiting validation","بانتظار التحقق"]};
export const IMPORT_ERROR_LABELS:Record<string,[string,string]>={
 BAD_LINK:["Enter a valid Sketchfab model URL.","أدخل رابط نموذج صالحًا من Sketchfab."],
 INVALID_SKETCHFAB_URL:["Enter a valid Sketchfab model URL.","أدخل رابط نموذج صالحًا من Sketchfab."],
 SKETCHFAB_TOKEN_MISSING:["Sketchfab credentials are missing on the MOTEXA backend (the Sketchfab API token).","بيانات Sketchfab غير موجودة على خادم موتكسا (رمز واجهة Sketchfab)."],
 SKETCHFAB_UNAUTHORIZED:["Sketchfab rejected the backend credential. Check its type, expiry and download access.","رفض Sketchfab بيانات الخادم. تحقق من نوع الرمز وصلاحيته وإذن التنزيل."],
 SKETCHFAB_RATE_LIMITED:["Sketchfab is rate limiting requests. Try again later.","بلغت طلبات Sketchfab الحد المسموح. حاول لاحقًا."],
 SKETCHFAB_UNAVAILABLE:["Sketchfab is unavailable or returned invalid data. Try again later.","خدمة Sketchfab غير متاحة أو أعادت بيانات غير صالحة. حاول لاحقًا."],
 NETWORK_ERROR:["Could not connect. Check the phone-to-backend connection and the backend's access to Sketchfab.","تعذّر الاتصال. تحقق من اتصال الهاتف بالخادم ووصول الخادم إلى Sketchfab."],
 FORBIDDEN:["Sign in with an account that has Parts Admin access.","سجّل الدخول بحساب لديه صلاحية إدارة قطع الغيار."],
 SKETCHFAB_NOT_FOUND:["Unable to read this Sketchfab model.","تعذّرت قراءة هذا النموذج من Sketchfab."],
 SKETCHFAB_API_FAILED:["Unable to read this Sketchfab model.","تعذّرت قراءة هذا النموذج من Sketchfab."],
 NOT_DOWNLOADABLE:["The creator has not allowed downloads of this model on Sketchfab, so MOTEXA cannot import it.","لم يسمح منشئ هذا النموذج بتنزيله على Sketchfab، لذا لا يمكن لموتكسا استيراده."],
 MODEL_NOT_DOWNLOADABLE:["The creator has not allowed downloads of this model on Sketchfab, so MOTEXA cannot import it.","لم يسمح منشئ هذا النموذج بتنزيله على Sketchfab، لذا لا يمكن لموتكسا استيراده."],
 LICENSE_NOT_ALLOWED:["This model does not have a Creative Commons license, so MOTEXA cannot use it. Choose a model with any CC license.","هذا النموذج ليس بترخيص المشاع الإبداعي (Creative Commons)، لذا لا يمكن لموتكسا استخدامه. اختر نموذجًا بأي ترخيص CC."],
 DUPLICATE_IMPORT:["This Sketchfab model has already been imported.","سبق استيراد هذا النموذج من Sketchfab."],
 DUPLICATE_MODEL:["This Sketchfab model has already been imported.","سبق استيراد هذا النموذج من Sketchfab."],
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
 const failure=e as {data?:{code?:string};status?:number;code?:string};
 const code=failure?.data?.code??failure?.code??(failure?.status===401||failure?.status===403?"FORBIDDEN":failure?.status===429?"SKETCHFAB_RATE_LIMITED":failure?.status===undefined?"NETWORK_ERROR":undefined);
 const labels=code?IMPORT_ERROR_LABELS[code]:null;
 return labels?t(...labels):t(`The import request failed (HTTP ${failure?.status??"unknown"}). Try again or check the backend log.`,`فشل طلب الاستيراد (HTTP ${failure?.status??"غير معروف"}). حاول مجددًا أو راجع سجل الخادم.`);
};
export const validYears=(from:number,to:number)=>Number.isInteger(from)&&Number.isInteger(to)&&from>=1886&&to<=new Date().getFullYear()+2&&from<=to;
/** Why the last import attempt failed, as saved by the backend (`failureDetail`). */
export type ImportFailure={stage:string;message:string|null;triangles?:number;limit?:number};
const en=(n?:number)=>(n??0).toLocaleString("en");
const arDigits=(s:string)=>s.replace(/\d/g,d=>"٠١٢٣٤٥٦٧٨٩"[Number(d)]).replace(/,/g,"٬").replace(/\./g,"٫");
const ar=(n?:number)=>arDigits(en(n));
const one=(n:number)=>(Math.round(n*10)/10).toString();
/** 1186481 -> "1.2M" / "١٫٢ مليون", 286967 -> "287k" / "٢٨٧ ألف" */
export const trianglesShort=(n:number):[string,string]=>n>=1e6?[`${one(n/1e6)}M`,arDigits(`${one(n/1e6)} مليون`)]:n>=1e3?[`${Math.round(n/1e3)}k`,arDigits(`${Math.round(n/1e3)} ألف`)]:[String(n),arDigits(String(n))];
/** "Simplified for phones: 1.2M → 287k triangles" */
export const simplifiedText=(s:{before:number;after:number},t:(en:string,ar:string)=>string)=>{const [b,ba]=trianglesShort(s.before),[a,aa]=trianglesShort(s.after);return t(`Simplified for phones: ${b} → ${a} triangles`,`بُسّط للهواتف: من ${ba} إلى ${aa} مثلث`);};
const again=["Try again; if it repeats, choose another model.","حاول مجددًا، وإن تكرر فاختر نموذجًا آخر."];
/** Plain words for the reasons a prepared model fails validation. Keys = the start of the backend's own message (tests/import-failure-text.test.mjs keeps them in sync). */
export const IMPORT_FAILURE_TEXT:Record<string,(f:ImportFailure)=>[string,string]>={
 "Model needs nonzero geometry and at most":f=>f.triangles?[`Even after simplifying for phones this model has ${en(f.triangles)} triangles; the limit is ${en(f.limit)}. Choose another version of this model on Sketchfab.`,`حتى بعد تبسيطه للهواتف يحتوي هذا النموذج على ${ar(f.triangles)} مثلث، والحد الأقصى ${ar(f.limit)}. اختر نسخة أخرى من هذا النموذج على Sketchfab.`]:["This model has no usable 3D surfaces. Choose another model.","لا يحتوي هذا النموذج على أسطح ثلاثية الأبعاد صالحة. اختر نموذجًا آخر."],
 "Model is not upright.":()=>["The model is lying on its side or upside down. Change \"Source up correction\" below and validate again.","النموذج مائل أو مقلوب. عدّل «تصحيح المحور الرأسي للمصدر» أدناه ثم أعد التحقق."],
 "Bounds do not have sensible vehicle proportions.":()=>["The model's width or height does not look like a car of this length. Check the vehicle length and orientation below and validate again.","عرض النموذج أو ارتفاعه لا يناسب سيارة بهذا الطول. راجع طول المركبة واتجاهها أدناه ثم أعد التحقق."],
 "Vehicle length must be between 2.5 and 8 metres.":()=>["Enter a vehicle length between 2.5 and 8 metres.","أدخل طول مركبة بين ٢٫٥ و٨ أمتار."],
 "Model scale is extreme.":()=>["The model's size is broken (extremely large or tiny). Choose another model.","حجم النموذج غير صالح (كبير جدًا أو صغير جدًا). اختر نموذجًا آخر."],
 "Invalid or extreme model bounds.":()=>["The model's size or position is broken. Choose another model.","حجم النموذج أو موضعه غير صالح. اختر نموذجًا آخر."],
 "Model exceeds the configured size limit.":()=>["The prepared file is too large. Choose a lighter model.","الملف المجهّز كبير جدًا. اختر نموذجًا أخف."],
 "Normalized model exceeds the configured size limit.":()=>["The prepared file is too large. Choose a lighter model.","الملف المجهّز كبير جدًا. اختر نموذجًا أخف."],
 "Textures exceed safe decoding limits or cannot be loaded.":()=>["The model's textures are too large or broken. Choose another model.","صور خامات النموذج كبيرة جدًا أو تالفة. اختر نموذجًا آخر."],
 "Animated or skinned models are not supported":()=>["Animated models are not supported. Choose a static model.","النماذج المتحركة غير مدعومة. اختر نموذجًا ثابتًا."],
 "Invalid viewer configuration":()=>["One of the settings below is not valid. Check them and validate again.","أحد الإعدادات أدناه غير صالح. راجعها ثم أعد التحقق."],
 "Protected surfaces were selected for body paint":()=>["The paint materials include glass, tyres, lights or interior. Remove those from \"Paint materials\" below and validate again.","خامات الطلاء تشمل الزجاج أو الإطارات أو الأضواء أو المقصورة. احذفها من «خامات الطلاء» أدناه ثم أعد التحقق."],
 "Unrelated geometry was recolored":()=>["Painting the body also changed other parts of the car. Check \"Paint materials\" and \"Paint nodes\" below and validate again.","تلوين الهيكل غيّر أجزاء أخرى من السيارة. راجع «خامات الطلاء» و«عناصر الطلاء» أدناه ثم أعد التحقق."],
 "Empty viewer":()=>["The 3D viewer showed nothing for this model. Choose another model.","لم يعرض العارض ثلاثي الأبعاد أي شيء لهذا النموذج. اختر نموذجًا آخر."],
 "Viewer errors or unexpected remote requests":()=>[`The 3D viewer hit an error while showing this model. ${again[0]}`,`حدث خطأ في العارض ثلاثي الأبعاد أثناء عرض النموذج. ${again[1]}`],
 "The 3D viewer check timed out.":()=>["The 3D viewer check took too long. Try again.","استغرق فحص العارض ثلاثي الأبعاد وقتًا طويلًا. حاول مجددًا."],
 "The production viewer could not render this asset.":()=>[`The 3D viewer could not show this model. ${again[0]}`,`تعذّر على العارض ثلاثي الأبعاد عرض هذا النموذج. ${again[1]}`],
 "The production viewer rejected this asset.":()=>[`The 3D viewer could not show this model. ${again[0]}`,`تعذّر على العارض ثلاثي الأبعاد عرض هذا النموذج. ${again[1]}`],
 "Part detection and quality validation could not complete.":()=>["Detecting the car's parts did not finish. Try again.","لم يكتمل اكتشاف قطع السيارة. حاول مجددًا."],
};
/** The saved reason in plain words; another backend message is shown as it is. null = no message saved (use the error code text). */
export const failureText=(f:ImportFailure|null|undefined,t:(en:string,ar:string)=>string)=>{
 const message=f?.message;if(!f||!message)return null;
 const plain=Object.entries(IMPORT_FAILURE_TEXT).find(([start])=>message.startsWith(start))?.[1](f);
 return plain?t(...plain):t(message,`تعذّر إكمال الاستيراد. التفاصيل التقنية: ${message}`);
};
