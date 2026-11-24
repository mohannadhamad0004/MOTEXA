# 07 — 30 likely defence questions, with honest answers

Each answer is short and based on the real code. File names are given so you can open them if the committee asks for proof.

---

### Idea and architecture

**1. What problem does MOTEXA solve, and for whom?**
Car owners in Palestine have no single trusted place to find a mechanic, buy a part that really fits their car, or call a tow truck.
MOTEXA puts the three in one app, and MOTEXA's own admins verify every provider first (documents, interview for mechanics, truck
papers for tow companies). Customers only ever see approved providers.

**2. What is the architecture?**
A classic three-tier client–server system: the Expo app on the phone, one Express REST API (`backend/src/server.ts`), and a PostgreSQL
database accessed through Prisma. The phone never touches the database or files directly; every request carries a bearer token and is
checked by the server. Two background loops run in the API process: the tow offer sweeper (20 s) and the 3D job worker (5 s).

**3. Why React Native with Expo, and not native Android or Flutter?**
One TypeScript language for the app and the server, one codebase for Android plus a web preview we use for automated screenshots, and
**Expo Go**: we test on a real phone by scanning a QR code, without building an APK. The cost is that we can only use Expo-supported
modules, which is why maps and the 3D viewer run inside a WebView (Leaflet, three.js).

**4. Why Expo Router?**
File-based routing: the folder structure under `mobile/src/app/` *is* the navigation (about 170 route files). Each role has its own folder
whose `_layout.tsx` checks the role (`RoleGate`), so the code is organised by who uses it.

**5. Why Express and PostgreSQL? Why not MongoDB?**
Express is small and its middleware chain matches our security layers (`requireAuth` → role guard → body parser → handler). Our data is
relational (user → shop → product → order → item) and we rely on PostgreSQL features: transactions, row locks (`FOR UPDATE`), partial
unique indexes (one active tow request per customer and company), CHECK constraints, arrays and JSON. A document database would push
those guarantees into application code.

**6. What does Prisma give you, and did you still write SQL?**
A typed client generated from one schema file (`backend/prisma/schema.prisma`) and versioned migrations (57). We still use SQL where it
is the right tool: atomic stock updates (`UPDATE … WHERE stock - reservedStock >= qty`, `services/parts-orders.ts`), the rate-limit upsert
(`INSERT … ON CONFLICT`, `services/auth-session.service.ts`), row locks, advisory locks for the 3D catalog, and the partial indexes and
CHECK constraints inside migrations. All raw SQL is parameterised.

### Security

**7. What happens when a user signs in?**
`POST /api/auth/login`: the email is normalised, the rate limiter is checked, the password is verified with argon2 (against a dummy hash
if the email is unknown, so the timing is the same). On success the server issues a 15-minute JWT and a 30-day refresh token whose
SHA-256 is stored (`issueSession`). The app saves both in SecureStore and lands on the role's home (`core/session/landing.ts`).

**8. How do you store passwords, and why argon2?**
Only argon2 (argon2id) hashes are stored. Argon2 is memory-hard, so guessing passwords on GPUs is expensive, and it was the winner of the
Password Hashing Competition. The policy is 12–256 characters with upper, lower, digit and symbol. One honest gap: drivers created by a
company use a weaker 8-character rule (`passwordOk` in `services/tow-dispatch.ts`).

**9. Why two tokens? What if a refresh token is stolen?**
A short access token limits the damage of a leaked token to 15 minutes; the refresh token keeps the user signed in. Refresh tokens are
**rotated on every use**, and if an already-used token is presented again the whole token family is revoked, which ends the thief's and
the user's session (`rotateSession`). A password reset or role change increments `sessionVersion`, which invalidates every token at once.

**10. How do you stop brute force?**
A database-backed limiter (`RateLimit` table): 5 failed logins per email or 20 per IP in 15 minutes, signups 5 per email / 20 per IP per
hour. Codes are 6 digits, HMAC-hashed, expire in 5 minutes, allow 5 tries, and attempts are counted atomically so parallel guesses cannot
exceed the limit. Honest gap: other endpoints (chat, search, uploads) have no request-rate limit yet.

**11. Can a customer make themselves an admin or a provider?**
No. Signup reads only name, email, phone and password and always creates a `CUSTOMER` (`POST /auth/register`). A provider role is written
only inside the department admin's approval transaction (`promoteApplicant`, `services/applications.ts`); an admin account only through a
super-admin invitation plus an emailed code. A test scans the whole source for any code that writes a role and fails if a new place
appears (`backend/tests/auth-security.test.mjs`).

**12. The app hides screens per role. Is that your security?**
No, it is only convenience; every layout says "UX gate only". The server checks again on every request: `requireAuth` reloads the user
from the database (so a suspended or promoted user is seen immediately), then role / permission guards
(`middleware/auth.middleware.ts`), the "approved provider" gate, and ownership inside each query — another user's record returns 404.

**13. Two drivers press "Accept" at the same moment. What happens?**
Only one wins. Every state change is a conditional update: `updateMany({ where: { id, status: "REQUESTED", driverId } … })`; the second
update matches zero rows and gets a 409. Accepting also claims the truck atomically (`APPROVED + AVAILABLE → BUSY`) in the same
transaction, so if the job update fails the truck claim rolls back (`driverAccept`, `services/tow-dispatch.ts`).

**14. How do you prevent selling more parts than are in stock?**
The server prices and checks every order itself. When the shop **accepts**, stock is reserved with
`UPDATE … SET reservedStock = reservedStock + n WHERE stock - reservedStock >= n`; if it updates 0 rows, the accept fails. Delivered /
picked up removes the units; cancel / reject releases them. Customers only see `stock − reservedStock` (`services/parts-orders.ts`).

**15. Could someone upload a malicious file?**
Files arrive as base64; the server checks the size before decoding, then decides the type from the file's first bytes (JPEG / PNG / WEBP,
or PDF for mechanic documents), ignores the client's name and MIME, saves under a random UUID name outside any static folder, and serves
by database id only, with `nosniff`. Private files require the owner or the matching department admin (`uploads/providerFiles.ts`,
`routes/files.routes.ts`). Honest gap: there is no virus scanning and files are not encrypted at rest.

### Privacy

**16. What personal data do you keep, and who sees it?**
Name, email, optional phone, cars, requests and orders, provider documents. Every customer-facing answer is built from an explicit field
list. Customers never see provider phones, emails or documents; a tow driver appears as "Ahmad K." with a masked plate until he accepts
the job. Shops see a customer's first name, never email or phone. A mechanic sees only the first name and an area (~1 km) until he
accepts; the exact address and phone only during the active job (`mechanicView`, tested in
`backend/tests/mechanic-request-privacy.test.mjs`).

**17. Do you track drivers all the time?**
No. The app asks only for foreground location. A driver's position is sent only while a job is active **and** his job screen is open
(about every 10 s). When the job ends, the trail is deleted and his last point cleared; only the total distance stays (`driverPing`,
`endTrail`). Before a job, a free driver is shown at his truck's base, rounded to about 110 m.

**18. What is the audit log for?**
Accountability. Every state change, every document view and every admin detail view writes an `AuditLog` row with the actor, action,
target and details. It has no foreign keys, so it survives deletions, and the team rule is append-only. It also enforces rules: a
mechanic approval is refused unless the deciding admin opened the identity document.

### Features

**19. How does a tow request reach a driver, and what if nobody answers?**
The customer chooses Nearest, a company or a specific driver. `routeNewRequest` gives the offer a deadline (3 minutes by default); a
company request goes to its only free driver or waits for the owner to assign. Every 20 s the sweeper (`services/tow-offers.ts`) moves an
unanswered "nearest" offer to the next nearest free driver not tried yet, or ends the request as a timeout and tells the customer.

**20. How do you verify providers? Do you check documents are genuine?**
Admins review each document (accept / reject with a reason) and the server enforces a checklist before approval: phone, location, every
required document accepted, and for tow companies at least one fully documented truck. Mechanics also need a passed interview recorded by
the admin. MOTEXA does **not** check documents with any government authority; it is a human review supported by the system.

**21. How does "View on my car" work?**
A shop asks for a 3D version of a product (bumper, rear wing or rims) with photos of the part. A Parts admin approves, starts a paid
Meshy generation (photos → 3D model), checks a six-view preview rendered by the real viewer, and publishes. Each published part is fitted
**once** per car generation by the same viewer code run headless, the admin approves the fit, and only then can a customer whose garage
car matches see it on their own car in their paint colour (`services/accessory3d.ts`, `services/accessory-autofit.ts`,
`mobile/src/features/car3d/sceneHtml.ts`).

**22. Where do the car models come from, and what about licences?**
From Sketchfab, imported only if the API reports CC0, CC BY or CC BY-SA (`services/sketchfab-client.ts`), then optimised and validated;
the credit is shown under the model. Customers can also request their car from 4 photos (Meshy), which an admin reviews. Generation photos
are Wikimedia Commons images with their credit and licence stored.

**23. The 3D API costs money. How do you control it?**
Generation can only be started by a Parts admin, with an explicit "confirm paid" flag, a backend key, the paid switch on, and a monthly
credit cap per shop (default 5). Tests can never call the real API (no key, mock mode, a fetch guard), and mock output can never be
published (`services/generation-runtime.ts`, `scripts/test-no-paid-provider.mjs`).

**24. How do you know a 3D part really fits the car?**
The viewer measures how deep the part cuts into the car (clip) and how far it floats (gap) in millimetres, tries small automatic
corrections, and refuses fits above the limit. Bumpers need a confirmed part map so the stock bumper can be hidden. The Parts admin
approves each fit. A report script (`backend/scripts/fit-qa.ts` → `docs/3d/FIT-QA.md`) puts every published part on every car: the 3
real parts show cleanly on all 23 combinations they are offered for. Limits: cars whose bumper is merged into the body (e.g. W203).

**25. How do you support Arabic?**
Every screen writes both texts side by side (`t("English", "العربية")` from `core/hooks/useL.ts`). Right-to-left is done per component
(rows reversed, text aligned right, slide animations mirrored) instead of a global switch that would need an app restart. Mixed Arabic /
Latin text is wrapped in Unicode isolates (`core/constants/bidi.ts`), Arabic digits are accepted in number fields, and server errors carry
codes the app translates.

### Quality and limits

**26. How did you test it?**
The backend suite (`npm test`, 51 files; last recorded 340/340 passing) runs on a fresh `motexa_test` database, against its own backend
process, with mock 3D providers; it covers sign-up and sessions, roles and permissions, privacy rules, tow dispatch, orders, the garage
and the 3D pipeline, including the real viewer run headless. The mobile side has 20 Node test files on pure logic (86/86 recorded) and manual
Playwright click-throughs. There is no measured code-coverage percentage, and the test database is filled from a copy of the dev data.

**27. Why polling instead of push notifications or WebSockets?**
Simplicity within Expo Go and our time. Notifications are rows the app reads; "live" screens re-read every few seconds while they are open
(`core/hooks/useLoad.ts`). It works for a demo but costs more requests and is not instant; push notifications and WebSockets are future work.

**28. Why cash only? And where is the AI diagnosis?**
Online payment needs a payment provider and its legal setup; for this version orders are pay-at-shop or cash on delivery, and "Card" is
shown as "Coming soon". AI diagnosis is **design only** (`docs/agents/AI-DIAGNOSIS-DESIGN.md`): no AI code, key, route or table exists;
the home screen shows an honest "Coming soon".

**29. Most of the code was written with AI agents. How do you know it is right, and do you understand it?**
The agents worked under written rules (`AGENTS.md`: proposal first, additive migrations, no fake data, privacy rules, type checks to zero)
and every task was logged in `docs/agents/STATUS.md`, with a second agent reviewing (`docs/agents/REVIEW.md`, `CODEX-REVIEW.md`).
Correctness is backed by the tests above, server-side checks independent of the app, and live checks on a real phone. Known problems are
written down in `docs/agents/KNOWN-ISSUES.md` rather than hidden. (Be ready to open any file in this guide and explain it.)

**30. What would you change before real production use?**
HTTPS behind a reverse proxy, restricted CORS and security headers, rate limits on all endpoints, a shared (not in-memory) recovery
limiter, the same 12-character password rule for drivers, object storage with encryption for files, push notifications, a payment
provider, an account-deletion / data-export feature, paging for long admin lists, moving the 3D worker and headless viewer to a separate
job service, and self-hosting the CDN scripts and the routing server.
