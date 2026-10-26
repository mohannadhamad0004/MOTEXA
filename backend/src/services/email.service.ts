import { Resend } from "resend";
import nodemailer from "nodemailer";

async function deliverEmail(message: {
  to: string[];
  subject: string;
  text: string;
}) {
  if (process.env.SMTP_HOST) {
    const user = process.env.SMTP_USER?.trim();
    const pass = process.env.SMTP_PASS?.replace(/\s/g, "");
    const port = Number(process.env.SMTP_PORT || 465);
    if (!user || !pass || ![465, 587].includes(port))
      throw new Error("SMTP configuration is incomplete.");
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      requireTLS: true,
      auth: { user, pass },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 20000,
      logger: false,
      debug: false,
    });
    try {
      const result = await transport.sendMail({
        ...message,
        from: { name: "MOTEXA", address: user },
      });
      if (!result.accepted.length || result.rejected.length)
        throw new Error("Email recipient was not accepted.");
      return { data: { id: result.messageId }, error: null };
    } catch (error) {
      const safe = error as { code?: string; responseCode?: number };
      console.error("SMTP delivery failed", {
        code: safe.code,
        responseCode: safe.responseCode,
      });
      throw new Error("Email could not be sent through SMTP.");
    } finally {
      transport.close();
    }
  }
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  // Development only: with no mail provider configured, print the message (invitation link, OTP) instead of failing.
  if ((!apiKey || !from) && process.env.NODE_ENV !== "production") {
    console.log("[DEV EMAIL] to=" + message.to.join(",") + " subject=" + message.subject + " | " + message.text.split("\n").join(" "));
    return { data: { id: "dev-console" }, error: null };
  }
  if (!apiKey || !from)
    throw new Error("Resend email configuration is missing.");
  return new Resend(apiKey).emails.send({
    ...message,
    from: `MOTEXA <${from}>`,
  });
}

type InvitationEmailInput = {
  to: string;
  fullName: string;
  permission: string;
  activationLink: string;
  expoGoActivationLink?: string;
};

const departmentNames: Record<string, string> = {
  MANAGE_MECHANICS: "Mechanics Management",
  MANAGE_SPARE_PARTS: "Spare Parts Management",
  MANAGE_TOWING: "Towing Management",
};

export async function sendAdminInvitationEmail({
  to,
  fullName,
  permission,
  activationLink,
  expoGoActivationLink,
}: InvitationEmailInput) {
  const department = departmentNames[permission] ?? "Administration";

  const { data, error } = await deliverEmail({
    to: [to],
    subject: "MOTEXA | Administrator Invitation",
    text: [
      `Hello ${fullName},`,
      "",
      "You have been invited to join MOTEXA as an administrator.",
      `Department: ${department}`,
      "",
      "Activate your account using this link:",
      activationLink,
      ...(expoGoActivationLink
        ? ["", "Expo Go test only (same Wi-Fi):", expoGoActivationLink]
        : []),
      "",
      "This invitation expires in 24 hours.",
      "If you did not expect this invitation, ignore this email.",
      "",
      "MOTEXA Team",
    ].join("\n"),
  });

  if (error || !data?.id) {
    console.error("Resend invitation delivery failed:", {
      name: error?.name,
      message: error?.message,
    });

    throw new Error("Failed to send administrator invitation email.");
  }

  return { emailId: data.id };
}

type OtpEmailInput = {
  to: string;
  fullName: string;
  otp: string;
};

export async function sendAdminOtpEmail({ to, fullName, otp }: OtpEmailInput) {
  const { data, error } = await deliverEmail({
    to: [to],
    subject: "MOTEXA | Administrator Verification Code",
    text: [
      `Hello ${fullName},`,
      "",
      "Your MOTEXA administrator verification code is:",
      "",
      otp,
      "",
      "This code expires in 5 minutes.",
      "Never share this code with anyone.",
      "",
      "If you did not request this code, ignore this email.",
      "",
      "MOTEXA Security Team",
    ].join("\n"),
  });

  if (error || !data?.id) {
    console.error("Resend OTP email error:", {
      name: error?.name,
      message: error?.message,
    });

    throw new Error("Failed to send administrator OTP email.");
  }

  return { emailId: data.id };
}

// Password recovery is deliberately separate from administrator invitation verification.
export async function sendPasswordResetOtpEmail({
  to,
  fullName,
  otp,
}: OtpEmailInput) {
  const { data, error } = await deliverEmail({
    to: [to],
    subject: "MOTEXA | Password Recovery Code",
    text: [
      `Hello ${fullName},`,
      "",
      "A password reset was requested for your MOTEXA account.",
      "Your password recovery verification code is:",
      "",
      otp,
      "",
      "This code expires in 5 minutes. Never share it with anyone.",
      "This code is for password recovery only, not for administrator invitation activation.",
      "If you did not request a password reset, ignore this email. Your password has not changed.",
      "",
      "تم طلب استعادة كلمة مرور حسابك في MOTEXA.",
      "رمز التحقق أعلاه صالح لمدة 5 دقائق. لا تشاركه مع أي شخص.",
      "إذا لم تطلب الاستعادة، تجاهل هذه الرسالة. لم يتم تغيير كلمة المرور.",
      "",
      "MOTEXA Security Team",
    ].join("\n"),
  });
  if (error || !data?.id)
    throw new Error("Password recovery email could not be delivered.");
  return { emailId: data.id };
}
