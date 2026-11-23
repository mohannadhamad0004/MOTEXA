# Workshop GPS and owner design preview

16 November 2026. Existing workshop request states and capacity rule are preserved. This is an additive implementation, not a backend rebuild.

## Implemented

- Approved workshop mechanic saves exact latitude/longitude from their current foreground location, typed coordinates or a map pin, under Requests → Set workshop map location. No existing profile receives fabricated coordinates.
- Owner sees a real saved workshop pin in the mechanic profile. Missing coordinates have an explicit unavailable state.
- An accepted WORKSHOP request opens a foreground journey: current GPS, road route, approximate distance/time, opt-in sharing, stop and arrival confirmation. Request status stays ACCEPTED until the mechanic starts service.
- Customer sharing is optional. The assigned approved/active mechanic can read a recent shared location only for the accepted request. Other customers/mechanics are denied. No location history is recorded; only the latest sample is stored.
- Stop, leaving the screen, backgrounding, arrival and service start/completion revoke sharing. If a stop request cannot reach the server, the location becomes unreadable after a maximum 45 seconds from server receipt; captured time is also checked. Native background tracking was intentionally not enabled.
- Session identifiers, monotonic sequence numbers and transaction locks reject stale/out-of-order updates and stale-session stops. Points require finite in-range coordinates, accuracy ≤100m and a recent timestamp. Updates are rate-limited to at most one write every two seconds.
- Arrival is customer confirmation based on device-reported coordinates within 200m, accuracy ≤100m and a recent fix; it is not tamper-proof proof of presence. Arrival sends a mechanic notification and audit event. GPS samples are not put in notification/audit text.
- A started journey snapshots its destination, so later workshop pin edits do not move an existing journey.
- Route refresh is available manually and after movement of more than 100m with a 30-second interval. Late routing results are discarded after stopping. External navigation is available if in-app routing fails.

## Providers and platform limits

Maps use Leaflet 1.9.4, OpenStreetMap tiles with visible attribution, and OSRM road routing. The default OSRM public service and public tiles are best-effort services, not a production SLA. Set EXPO_PUBLIC_OSRM_URL to an appropriate hosted/self-hosted service for deployment. Internet access is required. Routing sends origin/destination to that provider; the owner UI discloses external providers. Native WebView loads pinned Leaflet resources from a CDN.

Expo Location and react-native-webview were installed at SDK-compatible versions and the foreground location plugin configured. Physical Android/iOS GPS and performance remain unverified; existing native builds require rebuilding for new modules/config. Web geolocation requires HTTPS or localhost. Permission denial, unavailable/weak/stale fixes and route failures are represented explicitly.

## Verification

- PostgreSQL additive migration 20261116210000_workshop_journey applied; all 18 migrations current. Prisma validation/generation and backend build passed.
- Real HTTP/DB tests passed for persistence, ownership and roles, pending/closed restrictions, invalid/stale/out-of-order positions, opt-out, stale sessions, destination snapshots, near-arrival and cross-role completion.
- Actual mobile-sized browser UI passed in EN dark at 390px and AR light at 320px, using browser-emulated GPS: mechanic pin save, permission denial then grant, map tiles and real road route, opt-in sharing, mechanic view, stop/privacy, arrival persistence. These are not physical-device GPS tests.
- Existing real full-stack regression passed: registration/login, invalid login, vehicle CRUD/selection/reload persistence, Workshop acceptance/start/completion, preserved mobile cancellation/online decline, account save/signout; no API interception or browser errors.
- Mobile TypeScript, scoped lint and production export passed. Actual map screenshots were reviewed.

## Public design preview

/customer-preview is a separate public walkthrough. It uses the actual owner screen components with isolated, in-memory example data and stage shortcuts. GPS layout is explicitly labelled a sample and never requests device location or sends API calls. Twelve stages were checked without authentication, with zero backend calls; /customer still rejects anonymous access. Signup/login shortcuts open their public real pages. This preview does not demonstrate persistence or live GPS; use the real authenticated workflow for those.

## Remaining quality work

This implements and tests the workshop GPS slice. It does not certify every owner screen as matching the reference at final design quality. Physical-device validation, production map/routing hosting, external recovery-email delivery and further visual refinement remain. Mobile/on-site and online expansion are separate subsequent stages.
