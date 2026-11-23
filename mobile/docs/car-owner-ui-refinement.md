# MOTEXA — Car Owner UI refinement

16 November 2026. This refines the existing implementation; it does not rebuild the backend.

## Before and after

The audit found navigation covering content, repeated vehicle layouts, undersized metadata, repeated cockpit imagery, and missing inline booking validation. The refinement restores the original named, animated FloatingRoleTabs and original Great Vibes / Didot display typography, while retaining Manrope / Cairo for functional text. Chocolate surfaces and bronze highlights remain.

- Home: balanced selected-car composition, less repeated metadata, instrument-style interactive service console, active-request priority.
- Garage: wheel-detail collection header, distinct selected/unselected cards, direct persistent vehicle selection and restrained transitions.
- Services: workshop, mobile diagnostics and online cockpit compositions with controlled selection feedback.
- Discovery/profile: readable verified professional information, contextual imagery and clear request actions; no invented ratings.
- Booking: compact vehicle/mechanic context, diagnostic hero, 16px inputs, inline errors and focus on the first invalid field.
- Confirmation: tracking action remains visible above the original tabs.
- Tracking/history: readable milestones, explicit terminal statuses and compact history entries.
- Public/auth/settings: restored display fonts, new contextual art, larger controls and consistent spacing.
- Motion: subtle bronze reflections, vehicle/card transitions, original tab motion and service-orbit expansion. Reduced-motion preference and background pause are respected.

The shared FloatingRoleTabs source is unchanged: SHA256 CF383F5CF30CEA4BD984E574FE93E443228354EFEBCCF094DFD10D72253772C2. Footer layout now reserves space instead of covering scroll content.

## Complete journey checklist

| Screen / capability | Implementation and verification | Remaining qualification |
|---|---|---|
| Welcome and role selection | Cinematic intro, original fonts, transitions; public UI checks | Native device performance unverified |
| Registration and login | Real registration/login; invalid credentials and signout tested | — |
| Forgot password / recovery | Existing recovery UI/API and local mail-sink tests retained | External email delivery unverified |
| First vehicle setup | Real add/select and persistence tested | Artwork catalogue limited below |
| Home | Refined hero and service console; EN/AR mobile checks | — |
| Garage CRUD / selection | Add/edit/archive/select and reload persistence tested | Delete uses existing archive semantics |
| Vehicle details | Model/year/fuel and edit flow checked | — |
| Circular launcher | Original service orbit, expansion/close and motion checked | — |
| Workshop/mobile/online selection | Distinct photos and existing backend mode values preserved | Online expansion deferred |
| Approved mechanic discovery | Real city filtering and approved mechanic result checked | — |
| Mechanic profile | Actual professional details and request action checked | — |
| Request creation | Real vehicle/mechanic context; inline validation and first-error focus | — |
| Review and submission | Real backend write and action visibility checked | — |
| Confirmation | Actual saved request and visible tracking CTA checked | — |
| Tracking | NEW, ACCEPTED, IN_PROGRESS, COMPLETED, DECLINED, CANCELLED represented | All six in state suite; cross-role flows below |
| Requests and history | Actual cancellation, updated status and history checked | Existing latest-100 limit |
| Profile/settings | Actual account save/signout; UI refinement checked | — |
| Arabic/English, dark/light | RTL/LTR and both themes checked | Native platform QA remains |
| Loading/empty/error/success/confirmation | Isolated failure/retry/state suite passed | These failure fixtures are separate from real-API tests |

## Verification

- TypeScript check passed; scoped lint of changed files passed; production Expo web export passed. Full-project lint has pre-existing unrelated errors and is not reported as passing.
- Eight mobile-emulation combinations: 320×740, 390×844, 430×932 in EN/AR dark, plus EN/AR light at 390. Real API registration, login, vehicle switching/persistence, discovery, booking, submission, cancellation, history and account navigation; no browser errors or horizontal overflow. Primary actions checked against tab bounds.
- Two additional explicit touch runs (390 EN dark and AR light) passed, including password visibility target ≥44×44 and first-invalid-field focus.
- Nine isolated state/error/motion cases passed; four public EN/AR × dark/light cases passed.
- Real live full-stack regression passed: registration/login, vehicle CRUD/persistence, workshop NEW → ACCEPTED → IN_PROGRESS → COMPLETED, mobile cancellation, existing online decline, account save/signout. No API response interception in this regression or the mobile matrix.
- Previously verified backend authentication/authorization, concurrency and persistence safeguards were preserved. Multiple pending requests are allowed; only one accepted/in-progress request per mechanic, with a 409 conflict on simultaneous acceptance. No backend/schema changes were made in this visual refinement.
- Actual screenshots were reviewed and assembled into before/after and journey boards. Screenshot data comes from temporary test accounts and was cleaned up, not fabricated production records.

## Assets and limitations

Four new AI-generated editorial assets depict workshop work, diagnostic detail, wheel/brake detail and cockpit detail. Prompts are recorded in owner-refinement-assets.json. They do not claim to show a customer's car or a mechanic's actual premises. Existing model illustrations retain fictional plate digits and manufacturer marks.

Physical Android/iOS execution and animation performance have not been verified. External recovery-email delivery remains unverified. Online chat/video, appointments and payments were not added. Existing illustration catalogue is BMW M8 / Corolla 2018; unsupported models use an honest generic fallback. Existing backend lists are capped at 50 vehicles and the latest 100 requests.

## Reproduce

Start the existing backend and production web preview. Run mobile/tests/owner-mobile-refinement.mjs with MOTEXA_LIVE_API and MOTEXA_APP_URL if different. It requires the configured disposable/test database, built backend Prisma module, Edge and Playwright; it creates and cleans temporary real fixtures. Do not run against production data. State tests use isolated fixtures to exercise failures. See car-owner-complete-journey.md for earlier full-stack evidence.
