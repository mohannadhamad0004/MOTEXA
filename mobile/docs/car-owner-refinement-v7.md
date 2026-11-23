# MOTEXA — Car Owner refinement, 17 November 2026

This is an implemented refinement of the existing Car Owner experience, not a rebuild. Public introduction, role selection, shared login, original typography assets and original bottom tabs were preserved. Mechanic/admin UI and backend source were not changed in this phase.

## Before / after

| Area | Before | Implemented |
|---|---|---|
| Home composition | Small cutout inside another rounded card | Edge-to-edge dark automotive scene with bronze lighting, large vehicle title, illustrated exterior/interior switch and immediate mechanic action |
| Owner imagery | Mostly the same studio cutout composition | New Audi workshop photography-style illustration; supported model-specific art and cabins; uploaded owner photo takes precedence |
| Vehicle details | Home arrow opened the garage list | Opens selected vehicle details directly; edit/back/CRUD continue to use existing APIs |
| Services | Four small icon buttons | Photo-led mechanic entry plus distinct parts/towing/AI tiles; future services remain honestly unavailable |
| Circular launcher | Detached icons/text over underlying content | Contained material panel, connecting arc, bronze featured action and accessible close button above original tabs |
| Mechanic comparison | Compact repeated cards | Clearer workshop titles, addresses, specialties, experience, approval indicator and comparison guidance; no invented ratings |
| Booking rail | Small labels wrapping unpredictably in Arabic | Single-line responsive labels with preserved step accessibility labels |

Editorial imagery is not the customer's actual vehicle. Illustrative interiors are labelled. Unsupported model art is not replaced with an unrelated car. Private uploaded photos retain authenticated retrieval.

## Files changed in the actual repository

- `mobile/src/components/OwnerHome.tsx`
- `mobile/src/components/OwnerHomeShowcase.tsx` (new)
- `mobile/src/components/OwnerHomeServices.tsx` (new)
- `mobile/src/components/OwnerGarage.tsx`
- `mobile/src/components/OwnerMechanics.tsx`
- `mobile/src/components/OwnerDesign.tsx`
- `mobile/src/components/CustomerWorkspace.tsx`
- `mobile/src/components/CustomerServiceDock.tsx`
- `mobile/assets/images/owner-audi-workshop-v7.jpg` (new AI editorial illustration, fictional plate, not an actual workshop or owner photo)

## Screen-by-screen status

Existing screens below are distinguished from screens changed in this phase. Visual checks use the actual React Native web implementation at mobile viewport sizes, not design mockups. They are not physical Android/iOS tests.

| Screen / state | Implementation | Verification in this phase |
|---|---|---|
| Public welcome / role selection | Preserved | Protected-file SHA-256 unchanged |
| Shared login | Preserved | Real valid/invalid login, sign-out and protected-file checksum |
| Customer registration | Existing real registration | New customer saved via API; subsequent login succeeds |
| Forgot password / recovery | Existing workflow preserved | External email delivery not reverified; not claimed complete |
| First vehicle setup | Existing brand-specific exterior/interior and real photo picker | Visually reviewed; real upload and persistence regression passed |
| Home, with / without vehicle | Cinematic selected-vehicle scene changed; first-home retained | 320/390/430px visual review; saved vehicle switching and reload passed |
| Garage add/edit/delete/select | Existing CRUD retained | Actual API + database persistence, reload and archive regression passed |
| Vehicle details | Home direct-entry link changed | Correct selected-car details opened in all three viewport configurations |
| Circular service launcher | Contained panel changed | All four actions visible; mechanic entry works with normal/reduced motion |
| Three mechanic modes | Existing workshop/mobile/online retained | Visually reviewed; real mode switching exercised |
| Mechanic discovery / filtering | Comparison readability changed | Real approved-list selection and city filtering; seed profiles separately verified by authenticated API |
| Mechanic profile | Existing real details retained | Actual profile/map/request path and visual review passed |
| Request details | Existing guided form retained | Real description/title/contact submission; visual review |
| Review / submission | Existing review and idempotent backend retained | Actual request stored, selected vehicle persisted |
| Confirmation | Existing success state retained | Track action used in real browser workflow |
| Request tracking | Existing backend-supported statuses retained | Pending, accepted, started, completed; mobile cancellation and online decline exercised |
| Workshop GPS | Existing foreground journey retained | Simulated browser GPS start/arrival and completion; physical GPS unverified |
| Requests / history | Existing current/history groups retained | Real completion and preserved archived-vehicle snapshots verified |
| Account / settings | Existing account details and preferences retained | Real account save/sign-out; visual review of language/theme controls |
| English / Arabic, dark / light | Existing design system retained, small-screen booking rail improved | 39 screen captures: EN dark 390px, AR light 320px, EN light 430px; no document horizontal overflow or page JS errors |
| Loading / empty / error / success / confirmations | Existing reusable components retained | Invalid login and failed request/authorization paths covered by regression evidence; not every transient state recaptured |

## Checks and results

- TypeScript `tsc --noEmit`: PASS.
- ESLint for all eight changed owner components: PASS.
- Expo production web export: PASS.
- `owner-fullstack.mjs`: PASS, using direct live API; registration, invalid login, login, CRUD/select, persistent reload, real request acceptance/start/completion, cancellation, decline, account save, history preservation, sign-out. No browser page errors.
- `owner-workshop-quick-journey.mjs`: PASS, rerun after Home actions changed; real API/database flow, selected car, mode tabs, mechanic profile/map, review/save, mechanic acceptance, browser-emulated GPS arrival, service start/complete/history.
- `owner-vehicle-photo.mjs`: PASS; actual browser file chooser upload, private persisted photo, reload and removal.
- Visual matrix: 13 captures/checks per configuration × 3 configurations; no page JS errors, document horizontal overflow, or real backend API calls from the isolated public preview.
- Launcher: PASS at 390px EN with motion, 320px AR with reduced motion and 430px EN with reduced motion.
- Protected-file hashes: PASS for LaunchExperience, choose-role, shared login, FloatingRoleTabs, RoleOptionCard and RolePhotography.
- Full-project `expo lint`: FAIL, 24 errors and 6 warnings in files outside these edits, including mechanic-preview, GlassSurface, InteractiveButton, PremiumUI and Untitled scratch files. These were left unchanged to respect scope; the project-wide lint gate is not claimed green.

Earlier in this session, service ownership/authorization and competing-request tests passed, and the workshop GPS API test passed after the local backend was started. This phase did not replace backend responses or rewrite backend logic.

## Remaining limitations

- Physical Android/iOS performance, safe areas, gallery permissions, GPS accuracy/route following and network interruption behaviour require device validation.
- External account-recovery email delivery is not verified here.
- Parts, towing and AI are visible future-service entries, not implemented service workflows.
- Customer ratings/reviews are not implemented; no fabricated star ratings are displayed.
- Discovery filters by city/mode; it is not nearest-distance sorting.
- Seeded local display mechanics do not have genuine verified workshop coordinates. Their destination is not invented; testing navigation requires a saved workshop location. The automated GPS workflow uses its own isolated coordinate fixture.
- Public OSRM routing/OSM map dependencies need connectivity and are not a production SLA.
- Request tracking uses existing refresh/polling, not guaranteed instant push updates.

## Review links

- Public isolated design preview: http://127.0.0.1:58132/customer-preview?review=owner-v7-final
- Actual authenticated owner journey: http://127.0.0.1:58132/customer
- Screenshots and test scripts are in this report's directory. Preview navigation is only a reviewer tool; it is absent from the authenticated owner flow.

This phase improves the actual implementation and verifies existing real workflows. It does not certify the whole project as production-ready or claim that subjective visual approval has been obtained.
