import { mechanicApi, type MechanicProfile } from "./mechanic-api";
export const workflow = <T = any>(
  route: string,
  method = "GET",
  body?: unknown,
) => mechanicApi<T>("/api/mechanic-workflow" + route, method, body);
export type Question = {
  code?: string;
  explanation: string;
  sourceUrl: string;
  sourceReference: string;
  difficulty: string;
  reviewStatus: string;
  reviewerName: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  id: string;
  prompt: string;
  specialization: string;
  options: string[];
  correctIndex: number;
  active: boolean;
  revision: number;
};
export type ProfessionalTest = {
  id: string;
  submissionVersion: number;
  attempt: number;
  submittedAt: string | null;
  assignedAt: string;
  score: number | null;
  reviewedAt: string | null;
  assessment: string | null;
  reviewNotes: string | null;
  items: {
    id: string;
    prompt: string;
    options: string[];
    correctIndex?: number;
    answerIndex: number | null;
  }[];
};
export type ConversationMessage = {
  id: string;
  body: string;
  senderId: string;
  createdAt: string;
  sender: { id: string; fullName: string; role: string };
};
export type WorkflowNotice = {
  id: string;
  title: string;
  body: string;
  relatedUserId: string | null;
  kind: string;
  readAt: string | null;
  createdAt: string;
};
export type ApplicationSummary = {
  id: string;
  userId: string;
  city: string;
  specializations: string[];
  yearsOfExperience: number | null;
  verificationStatus: string;
  submissionVersion: number;
  submittedAt: string;
  offersWorkshop: boolean;
  offersOnSite: boolean;
  offersOnline: boolean;
  interviewResult: string | null;
  documents: { id: string; kind: string }[];
  tests: Pick<
    ProfessionalTest,
    | "id"
    | "submissionVersion"
    | "submittedAt"
    | "reviewedAt"
    | "score"
    | "assessment"
  >[];
  user: { fullName: string; email: string };
};
export async function getWorkflowDetail(userId: string) {
  const [data, tests, reviews] = await Promise.all([
    mechanicApi<{ profile: MechanicProfile }>("/api/mechanics/admin/" + userId),
    workflow<{ tests: ProfessionalTest[] }>(
      "/applications/" + userId + "/tests",
    ),
    workflow<{ reviewedDocumentIds: string[] }>(
      "/applications/" + userId + "/reviews",
    ),
  ]);
  return {
    profile: data.profile,
    tests: tests.tests,
    reviewed: reviews.reviewedDocumentIds,
  };
}
