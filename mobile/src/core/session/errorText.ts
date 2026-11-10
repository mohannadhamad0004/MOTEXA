// Server `errorCode` -> English / Arabic text (backend/src/services/error-codes.ts holds the codes).
// api() applies it to every failed call, so screens that show `e.message` are localised without changes.
// Unknown or missing code: the server's English message is kept.
export const ERROR_TEXT: Record<string, readonly [string, string]> = {
  PRODUCT_PRICE_INVALID: ["Enter a price of 0 or more, with up to two decimal places and no letters.", "أدخل سعرًا من صفر فأكثر، بمنزلتين عشريتين كحد أقصى ودون أحرف."],
  PRODUCT_STOCK_INVALID: ["Enter a whole stock quantity from 0 to 1,000,000, without decimals or letters.", "أدخل كمية صحيحة من صفر إلى مليون، دون كسور أو أحرف."],
  TRUCK_UNAVAILABLE: ["This truck is not available. Choose an approved, available truck.", "هذه الشاحنة غير متاحة. اختر شاحنة معتمدة ومتاحة."],
  DOCUMENTS_EXPIRED: ["This truck's documents have expired, so it cannot take new work until they are renewed.", "انتهت صلاحية مستندات هذه الشاحنة، فلا يمكنها استلام مهام جديدة حتى تُجدَّد."],
  REQUEST_NOT_WAITING: ["This request is no longer waiting for an answer.", "لم يعد هذا الطلب بانتظار الرد."],
  ACTIVE_REQUEST_EXISTS: ["You already have an active request with this company.", "لديك طلب نشط مع هذه الشركة بالفعل."],
  NO_TRUCK_AVAILABLE: ["This company has no available truck right now.", "لا توجد شاحنة متاحة لدى هذه الشركة الآن."],
  NO_DRIVER_AVAILABLE: ["No driver is available right now. Choose a company or try again soon.", "لا يوجد سائق متاح الآن. اختر شركة أو حاول لاحقًا."],
  CANCEL_NOT_ALLOWED: ["This request can no longer be cancelled.", "لا يمكن إلغاء هذا الطلب الآن."],
  CANCEL_REASON_REQUIRED: ["Please give a reason: your driver is already on the way.", "يرجى كتابة السبب: سائقك في الطريق بالفعل."],
  NOT_APPROVED: ["Your application has not been approved yet.", "لم تتم الموافقة على طلبك بعد."],
  LICENCE_NOT_APPROVED: ["Your licence is not approved yet.", "لم تتم الموافقة على رخصتك بعد."],
  NO_TRUCK_LINKED: ["You have no truck linked. Ask your company to link one.", "لا توجد شاحنة مرتبطة بك. اطلب من شركتك ربط شاحنة."],
  DRIVER_NOT_FREE: ["This driver is not free right now.", "هذا السائق غير متفرغ الآن."],
  JOB_CHANGED: ["The job changed meanwhile. Refresh and try again.", "تغيّرت المهمة في هذه الأثناء. حدّث الصفحة وحاول مجددًا."],
  JOB_NOT_WAITING: ["This job is no longer waiting for you.", "لم تعد هذه المهمة بانتظارك."],
  TRUCK_CANT_WORK: ["Your truck can't take work right now (not available, not approved or a document expired).", "لا يمكن لشاحنتك استلام مهام الآن (غير متاحة أو غير معتمدة أو انتهت صلاحية مستند)."],
  CHAT_CLOSED: ["Chat is open while the job is active.", "المحادثة متاحة أثناء المهمة النشطة فقط."],
  ALREADY_RATED: ["You already rated this tow.", "لقد قيّمت هذا السحب من قبل."],
  ORDER_CHANGED: ["The order changed meanwhile. Refresh and try again.", "تغيّر الطلب في هذه الأثناء. حدّث الصفحة وحاول مجددًا."],
  NOT_ENOUGH_STOCK: ["Not enough stock to accept this order.", "المخزون غير كافٍ لقبول هذا الطلب."],
  ORDER_CANT_CANCEL: ["The shop already accepted this order. Ask the shop in the chat.", "قبل المتجر الطلب بالفعل. اسأل المتجر في المحادثة."],
  ORDER_REASON_REQUIRED: ["Give the customer a reason.", "اكتب سببًا للزبون."],
  SHOP_NO_DELIVERY: ["This shop does not deliver. Choose pickup.", "هذا المتجر لا يوصّل. اختر الاستلام من المتجر."],
  TOO_MANY_WAITING: ["You already have several orders waiting at this shop. Wait for an answer first.", "لديك عدة طلبات بانتظار الرد لدى هذا المتجر. انتظر الرد أولًا."],
  PART_UNAVAILABLE: ["A part in your cart is no longer sold by this shop.", "قطعة في سلتك لم تعد متوفرة لدى هذا المتجر."],
  PHONE_INVALID: ["A valid contact phone number is required.", "يلزم رقم هاتف صحيح للتواصل."],
  PICKUP_REQUIRED: ["Pickup address is required.", "عنوان الاستلام مطلوب."],
  DESTINATION_REQUIRED: ["Destination address is required.", "عنوان الوجهة مطلوب."],
  CAR_REQUIRED: ["Car make and model are required.", "ماركة السيارة وطرازها مطلوبان."],
  DRIVER_NOT_FOUND: ["Driver not found.", "السائق غير موجود."],
  COMPANY_NOT_FOUND: ["Company not found.", "الشركة غير موجودة."],
  ORDER_NOT_FOUND: ["Order not found.", "الطلب غير موجود."],
  JOB_NOT_FOUND: ["Job not found.", "المهمة غير موجودة."],
  REQUEST_NOT_FOUND: ["Request not found.", "الطلب غير موجود."],
  SERVER_ERROR: ["Something went wrong on our side. Please try again.", "حدث خطأ من جهتنا. يرجى المحاولة مرة أخرى."],
};
/** The text for a server error in `language` ("ar" or anything else = English); `fallback` when the code is unknown. */
export const errorTextFor = (code: unknown, language: string | null, fallback: string) => {
  const row = typeof code === "string" ? ERROR_TEXT[code] : undefined;
  return row ? (language === "ar" ? row[1] : row[0]) : fallback;
};
