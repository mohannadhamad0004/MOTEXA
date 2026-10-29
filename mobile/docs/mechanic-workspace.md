# Mechanics administration workspace

The approved MOTEXA cream/bronze preview is implemented with React Native components. The existing administrator sign-in destination `/mechanics-admin` uses the live workspace; `/admin/mechanics` reuses it for authorized super admins. Registration, admin invitations, mail transport and password recovery retain their existing routes and configuration.

## Review journey

1. Sign in as an active admin with `MANAGE_MECHANICS` (or a super admin).
2. Open a submitted application, inspect private documents, and record document reviews.
3. Add professional multiple-choice questions to the question bank, with four distinct answers, a correct answer and a specialty. Questions can be edited or deactivated.
4. Select exactly two active questions matching the applicant's specialties or general safety. Preview and assign the test.
5. The mechanic signs in normally and chooses **Open test & administrator conversation** in their application. Both answers are submitted once.
6. The admin sees the calculated score, records a professional assessment and notes, then manually approves, requests completion or rejects. Passing answers never automatically approve an account.
7. Conversations, notifications, document reviews, test snapshots and decisions persist in PostgreSQL. Approved mechanics can be suspended and reactivated with the existing service-access gate enforced.

Question changes do not modify previously assigned tests. Submission versions prevent old tests from being used after resubmission. New test-based approvals require current reviewed documents and a reviewed, passed test. Existing interview-based records remain compatible with the prior review API.

## Operation

- Backend: `npm run dev` from `backend` (configured port 5055).
- Mobile: `npx expo start --lan --clear` from `mobile`; keep the existing `EXPO_PUBLIC_API_URL` pointing to the backend on the same network.
- Web build: `node node_modules/expo/bin/cli export --platform web --output-dir dist` from `mobile`.
- Local static web viewer: `node scripts/serve-preview.cjs` from `mobile`, then open `http://127.0.0.1:8140/auth/login?selectedRole=mechanics-admin`.
- Deploy database additions with `npx prisma migrate deploy` and regenerate the client from `backend` on another checkout. No destructive reset is needed.

The real question bank starts empty; an authorized admin supplies professionally reviewed questions. Sample questions/accounts used by tests are removed. Notifications are **in-app**, refreshed while the relevant screen is open (not OS push notifications). Conversation history is paginated; administrator notifications show the most recent 50. Unsent test choices are screen-local until submitted. Closed screens do not promise background delivery or push alerts.

## Validation

- Both TypeScript projects compile; the Expo web export succeeds.
- `backend/tests/mechanic-workflow.test.mjs`: department and owner authorization, exactly-two assignment, immutable snapshots, hidden answer keys, single submission, document review, manual approval, messages, notifications, stale version rejection and suspension/reactivation.
- `mobile/tests/mechanic-workspace-flow.cjs`: real independent admin/mechanic logins against PostgreSQL and Express, document reviews, test delivery/submission, score, professional assessment, two-way conversation, approval, question add/edit/deactivation, filtering, Arabic/dark appearance and multiple viewport sizes.
- Existing mechanic registration and 16 password-reset regressions pass. Tests do not send real mail. Fixture users/documents/messages/questions/notifications are cleaned up.

No commit or push is performed by this integration.
