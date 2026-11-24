# 06 — Security and privacy

Every measure below is in the code today, with the file where it lives. §9 lists what is still open. The main idea of the whole design:
**the phone is never trusted**. The app hides buttons for convenience ("UX gate only" comments), but every rule is enforced again on the
server, and the server builds every answer from an explicit list of fields.

## 1. Passwords and accounts
| Measure | Where |
|---|---|
| Passwords hashed with **argon2** (argon2id); the plain password is never stored or logged | `routes/auth.routes.ts`, `services/password-reset-completion.service.ts` |
| Password policy for customers, admins and resets: 12–256 chars with upper, lower, digit and symbol | `meetsPasswordPolicy` in `password-reset-completion.service.ts`; admin activation in `auth.routes.ts` |
| Signup can only create `CUSTOMER` accounts; role / status / permissions in the body are never read | `POST /auth/register` in `auth.routes.ts`; `tests/customer-signup.test.mjs` |
| A role other than CUSTOMER can be written only by: admin activation, approval (`promoteApplicant`), adding a driver, the dev seed — checked by a **source-scanning test** | `tests/auth-security.test.mjs` |
| Promotion only inside the department admin's approval transaction, and it ends the person's sessions (`sessionVersion + 1`) | `services/applications.ts` |
| Email must be confirmed with a code before the account is active | `/auth/verify-email` |
| No account enumeration: signup always answers `202 CHECK_EMAIL`; login says "Invalid email or password" for both cases and checks a dummy hash for unknown emails (same timing); password recovery always answers the same neutral 202 and sends the email from a background queue | `auth.routes.ts`, `services/password-reset.service.ts` |
| Anti-squatting: an unconfirmed signup can be taken over only after 24 h, and confirming needs both the code and the password | `SIGNUP_REPLACEABLE_AFTER_MS` in `auth.routes.ts` |
| Only `ACTIVE` accounts can use the API | `requireAuth` |

## 2. Sessions and tokens
| Measure | Where |
|---|---|
| Access token = JWT, **HS256 only** (`algorithms: ["HS256"]` on verify), 15 minutes; `JWT_SECRET` must be ≥ 32 chars | `services/auth-session.service.ts`, `middleware/auth.middleware.ts` |
| `requireAuth` **reloads the user from the database** on every request (role, status, session version); the token's own `role` is never trusted | `middleware/auth.middleware.ts` |
| Refresh token = 32 random bytes, only its **SHA-256** stored, 30 days, **rotated on every use**, atomic claim | `rotateSession` |
| **Reuse detection**: a revoked refresh token presented again revokes its whole family | `rotateSession` |
| Logout revokes the device's token family on the server | `POST /auth/logout`, `revokeSession` |
| `sessionVersion` ends every session at once after a password reset or a role change | `services/session-version.service.ts` |
| Phone: tokens in `expo-secure-store`; web preview: `sessionStorage` (gone when the tab closes) | `mobile/src/components/SessionStore.ts` |
| One refresh at a time on the phone, so rotation never looks like theft | `createRefresher` in `mobile/src/core/session/sessionExpiry.ts` |
| A 401 that a refresh cannot fix clears the tokens and returns to sign-in | `mobile/src/core/config/api.ts` |

## 3. One-time codes and rate limits
| Measure | Where |
|---|---|
| 6-digit codes from `crypto.randomInt`, stored only as **HMAC-SHA256** with `OTP_HASH_SECRET` (64 hex) | `services/otp.service.ts` |
| **Purpose binding**: signup, admin invitation and password-reset codes use different prefixes in the HMAC, so one can never validate another | `EMAIL_CODE` in `auth.routes.ts`, `hashPasswordResetOtp` |
| Constant-time comparison (`timingSafeEqual`) | `verifyOtpHash` |
| 5 minutes, 5 tries, 60 s between sends, 5 per hour, only the newest code counts, single use; attempts counted atomically before comparing | `otp.service.ts`, `auth.routes.ts`, `admin-otp.routes.ts`, `password-reset*.ts` |
| Recovery: a code must have been **delivered** (`sentAt`) to be usable; a correct code gives a hashed one-time grant valid 10 minutes | `password-reset-completion.service.ts` |
| Login: 5 failures per email / 20 per IP in 15 minutes → 429; signup: 5 per email / 20 per IP per hour; stored in PostgreSQL (`RateLimit`), atomic upsert | `createLimiter` in `auth-session.service.ts` |
| Recovery endpoints: per-IP limit 20 per hour (in memory), bounded mail queue (busy → 503) | `password-reset.service.ts` |
| Row locks (`SELECT … FOR UPDATE`) around invitation activation and recovery, so two parallel requests cannot both succeed | `auth.routes.ts`, `admin-otp.routes.ts`, `password-reset*.ts` |

## 4. Authorization (who may do what)
| Measure | Where |
|---|---|
| Role guards and permission guards (`MANAGE_MECHANICS` / `MANAGE_SPARE_PARTS` / `MANAGE_TOWING`), super admin passes all | `middleware/auth.middleware.ts` |
| Providers can act only when their application is `APPROVED` | `requireApprovedProvider` in `services/provider-onboarding.ts` |
| Only VERIFIED + ACTIVE mechanics are public or can answer requests | `publicMechanic`, `requireVerifiedMechanic` |
| Customer applicants reach **only their own** application endpoints | `own()` in `mechanics.routes.ts`, `mine()` in `provider-onboarding.routes.ts`, `requireTowApplicant` in `tow.routes.ts` |
| Ownership inside the query: another user's request / order / truck / product looks like it does not exist (404) | e.g. `ownRequest`, `companyRequest` in `tow-requests.routes.ts`; `jobFor` in `tow-job-extras.routes.ts` |
| Admin routes reuse provider handlers with `res.locals.asAdmin`, set **only after** the admin guard passed; a provider can never reach another provider's company | `myCompany()` in `tow.routes.ts`, `adminAsAdmin` in `parts.routes.ts` |
| Server-side approval checklist (the app may disable the button, the server refuses anyway) | `checklist()` in `services/provider-onboarding.ts` |
| Mechanic approval needs a passed interview **and** the admin must have opened the current identity document (audit row checked) | `POST /mechanics/admin/:userId/decision` |
| Optimistic checks: decisions must send the `submissionVersion` the reviewer saw | `mechanics.routes.ts` |
| State machines as **conditional updates** (`updateMany … where status = X`), so double taps and races give 409, not double actions | every request / order / job route |
| Paid 3D generation needs an explicit `confirmPaid`, a backend key, the paid switch and the shop's monthly cap; mock results can never be published | `services/accessory3d.ts`, `services/generation-runtime.ts` |
| Permission matrix tested over HTTP for the main roles | `tests/four-roles-permissions.test.mjs`, `tests/apply.test.mjs` |

## 5. Input validation
| Measure | Where |
|---|---|
| Hand-written checks on every field: type, trim, length caps (`text(v, max)`), fixed lists (cities, skills, categories, enums), phone patterns | every route file |
| Coordinates must be numbers inside the accepted map box | `readPair`, `inBox` in `src/geo.ts` |
| Strict numbers (no partial parsing, max 2 decimals, Arabic-Indic digits normalised) | `services/numbers.ts` |
| Fitment only from the vehicle list (no free text) | `toListedCars` in `parts.routes.ts`, `services/garage.ts` |
| Body size limits per route, applied **after** authentication; global JSON limit 8 MB | `server.ts` and each router |
| SQL injection: Prisma queries are parameterised; raw SQL uses tagged templates (`$queryRaw\`…${value}\``) or `$1` parameters | `auth-session.service.ts`, `parts-orders.ts`, `mechanics.routes.ts` |
| HTML escaping in the only server-rendered page (invitation landing) | `escapeHtml` in `services/activation-link.service.ts` |

## 6. Files and uploads
| Measure | Where |
|---|---|
| File type decided from the **bytes** (magic numbers), never from the name or declared MIME; JPEG / PNG / WEBP ≤ 5 MB (provider files), JPEG / PNG / PDF ≤ 5 MB with a matching declared type (mechanic documents) | `uploads/providerFiles.ts`, `mechanics.routes.ts` |
| Oversized base64 rejected **before** decoding | `parseUpload` |
| Random UUID file names; `path.basename()` on every read (no path traversal); no static route over private folders | `providerFiles.ts`, `files.routes.ts` |
| Public vs private files; private ones only for the owner, the super admin or the admin of the matching department; `Cache-Control: private, no-store`, `X-Content-Type-Options: nosniff` | `routes/files.routes.ts` |
| Mechanic documents: folder mode 0700, file mode 0600, never overwritten (`wx`), **every view audited** | `routes/mechanics.routes.ts` |
| Driver licence photos are private; driver photos public | `putDriverFile` in `services/tow-dispatch.ts` |
| 3D private storage keys must match a strict pattern; public 3D files are served only if currently published (allow-list checked before `express.static`) | `services/vehicle3d-private-assets.ts`, `services/vehicle3d-public-assets.ts` |
| Every GLB parsed and checked (size, structure, textures) before use; ZIP archives read in memory with bounded limits | `services/vehicle3d-validation.ts`, `services/vehicle3d-archive.ts` |
| Meshy: strict response parsing, downloads only from `https://assets.meshy.ai`, `redirect: "error"`, 30 s timeouts, size cap while streaming; no provider error, URL or key leaves the module | `services/meshy-client.ts` |
| Sketchfab: exact host / path parsing; only CC0, CC BY, CC BY-SA licences are imported; duplicate imports refused (`sourceUid @unique`) | `services/sketchfab-client.ts` |
| Provider media: images decoded by `sharp` with a pixel limit, MP4 structure checked, 60 items per owner | `services/provider-media.ts` |

## 7. Privacy rules (what each side may see)
| Rule | Where |
|---|---|
| Every customer-facing answer is built from an explicit field list; never: hidden products, unapproved shops / companies, phones, emails, licence numbers, documents, storage paths | `routes/catalog.routes.ts` (header comment), `catalog-mechanics.routes.ts` |
| Business locations given to customers rounded to 3 decimals (~110 m) | `round3` in `src/geo.ts` |
| Tow: the customer sees the driver card (short name "Ahmad K.", photo, real rating, truck type); the plate is **masked** (`•••• 12`) until the job is accepted by that driver, then shown in full so the customer can recognise the truck; never the driver's or company's phone | `services/tow-cards.ts`, `viewAll` in `tow-requests.routes.ts` |
| Tow: the phone the customer typed is shown to the company and its driver, and not echoed back to the customer; the company sees the customer's full name, the driver only the first name; nobody on the provider side sees the email | `companyView` in `tow-requests.routes.ts`, `jobView` in `tow-drivers.routes.ts` |
| Tow GPS: only while a job is active and the driver's job screen is open (foreground permission only); trail deleted and last point cleared when the job ends; free drivers shown at their base, rounded | `services/tow-dispatch.ts` (`driverPing`, `endTrail`), `services/tow-cards.ts` (`restingPoint`), `mobile/src/features/shared/locationService.ts`, `app.json` |
| Mechanic requests: first name, approximate area and a pin rounded to ~1 km until the mechanic accepts; exact address / pin / phone only during the active job; the admin follows the same rule and each detail view is audited | `mechanicView` in `mechanic-requests.routes.ts`, `mechanics-admin.routes.ts` |
| Orders: the shop sees the customer's first name, area, pin and note; never email or phone. Inquiries: the shop sees the name, never the email | `parts-orders.routes.ts`, `part-inquiries.routes.ts` |
| Stock is shown as IN / LOW / OUT, with `available` capped at 99 | `stockState` in `catalog.routes.ts` |
| Old sensitive mechanic columns (national id, document URLs) are stripped from every answer | `view()` in `mechanics.routes.ts` |
| Errors never leak internals: unknown errors are a generic 500; 3D errors log only a fixed sentence | every router, `server.ts` |
| **Audit log** of every state change, every document view and admin detail view; rows have no foreign keys so they survive deletions; project rule: append-only | `AuditLog` model, all routes |

## 8. Development and test safety
| Measure | Where |
|---|---|
| Secrets only in `backend/.env` (git-ignored); `EXPO_PUBLIC_*` values are public by design and hold no secret | `.gitignore`, `mobile/.env` |
| Dev seeds refuse to run in production or without `ALLOW_DEV_SEED=true`, and only touch `@motexa.test` users | `src/seed/test-accounts.ts` and other seeds |
| Dev emails are printed only when `NODE_ENV !== "production"`; in production a missing mail config is an error | `services/email.service.ts` |
| Tests run on a separate `*_test` database (enforced in `src/prisma.ts` and `scripts/test.mjs`), with throwaway secrets, mock 3D mode, no provider keys, and a `fetch` guard that blocks Meshy, Sketchfab and the dev server | `scripts/test.mjs`, `scripts/test-no-paid-provider.mjs` |
| Test data cleanup keeps audit rows and adds one `TEST_DATA_REMOVED` row | `AGENTS.md` §4.10 |

## 9. What is still open (honest list)
Security:
- **No HTTPS in development**: the phone talks to `http://<LAN-IP>:5000`, so tokens travel unencrypted on the Wi-Fi. Production needs TLS
  (a reverse proxy).
- **CORS is open to every origin** (`app.use(cors())` in `server.ts`). Tokens are bearer headers, not cookies, so classic CSRF does not
  apply, but the origin list should be restricted in production.
- **No global security headers** (no `helmet`); only some routes set `no-store` / `nosniff` / CSP. Express's `X-Powered-By` header is on.
- **Rate limits only on auth, recovery and codes**. Chat, uploads, catalog search and 3D endpoints have no request-rate limit (only
  business caps such as 3 open mechanic requests, 5 waiting orders or 5 open inquiries per shop).
- The recovery IP limiter is **in memory** (reset on restart, per process). `req.ip` is used without `trust proxy`, so behind a proxy
  every user would share one IP.
- **Driver passwords** follow a weaker rule (8–128 chars, `passwordOk` in `services/tow-dispatch.ts`) than everyone else (12+).
- **No second factor** for admins after activation (the email code is used only once, at activation).
- Files are on the server's **local disk**, not encrypted at rest and not virus-scanned (`uploads/providerFiles.ts` says "Replace with
  object storage before production").
- The audit log is append-only **by rule**, not by a database trigger or permission.
- WebViews load Leaflet (unpkg) and three.js (jsDelivr) from CDNs **without Subresource Integrity**.

Privacy:
- The phone sends route start / end points to the **public OSRM demo server** and loads OpenStreetMap tiles (third parties see the map
  area). `docs/agents/AI-DIAGNOSIS-DESIGN.md` is design only, so no AI provider receives data today.
- There is **no "delete my account" or data-export endpoint**, and no automatic retention rule for old requests, chats or documents.
- `npm test` copies the dev database (including names, emails and password hashes of dev accounts) into `motexa_test`; fine for dev data,
  never acceptable for real customer data.
- Mechanic distances use the city centre (no workshop coordinates), which is a functional limit rather than a leak.
- Role demotion: an approved provider who is later rejected / suspended keeps the provider role; provider actions are still blocked by
  `requireApprovedProvider` / `publicMechanic`, but the account does not go back to customer.
