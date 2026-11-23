# MOTEXA — Owner journey refinement v5

16 November 2026. Scope: Car Owner screens, isolated owner preview, and the missing owner vehicle-photo integration. This is a refinement of existing functionality, not a rewrite.

## Outcome and interaction model

The normal journey is role selection → shared sign-in → optional create-account → shared sign-in → owner Home. New owners arrive on Home, then add their first car. Returning owners see their saved car, current request and primary mechanic action in one cinematic card.

The service circle remains interactive. A second, shorter entry from Home opens approved mechanic discovery directly, with Workshop / Mobile / Online tabs on the same page. Existing three service-mode cards remain available through the service circle. Mechanic profile, request details, review/send, confirmation and tracking retain their separate responsibilities; the public preview menu is not a required wizard.

Workshop directions and foreground GPS are opened from the accepted workshop request. They are not a separate required journey stage. Existing pending/accepted/in-progress/completed/declined/cancelled request statuses and service history remain.

## Visual changes

- Existing Great Vibes greeting titles and owner Arabic typography reused across owner headings. Functional vehicle/model names and form labels remain readable body type.
- Home shortened: vehicle, actual request status and primary action merged. Driving motion is integrated into the smaller service console; the extra film card was removed.
- First-car studio keeps exterior/interior switching. Seven manufacturer choices have distinct exterior and cabin illustrations. A compact model-example info panel is available. Example metadata is explicitly separate from actual customer-entered make/model/year/fuel.
- New Porsche front/rear views differentiate Home and the collection. Twelve new AI-generated assets are project-local; prompts are in owner-ui-v5-assets.json. These are static illustrated views with depth, not an interactive 3D model or verified factory configuration.
- Customer signup uses the existing shared header/brand, a studio image, greeting, grouped form card and a chocolate/bronze action. The real register/login flow is preserved.
- Account has a cockpit-backed identity card, actual counts and grouped detail/preferences rows. Theme and language options expand inside their card; existing real save/signout actions remain.
- Preview controls moved out of page content into a small button and separate review dialog. Confusing preview labels were renamed; standalone GPS was removed from its menu. Preview GPS is reachable from the accepted sample request.

## Real vehicle photos

The owner can upload/replace/remove their car photo during setup/edit. A saved user photo takes priority on Home, Garage and Details. The backend accepts bounded JPEG/PNG/WebP data, validates by decoding, limits dimensions/pixels and bytes, orients/re-encodes to JPEG and strips EXIF/GPS metadata. Photos are stored in PostgreSQL, retrieved only by the authenticated owning customer, omitted from ordinary vehicle list JSON, and denied after archive. Updates use the existing ownership lock and optimistic version checks. Initial create remains idempotent including photo contents.

Migration 20261116220000_customer_vehicle_photo adds nullable columns only; 19 migrations applied without resetting data. No fabricated photos or coordinates were added to production records.

## Screen-by-screen checklist

| Screen / area | Current result | Verification / qualification |
|---|---|---|
| Welcome / role selection | Previous Mercedes introduction and original role images retained | Protected file hashes unchanged |
| Shared sign-in | Original unified screen retained | Real login/invalid-login regression passed |
| Customer create-account | Studio image, greeting and grouped card; real registration | Real DB creation and return to login passed |
| Recovery | Existing working routes retained | Prior local recovery tests; external delivery still unverified |
| First vehicle | Manufacturer studio views, example info, actual fields and upload | Seven exterior/interior pairs; real photo upload/save tested |
| Home | Compact cinematic hero, actual status, quick mechanic action and service circle | Actual screenshot review and real quick-path test |
| Garage | Vehicle/model cards and actual image priority | CRUD/selection/reload/ownership tests passed |
| Vehicle details | Actual make/model/year/fuel and customer photo | Photo persistence/reload/removal tested |
| Service launcher | Existing circular launcher preserved | Existing full-stack flow retained |
| Mechanic modes | Existing three cards plus same-page discovery tabs | Real quick-path mode switching tested |
| Discovery | Approved mechanic cards and actual city filtering | Isolated real fixture selected through UI |
| Mechanic profile | Actual professional details and saved workshop map | Profile, experience and map opened in real UI |
| Request creation | Selected car/mechanic plus validated details | Actual UI request creation passed |
| Review/submission | Existing review/send preserved | Real request stored once and transitions verified |
| Confirmation | Saved request and direct tracking action | Full-stack regression passed |
| Request tracking | All supported statuses; accepted workshop GPS entry | Real acceptance/GPS arrival/start/complete/history passed |
| History | Completed/cancelled/declined history retained | Real closed workflow and archive snapshot checks passed |
| Account/settings | Grouped menus and actual profile actions | Save/signout regression; visual theme/language checks |
| Loading/error/empty/success | Existing states retained, photo errors added | Invalid auth/image/ownership/version and previous state suites |

## Verification evidence

- Mobile TypeScript and scoped lint passed; Expo production web export passed. Full-project lint is not claimed; earlier unrelated lint defects remain documented.
- Final screenshot matrix: EN dark/light at 390px and AR light at 320px, all owner review stages and signup, without horizontal overflow or browser errors. Earlier 430px/620px checks passed before the final typography/content adjustment.
- Seven unique exterior sources and seven unique interior sources verified through actual manufacturer controls; example-details toggle and preview GPS entry tested.
- Real photo UI: login → first Home → add car → manufacturer/view selection → OS file picker → save → own photo on Home → reload → remove. Database persistence confirmed.
- Real photo API: authenticated ownership/roles, no public image access, sanitized JPEG and EXIF removal, invalid file rejection, idempotency, version conflicts, replace/remove and archived-photo privacy passed.
- Real quick route: Home → mode tabs → filtered approved mechanic → actual profile/map → request/review/save → accept → foreground GPS/arrival → start/complete → history passed. Browser GPS is emulated in this test; API and PostgreSQL writes are real.
- Existing full-stack owner regression passed: registration/login, garage CRUD/selection/reload, workshop acceptance/start/completion, preserved mobile cancellation and online decline, account save/signout.
- Three backend regression tests passed: garage management/ownership/versioning, request authorization/transitions/idempotency, simultaneous mechanic capacity.
- Public design preview has isolated in-memory samples, no session writes and no backend calls. The real /customer route still requires authentication.

## Preserved scope and remaining limits

LaunchExperience.tsx, choose-role.tsx, login.tsx, RoleOptionCard.tsx and RolePhotography.tsx match their pre-refinement hashes. FloatingRoleTabs.tsx is unchanged (SHA256 CF383F5CF30CEA4BD984E574FE93E443228354EFEBCCF094DFD10D72253772C2). No unrelated mechanic/admin screen redesign was made in this v5 phase.

Physical Android/iOS execution, GPS accuracy/battery/performance and native photo permissions still need device verification. Existing native builds need rebuilding for new modules/config. External recovery email remains unverified. Public map/routing defaults have no production SLA; see workshop-gps-and-preview.md. Parts/towing are not fabricated working services; their existing unimplemented state remains. Further mobile/online feature expansion is outside this workshop-focused phase. Vehicle list/history limits remain 50/latest 100.

This report records implementation and tests; final aesthetic acceptance is the user's review, not a claim of universal design quality.
