# MOTEXA Car Owner — verified state, 17 November 2026

Scope: existing Car Owner implementation only. No backend, schema, shared login, role selection, mechanic or admin implementation was changed in this refinement. Seventeen protected files match the saved SHA-256 snapshot.

## Changes

Audi RS7 and Range Rover catalog photos now have transparent backgrounds and render directly in the Home composition, Garage and vehicle art component. Toyota Corolla uses an SVG clipping path on its licensed photo. Customer-uploaded photos keep priority and their authenticated storage path. Existing exterior/interior switching, original fonts and floating tabs remain. These are layered 2D photos/illustrations, not interactive 3D models. Other model and cabin illustrations remain labelled; do not describe all assets as actual owner photographs.

The account screen uses the original automotive theme and actual account/vehicle/request data. Language and appearance remain available in a secondary settings sheet. Vehicle entry remains three phases, with make/model/year/fuel and optional private photo; it was not collapsed into one form.

## Screen and integration checklist

| Screen / function | Implemented | Verification in this pass |
| --- | --- | --- |
| Roles → common Sign in → Create account link | Preserved | Browser role/entry test passed; mechanic still opens original login |
| Customer registration and login | Real APIs and PostgreSQL | Registration, invalid login rejection and valid login passed |
| First vehicle setup | Three phases, metadata and photo | New account opens setup; saved record opens Home; real photo picker/upload/reload/remove passed |
| Home and vehicle switching | Immersive vehicle stage, exterior/interior, actual saved selection | 320 AR light, 390 EN dark, 430 EN light; nine preview cars; zero page errors/overflow |
| Garage / details / edit / delete | Owned records, metadata and photo | CRUD, selection and reload persistence passed; deleting preserves request history |
| Mechanic service modes | Workshop / Mobile / Online | All three choices and discovery tabs checked |
| Mechanic discovery / profile | Approved specialists, city/mode filtering, details and workshop map | Real workshop profile → booking passed; no invented ratings |
| Booking / review / confirmation | Real request save with vehicle snapshot | Browser submission and DB persistence passed |
| Requests / history | Pending, Accepted, In Progress, Completed, Declined, Cancelled | Real cross-role actions, mobile cancellation and online decline regression passed |
| Workshop route / GPS | Accepted request, stored destination, foreground GPS, road route, optional sharing, arrival | Real API/DB tests and EN/AR browser map tests passed using browser-supplied GPS coordinates |
| Account | Real details update, garage/request links, secondary settings, sign out | Save/sign out passed; settings sheet checked EN/AR at phone widths |
| Recovery | Existing common recovery flow preserved | Recovery automation is stale: expects selectedRole query parameter that common login no longer sends. End-to-end recovery was not verified in this pass; external email delivery remains unverified |
| Loading / errors / confirmations | Existing states preserved | Invalid login, private photo validation, stale versions, unauthorized requests and GPS failures exercised; exhaustive native-state coverage not claimed |

## Engineering checks

- Mobile and backend TypeScript passed. Scoped lint for changed owner files passed. Production web export passed. Full-project lint is not claimed clean; earlier unrelated errors remain outside this scope.
- Backend tests passed: customer journey, vehicle management, vehicle photos, request policy, simultaneous request acceptance and workshop GPS.
- Multiple pending requests are allowed. Concurrent acceptance permits only one Accepted/In Progress service per mechanic; ownership, approval, idempotency and state transitions passed.
- GPS tests passed for authentication/ownership, destination snapshots, weak/invalid/stale/out-of-order positions, opt-out, old sessions, arrival and cross-role completion.
- Browser full-stack scenario passed: registration → login → car → approved mechanic → request persisted → accept/start/complete → customer history. Isolated test records were cleaned; preview data is in-memory and does not demonstrate real persistence.

## Remaining limits / not complete

- Physical Android/iOS GPS, foreground/background transitions, gallery and native animation performance require device checks. Current location tracking is foreground only and stops on backgrounding; it is not continuous background navigation.
- Actual workshop coordinates must be saved by the verified mechanic. No fake destination is supplied if absent.
- Map tiles/routing require connectivity and currently use public OSM/OSRM infrastructure; production routing configuration is still needed. External driving directions are available as fallback.
- Customer status refresh uses polling, not push delivery. Route ETA is approximate.
- AI assistant, car parts and towing are future-service presentation pages, not implemented ordering/chat systems. Full on-site and online service experiences remain later scope; their existing request APIs were regression tested.
- Visual refinement is ongoing. This report does not certify every customer screen as meeting the supplied reference's final aesthetic quality.

Evidence: mobile/tests/owner-fullstack-results.json; mobile/test-results/owner-quick; local owner-services-v10 screenshots, ui-results.json and account-check.cjs. The public /customer-preview uses isolated sample data. Use /choose-role for the real authenticated journey.
