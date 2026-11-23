# Phase 0 v2 addendum — approval still required

Read together with PHASE_0.md, inventory, shot list and reference checklist. v2 replaces the earlier warning-to-workshop Phase1 destination with cockpit-to-infotainment dive. No feature code added or changed.

## Changes to the proposed Phase 1
Dev-only lab; isolated persistent stage; generic exterior hold; cancellable press-and-hold entry ring; windshield portal; cockpit and MOTEXA promise; dashboard-screen dive ending in a labelled placeholder. No scenes4-8 content, no personal data fetching, no Home redesign or production wiring. First-name greeting reserved for Scene8. Vehicle label can later come from existing authorized owner state; do not claim generic hero photography depicts the customer's own vehicle.

Use v2 normalized ranges: 0-.08 exterior hold; .08-.22 windshield reveal; .22-.30 cockpit hold; .30-.40 promise; .40-.52 screen-dive study; end in labelled content placeholder. Tests at p=.12/.15/.18, mid-reveal reverse, rapid reversal, resize/rotation. No final portrait crop or portal coordinates approved yet; derive from real selected source and crop, not a guessed viewport rectangle.

## Track comparison and recommendation
A: 2-4s forward/reversed matched clips. Strongest potential screen-crossing imagery, but BOTH are absent. Existing 10/12-second driving clips have no infotainment dive and no matching endpoints. Phase1 A test can only use a labelled placeholder unless compatible transition media is provided/approved. A placeholder verifies lifecycle/state, NOT cinematic quality. No existing clip may be presented as a successful screen dive.

B: existing Reanimated + Gesture Handler + SVG/clipping and image sources. Precise bidirectional finger mapping; feasible mechanical prototype, with flat-photography limits. Counter-scaling preserves proportions but cannot synthesize unseen cabin geometry. Recommended baseline for the user-control acceptance criterion.

Hybrid: retain as a hypothesis. Threshold-triggered A playback continues independently of position while playing; a reversed clip is time-reversal playback, not position-reversible scrubbing. Thus v2 A and the earlier precise-control rule are not equivalent. Do not quietly substitute A for strict 1:1 scrubbing. Any A burst requires explicit acceptance of this control exception, or keep B throughout. No measured Android winner exists.

## Gesture entry, haptics and snapping
Proposed A/B harness first maps pan distance to one progress shared value, preserving grab origin and cancelling decay on touch. Compare native-scroll variant using the same scenes; do not change visuals to bias comparison. No time-based stagger during scrubbing: whole-line offsets and slice staggering become progress offsets. A 40ms timer is inappropriate for reversible finger-led motion.

Hold entry has its own cancellable input-duration value; story progress remains the sole visual scene clock. Hold completion unlocks entry, not an uncontrollable camera animation. Skip remains available before/after hold. Early release clears ring. No engine playback or haptics claimed. expo-haptics must be checked separately; if absent, dependency approval is needed, not silent installation. Haptics/snap are opt-in implementation gates; earlier user instruction requires precise progress, with no snap interfering with active drag. Default no snap in control-quality baseline; optional release-only snap later.

## Integration constraints unchanged
CUSTOMER only, first eligible authenticated launch proposed for Phase4; replay later; no login/role rewrite. Existing mode changes are internal CustomerWorkspace callbacks, not supported route params. Phase2 requires an approved owner-only bridge or existing callback handoff to preserve selected mode; do not invent deep links. Parts/tow are currently information portals, AI preview only.

The request to create a feature branch conflicts with prior explicit no-branch-without-approval instruction; no branch created in Phase0. Existing uncommitted changes preserved. Final Home cannot both unmount and remain reverse-scrollable: retain stage until deliberate handoff, then explicit Replay. Resolve in Phase4, not by touching Home now.

## Report labels
VERIFIED: installed inventory and source audit from PHASE_0; TypeScript noEmit passed; original193036 recording decoded into10fps timestamp sheets. No new feature functionality inferred from compile success.
IMPLEMENTED-UNTESTED: no v2 feature code implemented. Existing experiments are not certified to v2.
NOT DONE: both-track prototypes; new media; press-hold/haptic tests; exact portal coordinates; real-device gesture comparison; release Android FPS/memory/player-count/startup measurements; scenes4-8; feature-flag integration. No device/build was used in this docs-only phase. Existing eas preview profile can produce an APK; no build triggered.

Files created/updated in Phase0 are documentation and sampled reference-sheet images only. No packages, Git history/configuration, original screens, APIs, backend, Prisma or database were changed. Stop here pending Phase1 approval and the illustrative-vs-photographic proof-asset decision.

Additional verified finding: expo-haptics is absent from mobile/node_modules. Completion vibration is NOT implemented; any Expo haptics package installation needs explicit dependency approval. Timestamp sheets were visually reviewed after extraction. The available193036 file keeps the laptop visible and does not establish literal full-screen camera entry; owner-supplied v2 interpretation is a desired creative direction where it exceeds visible evidence. See REFERENCE_MATCH.md for observed time intervals.
