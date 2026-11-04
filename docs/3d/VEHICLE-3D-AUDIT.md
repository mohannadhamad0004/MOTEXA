# VEHICLE-3D-AUDIT ? visual review completed

Local Three.js **0.160.1** and GLTFLoader loaded from C:/Users/mohan/WebstormProjects/MOTEXA/.private/three-r160/package. No npm operations or CDN requests were used in this resume. Production assets, mappings and viewer source were preserved. No Sketchfab searches or replacements were performed.

## Results

All 120 models were reviewed. All 120 originals and 118 prepared variants rendered: **238 successful variant sets / 1,428 baseline screenshots**. Two prepared builds failed (Ford Kuga Mk2 and Kia Sorento UM); their original views and exact build errors were reviewed. Thus 120 models have rendered evidence, 118 have both complete variant sets, and two have original views plus prepared failure records.

PASS 48; FIX_CONFIG 14; FIX_PIPELINE 2; REPLACE 18; UNCERTAIN 38. HEAVY 5 is independent performance metadata. Classifications are demo visual assessments, not device-performance or licensing clearance. Models held for provenance review stay held.

## Method and reproducibility

The audit reads the completed inventory; it does not repeat technical inspection or DB queries. Audit-only HTML rewrites the production import map to local paths. Local JS/selected GLB are supplied by allowlisted Playwright routes; remote resource requests remain blocked. All views use 900 x 650, fixed directions, neutral background, identical lighting/ground and fit-to-bounds. Originals retain orientation; prepared assets run through MOTEXA build/config/paint behavior. No flattering per-model camera changes were made.

The first run hit Chrome's 100MB DevTools transfer limit on a large original GLB. Large files now transfer in 1MB chunks to an in-memory browser buffer for GLTFLoader.parseAsync; smaller GLBs use the local route. No security setting was weakened. A loopback-streaming attempt failed and was removed. The completed run has no global blocker and zero remote resource requests. Earlier successful evidence was retained; compatible renderer hashes record the transfer-only revisions, with unchanged camera/build behavior. Asset/image/viewer hashes remain checked.

~~~powershell
node backend/scripts/vehicle-audit-render.mjs --three-dir=C:/Users/mohan/WebstormProjects/MOTEXA/.private/three-r160/package
node backend/scripts/vehicle-audit-report.mjs
node --test backend/tests/vehicle-audit-local.test.mjs backend/tests/vehicle-audit.test.mjs
~~~

The renderer preserves matching existing evidence and attempts missing variants. Do not run vehicle-audit.mjs, which rebuilds the earlier technical inventory. Evidence is in ignored 3d-source/audit/renders/<key>/{prepared,original}/; contact sheets in audit/sheets/01.png through 24.png contain all twelve views per model (blank prepared row where build failed). Decisions live in visual-decisions.json and are bound to both evidence hashes. Failed variants have failure.json instead of fabricated screenshots. The report merger validates screenshots or explicit failure evidence before accepting a review.

## Mercedes diagnosis

**W203: FIX_CONFIG.** Baseline original and prepared scenes both stand vertically. Separate proposed-fix captures prove that a -90 degree X rotation in a child wrapper, applied before the existing heading rotation, produces an upright assembled car. See audit/proposed-w203-minus/mercedes-c-class-w203/prepared/. Both rotation signs were tested; the positive sign is unsuitable. No production correction was applied.

**W204: REPLACE.** Original and prepared side views show empty arches, a wheel under the body centre and loose pieces beneath the car. This is present in the source assembly; preparation/viewer normalization is not the sole cause. A global rotation cannot reattach these components.

## Failures and risks

Kuga Mk2 and Sorento UM prepared builds throw SkinnedMesh.applyBoneTransform / missing matrixWorld errors. Originals load/render but also require orientation/material review. FIX_PIPELINE identifies the prepared-only runtime regression; it does not claim that repairing the skeleton alone will make them PASS.

HEAVY prepared models: L200 K60/K70, Octavia NX, Mokka B, W202 and i30 FD. No decimation or arbitrary visual rejection was applied. Mobile frame time/memory remain unmeasured; Expo Go verification is outstanding.

Audi A4 B8, BMW E36 and several others have promising wheel/body/bumper node signals. Every model has accessory metadata, with separate front/rear bumper, skirt, wheel, body and roof/trunk fields. Mesh separability is marked unknown wherever image review and names cannot prove it. No accessory changes were made.

## Next phase boundary

The classification stage is complete, including explicit UNCERTAIN decisions. The 18 clear REPLACE entries can enter a small Sketchfab candidate-comparison phase; do not mass-promote assets. The 14 configuration fixes and two pipeline regressions should retain their current licensed sources. The 38 uncertain entries need human review before replacement decisions. Correct source licensing, candidate rendering and device validation remain required. No production deployment readiness is implied.

Human-review entries:

- audi-a3-8l: Prepared hood has patch artifacts absent from original; determine material/quantization cause before choosing a fix.
- audi-a4-b6: Both versions have visibly transparent/wire-like surfaces; material correction feasibility needs review.
- audi-q5-8r: Both versions have transparent patchy body/wheels; investigate material alpha settings before replacing.
- audi-q7-4l: Pale/low-contrast original and patchy prepared surfaces need material review.
- bmw-3-series-e46: Existing keepBox removes exploded alternatives but prepared wheel placement/materials remain questionable.
- bmw-5-series-e39: Source has distant exploded components and miniature framed body; mesh-selection/assembly review required.
- bmw-5-series-e60-e61: Source and prepared contain vertically exploded body alternatives; cannot confirm safe component selection.
- bmw-5-series-g30-g31: Distant exploded geometry dominates bounds in both versions; inspect assembly selection before replacement.
- bmw-x3-e83: Body surfaces remain partly translucent; material correction feasibility needs review.
- bmw-x5-g05: Transparent patchy body in both versions; material correction needs review.
- ford-focus-mk1: Both versions contain multiple separate/overlapping body variants, with incorrect prepared heading; assembly selection needs review.
- ford-focus-mk3: Monochrome body/wheels and reversed heading; generation shape plausible but materials need review.
- hyundai-i10-ac3-ai3: Whole-body material tint and low contrast; inspect material assignment before approval.
- hyundai-i20-pb: Several body variants and detached kit pieces share the scene; selection/reassembly feasibility uncertain.
- hyundai-santa-fe-mx5: Vehicle is assembled but heading is reversed and roof/window surfaces are patchy; inspect materials and variant correctness.
- hyundai-tucson-lm-ix35: Nearly white materials make details/wheels difficult to verify; keep for material/generation review.
- kia-optima-mg: Baked/scan-like texture and background floor remain; quality borderline for demo.
- kia-optima-tf: Assembled but exact Optima generation and material quality require confirmation.
- kia-rio-yb-sc: All-white rendering obscures surfaces/wheel integrity; inspect materials before deciding.
- mercedes-a-class-w176: Assembled but washed-out glazing/body materials need approval.
- mitsubishi-l200-3rd-gen-k60-k70: Tilted/floating pickup and questionable K60/K70 identity; generation and transforms require human review; HEAVY separately.
- mitsubishi-outlander-4th-gen-gm-gn: Washed-out materials and exact-generation detail need confirmation.
- mitsubishi-pajero-2nd-gen-v20: Large background walls dominate both renders and hide the car; isolate geometry before deciding suitability.
- mitsubishi-pajero-4th-gen-v80: Exploded wheel/body alternatives in both versions; safe variant selection/reassembly not confirmed.
- nissan-juke-f15: Assembled Juke faces backward in front view; heading configuration needs correction.
- nissan-x-trail-t32: Scene base and nearly white materials remain; geometry/material cleanup feasibility uncertain.
- opel-astra-f: Floating body/trim and displaced wheels appear in original and prepared; assembly selection may help but needs review.
- opel-astra-h: Vertical car plus rig/gizmo objects in both versions; orientation and object selection need validation.
- opel-insignia-a: Multiple separate shells and body pieces in both versions; assembly-selection feasibility uncertain.
- opel-mokka-b: HEAVY model with washed-out materials; visual approval needs material review.
- peugeot-301-m3: Almost featureless white vehicle/wheels; materials need review rather than automatic replacement.
- renault-captur-2nd-gen-jb-je: Nearly white vehicle; material acceptability cannot be confirmed.
- renault-megane-mk2: Exploded alternate body pieces persist; needs safe variant selection review.
- seat-ibiza-mk4-6j: Assembled but white/plain materials obscure detail and generation confirmation.
- skoda-octavia-mk4-nx: HEAVY wagon appears assembled, but NX generation identity and finish need human confirmation.
- toyota-land-cruiser-j100: White low-contrast source plus detached-looking front wheel pieces; material/assembly review required.
- toyota-land-cruiser-j200: Vehicle floats off-centre with oversized bounds/shadow; inspect stray geometry/origin before choosing normalization.
- volkswagen-transporter-t4: Floating alternate front pieces and inconsistent wheel placement in both versions; selection/assembly needs review.

Checks: audit tests 9/9 passed; mobile/backend TypeScript passed; scoped diff checks passed. Android export was not rerun because no production/mobile source changed. No commit/push.


## Stage A update and host replacement handoff

Stage A is complete: 14 targets evaluated, 10 PASS_AFTER_FIX, four UNCERTAIN. The four are BMW X5 E70 (pink source glazing), Sonata NF (display floor fused into the only mesh), Peugeot 207 (white source materials) and Clio Mk2 (pink source glazing). The Sonata has no applied correction; the other three have partial configuration improvements but are not demo-approved. No GLB changed. All held models remain held. The prior counts above describe historical baseline; current totals are PASS 48, PASS_AFTER_FIX 10, FIX_CONFIG 0, FIX_PIPELINE 2, REPLACE 18, UNCERTAIN 42, HEAVY 5.

Exact before/after configurations and results: STAGE-A-CONFIG-FIXES.md and each model's history/stageAFix in audit JSON. New evidence: audit/stage-a/renders/<key>/prepared/, six views each; baseline renders were preserved. W203 uses preRotateX=-PI/2 and heading rotateY=0 after verifying front and side views. Normalization uses a nested group before heading, preserving original hierarchy. All other settings remain unchanged except the specific paint corrections.

The baseline report merger now refuses to overwrite a report containing Stage A history. Do not run bulk optimize-3d.ts regeneration: it can overwrite manual configuration. config-fixes.json records the 14 exact per-model overrides, including held-model evaluation settings. The renderer's --stage-a mode reads live production configuration, applies held overrides, and writes separate evidence.

Checks: 15 audit/configuration/host-helper tests passed; mobile/backend TypeScript passed; Android export succeeded (2275 modules). No native phone test.

Stage B targets remain W204, BMW F20/F21 and Golf Mk7. Host identity authentication has not been proven. No sandbox outbound request was retried, and no search/download/candidate evaluation/promotion occurred. Run this from normal host PowerShell in the repository root with SKETCHFAB_ACCESS_TOKEN already present in that shell's environment:

~~~powershell
node .\backend\scripts\sketchfab-host.mjs --auth
~~~

Do not paste the credential into source or the chat. The helper only reads SKETCHFAB_ACCESS_TOKEN and uses Bearer authentication; there is no legacy-token fallback. It never logs the token, profile or signed download links. HTTP 401, HTTP 403 and NO_HTTP_RESPONSE failures are distinct. A successful identity check writes only sanitized status to ignored 3d-source/sketchfab-candidates/host-auth.json. This verifies identity, not download authorization. Stop on failure and report the sanitized message.

After host identity succeeds:

~~~powershell
node .\backend\scripts\sketchfab-host.mjs --search
~~~

The search mode is limited to the three pilot keys and derives queries/year ranges from actual audit entries, using downloadable=true. It stores UID/title/creator/license/counts/popularity/date metadata. Results still require generation/body-style review to select 3-5 serious candidates. Download only a reviewed UID from those results:

~~~powershell
node .\backend\scripts\sketchfab-host.mjs --download --target=mercedes-c-class-w204 --uid=REVIEWED_UID
~~~

The download endpoint separately verifies authorization. Only downloadable CC0/BY/BY-SA metadata is admitted; provenance legitimacy still needs review. Original GLB or glTF archive is staged under target/UID and never published. Existing source files are not overwritten. No automatic preparation or promotion runs in this helper; downloaded candidates return to Codex for safe staging preparation, local rendering, comparison and acceptance. Identity has not yet been proven, so network-dependent work stops at this handoff. None of the three is marked NO_ACCEPTABLE_REPLACEMENT because candidates remain unevaluated. Do not scale this workflow yet.
