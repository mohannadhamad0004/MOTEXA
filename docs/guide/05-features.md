# 05 — Every feature end to end

Order: the way a user meets them. For each feature: **screens → API → service / rules → tables**, then what is partial or missing.
All API paths start with `/api`.

---

## 1. Sign-up with an email code (customers)

**Screens**: `mobile/src/app/index.tsx` (welcome) → `app/auth/signup.tsx` → `app/auth/verify-email.tsx` → the customer home.

**Flow**
1. The form sends `POST /auth/register` with `fullName`, `email`, optional `phone`, `password` (`routes/auth.routes.ts`).
   - Only these four fields are read. The account is **always** `CUSTOMER` with status `PENDING`; a `role` in the body is ignored
     (tested in `backend/tests/customer-signup.test.mjs`).
   - Checks: name 2–80 chars, valid email, phone pattern, password policy (`meetsPasswordPolicy`: 12–256 chars with upper, lower,
     digit and symbol). Rate limits: 5 per email / 20 per IP per hour.
   - The password is hashed with argon2 **every time**, even if the email is taken, so all answers take the same time.
   - The answer is always `202 CHECK_EMAIL` ("Check your email for a code"), whether the email is new, waiting for its code, or
     already registered. The owner of an already registered email gets a "you already have an account" email instead of a code.
     This hides which emails have accounts.
   - Anti-squatting: an unconfirmed signup can be replaced by a new signup only after 24 h (`SIGNUP_REPLACEABLE_AFTER_MS`).
2. `sendSignupCode()` makes a 6-digit code (`services/otp.service.ts`), stores its HMAC in `EmailVerificationOtp` (5 minutes,
   5 tries, max one per 60 s and 5 per hour) and emails it in the background (`sendSignupCodeEmail`). In dev it is printed as
   `[DEV EMAIL]`.
3. The app keeps the typed password **in memory only** (`core/session/pendingSignup.ts`) and opens the code screen.
4. `POST /auth/verify-email` with `email`, `password`, `code`. The password must be right (a wrong one counts as a failed login).
   One try is "taken" atomically before comparing, so parallel guesses cannot exceed 5. In one transaction: the code is consumed,
   the user becomes `ACTIVE` with `emailVerifiedAt`, other codes are deleted, `CUSTOMER_EMAIL_VERIFIED` is audited. The answer is the
   same as a login (access + refresh token), so the user is signed in.
5. Signing in later while still unconfirmed returns `403 EMAIL_NOT_VERIFIED`, sends a new code, and the app opens the code screen.

**Forgot password** (`app/auth/forgot-password.tsx`, `routes/password-reset.routes.ts`): request a code (same neutral 202 answer),
verify it (→ a 10-minute one-time grant), set a new password. Completing it increments `sessionVersion` (all sessions end) and also
confirms an unconfirmed signup, because the code proves the inbox.

**Tables**: `User`, `EmailVerificationOtp`, `RateLimit`, `RefreshToken`, `PasswordResetRequest`, `AuditLog`.

---

## 2. Work with MOTEXA + approvals (becoming a provider)

Since the "auth redesign" (stages A–C, `docs/agents/AUTH-REDESIGN.md`), **nobody signs up as a provider**. A provider is a customer
whose application was approved. The old provider signup endpoints were deleted and `backend/tests/auth-security.test.mjs` checks
they answer 404.

**Screens**: customer Profile → `app/work-with-motexa.tsx` → the application wizard (`/mechanic` for mechanics,
`/provider/onboarding` for tow / parts) → admin review in `app/dept/requests` + `app/dept/review/[kind]/[id]`.

**Start**: `POST /apply/:kind` (`routes/apply.routes.ts`), kind = `mechanic | tow | parts`.
- Only a `CUSTOMER` (else 403). Both switches must be on: "this account becomes a provider account" and "I accept the terms".
- One kind per account. Refused (409) while the customer still has an open tow request, mechanic request or parts order
  (`activeCustomerWork` in `services/applications.ts`), because a provider account can no longer see customer screens.
- It creates a `DRAFT` profile on the same account: `MechanicProfile`, or `TowCompanyProfile` / `PartsShopProfile` with business name,
  phone and a city from the list. The role does **not** change.

**Fill in**
- Mechanic (`routes/mechanics.routes.ts`): `PUT /mechanics/me` (city, phone, skills from `MECHANIC_SKILLS`, years, summary, service
  options: workshop / on site / online), `POST /mechanics/me/documents` (IDENTITY and optional CERTIFICATE; JPEG / PNG / PDF ≤ 5 MB,
  private), `POST /mechanics/me/submit` (needs a complete profile + identity document + accepting the privacy statement) → `PENDING`.
- Tow / parts (`routes/provider-onboarding.routes.ts`, one rule set for both in `services/provider-onboarding.ts`):
  `PUT /provider/onboarding/info`, `POST /provider/onboarding/documents` (tow: commercial registration, owner ID, driver licence;
  parts: commercial registration, trade licence, owner ID), the business location on a map (`app/provider/onboarding/location.tsx`),
  trucks with their photo and documents (`POST /tow/me/trucks`, tow only), `POST /provider/onboarding/submit` → `PENDING`.
  A message thread with the department's admins (`/provider/messages`) stays after approval.

**Review**
- Mechanics admin (`MANAGE_MECHANICS`): `GET /mechanics/admin`, `GET /mechanics/admin/:userId`, record an interview
  (`POST …/interview`, PASSED / FAILED + notes), then `POST …/decision` with `APPROVE | NEEDS_COMPLETION | REJECT | SUSPEND |
  REACTIVATE`. Approval is refused unless the profile is complete, the identity document exists, the interview PASSED, **and this admin
  opened the current identity document** (an audit row `MECHANIC_DOCUMENT_VIEWED` must exist). The admin must send the
  `submissionVersion` they saw, so a changed application must be reloaded first.
- Tow / parts admins (`routes/provider-review.routes.ts`, mounted twice: `/admin/providers/tow` behind `requireTowAdmin`,
  `/admin/providers/parts` behind `requirePartsAdmin`): accept / reject each document (`PATCH …/documents/:docId`), request changes
  (flag fields + a required message → `NEEDS_CHANGES`), reject (reason required) or approve. **The approval checklist is enforced on the
  server** (`checklist()`): valid phone, location set, every required document ACCEPTED, and for tow at least one truck whose photo,
  registration and insurance / operating licence are accepted; for parts at least one category. Trucks that qualify are approved
  together with the company.

**Promotion**: inside the approving transaction, `promoteApplicant()` changes the role `CUSTOMER → MECHANIC / TOW_PROVIDER /
PARTS_PROVIDER` and increments `sessionVersion`, so the person's sessions end and the next sign-in lands in the provider area. It is
audited as `ROLE_PROMOTED`, and the applicant gets a notification (and a system message in the thread).

**Admins themselves** (invited, not applying) are in §8.

**Tables**: `MechanicProfile`, `MechanicDocument`, `TowCompanyProfile`, `Truck`, `PartsShopProfile`, `ProviderFile`, `ProviderMessage`,
`Notification`, `AuditLog`, `User`.

**Partial / open** (from `docs/agents/STATUS.md`): an approved provider who is later rejected or suspended is **not** turned back into a
customer; open part inquiries do not block an application.

---

## 3. Customer cars (Garage)

**Screens**: the car chip in every customer hero, `app/customer/garage.tsx`, the picker sheets (`features/catalog/VehiclePicker.tsx`,
`GarageSheets.tsx`), the store `features/catalog/myCar.ts` + `garageStore.ts`.

**API** (`routes/garage.routes.ts`, inside the catalog router, customers only): `GET/POST /catalog/garage`,
`PATCH/DELETE /catalog/garage/:id`, `POST /catalog/garage/:id/activate`; older single-car API `GET/PUT/DELETE /catalog/my-car`.

**Rules** (`services/garage.ts`)
- Up to 10 cars (`MAX_GARAGE_CARS`), nickname ≤ 40 chars, colour `#rrggbb` from the list.
- The make and model must be on the **vehicle list** (`Vehicle`, seeded from `src/vehicleCatalog.ts`): no free text. The year must
  fall inside an active **generation** (`VehicleGeneration`, e.g. "Corolla E170/E180"). If two generations overlap that year, the
  customer chooses; if only one matches it is chosen automatically.
- Exactly one car is **active** (partial unique index). The active car drives "fits my car" in the parts shop, pre-fills tow and
  mechanic request forms, and is the car shown in 3D.
- A car missing from the list can be **requested** (`app/customer/vehicle-requests/*`, `routes/vehicle-catalog.routes.ts`,
  `services/vehicle-catalog-requests.ts`): the customer enters make / model / year, uploads 4 guided photos (front, rear, left,
  right) and consents to processing and sharing. The Parts admin approves the request, starts a Meshy generation, checks the
  result and publishes it into the 3D catalog (limit: 10 requests per day).

**3D of my car** (`app/customer/car3d.tsx`, `features/car3d/*`): if the active car's generation has a published model
(`VehicleGeneration.model3dKey` + `isPublished`), it is shown in the customer's paint colour, with drag / pinch / double-tap and the
model's licence credit. Otherwise a "coming soon" card. The list of models comes from `GET /catalog/3d-models`.

**Tables**: `CustomerGarageCar`, `Vehicle`, `VehicleGeneration`, `VehicleBrand`, `VehicleCatalogRequest`, `Vehicle3DSubmission`.

---

## 4. Parts shop and products

### 4.1 The shop side
**Screens**: `app/provider/parts/(tabs)/products.tsx`, `products/edit/[id].tsx` (form in `features/parts/ProductForm.tsx`),
`inventory.tsx`, `categories.tsx`, `delivery.tsx`, `analytics.tsx`, `preview.tsx`, `media.tsx`.

**API** (`routes/parts.routes.ts`, `PARTS_PROVIDER` of an **approved** shop for writes):
- `POST /parts/me/products`, `PATCH /parts/me/products/:id`, `DELETE /parts/me/products/:id`, `GET /parts/me/products`.
- Fields: name, brand, part number, description, price (strict: ≥ 0, max 2 decimals, Arabic digits allowed), stock (whole number),
  **one leaf category** (`catalogCategories.ts`), condition (NEW / USED / REFURBISHED), type (OEM / AFTERMARKET / not stated), sale
  "was" price with an optional window, warranty months.
- Image: one JPEG / PNG / WEBP ≤ 5 MB, public. Products without a real photo (≥ 2 KB) are never shown to customers (`hasPhoto`).
- Fitment: at least one car **from the vehicle list** (optionally one generation, "Fits W202") or **Universal**. Free-text cars are
  refused (`toListedCars`).
- Stock cannot be set lower than what accepted orders have reserved.
- Delivery settings: `GET/PUT /parts/me/delivery` (on / off, fee or "agreed with the shop", area note). The owner delivers himself.

### 4.2 The customer side
**Screens**: `app/customer/(tabs)/parts.tsx`, `categories.tsx`, `category/[key].tsx`, `parts/[id].tsx`, `shops/[id].tsx`, map
`parts/map.tsx`; components in `features/catalog/*`.

**API** (`routes/catalog.routes.ts`, any signed-in active account):
- `GET /catalog/parts` with search (`q`, also matches a few Arabic body-kit words), make / model / year (fit filter), category or
  group, condition, type, brand, price range, in stock, on sale, shop city, sort (relevance, price, newest, discount), 20 per page.
- `GET /catalog/parts/:id`, `/catalog/shops`, `/catalog/shops/:id`, `/catalog/categories`, `/catalog/brands`, `/catalog/vehicle-list`.
- **Visible products only**: not hidden by an admin, shop APPROVED, with a real photo.
- "Does it fit my car?" is one rule (`services/fitment.ts`): `FITS` (a fitment row matches make, model, year, trim), `UNIVERSAL`,
  `NOT_LISTED` (has fitment data but not for this car) or `UNKNOWN`.
- Stock is shown as a state (IN / LOW / OUT) and `available` (stock − reserved, capped at 99); badges from
  `services/catalog-badges.ts` (discount %, sold out, low stock ≤ 3, new ≤ 14 days, used / refurbished).

### 4.3 Asking a shop and ordering
- **Inquiry** (`app/customer/inquiry/*`, `routes/part-inquiries.routes.ts`): a question about one product with messages; max 5 open
  per shop; the shop sees the customer's name, never the email.
- **Cart** (`features/orders/cart.ts`): one shop at a time, kept in memory; prices there are only a preview.
- **Checkout** (`app/customer/checkout.tsx`) → `POST /catalog/orders` (`routes/parts-orders.routes.ts`, `services/parts-orders.ts`):
  - 1–20 lines, quantity 1–99; pickup, or delivery with a pin inside the map area (only if the shop delivers). Payment is
    **cash only**: `PAY_AT_SHOP` or `CASH_ON_DELIVERY`. "Card" shows "Coming soon".
  - The **server reads its own prices**, checks free stock, computes subtotal + fee, and copies name / part number / price into the
    order lines. Max 5 orders waiting at one shop.
- **Shop handles it** (`app/provider/parts/(tabs)/orders.tsx`, `orders/[id].tsx`; `POST /parts/me/orders/:id/status`):
  `PLACED → ACCEPTED → PREPARING → READY_FOR_PICKUP → PICKED_UP` or `… → OUT_FOR_DELIVERY → DELIVERED`; `REJECTED` / `CANCELLED`
  need a reason. **Accept reserves stock** with a conditional SQL update (fails if not enough is free); delivered / picked up removes it
  from stock; cancel / reject releases it. The customer may cancel only while `PLACED`.
- Every step writes a system line in the order chat and a notification. During `OUT_FOR_DELIVERY` the owner's phone sends its position
  (`POST /parts/me/orders/:id/location`) and the customer can follow it (`app/customer/order/track/[id].tsx`).
- The shop sees the customer's **first name**, the delivery area, pin and note; never the email or phone.
- Parts admins read every order (`/parts/admin/orders`, active deliveries), read only.

**Tables**: `PartsShopProfile`, `PartsProduct`, `PartsFitment`, `ProviderFile`, `PartInquiry(+Message)`, `PartsOrder`,
`PartsOrderItem`, `PartsOrderMessage`, `Notification`, `AuditLog`.

---

## 5. 3D accessories ("View on my car")

The longest pipeline in the project (`services/accessory3d.ts`, ~850 lines). Supported accessory types for shops today, by product
category (`TYPES_FOR_CATEGORY`): **front / rear bumper** (Bumpers & body kits), **rear wing** (Wings & spoilers), **rims** (Wheels).
The schema knows more types (side skirts, lip, diffuser, roof rack, mirror covers…) but shops cannot request them yet.

### 5.1 Shop wizard
**Screen**: `app/provider/parts/accessory-3d/[productId].tsx` → `features/accessory3d/ShopWizard.tsx`, 5 steps:
1 what part, 2 which car (generations it fits; bumpers must be car-specific, never Universal; a rim on a Universal product is
"universal by size"), 3 photos of the loose part (2–4 guided photos) **or** the shop's own 3D file, 4 optional details (real size in
mm / inches, rim width / PCD / offset / finish, installed photos of the part on a car, notes), 5 review and submit.

**API** (`routes/accessory3d.routes.ts`): `GET/PUT/DELETE /parts/me/products/:productId/accessory-3d`, `POST …/photos/:kind`,
`POST …/model-file`, `POST …/submit`, `POST …/revise`. `submit` lists every problem at once (photos, fits, size sanity range, consent:
"I own these photos and allow MOTEXA to generate and show a 3D model") → `PENDING_REVIEW`.

### 5.2 Parts admin review and Meshy generation
**Screens**: `app/dept/accessory3d/index.tsx`, `[id].tsx` (`features/accessory3d/screens.tsx`, `FinalReview.tsx`).
1. **Approve photos** (`POST /admin/parts/accessory-3d/:id/approve`) → `APPROVED_FOR_GENERATION` (also approves installed photos for
   customers) — or reject with notes.
2. **Start** (`POST …/start` with `confirmPaid: true`) → `GENERATING`. This is the **only** action that can spend money. Real mode needs
   `MESHY_API_KEY`, paid generation not switched off, the admin's explicit confirmation, and the shop's **monthly credit cap**
   (`accessory3dMonthlyCredits`, default 5, set by the admin with `PUT /admin/parts/shops/:id/accessory-3d-credits`). Alternatively
   `use-shop-model` uses the shop's uploaded file instead of generating.
3. **The worker** (`startVehicle3DWorker`, every 5 s) moves the job through stages with a lease so two processes never run the same job:
   `GENERATING` (Meshy "multi-image to 3D" task, `services/meshy-client.ts`, model `meshy-7.1`, GLB output) → `DOWNLOADING` (only from
   `https://assets.meshy.ai`, size-capped) → `VALIDATING` (`readSafeGLB`, optimisation) → `CHECKING_FIT` (first preview) →
   `READY_FOR_FINAL_REVIEW`. In tests and dev "mock" mode a stand-in model is produced, and **mock output can never be published**.
4. **Six-view preview** (`POST …/preview`): the part is fitted on a car of a matching generation by the **real viewer code** run headless
   (`scripts/accessory-fit-check.mjs`, Playwright Chromium) and rendered from six angles.
5. **Publish** (`POST …/publish`) requires: a real (non-mock) model, a passed validation whose SHA-256 still matches the file,
   `visuallyVerified: true` **and** the exact `modelRevision` the admin looked at (a changed model must be checked again). The file is
   copied to `public/3d/accessories/acc-<hash>.glb` (content-addressed), the old candidates are deleted, the shop is notified, and
   auto-fitting starts in the background. `regenerate`, `unpublish`, `reactivate` exist too.

### 5.3 Part maps (so a bumper can replace the stock bumper)
**Screen**: `app/dept/accessory-zones/index.tsx`. **Service**: `services/car-part-map.ts`.
- Each car model is split into pieces (meshes → connected components) by the real viewer (`--views=segment`), then auto-labelled
  (`FRONT_BUMPER`, `REAR_BUMPER`, `SPOILER`, `SIDE_SKIRTS`, `MIRRORS`, `WHEELS`, `ROOF_RAILS`) as a **proposal** with a confidence.
- The Parts admin confirms or corrects the map (`PUT /admin/parts/part-maps/:key`), can save a measured size per label and, for cars
  whose bumper is merged into the body, a **cut box** (8 points) instead.
- The app receives a map only when it is confirmed **and** `modelSha256` equals the served file's hash. Otherwise bumpers on that car
  are refused (`PART_MAP_STALE`). Known limit: cars like the Mercedes W203 have the bumper merged into the body mesh
  (`docs/agents/KNOWN-ISSUES.md`).

### 5.4 Auto-fit
**Service**: `services/accessory-autofit.ts`. After publishing, every fitting generation gets a fit computed **once** by the real viewer
(`fitAccessory` in `mobile/src/features/car3d/sceneHtml.ts`) and stored in `AccessoryAutoFit` with `carRevision`, `partRevision` and
the viewer's `fitVersion` for that type. It is recomputed only if one of those changes. The fit includes an automatic quality check
(clip / gap in millimetres). The Parts admin reviews fits per car or in bulk (`app/dept/accessory-fits/index.tsx`,
`features/accessory3d/BulkFits.tsx`): bulk approve only takes fits whose state is exactly "passed"; a manual correction (`adj`) must
pass the viewer's clearance check again.

**Bulk fits screen (one accessory on all its cars, built for 5,000 cars).** A virtualized list paged and filtered on the server
(`GET /admin/parts/accessory-3d/:id/fits?q&make&model&generationId&status&offset&limit`; status `correction` = needs correction or a
stored correction), one row per car (checkbox, brand / model / generation / years, state, ⋮ menu), "Select all" (rows on screen) and
"Select all matching the filter". A selection is sent as `{ generationIds ≤ 500 }` or `{ filter, exclude }`, never thousands of ids.
The rows are computed with batched reads (`modelsWithZones`, cached file hashes) and kept 10 s per process (`fitRows`); approve and job
creation always compute fresh.
- **Approve passed fits** (`POST …/fits/approve`, `dryRun` for the confirmation): only "passed" fits, each only if its stored fit is
  unchanged (same `updatedAt`, no correction) in one locked `UPDATE`; returns `{ approved, skipped: { reason: count } }`; one audit row
  per car + a summary row.
- **Run auto-fit** (`POST …/fits/jobs`, `GET …/fits/jobs/current`, `POST …/fits/jobs/:jobId/cancel`): a resumable background job
  (`AccessoryFitJob`, `services/accessory-fit-jobs.ts`, its own 3 s worker loop with a lease renewed per car; one queued / running job
  per accessory). Approved fits are skipped by default; "Also re-run approved fits" must send `confirmApprovedReset` = the exact number
  of approvals that will be reset (customers lose "View on my car" for those cars until re-approved). Each car is fitted like an explicit
  rerun. The screen shows a progress bar and "about N min left" (average time per fitted car × cars left) and keeps it after leaving.
  5 errors before any success stop the job (`FIT_CHECKER_UNAVAILABLE`).
- **3D only on demand**: tapping a row previews that one car (a sheet on phones, a side panel from 900 px), never several viewers.

### 5.5 FIT-QA (the quality report)
`backend/scripts/fit-qa.ts` + `fit-qa-report.ts` put every published accessory (and test-only "stand-in" boxes) on every active car
through the real viewer and write `docs/3d/FIT-QA.md`. Tiers: **GOOD** (visible clip ≤ 6 mm and gap ≤ 6 mm, or 0.5 % of the part size),
**PERFECT** (clip ≤ 2 mm, gap ≤ 3 mm), **REFUSED** (not shown, with the measured reason). The current report: the 3 real published parts
on the cars they fit are shown in 23 / 23 combinations. It is a developer report, read-only for the database; the same check runs inside
each auto-fit.

### 5.6 "View on my car" (customer)
**Screens**: the product page `app/customer/parts/[id].tsx` (`features/accessory3d/customer.tsx`) → `app/customer/car3d.tsx?product=…`.
- `GET /catalog/products/:productId/accessory-3d?generationId=…` (`forProduct`) and `…/accessory-3d/garage` (which of my garage cars
  can show it).
- A part is offered on the customer's car only if **all** hold (`fitEligibility`): the accessory is published, visually verified, not
  deactivated, not mock, its file exists; the product is visible and the shop approved; the car's generation has a published 3D model;
  for bumpers a confirmed, current part map (or cut); a stored, current auto-fit that did not fail; and **the Parts admin approved that
  fit**. Otherwise the app shows the reason (e.g. "This part doesn't fit your car").
- In the viewer: the stored fit + the admin's correction, "paint to match" (or the rim's finish), each kit part on / off.
- "Installed look": the shop's approved photos of the part on a car, with drag-to-spin when there are 12+ photos around the car.
- Customers can no longer save their own adjustment: `PUT …/adjust` answers `403 FIT_ADMIN_ONLY`.

**Tables**: `ProductAccessory3D`, `ProductAccessory3DFit`, `ProductAccessory3DPhoto`, `AccessoryAutoFit`, `CarPartMap`,
`AccessoryFitZone`, `Vehicle3DRevision`, `VehicleGeneration`.

**Open** (`docs/agents/KNOWN-ISSUES.md`, 2026-11-13): some demo parts were waiting for an admin to re-verify / approve fits; several fixes
were marked unverified because they need a paid Meshy run.

---

## 6. Tow

### 6.1 Request
**Screens**: `app/customer/(tabs)/tow.tsx` (companies, nearby free drivers, map), `tow/[id].tsx` (company), `tow/drivers.tsx`,
`towrequest/new.tsx` (`features/requests/TowRequestForm.tsx`), `towrequest/[id].tsx` (live status), `towrequest/chat.tsx`.

**Choose how** (`choiceMode`): **NEAREST** (the nearest free driver of any approved company), **COMPANY** (a company; it assigns), or
**DRIVER** (one free driver the customer picked).

**API**: `GET /catalog/tow/companies` (approved companies with at least one approved truck; distance from the customer, free drivers,
real ratings, available trucks), `GET /catalog/tow/drivers?lat&lng` (free drivers with their card and a rounded pin),
`POST /requests/tow` (`routes/tow-requests.routes.ts`).
- Required: pickup and destination addresses, a contact phone, car make + model, a problem type (won't start, accident, flat tyre,
  overheating, out of fuel, other); optional map points (inside the map box), notes, year.
- The company must be APPROVED and have an AVAILABLE, approved, not archived truck with **no expired document**
  (`services/truck-eligibility.ts`).
- **One active request per customer and company** (code check + the partial unique index).

### 6.2 Offers and routing (`services/tow-dispatch.ts`, `services/tow-offers.ts`)
- `routeNewRequest()` sets `offerExpiresAt = now + TOW_OFFER_MINUTES` (default 3). A request to a driver goes to that driver; a request
  to a company is auto-assigned when exactly one driver is free (unless the customer chose COMPANY), otherwise the owner assigns
  (`POST /tow/me/requests/:id/assign`).
- The **sweeper** (every 20 s): an unanswered NEAREST offer moves to the next nearest free driver not tried yet (`triedDriverIds`,
  possibly another company); when nobody is left — or for COMPANY / DRIVER requests — it ends as `CANCELLED` by `SYSTEM` with reason
  `TIMEOUT`. Everyone is notified and it is audited (actor null = MOTEXA).

### 6.3 Driver statuses and the job steps
- A driver (`TowDriver`) is added by the approved company owner: a new `TOW_DRIVER` login (invited by email to set a password through the
  recovery flow) or the owner himself ("I drive too"). Every driver starts `PENDING` until a **tow admin approves the licence photo**
  (`POST /admin/tow/drivers/:id/review`).
- Status is computed (`driverStatus`): `UNAPPROVED`, `OFFLINE` (the driver's own switch), `BUSY` (has an ACCEPTED / EN_ROUTE /
  IN_PROGRESS job), `NO_TRUCK` (no linked truck that may work), else `FREE`.
- The driver app (`app/driver/job/[id].tsx`, `routes/tow-drivers.routes.ts`): accept (atomically claims his truck: APPROVED + AVAILABLE
  → BUSY) or decline; then strictly in order: **On the way → Arrived → Loading → Towing → Delivered → Completed** (`STEP` table; nothing
  can be skipped or undone). Cancel needs a reason. Completing releases the truck (AVAILABLE again only if it may still work).
- Jobs without a driver are moved by the company (`PATCH /tow/me/requests/:id/accept` with a truck, `…/status`, `…/decline`,
  `…/cancel`); a job with a driver is moved only by that driver.
- The customer may cancel freely until the driver is on the way; while EN_ROUTE a reason is required; not once loading started.

### 6.4 Live location
- While a job is active **and the driver's job screen is open**, the phone sends its position (`POST /driver/jobs/:id/location`,
  foreground only, about every 10 s / 5 m; the server ignores pings closer than 5 s). Points are rounded to 5 decimals, stored in
  `TowDriver.lastLat/Lng` and a short trail (`TowJobTrail`, newest 300), and `distanceMeters` grows.
- The customer, the company owner (`app/provider/tow/live.tsx`) and tow admins see the live point; it is marked stale after 2 minutes.
- When the job ends (completed / cancelled / reassigned) the trail is **deleted** and the driver's last point cleared (`endTrail`);
  only the distance summary stays.
- Before a job, a free driver is shown at his truck's base (or the company base, or the city centre), rounded to ~110 m: there is no
  idle tracking.

### 6.5 Chat, rating, report
`routes/tow-job-extras.routes.ts`: chat customer ↔ assigned driver only while the job is active (the owner can read); after COMPLETED
the customer can rate once, 1–5 stars + comment (`TowReview`, unique per job; counts for the driver and the company; "New" when there
are no ratings); "Report a problem" goes to every tow admin (`TowReport`), who can close it.

### 6.6 Tow admin
`app/dept/tows/*`: active jobs, history with filters, job detail (trail while active, reports, review), cancel any open job with a reason,
driver licences, reports; companies and trucks: review, edit, add a truck, **archive / restore** a truck (never a hard delete).

**Tables**: `TowCompanyProfile`, `Truck`, `TowDriver`, `TowRequest`, `TowJobTrail`, `TowRequestMessage`, `TowReview`, `TowReport`,
`ProviderFile`, `Notification`, `AuditLog`.

---

## 7. Mechanics

**Customer screens**: `app/customer/(tabs)/mechanics.tsx`, `mechanics/map.tsx`, `mechanic/[id].tsx`, `mechanicrequest/new.tsx`
(`features/mechanics/MechanicRequestForm.tsx`), `mechanicrequest/[id].tsx`.
**Mechanic screens**: `app/mechanic/index.tsx`, `requests/index.tsx`, `requests/[id].tsx`.

**Public mechanics** (`routes/catalog-mechanics.routes.ts`): `publicMechanic` = role MECHANIC, account ACTIVE, profile VERIFIED. List with
search, city, skill, sort by name or nearest. Shown: name, workshop name, city, skills, years; the detail adds the workshop address.
**Never**: phone, email, national id, documents, review / interview notes. Distance today is always from the **city centre**: MOTEXA
stores no workshop coordinates yet (`distanceSource: "city"`).

**Requests** (`routes/mechanic-requests.routes.ts`):
- `POST /requests/mechanic`: mechanic, optional skill (must be one of the mechanic's), car make / model / year, problem (10–1000
  chars), location text + optional pin, preferred time (free text), optional phone. Max 3 open requests with one mechanic.
- State machine: `REQUESTED → ACCEPTED → IN_PROGRESS → COMPLETED`; the mechanic may decline (optional reason); the customer may cancel
  while REQUESTED / ACCEPTED. Each step is one conditional update + an audit row. A mechanic who is no longer public cannot answer.
- **Privacy** (`mechanicView`): before accepting, the mechanic sees the customer's **first name only**, the car, the problem, the nearest
  city to the pin and the pin **rounded to 0.01° (~1 km)**, marked approximate — no address, no phone. The exact address, pin and phone
  (if typed) are shown **only while ACCEPTED / IN_PROGRESS**; afterwards it goes back to approximate. The customer never sees the
  mechanic's phone or email. Tested in `backend/tests/mechanic-request-privacy.test.mjs`.
- There is **no chat, no price and no rating** for mechanic requests.

**Admin supervision** (`routes/mechanics-admin.routes.ts`, `app/dept/requests` → "Mechanic requests", `app/dept/mechanic-requests/[id].tsx`):
stats, active / history lists (search by customer, mechanic, workshop or city — never by address; the list never carries address or
phone), detail with **the same location rule as the mechanic** (every open is audited, `MECHANIC_REQUEST_ADMIN_VIEWED`), and cancel with
a required reason (audited, both sides notified and shown the reason).

**Tables**: `User`, `MechanicProfile`, `MechanicDocument`, `MechanicRequest`, `Notification`, `AuditLog`.

---

## 8. Admins and the super admin

### 8.1 Creating an admin (invitation)
1. The super admin (`app/admin/admin-management.tsx`) sends `POST /admin-invitations` with full name, email and **one** permission
   (`routes/admin-invitations.routes.ts`). A 64-hex token is generated; only its SHA-256 is stored; it expires in 24 h. The email
   contains a link to `/api/auth/admin/open-invitation?token=…`.
2. That link opens a small HTML page (`services/activation-link.service.ts`, strict security headers) with a button to the app deep
   link `motexa://auth/admin-activation?token=…` (or an `exp://` link to Expo Go in development).
3. `app/auth/admin-activation.tsx`: `POST /auth/admin/verify-invitation` → `POST /auth/admin/request-otp` (emailed code, 60 s / 5 per
   hour) → `POST /auth/admin/verify-otp` (5 tries) → `POST /auth/admin/activate` with a strong password. Activation locks the invitation
   row (`SELECT … FOR UPDATE`), consumes the verified code once, creates the `ADMIN` with its permission and audits it.
4. The super admin can revoke a pending invitation and suspend / reactivate an admin (`PATCH /admin-invitations/:id/status`).

### 8.2 Department admins (`/dept`)
Every department admin works in the same area with the same five tabs (Home, Requests, Directory, Messages, Profile). What each tab
shows comes from one config per department (`mobile/src/features/department/departments.ts`). An admin with several permissions can
switch department (`DepartmentContext.tsx`).
- **Towing**: company / truck / driver review, tow jobs, reports, live map, edits and truck archive.
- **Spare parts**: shop review, product hiding (`PATCH /admin/parts/products/:id/visibility` with a reason), admin edits, orders
  (read only), and everything 3D: the vehicle catalog (brands, models, generations), Sketchfab / file imports, car models (configure,
  hide / show, delete with an impact preview), customer car requests, accessory review, zones, part maps, auto-fits, shop credits.
- **Mechanics**: applications (interview + decision) and request supervision.
Admins **decide**; they do not silently edit provider data. Where an admin does edit (trucks, products, shop fields), the audit action
gets an `ADMIN_` prefix and `byAdmin: true`.

### 8.3 Super admin (`/admin`)
- Dashboard (`GET /admin-management/dashboard`): real counts of admins, mechanics, pending mechanics, active mechanic requests, pending
  invitations, tow companies and parts shops by status.
- Providers directory (`GET /admin-management/providers`, read only).
- Requests overview (`app/admin/(tabs)/requests.tsx`): what is waiting in every department, from the departments' own endpoints; a
  source that fails shows "—" (nothing estimated).
- Admin management (invite, revoke, suspend, reactivate) and "Departments": because every department guard also accepts
  `SUPER_ADMIN`, the super admin can open any department.
- There is one super admin, created by `src/seed/super-admin.ts`; there is no screen to create another.

**Tables**: `User`, `AdminPermission`, `AdminInvitation`, `AdminInvitationOtp`, `AuditLog`.
