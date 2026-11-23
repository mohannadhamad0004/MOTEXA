# Phase 0 — cinematic Car Owner audit

Date: 2026-11-18. Original repository: C:/Users/Zain/OneDrive/Dokumente/GitHub/MOTEXA. Documentation only; Phase 1 is NOT approved.

## 1. Scope and Git
Git status was the first action. Existing branch: codex/uiux-20261102. There are 48 modified tracked files plus numerous untracked source files/assets/tests. These are pre-existing changes, not changes attributed to this audit. No branch creation, commit, reset, stash, configuration change, dependency installation, backend/DB operation or feature-code modification was performed. User's explicit no-branch instruction overrides the attachment's feature/cinematic-car-owner instruction.

Created only docs/cinematic/PHASE_0.md, ASSET_INVENTORY.md, ASSET_SHOT_LIST.md, REFERENCE_MATCH.md. Existing files and backups were not overwritten.

## 2. Relevant repository map
- mobile/src/app: Expo Router entry, choose-role, auth/*, customer/index.tsx and existing customer-preview/customer-motion-proof/customer-cinematic-preview experiments.
- mobile/src/components/CustomerWorkspace.tsx: owner orchestration and internal page state; OwnerHome.tsx is the current Home. OwnerWorkspacePage.tsx supplies the native scroll shared value and existing header/footer.
- OwnerCinematicIntro.tsx: currently mounted by Home; three image layers with fades/transforms. OwnerHomeServices.tsx: separate service presentation. This is the existing baseline, not an accepted implementation of the new master prompt.
- OwnerCinematicHomeScene.tsx and customer-motion-proof.tsx: earlier experimental implementations, not Phase 1. They contain hardcoded colors and React updates at scene boundaries; do not adopt wholesale.
- CustomerDrivingFilm.tsx: reusable local expo-video player/poster/lifecycle pattern; pauses on AppState/reduced motion. Route-focus pausing is passed by parent, not implemented internally.
- mobile/assets/images, videos, fonts: bundled media. Full dimensions/bytes in ASSET_INVENTORY.md.
- mobile/src/i18n, components/Appearance.tsx, DesignTokens.ts: existing language/theme infrastructure.
- backend/src/routes, prisma: existing services; read-only audit, never part of this feature's edits.

## 3. Actual installed versions
| Package | Installed |
|---|---|
| expo | 57.0.26 |
| react | 19.2.3 |
| react-native | 0.86.3 |
| react-native-reanimated | 4.5.1 |
| react-native-worklets | 0.10.1 |
| react-native-gesture-handler | 2.32.0 |
| expo-video | 57.0.5 |
| expo-image | 57.0.5 |
| react-native-svg | 15.15.4 |
| @shopify/react-native-skia | Absent |
| expo-gl | Absent |

Reanimated's installed type entry exports useAnimatedScrollHandler/useAnimatedProps/useFrameCallback. Installed expo-video types expose currentTime/pause/staysActiveInBackground. API presence is verified statically; no native rendering/performance claim follows. No new dependency is proposed. No Lottie/3D model pipeline was identified among project assets.

## 4. Current navigation and data (source-verified, not re-run against live backend in Phase 0)
Role selection -> shared /auth/login with selectedRole -> /customer for CUSTOMER. /customer exports CustomerWorkspace. hasOwnerSession checks stored token through /api/auth/me and requires CUSTOMER/ACTIVE. CustomerWorkspace checks backend role again. /customer-preview intentionally uses createCustomerPreviewApi: its sample records are not production evidence.

Internal pages: home, garage, requests, account, modes, mechanics, profile, request, review, submitted, soon, preview-map. Mechanic modes are WORKSHOP / ON_SITE / ONLINE. beginService requires a vehicle, otherwise opens garage. Mode selection sets state and calls find(mode); it is not a standalone route parameter. The only current screen query handling initializes garage for preview; do not invent a /customer?mode=... deep link or modify the API layer.

Real-source endpoints consumed: GET /api/auth/me, /api/customer/account, /api/customer/vehicles, /api/service-requests/customer, /api/customer/mechanics?mode=&city=, /api/customer/mechanics/:id?mode=; vehicle POST/PATCH/DELETE/select; service request POST and cancellation; account PATCH. Workshop tracking source exists separately. This audit does not certify those endpoints operational today.

Parts, towing and AI reach OwnerServicePortal through internal soon/soonKey state. They display not-available notices; no functional ordering/towing dispatch/AI diagnosis endpoint was identified in mounted backend routes. AI must remain Preview: in development with no diagnosis CTA. Parts/towing may only link to their honest information screens until their real workflows exist.

## 5. Language, themes and typography
LanguageProvider persists motexa_language and exposes isArabic/translations. useMechanicTheme wraps the existing theme tokens and provides t(en,ar), row/row-reverse, and textAlign. It does not depend on I18nManager globally forcing RTL. Animate whole Arabic lines; explicitly mirror horizontal masks/slice order using the existing language value. English unchanged.
AppearanceProvider provides light/dark/system; owner appearance has a separate provider/preference. Use the actual runtime theme values from useMechanicTheme/DesignTokens, not hardcoded palette copies from prior prototypes. Reuse existing fonts: GreatVibes for selected English editorial headings, existing Arabic family, regular UI type from the owner wrapper. The same footage remains across themes; text-zone treatment adapts. Existing public header and tabs stay untouched.

## 6. Media feasibility: what the assets actually support
- motexa-driving.mp4: 960x540, 24fps, 12s, 1,091,578 bytes. Real exterior driving. Landscape and moving subject: not suitable for tracking a fixed windshield portal without tracking metadata. Cropping to 9:16 discards most horizontal coverage. Can serve a held atmospheric shot, after explicit crop review. Not a slow dusk studio hero.
- motexa-interior-driving.mp4: 960x540, 25fps, 10s, 523,562 bytes. Real driver POV; wheel dominates and windshield traffic moves. No exit from car; not matched to exterior clip. Muting a player does not prove the audio track was stripped. No re-encode in Phase 0.
- owner-real-r8-exterior-v16.jpg / cockpit / dashboard: genuine photography, respectively 1400x933 (317,712 B), 1400x854 (194,587 B), 1400x933 (139,010 B). Same model/photographer, not proven same physical vehicle/session. Cockpit is an open-door oblique view, NOT driver POV. Dashboard is driver-facing but tight/bright and lacks a usable infotainment screen. Daylight exterior is on a bridge, not a warm studio. Useful mechanical-study sources; cannot claim final one-car-film continuity.
- owner-audi-workshop-v7.jpg 1086x1448 (170,699 B) and owner-audi-interior-v6.png 1536x1024 (2,193,824 B): earlier user-preferred illustrative pair, not real photographic evidence. Better composition space than daylight photos, but label as illustrative proof assets. They do not meet final realistic-media criterion by themselves.
- owner-audi-photo-cutout-v11.png: 1400x489 with alpha, 1,064,437 B. Candidate for real separated-layer parallax; alpha existence alone does not certify edges, windshield transparency or compatibility with the cockpit. Must be inspected before choosing it; no assumed background removal.
- Existing real workshop/parts/towing photos can support scene studies; disparate light and perspective prevent a guaranteed single-film look. Tow image is daylight, not the specified night light-bar shot. Real diagnostic photograph exists; owner-service-ai-v10.jpg is an illustrative/generated asset and must not be presented as a real scan.
- No matching full interior/exterior image sequence, separated wheel/dashboard layers, verified same-workshop triptych or final infotainment surface match was identified. Existing stock cutouts and brand illustrations are not replacements for those assets.

## 7. Feasibility tiers
FEASIBLE NOW AS A PROTOTYPE: one pinned stage, normalized native-scroll shared value, coordinated transforms, clipped line text, SVG strokes, rectangular portal and circular mask studies, counter-scale based on fixed crop math, posters and loop lifecycle. These are implementation candidates using installed libraries, NOT a measured Android performance result. Start with two still layers; add video only after mask quality is established.
NEEDS MEDIA: cinematic same-model driver POV and exterior composition with measurable windshield; coherent workshop/mode shots; consistent macro parts; night towing; final cockpit with readable infotainment region. See shot list. Missing images use clearly labelled placeholders, not unrelated substitutes.
RISKY / TEST FIRST: animated clipping layout on Android, full-screen image memory, rapid direction changes, video texture compositing, large blur, image/crop changes on rotation, and mounting-window logic. Do not seek video per scroll frame. Do not fabricate blur-based focus pull if a measured transform-only reveal is smoother.
NOT PROPOSED: Three/Fiber/Skia/custom modules, new state/navigation libraries, automated AI diagnosis, or physical camera-path claims.

## 8. Exact Phase 1 proposal (approval required)
New isolated dev-only cinematic-lab route, no links or redirects from current Home/auth. Feature flag OFF by default, unavailable in release builds until an explicitly approved QA build flag is set. Do not repurpose existing public prototype routes or wire first-launch behavior yet.

Files proposed, NOT created: components/cinematic/CinematicStage.tsx, scenes.config.ts, ExteriorScene.tsx, CockpitScene.tsx, PromiseScene.tsx, WarningPortal.tsx, and app/(dev)/cinematic-lab.tsx. Test files only once functionality exists.

One master p=clamp(offset/scrollTravel,0,1), no timers controlling transitions. Viewport remains anchored; scroll surface remains native. All masks/transforms/text derived on the UI thread. Do not copy runOnJS(setStage) from old experiments into per-frame scrubbing. Nearby scene mounting may be scheduled at range boundaries; if that uses JS, disclose it and never claim literally zero JS activity. Initially only two photo layers plus a labelled workshop placeholder are needed.

First test uses the earlier preferred Audi illustrative pair ONLY as an explicit motion study; alternatively genuine R8 driver-dashboard photo is available but its tight perspective is a declared mismatch. Do not silently switch pair. A realistic final-media claim remains blocked. Geometry is normalized to source image and mapped through the chosen cover/contain crop; guessed viewport coordinates are unacceptable. No measured final windshield rectangle is approved yet.

Storyboard ranges (baseline, not copied timing measurements):
0-.10 exterior hold, subject clear, two short lines in negative space.
.10-.15 whole text lines exit through clips; .10-.25 exterior zoom/translation toward actual windshield, portal grows from windshield, interior counter-scales with preserved aspect ratio. Backward returns exact same geometry.
.25-.35 cockpit hold; one flat-image depth drift only, no pretend separated wheel.
.35-.45 tachometer SVG stroke + brief brand promise, anchored to visible instrument region. Brand mark does not cover vehicle branding.
.45-.55 explicit illustrative amber service cue, scale determined by p (not a timer); circular workshop placeholder reveal originates from that cue, cockpit simultaneously retreats and text clears. This cue is not a real vehicle fault or live diagnosis.
.55-.65 placeholder workshop hold with no booking CTA. Scenes 4-8 are out of scope. Use a Phase-1-only debug mapping ending at .65, not a progress jump into unimplemented content.

No snapping in the initial acceptance run. User's direct instruction overrides attachment defaults. If later approved, snapping is opt-in after touch release only and cancelled immediately on touch; zero snap behavior during drag. Holds mean flat animation ranges, not forced scroll stops.

Skip always reaches existing /customer, with existing authentication unchanged. Phase 1 has no backend calls/booking. Reduced motion offers explicit tap navigation among still scene states with same Skip; Android back moves one held scene backward except at start, where normal back applies. Story is separate from existing Home. Real Home handoff must be reversible while p<1; once normal navigation occurs, replay is an explicit action, not reverse-scroll through an unmounted stage. This resolves the attachment's contradictory unmount-and-reverse requirement for Phase 4 planning.

## 9. Verification and Android plan
VERIFIED: Git branch/dirty state read; installed versions read from node_modules; local image dimensions/bytes measured; MP4 duration/FPS/resolution decoded; source navigation, theme and API consumption inspected. Actual dashboard/cockpit photograph inspected visually. Prior session reference frames were viewable (glasses/material-to-product and two food-product transformations); frame imagery shows re-composition/object continuity, not evidence of native site scroll curves.
IMPLEMENTED-UNTESTED: no new feature implementation in Phase 0. Earlier experiments remain present; this report does not certify them to the new acceptance criteria.
NOT DONE: Phase 1 code, new media production, portal crop approval, real-device QA, release-like FPS/memory/cold-start measurement, scenes 4-8 and integration. No Android model/version claimed. adb was not found on current PATH; this alone does not prove no Android tooling exists elsewhere.

After Phase 1 approval: first run web geometric checks (p=.15/.18/.21 and mid-transition reverse), Arabic/LTR, both themes, Skip and lifecycle. Then use a release-like Android APK (existing eas preview profile produces APK; no build is started in Phase 0). Record device/model/Android/build identity; slow drag, stop, reverse, fast multi-scene flick, app background/foreground, three forward/back passes; measure UI frame timing, process memory, live player count and cold-to-interactive time. Dev FPS counter is diagnostic only; not proof of release performance. No quality or performance guarantee before these observations.

## 10. Approval gate / deviations
No new branch because the user's explicit instruction overrides the attachment. No mandatory snapping. No documentation pretending exact reference easing has been measured. No acquisition or conversion of media. No auth/backend modifications. Phase 0 stops here. Approval needed for the proposed isolated Phase 1 and explicit illustrative asset pair; final photographic pair remains a separate media decision.
