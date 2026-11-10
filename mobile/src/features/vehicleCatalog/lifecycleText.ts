export const THREE_D_ERRORS:Record<string,readonly[string,string]>={
 NO_VEHICLE_3D:["This car has no published 3D model. Request your car in 3D from Garage.","لا يوجد نموذج ثلاثي الأبعاد منشور لهذه السيارة. اطلب نموذج سيارتك من الكراج."],
 NO_3D_CAR:["This car has no published 3D model yet.","لا يوجد نموذج ثلاثي الأبعاد منشور لهذه السيارة بعد."],
 NO_ACCESSORY_3D:["This product has no published accessory model yet.","لا يوجد نموذج ثلاثي الأبعاد منشور لهذه القطعة بعد."],
 NO_COMPATIBLE_GARAGE_CAR:["No compatible Garage car is available. Add or choose a compatible car.","لا توجد سيارة متوافقة في كراجك. أضف سيارة متوافقة أو اخترها."],
 PENDING_3D_REQUEST:["Your 3D request is awaiting review.","طلبك ثلاثي الأبعاد بانتظار المراجعة."],
 DUPLICATE_REQUEST:["A request or reviewable candidate already exists for this generation. Review it before starting another.","يوجد طلب أو نموذج قيد المراجعة لهذا الجيل. راجعه قبل بدء محاولة أخرى."],
 GENERATION_NOT_APPROVED:["Parts Admin must approve this request before generation.","يجب أن توافق إدارة القطع على الطلب قبل الإنشاء."],
 INITIAL_REVIEW_REQUIRED:["Parts Admin must approve this request before generation.","يجب أن توافق إدارة القطع على الطلب قبل الإنشاء."],
 GENERATION_ALREADY_RUNNING:["Generation is already running. This is the same task.","الإنشاء جارٍ بالفعل. هذه المهمة نفسها."],
 GENERATION_FAILED:["Generation failed. Review the provider state before retrying.","تعذّر الإنشاء. راجع حالة مزود الخدمة قبل إعادة المحاولة."],
 PROVIDER_REQUEST_UNCONFIRMED:["The provider request was not confirmed. Check Meshy before explicitly starting another paid attempt.","لم يتأكد طلب مزود الخدمة. تحقق من Meshy قبل بدء محاولة مدفوعة أخرى صراحةً."],
 FIT_FAILED:["The accessory did not pass the fit or clearance checks for this car.","لم تجتز القطعة فحوص التركيب أو المسافة الآمنة لهذه السيارة."],
 FIT_NOT_READY:["The fit is missing or outdated. Parts Admin must compute it again.","التركيب غير جاهز أو قديم. يجب أن تعيد إدارة القطع حسابه."],
 FIT_REVIEW_REQUIRED:["The fit requires Parts Admin review before publication or preview.","يتطلب التركيب مراجعة إدارة القطع قبل النشر أو المعاينة."],
 PRIVATE_ASSET:["This private asset is available only to its owner and Parts Admin.","هذا الملف الخاص متاح فقط لمالكه وإدارة القطع."],
 PUBLICATION_BLOCKED:["Publication is blocked. Check validation, current fits and active vehicle records.","النشر محظور. تحقق من صلاحية النموذج والتركيب وسجلات المركبة النشطة."],
 MODEL_REFERENCED:["This model has references or publication history. Deactivate it; hard deletion is refused.","يرتبط هذا النموذج بسجلات أو سجل نشر. عطّله؛ الحذف النهائي مرفوض."],
 DELETE_BLOCKED:["This record has generation or publication history and cannot be deleted. Deactivate it instead.","يحتوي السجل على تاريخ إنشاء أو نشر ولا يمكن حذفه. عطّله بدلًا من ذلك."],
 SOURCE_INVALID:["The model source or redistribution permission is invalid.","مصدر النموذج أو إذن إعادة التوزيع غير صالح."],
 PART_MAP_STALE:["This car needs a current confirmed map of its stock parts before this preview is available.","تحتاج هذه السيارة خريطة حديثة مؤكدة لقطعها الأصلية قبل إتاحة المعاينة."],
 STALE_PART_MAP:["The vehicle model changed. Reload and confirm its current part map.","تغير نموذج السيارة. أعد التحميل وأكّد خريطة القطع الحالية."],
 CATALOG_REVISION_STALE:["The model changed during review. Reload before saving.","تغير النموذج أثناء المراجعة. أعد التحميل قبل الحفظ."],
 FIT_ADMIN_ONLY:["Only Parts Admin can edit accessory fits.","يمكن لإدارة القطع فقط تعديل تركيب الإكسسوارات."],
};
export function threeDError(error:unknown,t:(en:string,ar:string)=>string){
 const e=error as {data?:{code?:string};code?:string;message?:string};const pair=THREE_D_ERRORS[e?.data?.code??e?.code??""];
 return pair?t(...pair):t(e?.message??"Could not complete the 3D action. Try again.","تعذّر إكمال الإجراء ثلاثي الأبعاد. تحقق من التفاصيل وحاول مجددًا.");
}
export function threeDReason(code:string|null|undefined,t:(en:string,ar:string)=>string){return t(...(THREE_D_ERRORS[code??""]??THREE_D_ERRORS.FIT_REVIEW_REQUIRED));}
