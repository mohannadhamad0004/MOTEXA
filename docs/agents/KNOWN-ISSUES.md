# MOTEXA known issues (for the report, 2026-11-13)

Short and honest. Details and evidence: docs/agents/BUGS-ADMIN-3D.md and docs/agents/RUN-LOG.md.

## Open bugs and limits
- **E36 front bumper and rims don't reach customers yet.** The wing works. The bumper's published row lost its visual verification (bug T-05, now fixed in code), and the seed never stored a review time to restore it from. The rims are unpublished, and their E36 fit isn't approved. Needs a Parts Admin decision, not code.
- **Grey product photos reported on one phone.** Not reproduced: every photo loads over the LAN IP from the PC. Waiting for the phone-browser check.
- **Seeded demo tow job stuck "on the way" since 2026-10-30.** It blocks customer@motexa.test from a new Al-Noor request (one active request per customer + company, by design).
- **Unverified fixes (🟡):** B-01 (stale final-review images), B-02 (new Meshy generation after a bad result; needs a paid run), B-03 (shop notified on unpublish/reactivate), C-01 (photo upload keeping unsaved 3D form fields). Each needs specific data or a paid run.
- **Not reproduced (⬜):** A-04 (legacy published car missing from management), D-03 (only 200 drivers per status are listed: no paging).
- **Web preview limits:** maps and routes are native-only (Leaflet in a WebView). On web the tow screens show "The map is not available on this platform." Live location, the camera and push notifications are phone-only checks.
- **15-minute sessions with no refresh token:** E-03, partner file. Long tow jobs or admin reviews can log the user out.

## Test suite
- `backend/tests/autofit.test.ts:82` (approve while a fit is "running") fails on unmodified HEAD.
- `backend/tests/accessory3d.test.ts`: the fixture fails with EPERM on a leftover tmp-fit folder on Windows, then leaves test rows in the dev DB. That's why it wasn't run against the dev database in this run.
- Run on 2026-11-13: backend `tsc` 0, mobile `tsc` 0. The full test suites were not run (they write to the dev DB).

## 3D model limits
- **Mercedes W203 (and other "merged bumper" models):** the bumper isn't a separate mesh in the model, so a replacement bumper can't cleanly hide the stock one. The app warns "Limited: bumpers not separate". Fix: a better model, or the medium-size box-cut change (docs/agents/BOX-SELECT-CHECK.md).
- Fit quality depends on the model's geometry. FIT-QA samples points in triangle order, which is why the E36 bumper is kept un-optimised.

## Partner files (Diala): what she needs to change
- **D-04:** `mobile/src/app/admin/(tabs)/requests.tsx`, the general admin Requests tab is still "Coming soon".
- **D-05:** `mobile/src/app/admin/(tabs)/_layout.tsx:45`, `/api` is doubled when `EXPO_PUBLIC_API_URL` ends with `/api`. Use `apiUrl()` from `core/config/api.ts`.
- **E-03:** `backend/src/routes/auth.routes.ts`, refresh tokens or longer sessions for drivers on a job.
- **DIRECTION-STYLE:** `mobile/src/app/admin/(tabs)/index.tsx:317-339`, move `direction:'ltr'` out of `StyleSheet.create`. On web it raises a dev error toast that also covers buttons.

## Future work
- Bake accessory parts into named meshes in the car models, so replacement doesn't depend on part maps or boxes.
- Box cut for merged bumpers (W203 class), medium-size option.
- More part types (side skirts, mirrors, grilles, lights) with their own fit rules.
- FIT-QA: sample evenly across the surface instead of in triangle order.
- Paging for long admin lists (drivers, jobs).
