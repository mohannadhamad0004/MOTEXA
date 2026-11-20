# MECHANICS PLAN — read-only step (2026-11-18 night)

Status: **approved 2026-11-20** (answers 1–7: garages SHOULD but designed for; `mechanicUserId` may become nullable; all listed skills approved at once; tow quote later; old tables stay; 30-min deadline as one config value; in-app inbox only. Quote rule: the mechanic may inspect/diagnose before quoting, an accepted quote is required before the repair starts, the invoice can't exceed the last accepted quote, a revised quote needs the customer's approval).
- MUST 1 (one signup/review system): **done 2026-11-20** — see STATUS.md.
- MUST 2–8: not started.

(Original read-only step: no code changes, no migrations, no git; only AGENTS.md §3 and docs were edited.)

- AGENTS.md §3 rewritten: Mohannad works alone; no partner file list, no "listed bugs only" rule. (Also removed "another owner's files" from the ask-again list and "Diala's" from the design-components line.) STATUS.md history untouched.
- Backend :5000 health OK at start (`/api/health` 200). Expo web: :8081.

## 1. What exists today (verified live)
_(done: API on :5000 + Expo web :8081 at 390 px, EN and AR)_

### 1a. Two mechanic pipelines exist side by side
| | Pipeline A (reachable) | Pipeline B (orphaned) |
|---|---|---|
| Signup screen | `auth/signup?selectedRole=mechanic` → `components/MechanicRegistration.tsx` (`POST /api/auth/mechanic/register`) | `app/auth/mechanic-signup.tsx` (7 steps, `POST /api/mechanic-applications`); **no link to it anywhere** |
| Application | `components/MechanicApplication.tsx` → `/api/mechanics/me`, `/me/documents`, `/me/submit` → table `MechanicProfile` | table `MechanicApplication` + `MechanicApplicationSkill` |
| Admin review | `components/MechanicReviewScreen.tsx` (`/api/mechanics/admin…`): request changes / interview / approve / reject / suspend; opened from `/dept` (Mechanics) and `/mechanics-admin` | `app/admin/mechanics/applications/*` (`/api/mechanic-review…`); not linked from the admin tabs I checked |
| What the **customer catalog** reads | — | `catalog-mechanics.routes.ts:27` `publicMechanic` = MECHANIC + ACTIVE + `mechanicApplication` (not REJECTED) with ≥1 APPROVED skill |

### 1b. Live run, pipeline A (API on your :5000, 2026-11-18 ~19:40 UTC)
| Step | Result |
|---|---|
| Register `plan.mech.1119@motexa.test` | 201 |
| Save profile, upload ID (JPEG), submit | 200 / 201 / 200, status PENDING |
| Admin (admin.mechanics@) sees it | yes |
| Request changes (needs `submissionVersion`) | 200 → NEEDS_COMPLETION; mechanic gets an in-app notification |
| Mechanic resubmits | 200 → PENDING |
| Interview PASSED, admin opens ID, approve | 200 → **VERIFIED** (approve requires a passed interview + the ID viewed: good) |
| `GET /mechanics/me/service-access` | 200 (allowed) |
| **Customer catalog** `/catalog/mechanics` | **not listed** (5 total = the seeded ones) |
| Customer profile `/catalog/mechanics/:id`, customer request | **404 "Mechanic not found"** |

**P0 BUG — the funnel is broken at the join:** approval writes `MechanicProfile.verificationStatus = VERIFIED` (`mechanics.routes.ts:480`), but the catalog and `POST /requests/mechanic` look at `MechanicApplication` + approved skills (`catalog-mechanics.routes.ts:27-31`), which pipeline A never creates. Only the 5 seeded mechanics (`seed/mechanics-demo.ts:65`, written straight into `MechanicApplication`) can ever be found or receive requests. Every real mechanic who signs up through the app is invisible to customers.

### 1c. Live run, request lifecycle (seeded mechanic.nablus@ + customer@)
create 201 → accept 200 (ACCEPTED, full name + exact location) → start 200 (IN_PROGRESS) → complete 200 (COMPLETED, exact location hidden again). The customer status page shows the real timeline REQUESTED > ACCEPTED > IN_PROGRESS > COMPLETED, `canCancel=false`. **No in-app notification** reached either side at any step (the `/api/notifications` lists didn't change).

### 1d. Screens (Expo web 390 px, EN + AR)
- Customer: Mechanics tab, mechanic profile, request form (3 steps), status page all load in EN and AR, no API errors, no horizontal overflow (scrollWidth 390).
- Mechanic (seeded, e.g. mechanic.nablus@): login lands on `/mechanic` = **"Mechanic profile not found." + Retry / Go to sign in**, in both EN and AR (the server text isn't translated). The working inbox `/mechanic/requests` (EN + AR fine) can only be reached by typing the URL or through `/home`.
- Mechanic (approved via pipeline A, plan.mech.1119@): `/mechanic` shows "Your application is approved" + service modes + notifications, **but no way to the request inbox** (and no requests can reach them, see 1b).
- Mechanics admin (`/dept` → Mechanics, `MechanicReviewScreen`): pending / needs completion / approved / rejected filters, interview, decision; works (the text-node bug was fixed earlier today).

### 1e. Bugs, dead ends, mock / hard-coded data, "coming soon"
| # | Sev | Where | What |
|---|---|---|---|
| B1 | **P0** | `backend/src/routes/catalog-mechanics.routes.ts:27-31`, `mechanics.routes.ts:480` | Approved (VERIFIED) mechanics from the real signup never appear to customers, and requests to them get 404 (1b). |
| B2 | **P0** | `mobile/src/app/auth/login.tsx:185` → `app/mechanic/index.tsx` → `components/MechanicApplication.tsx`; `backend/src/routes/mechanics.routes.ts:71,86` | Every mechanic lands on the application screen. Mechanics without a `MechanicProfile` (all 5 seeded ones, i.e. the only ones customers can book) see "Mechanic profile not found." (English even in AR). |
| B3 | **P0** | `mobile/src/app/home.tsx:16,50` vs `core/session/landing.ts:24` | The request inbox `/mechanic/requests` is linked only from `/home`, which login never opens for a mechanic (dead end: jobs can't be found in the app). |
| B4 | P1 | `mobile/src/app/home.tsx:52` | Hard-coded "Coming soon / Your home screen is on its way" card. |
| B5 | P1 | `backend/src/routes/mechanic-requests.routes.ts` (all transitions) | No notifications for new / accepted / declined / started / completed / cancelled requests (1c). |
| B6 | P1 | `mobile/src/app/customer/mechanicrequest/new.tsx:119` | Privacy note is outdated: says the mechanic sees "your name … and the location you wrote"; today it's first name + area until they accept. |
| B7 | P2 | `mobile/src/app/auth/mechanic-signup.tsx` + `backend/src/routes/mechanic-applications.routes.ts`, `mobile/src/app/admin/mechanics/**` + `backend/src/routes/mechanic-review.routes.ts` | Pipeline B: second signup + second admin review that nothing links to. Dead code that still writes the table the catalog reads. |
| B8 | P2 | `mobile/src/app/auth/mechanic-preview.tsx`, `components/MechanicApplication.tsx:58,255` | Preview route with a mock profile (`id: "preview"`, "Nothing is sent to the database"), reachable by URL in production builds. |
| B9 | P2 | catalog / map | Mechanics have no coordinates: distance and map pins are city centres (already labelled "approximate"). |
| — | info | admin review | Approve correctly requires a passed interview + the ID opened (audited); "Reject" wasn't run live (it's terminal); its code path requires notes. |

**Fix direction for B1–B3 (one model):** keep pipeline A (`MechanicProfile` + documents + interview) as the single source of truth. Make `publicMechanic` = MECHANIC + ACTIVE + `mechanicProfile.verificationStatus = VERIFIED`, with skills from `MechanicProfile.specializations`. Migrate the 5 seeded mechanics into `MechanicProfile` (dev seed only). Send `/mechanic` to a mechanic home (inbox first, application status second). Remove pipeline B and the preview route.


## 2. Garages + independent mechanics — data model
All changes are **additive** (new tables, new nullable columns, new enum values). One exception needs your OK, marked ⚠.

### 2a. Who is who
| Actor | Account | Profile | Approved by | Visible to customers when |
|---|---|---|---|---|
| Independent mechanic (today) | `User` role MECHANIC | `MechanicProfile` (pipeline A, after the B1 fix) | mechanics admin (documents + interview + decision) | `verificationStatus = VERIFIED` and `available` |
| Garage owner (new) | `User` role **GARAGE_OWNER** (new enum value; mirrors TOW_PROVIDER) | `GarageProfile` (new; copy of `TowCompanyProfile`) | mechanics admin (same application review as tow/parts) | `verificationStatus = APPROVED` |
| Garage mechanic (new) | `User` role MECHANIC, created/invited by the owner (like TOW_DRIVER) | `GarageMechanic` (new; copy of `TowDriver`) | mechanics admin reviews ID/licence (like tow drivers' licences) | not listed alone; shown as "<garage> · <first name>" once assigned |

### 2b. New / changed tables (Prisma, additive)
```prisma
enum UserRole { … GARAGE_OWNER }                        // new value only

model GarageProfile {                                   // = TowCompanyProfile pattern
  id String @id @default(uuid())
  userId String @unique                                 // owner
  name String
  nameAr String?
  phone String
  city String
  address String?
  baseLat Float?                                        // exact; customers get it rounded (like tow baseLat/baseLng)
  baseLng Float?
  workingHours String?                                  // same free-text format as tow
  open24h Boolean @default(false)
  services String[] @default([])                        // skill keys from mechanicSkills.ts
  description String?
  verificationStatus ProviderVerificationStatus @default(PENDING)
  rejectionReason String?
  reviewedById String?
  reviewedAt DateTime?
  submittedAt DateTime?
  submissionVersion Int @default(0)
  flaggedFields String[] @default([])
  files ProviderFile[]                                  // commercial registration, workshop photos (reused table)
  mechanics GarageMechanic[]
  requests MechanicRequest[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model GarageMechanic {                                  // = TowDriver pattern
  id String @id @default(uuid())
  userId String @unique
  garageId String
  phone String
  skills String[] @default([])
  available Boolean @default(true)
  approval GarageMechanicApproval @default(PENDING)     // PENDING | APPROVED | REJECTED | SUSPENDED (same values as TowDriverApproval)
  approvalReason String?
  reviewedById String?
  reviewedAt DateTime?
  files ProviderFile[]                                  // ID / licence (reused table)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model MechanicProfile { …                               // independent mechanics, new nullable columns
  baseLat Float?   baseLng Float?   workingHours String?   available Boolean @default(true)
}

model MechanicRequest { …
  garageId String?                                      // request to a garage (owner assigns)
  assignedAt DateTime?
  respondBy DateTime?                                   // offer deadline (see MUST 3)
  cancelReason String?
  cancelledBy String?                                   // CUSTOMER | MECHANIC | GARAGE | ADMIN | SYSTEM
  carId String?                                         // link to CustomerGarageCar [AI]
  // ⚠ mechanicUserId: NOT NULL -> NULL (a garage request has no mechanic until the owner assigns one).
  //    No data changes, only the constraint is relaxed. Alternative if you refuse: a separate GarageRequest table.
}
```
Rule: one user is either an independent mechanic or a garage mechanic, not both (checked in the API).

### 2c. Request flow
- **To a specific mechanic** (independent, or a garage mechanic picked on the garage page): as today (`mechanicUserId` set).
- **To a garage**: `garageId` set, `mechanicUserId` null. The owner sees it in the garage inbox and assigns an available, approved mechanic who has the skill. The assigned mechanic gets it in their inbox; accept/start/complete as today. Privacy stays the same: first name + area until the assigned mechanic (or the owner) accepts.
- The `mechanicView` privacy rules (exact location only during the active job) apply to the owner and to the assigned mechanic.

### 2d. Reused, not rewritten
| Need | Reuse |
|---|---|
| Garage signup wizard + documents + resubmit | `app/provider/tow-signup` + `backend/routes/provider-signup.routes.ts` (add kind GARAGE) |
| Admin application review (approve / request changes / reject, messages) | `provider-review.routes.ts` + `features/department/applications.tsx` (`ApplicationsList` kind GARAGE), `ProviderMessage` (add nullable `garageId`) |
| Garage staff: add/invite mechanic, licence review | `tow-drivers.routes.ts` (`/tow/me/drivers`, `/admin/tow/drivers/:id/review`) + `app/provider/tow/drivers.tsx`, `app/dept/tows/drivers.tsx` |
| Garage inbox + assignment | `app/provider/tow/dispatch/*` + `POST /tow/me/requests/:id/assign` |
| Garage public page + map | `catalog/tow/companies/:id` + `features/shared/ServiceMapScreen.tsx` (mode "mechanic" already exists) |
| Files, photos, notifications | `ProviderFile`, `pickPhoto()`, `notify()` |
| Independent mechanic | `MechanicProfile` + `mechanics.routes.ts` (pipeline A), unchanged apart from the B1 fix and the new columns |

## 3. Shared with tow — quote/invoice, notifications, push

### 3a. ONE quote → approval → invoice model (tow + mechanics; payment plugs in later)
```prisma
enum ServiceKind { TOW MECHANIC }
enum QuoteStatus { PROPOSED ACCEPTED DECLINED SUPERSEDED EXPIRED }
enum InvoiceStatus { ISSUED CONFIRMED DISPUTED VOID }
enum PaymentMethod { CASH ONLINE }                      // ONLINE unused until the payment step
enum PaymentState { UNPAID PAID REFUNDED }
enum MoneyLineKind { LABOUR PART FEE DISCOUNT }

model ServiceQuote {
  id String @id @default(uuid())
  kind ServiceKind
  towRequestId String?                                  // exactly one of the two is set (CHECK in the migration SQL)
  mechanicRequestId String?
  version Int                                           // 1, 2, 3 … a price change = new version, the old one SUPERSEDED
  status QuoteStatus @default(PROPOSED)
  currency String @default("ILS")
  subtotal Decimal @db.Decimal(12, 2)
  total Decimal @db.Decimal(12, 2)
  note String?
  validUntil DateTime?
  createdByUserId String
  decidedAt DateTime?
  lines MoneyLine[]
  createdAt DateTime @default(now())
  @@unique([towRequestId, version])
  @@unique([mechanicRequestId, version])
}

model ServiceInvoice {
  id String @id @default(uuid())
  number String @unique                                 // e.g. MTX-2026-000123
  kind ServiceKind
  towRequestId String? @unique
  mechanicRequestId String? @unique
  quoteId String?                                       // the accepted quote it is based on
  status InvoiceStatus @default(ISSUED)
  currency String @default("ILS")
  subtotal Decimal @db.Decimal(12, 2)
  total Decimal @db.Decimal(12, 2)
  paymentMethod PaymentMethod @default(CASH)
  paymentState PaymentState @default(UNPAID)
  paidAt DateTime?
  confirmedByCustomerAt DateTime?
  lines MoneyLine[]
  issuedAt DateTime @default(now())
}

model MoneyLine {                                       // shared by quotes and invoices
  id String @id @default(uuid())
  quoteId String?
  invoiceId String?
  kind MoneyLineKind
  label String
  quantity Decimal @db.Decimal(10, 2)
  unitPrice Decimal @db.Decimal(12, 2)
  total Decimal @db.Decimal(12, 2)
}
```
**Rules (server-side):**
- A mechanic job can't go to IN_PROGRESS without an ACCEPTED quote. A tow job can't go to EN_ROUTE without one; the company quotes when it accepts.
- A price change creates a new quote version, which the customer approves again. No surprise charges: invoice total ≤ the accepted quote total.
- At completion the provider issues the invoice. The customer confirms it or disputes it (a dispute uses the existing report flow). Cash is marked PAID by the provider.
- Every step writes an AuditLog row and a notification. Money is `Decimal(12,2)`, shown as "₪ 120.00" (the existing money helpers).
- Later, online payment = a new `Payment { invoiceId, provider, providerRef, amount, status }` row with `paymentMethod = ONLINE`. Nothing above changes.

### 3b. ONE in-app notification model (inbox + badge)
It mostly exists already: table `Notification` (bilingual `"en||ar"` title/body), `notify()` in `services/provider-onboarding.ts:251`, `GET /api/notifications` (last 50 + unread count), `POST /api/notifications/read-all`. Mechanics also have a separate `/api/mechanics/notifications` on the same table.
- **Additive columns:** `kind String?` (e.g. `MECHANIC_REQUEST_ACCEPTED`), `link String?` (in-app route, e.g. `/customer/mechanicrequest/<id>`), `refType String?`, `refId String?`.
- **API:** add `POST /api/notifications/:id/read`. Move `notify()` to `services/notifications.ts` (one place). Every tow, mechanic, quote and invoice transition calls it. Remove the duplicate `/api/mechanics/notifications` once its screen uses the shared one.
- **Mobile:** one `useNotifications()` hook (`core/hooks`). It refreshes on screen focus and every 20 s while the app is in the foreground (AppState), never in the background. It drives a bell with a badge in every role's header/tab bar and one inbox screen whose rows open `link`. It reuses `features/provider/api.ts:62` `notifications`.

### 3c. Push in Expo Go (checked in the Expo docs for SDK 57)
- Expo docs, `versions/v57.0.0/sdk/notifications`: *"Push notifications (remote notifications) functionality provided by `expo-notifications` is unavailable in Expo Go on Android from SDK 53. A development build is required to use push notifications. Local notifications (in-app notifications) remain available in Expo Go."*
- **So: no remote push in Expo Go on Android.** While the app is open it can show a *local* notification when the polling finds a new item (works in Expo Go).
- **Real push would need:**
  1. a development build (`expo-dev-client`, EAS Build, or `npx expo run:android`). The phone then runs your own APK instead of Expo Go, which conflicts with AGENTS.md rule 7 ("everything must work in Expo Go");
  2. `expo-notifications`;
  3. a Firebase project + `google-services.json` (`android.googleServicesFile` in app.json) + the FCM V1 service-account key uploaded to EAS;
  4. an EAS `projectId` for `getExpoPushTokenAsync({ projectId })`;
  5. backend: a `PushToken { userId, token, platform, lastSeenAt }` table + sending through the Expo Push API, with receipts and removal of dead tokens.
- Recommendation: **LATER**. The in-app inbox + badge covers the demo in Expo Go.

## 4. MUST / SHOULD / LATER (one developer, ~4 weeks, AI diagnosis + security pass + payment still to come)
Budget assumption: of ~20 working days, about **10 go to mechanics**; the rest go to AI diagnosis (~5), the security pass (~2) and payment (~3). Sizes: S ≈ ½–1 day, M ≈ 2 days, L ≈ 3–4 days.

### MUST (8 items, in build order)
| # | Item | Size | Files it touches | Gap-audit ref |
|---|---|---|---|---|
| 1 | **Fix the mechanic funnel (B1–B3, B6–B8):** one model (pipeline A); the catalog and new requests read `MechanicProfile` VERIFIED + its specializations; move the 5 seeded mechanics to `MechanicProfile` (dev seed); a mechanic home with the inbox first and the application status second; one landing for MECHANIC; fix the privacy text; remove pipeline B + the preview route (code only, tables stay) | M | `backend/src/routes/catalog-mechanics.routes.ts`, `mechanic-requests.routes.ts`, `mechanics.routes.ts`, `seed/mechanics-demo.ts`, `server.ts`; `mobile/src/app/mechanic/index.tsx`, `app/auth/login.tsx`, `core/session/landing.ts`, `app/home.tsx`, `components/MechanicApplication.tsx`, `app/customer/mechanicrequest/new.tsx`; delete `app/auth/mechanic-signup.tsx`, `app/auth/mechanic-preview.tsx`, `app/admin/mechanics/**`, `features/mechanic-review/*`, `routes/mechanic-applications.routes.ts`, `routes/mechanic-review.routes.ts` | prerequisite |
| 2 | **Shared in-app notifications:** columns `kind/link/refType/refId`, `services/notifications.ts`, `POST /notifications/:id/read`, `useNotifications()` + bell/badge + inbox for every role; wire mechanic request transitions | M | migration; `backend/src/services/notifications.ts` (new), `services/provider-onboarding.ts`, `routes/provider-onboarding.routes.ts` (router), `mechanic-requests.routes.ts`, tow routes (import path only); `mobile/src/core/hooks/useNotifications.ts` (new), `app/notifications.tsx` (new), `components/layout/*` headers, `features/provider/api.ts` | 1 |
| 3 | **Offer deadline + expiry:** `respondBy` (e.g. 30 min), a sweep like `tow-offers.ts` → CANCELLED by SYSTEM "no answer", customer notified | S | migration; `backend/src/services/mechanic-offers.ts` (new, copy of tow-offers), `server.ts`, `mechanic-requests.routes.ts`; customer status screen text | 2 |
| 4 | **Shared quote → approval → invoice (cash)** for mechanics AND tow (§3a): mechanic sends a quote, customer approves/declines, IN_PROGRESS needs an accepted quote, invoice at completion, customer confirms, cash marked paid | L | migration; `backend/src/services/billing.ts` + `routes/billing.routes.ts` (new), `mechanic-requests.routes.ts`, `tow-requests.routes.ts`/`tow-drivers.routes.ts` (status gate); `mobile/src/features/billing/*` (new: QuoteCard, InvoiceCard, QuoteForm), `app/mechanic/requests/[id].tsx`, `app/customer/mechanicrequest/[id].tsx`, tow job + customer tow status screens | 4, 5, 6 **[PAY]** |
| 5 | **Per-request chat (mechanics):** `MechanicRequestMessage` + endpoints + UI, history kept after the job (copy of `TowRequestMessage` / `tow-job-extras.routes.ts`) | S | migration; `backend/src/routes/mechanic-request-extras.routes.ts` (new); mobile chat component reused from the tow job screens | 3 |
| 6 | **Mechanics admin supervision, lite:** stats, request list/history, detail (audited), admin cancel (§5 without map/reports) | M | `backend/src/routes/mechanics-admin.routes.ts` (new); `mobile/src/features/department/MechanicsAdminHome.tsx` (new), `departments.ts`, `app/dept/mechanics/*` (new, copy of `app/dept/tows/*`) | 13 |
| 7 | **AI-ready request input:** pick a car from the customer's garage (`carId`), up to 3 photos (`pickPhoto` + `ProviderFile`), a symptom category; the mechanic records a structured outcome at completion (diagnosis category + work done) | M | migration; `mechanic-requests.routes.ts`, `features/mechanics/MechanicRequestForm.tsx`, `app/mechanic/requests/[id].tsx`, `services/garage.ts` | 15–18 **[AI]** |
| 8 | **Rating per completed job** (copy of `TowReview`), shown on the profile as average + count (real ratings only) | S | migration; `mechanic-request-extras.routes.ts`, `catalog-mechanics.routes.ts`, customer status + mechanic profile screens | 10 |

Total ≈ M+M+S+L+S+M+M+S ≈ 13–14 days. If that's too much against the 10-day budget, item 8 moves to SHOULD first, then item 6.

### SHOULD (if time allows, in this order)
- **Garages** (§2: `GarageProfile`, `GarageMechanic`, assignment, reuse of the tow signup/drivers/dispatch screens). Size **L+ (4–5 days)**. Recommended only after payment works; see question 1.
- Workshop pin + availability toggle → real distance and "nearest available mechanic" (gap 11, 12). S–M.
- Richer statuses: on-site EN_ROUTE/ARRIVED; workshop CAR_RECEIVED → WAITING_FOR_APPROVAL/PARTS → READY_FOR_PICKUP (gap 8). S–M.
- Problem reports + admin reports list (gap 7). S.
- Admin map of workshops and active jobs (rest of §5). S.

### LATER
- Real push (dev build + FCM, §3c). Live location/ETA for on-site jobs (gap 9). Cancellation fees (gap 6, part). Consent screen for using request data in AI (gap 19), unless AI training uses request data before the deadline (then it becomes MUST).

### If there are only 2 weeks
Keep **1 (funnel), 2 (notifications, inbox + badge only), 3 (expiry), 4 in a reduced form (one quote, invoice = accepted quote, cash only, mechanics only; tow later) and 7 in a reduced form (garage car + photos, no structured outcome)**. Drop 5 (chat), 6 (admin supervision), 8 (rating), garages and every SHOULD. Without 1 the mechanics feature doesn't work at all; without 4 there's nothing to pay; without 7 AI diagnosis has no input.

## 5. Mechanics admin — supervising requests like the tow admin
Today the mechanics admin only sees **applications** (`/dept` Mechanics → `MechanicReviewScreen`, `departments.ts` MANAGE_MECHANICS). It sees no requests at all.

| Tow admin has | Mechanics admin needs | Backend (new, copy of tow) | Mobile (reuse) |
|---|---|---|---|
| KPIs on home (`TowAdminHome.tsx`) | Pending applications, open requests by status, **stale** requests (REQUESTED past `respondBy`), completed today, verified mechanics / approved garages | `GET /admin/mechanics/stats` | `TowAdminHome` Kpi + cards → `MechanicsAdminHome.tsx` |
| Active jobs map (`/admin/tow/active-jobs`) | Active jobs (ACCEPTED / IN_PROGRESS) list + map: workshop/garage pins (exact, admin only) and on-site job areas | `GET /admin/mechanics/active-jobs`, `GET /admin/mechanics/map` | `AdminMapScreen.tsx`, `MapPage.tsx` |
| Job detail + admin cancel (`/admin/tow/jobs/:id`, `/cancel`) | Request detail (full data, every open audited like the ID-document view), admin cancel with reason (notifies both sides) | `GET /admin/mechanics/requests/:id`, `POST …/:id/cancel` | `app/dept/tows/[id].tsx` pattern |
| History (`/admin/tow/jobs`) | History with filters (status, city, mechanic/garage, date) | `GET /admin/mechanics/requests?status&city&q&from&to` | `app/dept/tows/history.tsx` |
| Problem reports (`/admin/tow/reports`) | Customer reports on a job + close | `MechanicRequestReport` (copy of the tow report) + `GET/POST /admin/mechanics/reports` | `app/dept/tows/reports.tsx` |
| Driver licences (`/dept/tows/drivers`) | Garage mechanics' ID/licence review | `GET/POST /admin/garages/mechanics/:id/review` | `app/dept/tows/drivers.tsx` |
| Company applications | Garage applications (same queue as tow/parts) | `provider-review.routes.ts` kind GARAGE | `ApplicationsList` |

Access: `requireMechanicsAdmin` (exists in `auth.middleware.ts`). The super admin's Requests overview gets "Open mechanic requests" and "Garage applications" rows.

## Decisions I made alone
1. **Pipeline A is the single mechanic model** (`MechanicProfile` + documents + interview), not pipeline B. A is what the app links to, it has the stronger review (interview + audited document view + versioning) and it's what the mechanics admin uses. B only survives because the catalog and the seed read its table. Tables stay (no destructive migration); only code is removed.
2. **Skills for pipeline-A mechanics:** on VERIFIED, all declared `specializations` count as approved (A has no per-skill review). If you want per-skill approval back, that's a SHOULD item (question 3).
3. **Garage owner = new role `GARAGE_OWNER`** (mirrors TOW_PROVIDER), rather than reusing MECHANIC with a flag: clearer permissions and gates.
4. **Garage requests** need `MechanicRequest.mechanicUserId` to become nullable ⚠: no data changes, but it isn't a pure "add" (question 2).
5. **One user = independent OR garage mechanic, never both** (simpler privacy and assignment).
6. **Notifications keep the existing `"en||ar"` format** (no column split) and add only `kind/link/refType/refId`.
7. **No remote push** in the plan for Expo Go (Expo docs); local notifications in the foreground only. Push is LATER.
8. **Quote gate:** mechanics can't start without an accepted quote; tow can't go EN_ROUTE without one. Invoice total ≤ accepted quote.
9. **MUST budget** ≈ 10 working days for mechanics (the rest for AI, security, payment). Garages are SHOULD, not MUST.
10. **Test records:** I kept the audit rows my tests produced (11) and added `TEST_DATA_REMOVED` rows rather than deleting audit history (same rule as the earlier cleanups today).
11. AGENTS.md: besides §3, I also removed "another owner's files must be changed" from the ask-again list and the word "Diala's" from the design-components line, so nothing in it refers to partner ownership any more. The credits line (project by Mohannad Hamad and Diala Bakir) stays.

## Records created and removed during this step
All on your dev DB through your backend on :5000 (it stayed up the whole time; I didn't restart it).
| Created | Removed |
|---|---|
| User `plan.mech.1119@motexa.test` (id ffc5c2e2…) + `MechanicProfile` + 1 `MechanicDocument` + 4 notifications | deleted (cascade), audit row `TEST_DATA_REMOVED` |
| ID image file `backend/.private/mechanic-documents/000407d3-77b3-4361-ab3b-3e69dcb13a15` | file deleted |
| Mechanic request `3ea13529…` (customer@ → mechanic.nablus@, COMPLETED) | deleted, audit row `TEST_DATA_REMOVED` |
| 12 refresh-token rows (plan.mech, admin.mechanics, customer, mechanic.nablus; 3 were still active) | deleted, audit row `TEST_DATA_REMOVED` |
| 11 audit rows from the flows (MECHANIC_SUBMITTED ×2, NEEDS_COMPLETION, INTERVIEW_PASSED, DOCUMENT_UPLOADED/VIEWED, APPROVE, REQUEST_CREATED/ACCEPTED/IN_PROGRESS/COMPLETED) | kept (history) |
Nothing else changed: no migrations, no code changes (only AGENTS.md §3 and these docs), no git commands, no Meshy/Sketchfab, `graphify-out/` untouched. Screenshots are in the scratchpad only.

## Questions for you
1. **Garages: MUST or SHOULD?** I put them in SHOULD (4–5 days) so that payment + AI + security fit in 4 weeks. Do you need garages for the graduation demo?
2. **May `MechanicRequest.mechanicUserId` become nullable** (⚠ in §2b)? If not, garage requests get their own table (≈ +1 day).
3. **Per-skill approval:** OK that a VERIFIED mechanic's declared specializations all count as approved, or do you want the admin to approve each skill (as pipeline B did)?
4. **Quote gate for tow:** should tow also require an accepted price before EN_ROUTE (emergency tows may need to start first), or only mechanics for now?
5. **Pipeline B tables** (`MechanicApplication`, `MechanicApplicationSkill`): drop them later in a separate, explicit migration, or keep them forever? (I won't touch them without your OK.)
6. **Offer deadline for mechanics:** 30 minutes OK (tow uses 3 minutes because it's an emergency)?
7. **Real push:** do you want a development build at all before the deadline? It means testing on your own APK instead of Expo Go (conflicts with AGENTS.md rule 7).
