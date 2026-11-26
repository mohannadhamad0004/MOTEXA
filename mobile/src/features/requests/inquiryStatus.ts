// A part inquiry's status as one chip (provider / admin screens).
import type { Tone } from "../../components/garage";
import type { InquiryStatus } from "./requestsService";

const S: Record<InquiryStatus, [Tone, string, string]> = { OPEN: ["warning", "Open", "مفتوح"], ANSWERED: ["success", "Answered", "تم الرد"], CLOSED: ["neutral", "Closed", "مغلق"] };
export const inquiryStatus = (s: InquiryStatus, t: (en: string, ar: string) => string) => ({ label: t(S[s][1], S[s][2]), tone: S[s][0] });
