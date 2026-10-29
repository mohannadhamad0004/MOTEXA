import * as Store from "./SessionStore";
export type MechanicDocument = {
  id: string;
  kind: string;
  fileName: string;
  mimeType: string;
  size: number;
};
export type MechanicProfile = {
  id: string;
  userId: string;
  city: string;
  phoneNumber: string;
  specializations: string[];
  yearsOfExperience: number | null;
  experienceSummary: string;
  offersWorkshop: boolean;
  offersOnSite: boolean;
  offersOnline: boolean;
  workshopName: string;
  workshopAddress: string;
  coverageAreas: string[];
  verificationStatus: string;
  submittedAt: string | null;
  submissionVersion: number;
  reviewNotes: string | null;
  interviewResult: string | null;
  interviewNotes: string | null;
  canReceiveServices: boolean;
  documents: MechanicDocument[];
  user: { fullName: string; email: string; status: string };
  history: {
    id: string;
    action: string;
    createdAt: string;
    details: { notes?: string } | null;
  }[];
};
export async function mechanicApi<T = any>(
  route: string,
  method = "GET",
  body?: unknown,
  publicRequest = false,
): Promise<T> {
  const base = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "");
  if (!base) throw Error("API address is not configured.");
  const token = publicRequest
    ? null
    : await Store.getItemAsync("motexa_access_token");
  if (!publicRequest && !token) throw Error("Sign in again to continue.");
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(base + route, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: "Bearer " + token } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      signal: controller.signal,
    });
    const data = await response.json();
    if (!response.ok || !data.success)
      throw Error(data.message || "The request could not be completed.");
    return data;
  } finally {
    clearTimeout(timer);
  }
}
export const mechanicSpecializations = [
  ["PETROL_ENGINES", "Petrol engines", "محركات البنزين"],
  ["DIESEL_ENGINES", "Diesel engines", "محركات الديزل"],
  ["ELECTRIC_VEHICLES", "Electric vehicles", "المركبات الكهربائية"],
  ["TRANSMISSION", "Transmission", "ناقل الحركة"],
  ["AUTO_ELECTRICAL", "Auto electrical", "كهرباء السيارات"],
  ["SUSPENSION", "Suspension", "الهيئة ونظام التعليق"],
] as const;
