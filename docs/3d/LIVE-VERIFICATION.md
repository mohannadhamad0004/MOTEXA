# Live vehicle-3D verification ? awaiting the human generation action

Branch `ui/blueprint`, 2026-11-04. This is a preflight/handoff record, not a successful live-generation report. No production code changed; no commit/push. No model approved/promoted. C63 remains inactive, technical/visual PASS_VARIANT with unresolved external provenance; neither archive was reactivated.

## Verified preflight

- Existing MESHY-INTEGRATION.md commands and consent/mode/provider workflow match the current backend. Generation is not triggered by configuration alone.
- Backend key presence verified without printing the value. Authentication/credits with Meshy have not been live-verified.
- The saved environment originally selected mock mode with paid generation disabled. The prepared backend process explicitly sets VEHICLE3D_MODE=real and MESHY_ALLOW_PAID_GENERATION=1; the key remains backend-only. No .env was edited.
- Health HTTP200 at http://192.168.88.7:5000/api/health. Dedicated web UI HTTP200 at http://localhost:8095/customer/garage. The pre-existing port8081 Expo server was left alone; its web page did not respond within15seconds, so a separate web server was prepared on8095 without a product-code change.
- Private asset/public model/local evidence directories passed unique-file write/delete probes.
- Photos: exactly front/rear/left/right; decodable JPEG/PNG only, max5MiB each, min32pixels per dimension, max25million input pixels; orientation-normalized/re-encoded JPEG max1600px, EXIF/GPS removed. Upload body parser7MB, base64 field bound7,000,000characters.
- Both 20261104190000_vehicle_3d_submissions and 20261104210000_vehicle3d_provider_lifecycle are applied, not rolled back.
- Zero PROCESSING submissions at preflight. The four existing customer@motexa.test Garage cars had no submissions: Mercedes C-Class2003, Mercedes C-Class2010, Audi A3 2011, Skoda Octavia2017. The human must choose only one matching the four real source photos.
- Read-only catalog validator:21active configurations,21mapped generations,21production GLBs, no stale keys; C63 source/viewer hash binding matches, C63 inactive.
- Authenticated runtime API: HTTP200,21models; neither test customer ID/email nor backend Meshy key appears in the response. Unauthenticated private-asset route returns401. Live-submission-specific owner/other-customer/admin checks remain pending.

## Human action that may spend credits

Open http://localhost:8095/customer/garage and sign in with the existing customer@motexa.test test account. Choose ONE Garage car matching your photos. Open Create my3Dcar and upload its actual front/rear/left/right photos. Confirm photo-processing consent. **Press Generate3Dmodel exactly once**; this button is the explicit credit-spending action. Do not generate for another car, retry/regenerate or approve a result. Tell the agent the car/submission ID and that you pressed Generate so live recovery/privacy/viewer checks can continue.

A read-only local observer is prepared under ignored .private/vehicle3d-phase2/live-observe.mjs. It follows the first submission among those test Garage cars and writes only masked-task evidence to live-evidence.jsonl. It makes no HTTP/provider calls or mutations. It records observed persisted states, provider-supplied progress, timestamps, raw/prepared sizes/formats, validation and safe failures. It does not fabricate unobserved intermediate states, guarantee a live restart test, perform approval, or establish customer preview success. No real task was triggered by an agent API/UI action.

## Factual result slots

1. Real Meshy task: not yet observed/started for the live test at handoff.
2. Credits: no intentional generation requested by the agent; provider billing not queried.
3. Provider status sequence: pending the human action.
4. Restart recovery: not live-verified; mocked coverage passed. Restart only after persisted task confirmation, while processing, without re-generating.
5. Raw/prepared sizes: no live asset yet.
6. Technical validation/dimensions/triangles/orientation/grounding/format: no live asset yet.
7. Customer private preview: not yet performed.
8. Parts Admin inspection: not yet performed; no approval/promotion authorized.
9. Privacy: runtime preflight and unauthenticated route guard pass; checks against the same actual live submission remain pending.
10. Physical ExpoGo: not yet performed. After backend success, provide steps for this SAME submission; do not generate a second model.
11. Product defects/fixes: none discovered at this preflight; no source-code changes.
12. Checks rerun: backend/mobile npx tsc --noEmit PASS; Prisma validation PASS; relevant mocked vehicle3D/Meshy tests34/34 PASS; catalog integrity PASS; git diff --check PASS. Full backend suite and Android export not repeated because product code did not change. Fixture tests finished before the final live backend was launched; do not run DB-fixture tests while live workers operate.
13. Blocker: choose one car and upload real guided photos, then the human must trigger the paid generation. Live HTTP/provider success, preview/review/privacy and device outcomes cannot be claimed before those actions.
14. Exact git status: FINAL-GIT-STATUS.txt contains root git status --short, including previously uncommitted implementation/cleanup and the untouched graphify-out directory.
