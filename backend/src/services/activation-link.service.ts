export function activationDestination(token: unknown, expoGoBaseUrl?: string): string | null {
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/i.test(token)) return null;
  if (expoGoBaseUrl) {
    const base = new URL(expoGoBaseUrl);
    if (!['exp:', 'exps:'].includes(base.protocol) || !base.hostname || base.username || base.password || base.search || base.hash || !['', '/'].includes(base.pathname)) {
      throw new Error('EXPO_GO_BASE_URL must be an exp:// or exps:// project origin.');
    }
    return `${base.toString().replace(/\/$/, '')}/--/auth/admin-activation?token=${encodeURIComponent(token)}`;
  }
  return `motexa://auth/admin-activation?token=${encodeURIComponent(token)}`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));
}

export function activationOpenPage(destination: string | null, development: boolean): string {
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><meta name="robots" content="noindex,nofollow"><title>MOTEXA | تفعيل حساب المسؤول</title><style>body{margin:0;min-height:100dvh;display:grid;place-items:center;background:#dfcfb7;color:#3c2a1c;font-family:system-ui,sans-serif}main{box-sizing:border-box;width:min(92%,450px);padding:32px;border-radius:26px;background:#fff9ef;border:1px solid #c8aa80}small{letter-spacing:3px;color:#8a5c31}h1{font-size:25px;line-height:1.6}p{line-height:1.9;color:#70583f}a{display:block;text-align:center;background:#49301d;color:#fff6e8;padding:17px;border-radius:18px;text-decoration:none;font-weight:700;margin-top:24px}.en{direction:ltr;text-align:left;font-size:14px}</style></head><body><main><small>MOTEXA</small><h1>${destination?'أكمل تفعيل حسابك':'رابط الدعوة غير صالح'}</h1><p>${destination?'اضغط الزر لفتح شاشة التفعيل داخل التطبيق. سيطلب التطبيق رمز التحقق ثم كلمة مرور جديدة.':'افتح رابط الدعوة الكامل من البريد الإلكتروني.'}</p>${destination?`<a href="${escapeHtml(destination)}">${development?'فتح MOTEXA في Expo Go':'فتح تطبيق MOTEXA'}</a>`:''}<p class="en">${destination?'Open your invitation in MOTEXA, verify the email code, and set your password.':'Please open the complete invitation from your email.'}</p>${development?'<p>للاختبار: افتح الرابط على الهاتف المتصل بنفس شبكة الكمبيوتر، واترك Expo Go والخادم يعملان.</p>':''}</main></body></html>`;
}
