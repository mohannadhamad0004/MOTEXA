# MOTEXA — Car Owner delivery and verification

Latest owner refinement: [v5 implementation, screen checklist and remaining checks](car-owner-refinement-v5.md). Earlier visual screenshots below are historical.

Current visual refinement: [screen-by-screen report](car-owner-ui-refinement.md), [actual screenshots](owner-refinement-after.png), [before/after](owner-refinement-before-after.png). This supersedes earlier capsule-navigation screenshots.

16 November 2026 · React Native / Expo SDK 57 · Chocolate and bronze identity

Implemented in the active repository: `C:/Users/Zain/OneDrive/Dokumente/GitHub/MOTEXA`.
The public introduction, owner authentication and owner workspace now share cinematic car compositions, newly generated model illustrations, dark chocolate surfaces, bronze gradients, the original named, animated FloatingRoleTabs navigation, accessible controls and RTL-aware transitions.

Current acceptance priority is **the workshop journey**. Further online-consultation work is deferred at the user's request. Existing mobile/online request integrations were preserved; they are not a chat, video-call or appointment system.

## Screen-by-screen checklist

| # | Screen / capability | Implementation and actual verification | Remaining limitation |
|---|---|---|---|
| 1 | Cinematic launch, welcome, role selection | New BMW scene, trajectory line, four intro chapters, swipe/skip, owner role routing; production English/Arabic × light/dark entry tests passed. | Physical-device swipe/performance review pending. |
| 2 | Registration and login | Shared cockpit hero and controls; real registration, failed login, valid login and sign-out verified against the configured live API. No token is issued by registration. | None in tested owner flow. |
| 3 | Forgot password / recovery | Email, code, new password and completion screens; real PostgreSQL-backed reset via a test mail sink. Wrong code rejected; old password and sessions revoked. Direct-link hydration fixed. | Actual external email delivery was not exercised. |
| 4 | First vehicle setup | Make, model/year and fuel steps, manufacturer marks, new studio art, validation and saving; real API/database verification. | Illustrations cover BMW M8 and Corolla 2018; other models have an explicit unavailable-art state. |
| 5 | Customer Home | Actual selected-vehicle data, layered car card, ghost model type, service CTA, current request and motion control. Captured and interacted with in both languages/themes. | Illustrations are labeled; fictional image plate digits are not owner vehicle data. |
| 6 | My Garage | Add, select, edit and archive/delete with confirmations; real persistence, reload restoration, selected-car change and archive history preservation verified. | Existing API limit: 50 non-archived vehicles. |
| 7 | Vehicle details | Large vehicle stage, real year/fuel/selection instruments and edit/remove/service actions; exercised through actual UI. | Same illustration catalogue limitation as setup. |
| 8 | Circular service launcher | Animated radial choices and close overlay; verified expansion, click-through and reduced-motion behavior. | Parts, towing and AI remain existing future-scope choices. |
| 9 | Workshop / mobile / online selection | All three existing choices retain real API mode values. Workshop is the completed primary journey. Mobile address validation/cancellation and online request/decline were regression-tested. | Further online-consultation experience deferred by user. No appointment, payment, chat or video is implied. |
| 10 | Approved mechanic discovery / filtering | Real city and mode filters, eligibility checks, search, loading and empty states; real isolated approved workshop found through API. | No fabricated ratings, availability slots or faces. |
| 11 | Mechanic profile | Real profile fields, specialties, experience, city, service modes and workshop address; editorial image is labeled. Profile-to-request navigation tested. | Photograph is editorial, not a claimed photo of the mechanic/workshop. |
| 12 | Request creation | Actual selected saved car, mechanic, title, description, phone and conditional mobile address; invalid input blocked and draft retained after failed send. | None in workshop request flow. |
| 13 | Review and submission | Vehicle/specialist summary and editable details; actual POST and idempotent key handling; real request row verified. | Sending requests does not confirm a time or payment. |
| 14 | Request confirmation | Animated bronze success mark, actual saved request reference and tracking action; actual server response drives the screen. | None in tested flow. |
| 15 | Request tracking | NEW, ACCEPTED, IN_PROGRESS, COMPLETED, DECLINED and CANCELLED rendered and tested. Actual mechanic accept/start/complete and decline reason appear to customer. | Updates refresh/poll every 15 seconds while focused; manual refresh available. |
| 16 | Current requests / history | Actual customer-owned requests, current/history filters, details, progress and cancellation. Cancelled/declined/completed records verified. | Existing API returns latest 100 requests; pagination is not added. |
| 17 | Profile and settings | Persisted name/phone edits, email display, garage/request links, language, appearance and themed sign-out confirmation. Real PATCH verified; sign-out clears local token. | No new account-deletion or email-change feature added. |
| 18 | Arabic / English, dark / light | Eight owner interaction cases at 320/390 px passed; four production public-entry combinations passed. Owner defaults dark; preference persists separately from other workspaces. | Android/iOS native screenshots and large-font accessibility audit pending. |
| 19 | Loading / empty / error / success / confirmation | Branded initial loading; empty current/history/directory; failed load/retry; expired and wrong-role session; failed send/retry; invalid login; recovery failure; archive/cancel/logout dialogs. Production state suite passed. | See global lint and device limits below. |

## Approved concurrency rule — implemented and verified

Two customers can submit workshop requests simultaneously. Both remain `NEW` until a mechanic decides. A mechanic can have **one** `ACCEPTED` or `IN_PROGRESS` request. A conflicting acceptance returns HTTP 409 with `MECHANIC_BUSY`; the losing request stays `NEW`, unchanged, and is not silently declined.

- Capacity decisions reuse the existing transaction and mechanic-row `FOR UPDATE` lock.
- Migration `20261116170000_one_active_service_per_mechanic` adds a PostgreSQL partial unique index over active statuses.
- Migration preflight found **zero** existing conflicting mechanics. It aborts if conflicts exist and never rewrites existing statuses.
- Two parallel HTTP accept calls returned one 200 and one 409; exactly one acceptance audit and one customer notification were recorded.
- Busy capacity remained enforced during `IN_PROGRESS`; completion released capacity.
- Capacity is shared across all three modes (workshop, mobile, online); changing mode cannot bypass a busy mechanic. A second mechanic could work independently. A direct database attempt to bypass capacity failed with unique-constraint enforcement.
- Competing start/complete updates respected version/state checks.
- The real mechanic UI handled a stale-tab acceptance conflict, refreshed its feed and disabled acceptance while busy. The second customer continued seeing the pending request. After completion the mechanic accepted it and the customer saw `ACCEPTED`.

This is a **service capacity rule**, not appointment-slot scheduling. Pending requests do not reserve a time.

PostgreSQL mechanisms: [row locks](https://www.postgresql.org/docs/current/explicit-locking.html), [partial unique indexes](https://www.postgresql.org/docs/current/indexes-partial.html).

## Backend audit and targeted changes

Preserved Node.js, Express, TypeScript, JWT, Prisma/PostgreSQL, all existing roles and REST contracts. Existing ownership, role, verified-mechanic, idempotency and transition enforcement were audited and regression-tested.

The backend changes are scoped to the approved missing capacity invariant, its safe migration and tests, plus requested centralized request observability. Request IDs and structured JSON result/error records now correlate failures without logging passwords, tokens, request bodies or query strings. The central fallback returns safe errors; existing route business-error handling remains in place.

No production demonstration accounts or requests were left behind. All verification fixtures were isolated and cleaned up.

## Verification evidence

- Frontend TypeScript check: passed.
- Scoped ESLint over changed owner, entry, authentication and mechanic-capacity components: passed without errors.
- Production web export: passed.
- Backend TypeScript/build: passed.
- Prisma: 17 migrations, database up to date.
- Existing owner/vehicle/request tests plus concurrency and observability privacy tests: **5 passed**.
- Existing account recovery tests: **16 passed**.
- Owner preview interaction matrix: **8 passed** (English/Arabic × dark/light × 320/390 px). Preview is development-only and never calls business APIs.
- Production entry matrix: **4 passed**, including intro navigation, role selection, registration/login/recovery layouts, no horizontal overflow and no browser exceptions.
- Production loading/status/error/motion suite: **9 passed**.
- Real recovery UI: passed through actual reset handlers and PostgreSQL with a test mail sink.
- Direct live customer–mechanic flow: passed without browser API interception, including invalid login, registration/login, add/select/edit/archive, database persistence and reload, workshop NEW → ACCEPTED → IN_PROGRESS → COMPLETED, mobile request/cancel, existing online request/decline, account save and sign-out.
- Direct live mechanic capacity UI: passed, including stale-tab conflict and later release/acceptance.

Runtime used: production frontend at `http://127.0.0.1:58132`; existing backend started at its configured port 5055. The mobile `.env` API address remains unchanged.

## Visual review and remaining limits

Actual implementation screenshots were inspected across welcome, role selection, access, setup, Home, Garage, details, services, profile, booking, confirmation, tracking, account, recovery and failure dialogs. Review corrected mobile ghost-type sizing, image framing, floating-navigation persistence, focus rings, direct-link hydration and form fuel controls.

The supplied luxury references guided composition, scale, dark layering, vehicle staging and controls. This delivery does **not** claim pixel identity or a completed physical-device performance certification.

Outstanding limits:

1. Physical Android/iOS device QA, large-font audit and native animation profiling remain unperformed.
2. External recovery email delivery was not tested; the UI/API/database reset flow was tested using a mail sink.
3. Further online consultation is deferred per user instruction; chat/video/appointments/payments are not implemented here.
4. Vehicle illustration coverage is currently BMW M8 and Corolla 2018. Other models remain functional with explicit missing-art messaging.
5. Full-project `expo lint` has existing failures in unrelated files (`mechanic-preview`, `GlassSurface`, `InteractiveButton`, `PremiumUI`, scratch `Untitled` scripts). Changed-scope lint passed; these unrelated failures were not hidden or rewritten.
6. Existing history and garage API limits are documented in the checklist.

## Reproduce verification

From `backend`:

```powershell
npm run build
npx prisma migrate deploy
node --test tests/customer-journey.test.mjs tests/customer-vehicle-management.test.mjs tests/service-requests.test.mjs tests/service-request-concurrency.test.mjs tests/request-observability.test.mjs
node --import tsx --test tests/password-reset.test.ts tests/password-reset-route.test.ts tests/password-reset-db.test.ts tests/password-reset-completion.test.ts
```

From `mobile`, with the frontend served at the URL set in `MOTEXA_APP_URL`:

```powershell
npx tsc --noEmit
npx expo export --platform web --output-dir dist-owner-reference
# In a separate terminal, serve the export:
# node scripts/serve-owner-web.cjs
$env:MOTEXA_APP_URL='http://127.0.0.1:58132'
$env:MOTEXA_LIVE_API='http://192.168.1.40:5055'
node tests/owner-fullstack.mjs
node tests/owner-capacity-ui.mjs
node tests/owner-recovery.mjs
node tests/owner-states.cjs
node tests/owner-access.cjs
```

Browser tests require installed Edge and the existing Playwright dependency. Use a dedicated development/test database; tests create and clean isolated fixture rows. Recovery tests use a local mail sink and send no live email.

## Image assets

Built-in image_gen produced the three project-bound assets:

- `mobile/assets/images/owner-studio-m8-v2.png`
- `mobile/assets/images/owner-studio-corolla-v2.png`
- `mobile/assets/images/owner-studio-interior-v1.png`

Original manufacturer marks are visible. Number plates are fictional illustrative digits, not project logos or saved owner data. Final generation/edit prompts are recorded in `ASSET-PROMPTS.json` alongside this delivery package.
