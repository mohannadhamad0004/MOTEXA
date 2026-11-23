# MOTEXA — Owner tabs and entry flow, 17 November 2026

This report supersedes the entry-flow description in v7. It records implemented changes and measured tests, not a claim that every service in the platform is production-ready.

## Final agreed customer entry

Choose Car Owner → **the existing shared Sign in** → use **Create a new account** below the form when needed → save customer registration → shared Sign in → first vehicle setup if no saved vehicles → save vehicle → Owner Home.

Returning owners with a saved vehicle open Home normally. First vehicle setup stores make, model, year and fuel type, and supports uploading a real car photo. Photo selection does not infer or replace those fields. Photo upload remains optional under the existing policy; the four metadata fields are validated. Vehicle creation opens Home after persistence succeeds. Account/settings and sign-out remain accessible; this is an onboarding destination, not an authorization barrier preventing access to an empty garage.

The role-selection file is restored to its original common login destination. Login UI, introduction, public role photography, original fonts and original FloatingRoleTabs were not redesigned. Mechanic/admin routes and UI were preserved.

## Implemented visual changes

| Area | Earlier composition | Current implementation |
|---|---|---|
| Home | Greeting, brand selectors and a separate rectangular car scene | A single composition with greeting, saved-car selectors, vehicle title, interior/exterior controls and full-scene photography; the car is integrated into the background |
| New owner | Home before vehicle entry | Existing first-car form is the default first destination after login; Home follows successful vehicle save |
| Home services | One large workshop tile plus three small tiles | Four photo-led services in a balanced two-column grid; AI has a circuit/orbit visual treatment |
| Active request | Below the services | Directly below the Home hero, with actual status and request title |
| Garage | Differently sized repeated cards | Consistent compact vehicle exhibits with dimensional shadows, prominent model/year, clear selected state and original real CRUD actions |
| Requests | Decorative photograph before status cards, small moving-dot timeline | Service-control header with actual current/history counts; prominent status, numbered progress and labelled milestones; actual update time when supplied |
| Account | Nested rounded panels | Full-width interior composition, identity and real counts, clean contact rows, separated preferences and preserved editing/sign-out |
| Future AI/parts/towing | Generic coming-later message | Distinct editorial service pages; AI has its own connected-node visual language. Unavailable status is stated near the top and before actions |

The photographic/cutout assets create visual depth; they are not interactive 3D models. Uploaded owner photos take priority and remain private/authenticated. Model art and illustrative interiors stay labelled, and unknown models are not assigned an unrelated owned car.

## Files changed

- `src/components/OwnerHome.tsx`
- `src/components/OwnerHomeServices.tsx`
- `src/components/OwnerHomeShowcase.tsx` — exports the existing matched-model cabin lookup
- `src/components/OwnerGarageVehicle.tsx` — new reusable garage display
- `src/components/OwnerGarage.tsx`
- `src/components/OwnerVehicleEditor.tsx` — clearer metadata/photo guidance
- `src/components/OwnerRequestProgress.tsx`
- `src/components/OwnerRequestsIntro.tsx` — new
- `src/components/CustomerRequests.tsx`
- `src/components/OwnerAccountIntro.tsx` — new
- `src/components/CustomerAccount.tsx`
- `src/components/OwnerServicePortal.tsx` — new
- `src/components/CustomerWorkspace.tsx`
- `tests/owner-fullstack.mjs` and `tests/owner-vehicle-photo.mjs` — align first-entry assertions with the agreed vehicle-setup-before-Home flow

No backend source, database schema or migrations changed in this refinement. Existing APIs and ownership/version/idempotency checks remain in use. The previously added four local mechanic display accounts remain in the database.

## Complete screen checklist

| Screen / function | Status | Evidence / remaining work |
|---|---|---|
| Public introduction and roles | Preserved | Protected checksums; customer role enters shared login |
| Shared Sign in | Preserved | Actual valid/invalid login and existing mechanic entry verified |
| Customer Create account | Integrated | Actual UI registration stored as ACTIVE CUSTOMER in PostgreSQL |
| Forgot password / recovery | Existing | External email delivery not verified in this phase |
| First vehicle setup | Integrated; clarified | Default first destination for owners without vehicles; make/model/year/fuel saved before Home |
| Car photo upload | Integrated | Browser chooser, real backend sanitization/persistence, reload and removal tested |
| Home | Re-composed | Background-integrated vehicle, real saved selectors, photo priority, direct mechanic action, current request |
| My Garage | Re-composed | Real add/edit/select/archive and reload persistence tested |
| Vehicle details | Retained and reviewed | Correct selected car, real metadata, edit/remove/service actions |
| Circular launcher | Preserved from v7 polish | Original tabs retained; contained service menu remains functional |
| Mechanic service modes | Existing; preserved | Workshop is the active implementation priority; mobile/online entries retained |
| Approved mechanic discovery | Integrated | Multiple persisted mechanics; actual city/mode filters; no fabricated ratings |
| Mechanic profile | Integrated | Actual specialties, experience, address and saved map destination |
| Request details | Integrated | Real vehicle/mechanic association, required contact and problem fields |
| Review / submission | Integrated | Actual request creation and saved database state |
| Confirmation | Integrated | Real saved request and Track action |
| Request statuses | Re-composed | Pending/accepted/in-progress/completed/declined/cancelled supported; no inferred state transitions |
| Workshop journey / GPS | Integrated; device validation pending | Real API/DB/role checks, route/map and browser-emulated GPS start/arrival; not physical device movement |
| My Requests / history | Re-composed | Current/history counts, progress and actual status updates; archived-car request snapshot retained |
| Account / settings | Re-composed | Actual name/phone save, language/theme preferences and sign-out preserved |
| Arabic / English, dark / light | Reviewed | 320px Arabic light, 390px English dark, 430px English light |
| Loading/empty/error/success/confirmations | Existing components retained | Authentication errors, validation, real persistence, cancellation and success exercised; not every transient state recaptured |
| AI assistant | Visual future-service page | No AI backend/chat integration is claimed |
| Parts / towing / other providers | Future-service visuals only | Ordering/provider workflows are outside this workshop phase |

## Tests performed

- TypeScript `tsc --noEmit`: PASS.
- ESLint on all 14 affected owner/entry source files: PASS after correcting the load callback's `preview` dependency.
- Expo production web export: PASS.
- Actual entry flow: role → shared sign-in → Create a new account → UI registration saved in PostgreSQL → sign-in → vehicle setup → save make/model/year/fuel → Home → account sign-out. PASS. The mechanic role still opens original sign-in.
- `owner-fullstack.mjs`: PASS using the real live backend. Includes firstVehicleSetupBeforeHome, invalid login rejection, vehicle CRUD/selection/reload, request save, acceptance/start/completion, existing mobile cancellation/online decline regression, account persistence and sign-out. No browser page errors.
- `owner-vehicle-photo.mjs`: PASS after entry-flow update. Actual photo chooser/upload, save, private photo reload and removal.
- `owner-workshop-quick-journey.mjs`: PASS after the tab redesign. Actual mechanic discovery/profile/map, review/save, mechanic acceptance, browser-emulated GPS arrival, start/complete/history.
- Visual capture matrix: 16 views × 3 configurations = 48 captures. No page JavaScript errors, document horizontal overflow or production API calls from the isolated public preview.
- Preserved-file checks: original introduction, shared login, original tabs, role option/photo components and all files under mechanic/admin route directories remained unchanged. The temporary signup-first role condition was removed; role selection is back to its original source.

The whole-project lint command is not claimed green. The previous run reported 24 errors and 6 warnings in files outside this refinement (including shared legacy/scratch files and mechanic-preview); they were not edited to avoid changing protected scope.

## Remaining limitations

- Location sharing is foreground-only. Background/closed-app location tracking is not implemented.
- GPS tests used browser-provided coordinates. A real Android/iOS journey is required to verify physical accuracy, permission prompts, road following and interruptions.
- Workshop destinations require genuine saved workshop coordinates. The local seeded display profiles have no verified real workshop coordinates; random real-world destinations were not assigned to them. Automated GPS tests use separate isolated fixtures.
- External password-recovery email delivery remains unverified.
- Physical native safe-area/performance testing remains outstanding; mobile-sized browser screenshots are not native-device certification.
- AI, parts, towing/provider workflows, and customer ratings are not completed full-stack features. No fake AI responses, inventories, ratings or provider availability were added.
- Discovery remains city/mode filtering, not nearest-distance sorting.
- Existing request polling/refresh is retained; there is no claim of instantaneous push delivery.
- The public road-routing/map services require connectivity and do not provide a production service guarantee.

## Preview

Design-only review without registration: http://127.0.0.1:58132/customer-preview?review=owner-v8-final

Real entry: http://127.0.0.1:58132/choose-role

The isolated preview is clearly a visual walkthrough. Full-stack tests run separately against real authentication, APIs and PostgreSQL. Visual acceptance against the reference is still the user's decision.
