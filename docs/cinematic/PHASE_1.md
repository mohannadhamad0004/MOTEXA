# Phase 1 — isolated placeholder prototype report

Date:2026-11-18. Stop at end of phase. No image/video generation performed. Main flow flag remains OFF.

## Files
Created mobile/src/app/(dev)/cinematic-lab.tsx; mobile/src/components/cinematic/{CinematicStage.tsx,scenes.config.ts,CinematicMedia.tsx,MaskedCopy.tsx}; mobile/assets/cinematic/placeholders/{EXT_HERO.tsx,INT_COCKPIT.tsx,INT_DASH_SCREEN.tsx}; mobile/assets/cinematic/MANIFEST.md and generated/.gitkeep. New tests: mobile/tests/cinematic-phase1.cjs, cinematic-lab-smoke.cjs and cinematic-layout-inspect.cjs. New docs/evidence: docs/cinematic/SWAP_CONTRACT.md, PHASE_1_BASELINE.json, phase1-evidence/*, reference-frames/111727-contact.jpg and111816-contact.jpg; appended reference observations. Early smoke screenshots mobile/docs/cinematic-lab-initial.png and cinematic-lab-drag.png are diagnostic, not final art.

No pre-existing app/role/auth/API/backend/Prisma/configuration files were intentionally edited. Source-baseline hash verification is recorded separately. No branch, Git history/config changes, dependency installs, seed or database writes.

## VERIFIED
- Installed-library TypeScript noEmit and scoped ESLint passed at implementation checkpoint; rerun results recorded at final handoff.
- Browser, Microsoft Edge, viewport390x844 English/dark and320x844 Arabic/light: premature hold release stays locked at p0; full hold unlocks without forcing story progression.
- Finger-led Pan input: p advances while dragging; stays fixed when the held pointer stops; reversing within the same gesture decreases p. Momentum is release-only and cancelled on new touch. Optional snap exists but defaults OFF.
- Both locales reach p=.52. Sample successive pan observations were approximately .081/.200/.321/.441/.520 and .082/.203/.323/.441/.520. These are browser observations, not Android performance evidence.
- Native-scroll alternative responds forward/backward in browser. No per-frame React setState is used; shared values drive transforms/clips/text. The only runOnJS callback marks entry completion, not scrubbing.
- Reduced motion at430x844: tap-through reaches .52 and Previous returns .35; no pan or Ken Burns motion in reduced mode.
- Track A selection visibly reports missing clip. It does not play an unrelated video or pretend the clip exists. All three artworks visibly carry PLACEHOLDER labels.
- Zero observed page errors, zero API requests and zero live video elements in interaction tests. No horizontal page overflow in tested contexts. All assets still default to code-drawn placeholders.

## IMPLEMENTED-UNTESTED (native acceptance outstanding)
- Source-measured normalized windshield rect, counter-scaled fixed-aspect child; cockpit hold, tachometer ring, progress-driven warning cue and expanding infotainment-screen portal.
- Source Android BackHandler: previous hold point, normal back at start. AppState/focus cancellation and dev-only gating are implemented but native OS lifecycle not exercised.
- Opt-in release snapping and FPS debug overlay are implemented; precise snap tolerance, production gating and portal geometry checkpoints require additional targeted/native checks before acceptance.
- Screen dive is Track B fallback only. It is a geometrical placeholder study, not footage of a physical camera passing through a screen.

## NOT DONE
- Real-device Android/release APK demonstration, device model/Android version, memory profiling, dropped-frame accounting, cold-start measurement and measured A-vs-B comparison. Browser displayed refresh-rate FPS is not a native performance claim.
- Haptic feedback: expo-haptics is absent; no package installed. Hold ring provides visual feedback only.
- Track A forward/reversed transition clips: no compatible media supplied. No generated or synthetic clip created.
- AI/API functionality, scenes4-8, real personalized vehicle data, new service flows, Home integration, replay/first-launch behavior. Those remain outside Phase1.
- Final photography matching/quality approval. Owner will supply images; no auto-switch occurs.

## Deviations / rationale
No actual video playback because the latest instruction expressly keeps EXT_HERO_LOOP as still Ken Burns until a real clip exists. Max live video players is zero. Media production is not faked. No haptics dependency without approval. Optional snap is OFF to preserve user-controlled pacing. New reference recordings are accepted as basic movement benchmarks, not permission to change existing Home or to generate imagery.

There are only three asset layers in this short placeholder study; all remain mounted to guarantee deterministic reverse without scene-change JS. They are cheap SVG placeholders, but this is not the final +/-1 photographic mounting-window strategy. Native memory acceptance remains open when real images arrive; do not claim final asset lifecycle is optimized.

## Next phase
Stop. Review the isolated geometry/interaction, then owner supplies reviewed media and changes only config paths using SWAP_CONTRACT.md. Phase2/service-scene expansion needs approval. Real-device acceptance is still required before calling the cinematic experience finished.

### Final browser checks
TypeScript and scoped ESLint passed after changes. Additional test mobile/tests/cinematic-portal-check.cjs passed: source crop at p=.12/.15/.18 uses equal X/Y scale, reverse from .18 to .12 restores clip width/height within2 CSS pixels, and Skip reaches existing /customer route. Proof in phase1-evidence/portal-checkpoints.json. Main interaction tests rerun after text-fit correction with zero page errors/API requests. Scope guard:283 existing files checked, zero changed (phase1-evidence/scope-guard.json).

Reference update: owner-supplied111727 and111816 recordings are now visually inspected. They establish detail zoom, persistent car and compact service hotspots as a BASIC benchmark. No new photos or production-screen changes were made in response.

Image-tool status: explicitly forbidden by latest owner instruction; zero calls. Owner will generate three stills. Tool supports image references, but consistency is not guaranteed. No API script or secret files were created.
