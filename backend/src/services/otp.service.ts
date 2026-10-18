
import {
  createHmac,
  randomInt,
  timingSafeEqual,
} from "node:crypto";

export const OTP_EXPIRY_MINUTES = 5;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_SECONDS = 60;
export const OTP_MAX_REQUESTS_PER_HOUR = 5;

function getOtpSecret(): string {
  const secret = process.env.OTP_HASH_SECRET;

  if (!secret || !/^[a-f0-9]{64}$/i.test(secret)) {
    throw new Error(
      "OTP_HASH_SECRET must be a 64-character hexadecimal secret."
    );
  }

  return secret;
}

export function generateOtp(): string {
  return randomInt(0, 1_000_000)
    .toString()
    .padStart(6, "0");
}

export function hashOtp(
  invitationId: string,
  otp: string
): string {
  return createHmac("sha256", getOtpSecret())
    .update(`${invitationId}:${otp}`)
    .digest("hex");
}

export function verifyOtpHash(
  invitationId: string,
  otp: string,
  storedHash: string
): boolean {
  if (!/^\d{6}$/.test(otp)) {
    return false;
  }

  const expectedHash = hashOtp(invitationId, otp);

  if (!/^[a-f0-9]{64}$/i.test(storedHash)) {
    return false;
  }

  return timingSafeEqual(
    Buffer.from(expectedHash, "hex"),
    Buffer.from(storedHash, "hex")
  );
}

export function getOtpExpiryDate(): Date {
  return new Date(
    Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000
  );
}


