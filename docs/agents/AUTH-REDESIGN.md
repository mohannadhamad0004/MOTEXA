# AUTH REDESIGN — proposal (2026-11-20).

**Approved 2026-11-21 with 4 changes:** (1) email verification in this step: signup makes the account unverified (CUSTOMER, PENDING) and emails a code with the admin-invitation OTP rules; login is refused until the code is entered; signup always answers "Check your email for a code" (202, new or taken email). (2) ONE rate limiter stored in the DB (`RateLimit` table) for login and signup, per IP and per email (replaces the in-memory login limiter; no `SignupAttempt` table). (3) Apply screen warns that after approval the account becomes a provider account and loses the customer screens (use another email to keep booking); applying is blocked while the customer has an active request or order. (4) Test cleanup keeps audit rows (AGENTS.md §4.10).
**Stages:** A = customer signup + email code + one sign-in screen + choose-role deleted — DONE 2026-11-21 (STATUS.md). B = Work with MOTEXA + `POST /apply/:kind` + role promotion on approval — DONE 2026-11-21 (STATUS.md). C = remove old registration endpoints + all security tests — DONE 2026-11-21 (STATUS.md).

## 1. Audit
**How an account gets a role today (all server-side, role hard-coded per endpoint):** `auth/mechanic-registration.routes.ts:72` MECHANIC · `provider-registration.routes.ts:62` and `provider-signup.routes.ts:183/334` TOW_PROVIDER / PARTS_PROVIDER · `tow-dispatch.ts:141` TOW_DRIVER (a company creates it) · `auth.routes.ts:396` ADMIN (invitation + OTP, invitations are super-admin only: `admin-invitations.routes.ts:14`). **There is no customer signup:** `POST /auth/register` and `/auth/signup` → 404, and the "Create account" button of the customer form has no `onPress` (`mobile/src/app/auth/signup.tsx:356`). Customers exist only through the dev seed.

**Live role-escalation test (your :5000, throwaway email, deleted afterwards):** `role: ADMIN / TOW_ADMIN` on mechanic register → 400; `kind: ADMIN` on provider register → 400; provider register with `role: SUPER_ADMIN, status: ACTIVE, adminPermissions` → 201 but the account is **TOW_PROVIDER, ACTIVE, 0 permissions** (extras ignored). **No request can set its own role to anything it likes.** (`tow-signup` / `parts-signup` read from code only: role is a constant; not called live because they need large file bodies.)

**Issues:**
| # | Sev | Where | What |
|---|---|---|---|
| 1 | P1 | `signup.tsx:356` | Customers cannot register at all (dead button, no endpoint). |
| 2 | P1 | `mechanic-registration.routes.ts:72`, `provider-registration.routes.ts:62`, `provider-signup.routes.ts:183,334` | The provider role is granted at signup, before any review. Safe today only because every provider route re-checks approval (e.g. `requireVerifiedMechanic`); one forgotten check = an unapproved provider acts. |
| 3 | P1 | all four signups (`emailVerifiedAt` stays null) | No email verification: anyone can register any email (squat a victim's address; password reset goes to it). |
| 4 | P2 | `mechanic-registration.routes.ts:13-29`, `provider-registration.routes.ts:9-22` | Rate limit = per-IP, in memory (lost on restart), nothing per email; 4 copies of the password rules. |
| 5 | P2 | `mechanic-registration.routes.ts:93`, `provider-registration.routes.ts:77` | 201 vs 409 tells an attacker whether an email is registered. |
| 6 | P3 | `login.tsx:169-184`, `choose-role.tsx` | The role is picked on the client and "checked" on the client (cosmetic: the server returns the real role), but the screen offers admin roles to everyone. |

## 2. New flow
- **One sign-in screen.** No role picker. After login the app calls `landingFor(role from the server)` (exists). Links: "Create account", "Work with MOTEXA".
- **Sign up = CUSTOMER only** (`POST /auth/register`: name, email, optional phone, password). The role is a constant in the handler; `role`, `status`, `permissions` in the body are never read. Rate limit per IP **and** per email, stored in the DB; same answer whether the email exists or not (the email verification code is the next step, it also fixes #3).
- **Work with MOTEXA** (Profile + sign-in screen): choose mechanic / garage (later) / tow company / parts shop → the existing application screens and review queues, but attached to the signed-in customer (`POST /apply/:kind`, auth required, creates the DRAFT profile). Status shows in Profile.
- **Role after approval, my recommendation: ONE role field, promoted on approval** (customer → MECHANIC / TOW_PROVIDER / PARTS_PROVIDER by the existing admin approve endpoints, audited). Simplest and safest: no new table, every existing guard (`role === ...`, 40+) keeps working, and nobody holds a provider role before an admin said yes (fixes #2). Cost: a provider can no longer use the customer screens with the same account (they use a second email). The alternative, a user↔role table, means rewriting every guard; not worth it now.
- **Admins** are never created by signup: invitation + OTP by the super admin only (unchanged).
- **Existing accounts** (seed, and already-registered providers with DRAFT profiles) keep working: the old registration endpoints stay until the screens are gone, then are removed; old rows are not touched.

## 3. Changes
**Delete / merge (mobile):** `choose-role.tsx` (delete), `auth/signup.tsx` (merge into one customer form; drop the role chooser and the admin-role redirect), `components/MechanicRegistration.tsx` + `provider/register.tsx` (account step deleted; the wizard steps stay as the "apply" screens), `login.tsx` (drop `selectedRole`, role titles, "Back to roles", client role check), `app/index.tsx` (intro → sign-in), old `/mechanics-admin` route; new: Profile → "Work with MOTEXA" screen.
**Endpoints:** add `POST /auth/register`, `POST /apply/:kind`; `/auth/me` also returns the user's applications `{kind,status}`; approve endpoints (`mechanics.routes.ts` decision, `provider-review.routes.ts` approve) set the role; application endpoints (`mechanics.routes.ts own()`, provider onboarding guards) accept a CUSTOMER who owns the draft; remove `/auth/mechanic/register`, `/auth/provider/register` and the account creation inside `tow-signup` / `parts-signup`.
**Migration (additive):** `User.phone String?` (optional signup phone) and a small `SignupAttempt` table for the per-email limit. Nothing dropped.
**Tests to add:** signup with `role` = ADMIN / SUPER_ADMIN / TOW_ADMIN / MECHANIC / TOW_DRIVER / lowercase / array / object, plus `status`, `adminPermissions` → always CUSTOMER, ACTIVE, 0 permissions; apply needs a token (401) and does not change the role; role changes only after an approval by the right admin (other admins and the applicant get 403); a source scan fails if any new `user.create` sets ADMIN / SUPER_ADMIN / a provider role outside the allowed files; seed logins still work; same response for a taken email.
**UI:** every new screen EN + AR (RTL), light + dark, 390 px, checked live as before.

Test record: the throwaway account was created and deleted (its 1 audit row was deleted with it; one `TEST_DATA_REMOVED` row written).
