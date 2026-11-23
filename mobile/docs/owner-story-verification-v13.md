# Owner journey refinement — 17 November 2026

This update follows the user's latest direction: retain vehicle exterior/interior presentation, make the Home unfold as an automotive story on scroll, display all four services vertically without framed cards/circles, and avoid repeating the Home in Garage.

## Implemented in this update

- Owner Home: larger studio vehicle composition, model typography behind the car, restrained lighting and foreground floor, existing vehicle choices and actual saved metadata. Customer-uploaded photos still take priority.
- Scroll motion: vehicle translation, subtle perspective/scale, and independently moving service photography tied to the actual scroll position. Pause and reduced-motion fallbacks; no simulated driving or location changes. This is layered 2D/2.5D presentation, not a real-time 3D car model.
- Four services: vertically ordered, edge-to-edge photographic scenes with gradient blending into the page; no visible card frame/circle mask. Mechanic opens the existing three service modes. Parts, towing and AI remain explicitly marked coming later.
- Garage: compact vehicle-management list, actual make/model/year/fuel, active selection and detail action. It no longer repeats a large cinematic panel and four-field grid for every vehicle.
- Vehicle details: larger exterior view plus an interior tab where a labelled illustrative cabin exists. Private owner photos are not misrepresented as having an uploaded interior image. Existing edit/delete/request-service actions are preserved.

## Verification

- TypeScript, scoped lint and production Expo web export passed.
- Browser views at 320px Arabic/light, 390px English/dark and 430px English/light passed without page errors or document overflow.
- Motion was tested with no-preference accessibility settings: scrolling changes the vehicle transform; the pause control returns it to no transform. Reduced-motion browser regression also passed.
- Garage list and detail exterior/interior actions tested in English/Arabic; settled screenshots reviewed.
- Real API/DB owner full-stack regression passed after these changes: signup/login, first-car entry, vehicle CRUD/photo/selection persistence, workshop request submission, accept/start/complete/history, account save and sign out. Existing mobile cancellation/online decline regressions also passed.
- The quick real workshop path passed again, including browser-supplied GPS arrival and database persistence.
- Seventeen protected introduction, role selection, shared login, original tabs, mechanic/admin files match their saved SHA-256 hashes. No backend or schema changes in this update.

## Remaining limits

The v11 verification report remains applicable for unverified areas: physical-device GPS and native performance, external recovery-email delivery, foreground-only tracking, production map/routing configuration, and the future AI/parts/towing/on-site/online expansion. Recovery end-to-end automation needs updating for the preserved shared recovery UI; no successful recovery UI test is claimed here. Other existing model/cabin illustrations are still generated editorial assets; not every image is a real customer photograph. This update does not certify final visual parity with the supplied luxury reference or the entire platform as complete.

Evidence: local owner-services-v10/service-story-{390,320}.png, garage-management-{390,320}.png, vehicle-details-{390,320}.png, story-check.cjs, ui-results.json; mobile/tests/owner-fullstack-results.json. Public /customer-preview contains isolated in-memory sample records; real requests require the authenticated /choose-role journey.
