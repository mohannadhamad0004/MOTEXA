import ActivationExperience from '../../components/ActivationExperience';
import {VisualProvider} from '../../components/MotexaVisual';
import {useLanguage} from '../../i18n/LanguageContext';
import {useEffect,useState} from 'react';
import {router,useLocalSearchParams} from 'expo-router';
import MotexaDialog from '../../components/MotexaDialog';
const API = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "");

type Invitation = {
  fullName: string;
  email: string;
  permission: string;
};

type Step = "request" | "verify" | "password" | "complete";

export default function AdminActivationScreen() {
  const params = useLocalSearchParams<{ token?: string | string[] }>();
  const token = Array.isArray(params.token)
    ? params.token[0]
    : params.token;

  const { isArabic: ar } = useLanguage();
  const [checking, setChecking] = useState(true);
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [verifyError, setVerifyError] = useState("");

  const [step, setStep] = useState<Step>("request");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lastSentAt, setLastSentAt] = useState<number | null>(null);

  const [dialog, setDialog] = useState({
    visible: false,
    success: false,
    message: "",
  });

  const t = (en: string, arabic: string) => (ar ? arabic : en);

  const showDialog = (message: string, success = false) => {
    setDialog({ visible: true, success, message });
  };

  const department = (permission: string) => {
    const departments: Record<string, [string, string]> = {
      MANAGE_MECHANICS: ["Mechanics Management", "إدارة الميكانيكيين"],
      MANAGE_SPARE_PARTS: ["Spare Parts Management", "إدارة قطع الغيار"],
      MANAGE_TOWING: ["Towing Management", "إدارة خدمات السحب"],
    };

    const value = departments[permission];
    return value ? t(value[0], value[1]) : permission;
  };

  useEffect(() => {
    let active = true;

    async function verifyInvitation() {
      if (!token || !API) {
        setVerifyError("Missing invitation token or API configuration.");
        setChecking(false);
        return;
      }

      try {
        const response = await fetch(
          `${API}/api/auth/admin/verify-invitation`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token }),
          }
        );

        const data = await response.json();
        if (!active) return;

        if (!response.ok) {
          setVerifyError(
            data.message || "Invitation is invalid or expired."
          );
          return;
        }

        const details = data.invitation || data;

        if (!details.email || !details.fullName) {
          setVerifyError("Incomplete invitation details.");
          return;
        }

        setInvitation({
          fullName: details.fullName,
          email: details.email,
          permission: details.permission || "",
        });
      } catch {
        if (active) {
          setVerifyError("Unable to connect to the server.");
        }
      } finally {
        if (active) setChecking(false);
      }
    }

    verifyInvitation();

    return () => {
      active = false;
    };
  }, [token]);

  const post = async (
    endpoint: string,
    body: Record<string, string>
  ) => {
    if (!API) throw new Error("API configuration is missing.");

    const response = await fetch(`${API}/api/auth/admin/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || data.error || "Request failed.");
    }

    return data;
  };

  const requestOtp = async () => {
    if (!token || loading) return;

    if (lastSentAt && Date.now() - lastSentAt < 60000) {
      showDialog(
        t(
          "Please wait 60 seconds before requesting another code.",
          "يرجى الانتظار 60 ثانية قبل طلب رمز جديد."
        )
      );
      return;
    }

    try {
      setLoading(true);

      await post("request-otp", { token });

      setOtp("");
      setLastSentAt(Date.now());
      setStep("verify");

      showDialog(
        t(
          "A 6-digit verification code was sent to your email. It expires in 5 minutes.",
          "تم إرسال رمز تحقق من 6 أرقام إلى بريدك الإلكتروني. تنتهي صلاحيته خلال 5 دقائق."
        )
      );
    } catch (error) {
      showDialog(
        error instanceof Error
          ? error.message
          : t("Unable to send code.", "تعذر إرسال الرمز.")
      );
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (!token || loading) return;

    if (!/^\d{6}$/.test(otp)) {
      showDialog(
        t(
          "Enter the 6-digit verification code.",
          "أدخلي رمز التحقق المكوّن من 6 أرقام."
        )
      );
      return;
    }

    try {
      setLoading(true);

      await post("verify-otp", { token, otp });

      setStep("password");
      setOtp("");
    } catch (error) {
      showDialog(
        error instanceof Error
          ? error.message
          : t("Verification failed.", "فشل التحقق من الرمز.")
      );
    } finally {
      setLoading(false);
    }
  };

  const activate = async () => {
    if (!token || loading) return;

    if (
      password.length < 12 ||
      !/[A-Z]/.test(password) ||
      !/[a-z]/.test(password) ||
      !/[0-9]/.test(password) ||
      !/[^A-Za-z0-9]/.test(password)
    ) {
      showDialog(
        t(
          "Password must have at least 12 characters, uppercase and lowercase letters, a number, and a symbol.",
          "يجب أن تحتوي كلمة المرور على 12 حرفًا على الأقل، وحرف كبير وصغير، ورقم ورمز خاص."
        )
      );
      return;
    }

    if (password !== confirmPassword) {
      showDialog(
        t(
          "Passwords do not match.",
          "كلمتا المرور غير متطابقتين."
        )
      );
      return;
    }

    try {
      setLoading(true);

      await post("activate", { token, password });

      setPassword("");
      setConfirmPassword("");
      setStep("complete");

      showDialog(
        t(
          "Your administrator account has been activated successfully. You can now sign in.",
          "تم تفعيل حساب الإدارة بنجاح. يمكنك الآن تسجيل الدخول."
        ),
        true
      );
    } catch (error) {
      showDialog(
        error instanceof Error
          ? error.message
          : t("Activation failed.", "فشل تفعيل الحساب.")
      );
    } finally {
      setLoading(false);
    }
  };

  return <VisualProvider>
    <ActivationExperience checking={checking} invitation={invitation} verifyError={verifyError} step={step} otp={otp} password={password} confirmPassword={confirmPassword} showPassword={showPassword} loading={loading} lastSentAt={lastSentAt} departmentLabel={invitation?department(invitation.permission):''}
      onOtpChange={setOtp} onPasswordChange={setPassword} onConfirmChange={setConfirmPassword} onTogglePassword={()=>setShowPassword(value=>!value)}
      onRequestOtp={requestOtp} onVerifyOtp={verifyOtp} onActivate={activate} onBack={()=>router.replace('/choose-role')} onSignIn={()=>router.replace('/auth/login')}/>
      <MotexaDialog
        visible={dialog.visible}
        type={dialog.success ? "success" : "error"}
        title={
          dialog.success
            ? t("Account Activated", "تم تفعيل الحساب")
            : t("Notice", "تنبيه")
        }
        message={dialog.message}
        confirmText={t("Continue", "متابعة")}
        cancelText={t("Close", "إغلاق")}
        onConfirm={() => {
          const success = dialog.success;
          setDialog((previous) => ({ ...previous, visible: false }));
          if (success) router.replace("/auth/login");
        }}
        onCancel={() => {
          const success = dialog.success;
          setDialog((previous) => ({ ...previous, visible: false }));
          if (success) router.replace("/auth/login");
        }}
      />
  </VisualProvider>;
}
