export type Language = "en" | "ar";

export const translations = {
  en: {
    common: {
      appName: "MOTEXA",
      tagline: "YOUR SMART AUTOMOTIVE COMPANION",
      email: "EMAIL ADDRESS",
      emailPlaceholder: "Enter your email address",
      password: "PASSWORD",
      english: "English",
      arabic: "العربية",
    },

    login: {
      adminPortal: "ADMIN PORTAL",
      welcome: "Welcome back.",
      description:
        "Sign in to manage your automotive ecosystem.",
      passwordPlaceholder: "Enter your password",
      forgotPassword: "Forgot password?",
      signIn: "Sign In",
      newAdmin: "New administrator?",
      createAccount: "Create account",
      secureAccess: "SECURE ADMIN ACCESS",
    },

    signup: {
      system: "ADMINISTRATION SYSTEM",
      title: "Create admin account.",
      description:
        "Set up your secure access to the MOTEXA management platform.",
      fullName: "FULL NAME",
      fullNamePlaceholder: "Enter your full name",
      passwordPlaceholder: "Create a password",
      confirmPassword: "CONFIRM PASSWORD",
      confirmPasswordPlaceholder: "Confirm your password",
      createAccount: "Create Account",
      alreadyHaveAccount: "Already have an account?",
      signIn: "Sign in",
      secureRegistration: "SECURE ADMIN REGISTRATION",
    },

    forgotPassword: {
      system: "SECURE ACCOUNT RECOVERY",
      title: "Forgot your password?",
      description:
        "No worries. Enter your email address and we'll send you instructions to reset your password.",
      sendResetLink: "Send Reset Link",
      securityMessage:
        "For your security, the reset link will only be sent to the email associated with your admin account.",
      backToSignIn: "Back to Sign In",
    },
  },

  ar: {
    common: {
      appName: "MOTEXA",
      tagline: "رفيقك الذكي لعالم السيارات",
      email: "البريد الإلكتروني",
      emailPlaceholder: "أدخل بريدك الإلكتروني",
      password: "كلمة المرور",
      english: "English",
      arabic: "العربية",
    },

    login: {
      adminPortal: "بوابة الإدارة",
      welcome: "مرحبًا بعودتك.",
      description:
        "سجّل الدخول لإدارة منظومة MOTEXA لخدمات السيارات.",
      passwordPlaceholder: "أدخل كلمة المرور",
      forgotPassword: "نسيت كلمة المرور؟",
      signIn: "تسجيل الدخول",
      newAdmin: "مسؤول جديد؟",
      createAccount: "إنشاء حساب",
      secureAccess: "دخول آمن للإدارة",
    },

    signup: {
      system: "نظام الإدارة",
      title: "إنشاء حساب مسؤول.",
      description:
        "أنشئ حسابك للوصول الآمن إلى منصة إدارة MOTEXA.",
      fullName: "الاسم الكامل",
      fullNamePlaceholder: "أدخل اسمك الكامل",
      passwordPlaceholder: "أنشئ كلمة مرور",
      confirmPassword: "تأكيد كلمة المرور",
      confirmPasswordPlaceholder: "أعد إدخال كلمة المرور",
      createAccount: "إنشاء الحساب",
      alreadyHaveAccount: "لديك حساب بالفعل؟",
      signIn: "تسجيل الدخول",
      secureRegistration: "تسجيل آمن للمسؤول",
    },

    forgotPassword: {
      system: "استعادة الحساب بأمان",
      title: "نسيت كلمة المرور؟",
      description:
        "لا تقلق. أدخل بريدك الإلكتروني وسنرسل لك تعليمات لإعادة تعيين كلمة المرور.",
      sendResetLink: "إرسال رابط الاستعادة",
      securityMessage:
        "لحماية حسابك، سيتم إرسال رابط إعادة التعيين فقط إلى البريد الإلكتروني المرتبط بحساب المسؤول.",
      backToSignIn: "العودة لتسجيل الدخول",
    },
  },
} as const;