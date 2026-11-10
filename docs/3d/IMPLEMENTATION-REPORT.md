# 3D cleanup and submission implementation report

The [2026-11-08 workflow repair report](WORKFLOW-REPAIR.md) records the current taxonomy/publication separation, revision and model-management workflows, exact stock-visibility restoration, fresh E36 rear-bumper rejection, automated/browser validation and remaining checks. Its results supersede the older phase summaries below.

The [STEP 3D-FROM-LINK completion report](SKETCHFAB-IMPORT.md) records the 2026-11-07 Sketchfab workflow and actual Volkswagen Beetle publication. The active runtime catalog now contains 22 models; the older 21-model counts below describe their recorded historical phases. Live Garage, attribution, hash-bound part-map and current validation evidence are in that report.

The [managed catalog completion results](#managed-catalog-completion--2026-11-05) supersede the historical phase-2 and initial-phase implementation/test notes below.

Branch: `ui/blueprint`. No commit, push, reset, stash, revert or branch deletion. No graphify-out changes. No Diala-owned auth, choose-role, admin tabs, mechanics, root layout/index or components edited.

## Phase 2 ? Meshy, viewer/runtime hardening and current manual candidate

Completed 2026-11-04 on `ui/blueprint`. Existing foundation extended; no second submission workflow. No live paid job, commit or push. No Diala-owned files or graphify-out changes. No native dependency added.

### Current candidate and the two missing vehicles

| Item | Identity/use | Final classification | Production |
|---|---|---|---|
| `w204-c63-source.glb` | 2008 Mercedes-Benz C63 AMG, C-Class W204 sedan variant; 2,872,476 bytes; source hash `9874b284da3f456fdd297d3bd8654d060c4bf875158f12df6cc16a54640c1022` | **REJECT**: external source/license verification unavailable. Technical/visual result **PASS_VARIANT**, not the old broken asset | Inactive; no restored GLB or DB key |
| `backup-old/source-old.glb` | Archived source only | Not a candidate | Never reactivated |
| `backup-old/production-old.glb` | Retired production backup only | Not a candidate | Never reactivated |
| Intended second vehicle | Not yet supplied / pending import | Pending | None |
| Intended third vehicle | Not yet supplied / pending import | Pending | None |

Fresh technical inspection plus both neutral and red `c63color` six-view renders used the actual production HTML build, local Three r160 and the same `modelForViewer()` serializer used by the mobile hook. Confirmed front +Z, ground Y=0, 4.7 m length, sensible dimensions, four assembled wheel positions/separate rim/tire meshes and isolated paint. The embedded CC BY 4.0/007 source claim is recorded but not treated as external clearance. The old W204 rejection was tied to different hashes and cannot classify this candidate. Full evidence/configuration/hash details: [C63-AUDIT.md](C63-AUDIT.md), [c63-audit.json](c63-audit.json). No replacement published. Active collection stays at 21; exact 21 kept and all 99 removed/held keys remain in the initial-phase table and FINAL-3D-CLEANUP.md.

### Architecture/schema/security

`meshy-client.ts` implements the verified official Multi-Image-to-3D contract with injectable HTTP, safe errors, strict result parsing and bounded private downloads. `vehicle3d-generation.ts` persists task/state/progress/timestamps, poll scheduling, request intent, expiring lease and preparation checkpoints. Restart resumes known jobs; uncertain paid POSTs fail closed. Default mock is explicit and independently blocked from submit/promote. Real mode requires `MESHY_API_KEY`, `VEHICLE3D_MODE=real`, `MESHY_ALLOW_PAID_GENERATION=1` and an explicit customer Generate action/processing consent. Tests never use real Meshy HTTP.

New additive migration **`20261104210000_vehicle3d_provider_lifecycle`** was applied, alongside the existing first-phase `20261104190000_vehicle_3d_submissions`. It adds provider lifecycle, leases, raw preparation/attempt history, safe errors, explicit live authorization, catalog-sharing consent version/timestamp and visual-verification timestamp. No existing table/column dropped or renamed. Legacy unconfirmed processing rows are safely failed rather than authorized to spend credits.

Raw/prepared models and four re-encoded guided photos remain behind authenticated owner/Parts Admin asset APIs. DTO allowlists exclude provider IDs, customer identity, internal paths and source metadata. Generated GLB names/extras/copyright are removed from the prepared export. Public keys use generation/content hash. Private audit history links originating submission, photo attempt, reviewer, approvals and old/new replacement keys. Consent explicitly covers catalog sharing of the representation while original photos remain private; generated provenance never invents CC licensing.

`vehicle3d-promotion.ts` centralizes immutable production copy, catalog manifest/config/credits, generation mapping, audit and crash-recovery journal for both submissions and curator imports. Existing shared models require an explicit exact-key replacement. `manual3d-import.ts` supports private preparation/six-view review now and explicit publication later with genuine external source metadata or real MOTEXA ownership evidence and a Parts Admin reviewer. It refuses archived backup-old candidates. C63 preparation used this path without publication.

### API/mobile/admin/viewer changes

Existing routes are retained. Three additional actions extend them:

- Customer `POST /api/catalog/vehicle-3d-submissions/:id/regenerate` resets an unapproved attempt without creating a paid job.
- Parts Admin `POST /api/admin/parts/vehicle-3d-submissions/:id/validate` repeats technical/viewer preparation and accepts explicit up/heading correction.
- Parts Admin `POST /api/admin/parts/vehicle-3d-submissions/:id/request-regeneration` returns a reviewed model with notes for customer action.

The full 17-endpoint inventory and authorization are in [CUSTOMER-3D-WORKFLOW.md](CUSTOMER-3D-WORKFLOW.md). Runtime `GET /api/catalog/3d-models` now returns deterministic `revision` and authoritative `activeKeys`.

Customer screen `/customer/vehicle3d/[carId]`, reached from Garage Create/View my 3D car, now shows generation stage/provider progress, explicit mock labelling, consent, retry/regenerate/replace-photo/delete and admin notes. Photo/model revisions keep status polling from repeatedly reloading images/viewers. Parts Admin canonical list/detail are `/dept/3d-submissions` and `/dept/3d-submissions/[id]`; old vehicle3d routes remain aliases. Queue filters include pending/generating/failed/approved/rejected. Detail includes four private photos, interactive model, technical dimensions/size/provider, repeat validation/orientation correction, required visual verification, approve/reject/request-regeneration and explicit replacement. EN/AR, RTL and both themes are retained.

The production path already forwarded `preRotateX` at the start of this continuation. It is now centralized with every other required field in validated `modelForViewer()` and tested on the actual hook serializer: length, preRotateX, rotateY, groundOffset, both paint selectors, bakedPaint, centerX, keepBox, zones and wing/rack offsets. The renderer uses this same serializer and actual HTML build. Runtime merging validates nested fields, deduplicates keys, respects server removals, fails closed on invalid responses and uses a validated public-only disk cache for at most 24 hours offline. Missing/expired/unavailable configuration shows coming soon. Offline clients cannot learn subsequent server removals until reconnecting; TTL bounds stale use.

### Phase-2 files

- Backend schema/additive migration; server route guard; `vehicle3d.routes.ts`; `meshy-client.ts`, existing generation/submissions/validation/catalog services and new common promotion service.
- Tools: `manual3d-import.ts`, `meshy-live-report.ts`, `vehicle3d-catalog-check.mjs`, actual-viewer `vehicle3d-viewer-check.mjs`; historical cleanup guard and config test compatibility.
- Backend tests: new `meshy-generation.test.ts` and extended existing `vehicle3d.test.ts`.
- Mobile: Garage and Parts dashboard links, canonical admin route exports; vehicle3d API/screens; car3d hook, new `modelConfig.ts`, `runtimeCatalog.ts`, hardened `runtimeModels.ts`; `car3d-runtime.test.mjs`.
- Docs: this report, MESHY-INTEGRATION.md, CUSTOMER-3D-WORKFLOW.md, C63-AUDIT.md/c63-audit.json, inactive W204 manifest annotation, FINAL-3D-CLEANUP.md, STATUS.md and final git status. Earlier cleanup changes remain uncommitted and preserved.

### Final validation

| Check | Result |
|---|---|
| Backend `npx tsc --noEmit` | PASS, exit 0 |
| Prisma `npx prisma validate` | PASS; additive migration deployed |
| Full backend `node scripts/test-vehicle3d-suite.mjs` | **130/130 PASS**, serial fixtures, no real provider traffic |
| Mobile `npx tsc --noEmit` | PASS, exit 0 |
| Scoped mobile ESLint | PASS, zero errors/warnings |
| Existing + new mobile tests | **29/29 PASS** |
| C63 technical/six-view neutral + red | PASS technical/visual variant; legal gate REJECT |
| Runtime/read-only catalog integrity | PASS: 21 models, 21 mapped generations, 21 production GLBs, no stale/invalid keys; final C63 source/viewer/serializer hashes match |
| 390px browser fixture validation | **12/12 PASS**, EN/AR ? light/dark ? upload/private preview/admin review, no overflow, actual viewer shown event |
| Expo Android export | PASS, 2285 modules; `.private/vehicle3d-phase2/android-export` |
| `git diff --check` | PASS |

The added HTTP/lifecycle coverage includes four-view create, duplicate Generate, persisted progress/restart, completed private download/preparation, provider failures/auth/rate limits/timeouts/malformed/task disappearance, oversize/bad GLB, deletion during poll, resuming a saved task, private metadata stripping, consent, real promotion and runtime visibility. Existing ownership/auth/admin inspection/reject/approve, mock blocking, invalid GLB, duplicate/unsafe promotion and explicit replacement tests still pass. New actions test validation while generating is blocked, revalidation, regeneration notes, and reset consent/task boundaries. Promotion fixtures run serially and restore real metadata/assets; no fixture catalog entries remain.

Logs/screenshots are ignored under `.private/vehicle3d-phase2/`. Full-repo lint has pre-existing unrelated failures from the earlier phase; scoped lint is clean. Existing untouched admin-tab web direction/shadow warnings remain. Physical Expo Go verification was not performed. No live Meshy success is claimed.

### Human live test / remaining verification

Follow the exact single-car opt-in commands and UI steps in [MESHY-INTEGRATION.md](MESHY-INTEGRATION.md#exactly-one-intentional-live-test). Set backend real/paid opt-in, upload four photos for one Garage car, explicitly press Generate once, inspect preview, and run the read-only masked `meshy-live-report.ts --submission-id=<uuid>`. This reports duration/status sequence, prepared size, validation/viewer and preliminary eligibility; admin visual/identity/replacement checks remain mandatory. No automatic live test is authorized.

Remaining: genuine external C63 source/license evidence; the other two vehicles not yet supplied; intentional real Meshy generation and output identity/rights review; physical Android/Expo Go photo picking, navigation/backgrounding and performance; deployment packaging/durable storage/permissions and final legal consent review. The C63 is safely inactive pending provenance, rather than blocking the complete customer workflow.

## Initial phase (historical library cleanup)

## Exact model results

120 inventoried models, 95 previously active production GLBs. **21 kept; 0 replaced; 99 removed/inactive** (74 removed from production, 25 previously held). All 21 retained production GLBs are unchanged; their total is 76.9 MiB. Status totals: {'PASS': 13, 'PASS_VARIANT': 4, 'PASS_AFTER_FIX': 4}. Six undownloaded audit candidates were never models and remain inactive, outside these 120 totals.

All 99 exact removed keys, generations, previous audit statuses and reasons are listed in [FINAL-3D-CLEANUP.md](FINAL-3D-CLEANUP.md), also machine-readable in [cleanup-decisions.json](cleanup-decisions.json). No replacement source was selected. Modified W204 was archived before removal. The 74 removed production GLBs are backed up under ignored `.private/vehicle3d-cleanup/production-backups/`; ignored raw sources remain intact. Removed generations retain database rows and show coming soon. 74 stale model pointers were cleared with audit records.

| Kept key | Vehicle/generation | Final status |
|---|---|---|
| toyota-corolla-e170-e180 | Toyota Corolla E170/E180 | PASS |
| bmw-3-series-e36 | BMW 3 Series E36 | PASS_VARIANT |
| bmw-x5-e53 | BMW X5 E53 | PASS_VARIANT |
| hyundai-accent-lc | Hyundai Accent LC | PASS |
| mercedes-c-class-w203 | Mercedes-Benz C-Class W203 | PASS_AFTER_FIX |
| mercedes-e-class-w212 | Mercedes-Benz E-Class W212 | PASS_AFTER_FIX |
| mercedes-vito-w447 | Mercedes-Benz Vito W447 | PASS |
| peugeot-208-2nd-gen-p21 | Peugeot 208 2nd gen / P21 | PASS |
| peugeot-308-2nd-gen-t9 | Peugeot 308 2nd gen / T9 | PASS |
| renault-fluence-l38 | Renault Fluence L38 | PASS_AFTER_FIX |
| skoda-fabia-mk2-5j | Skoda Fabia Mk2 / 5J | PASS |
| skoda-octavia-mk2-1z | Skoda Octavia Mk2 / 1Z | PASS |
| toyota-c-hr-1st-gen | Toyota C-HR 1st gen | PASS |
| toyota-camry-xv20 | Toyota Camry XV20 | PASS_AFTER_FIX |
| toyota-camry-xv70 | Toyota Camry XV70 | PASS |
| toyota-corolla-e210 | Toyota Corolla E210 | PASS |
| volkswagen-caddy-sb-latest | Volkswagen Caddy SB / latest | PASS |
| volkswagen-polo-mk4-9n | Volkswagen Polo Mk4 / 9N | PASS_VARIANT |
| audi-a4-b5 | Audi A4 B5 | PASS |
| audi-q3-8u | Audi Q3 8U | PASS |
| opel-corsa-b | Opel Corsa B | PASS_VARIANT |

## Migration and endpoints

Applied additive migration: `backend/prisma/migrations/20261104190000_vehicle_3d_submissions/migration.sql`. Adds the submission table, enum, relations and indexes. No DROP/RENAME of any existing table/column, no destructive migration, no generation deletion.

[Workflow and complete 14-endpoint inventory](CUSTOMER-3D-WORKFLOW.md): customer create/list/status/four-view upload/generate/private assets/submit/delete, Parts Admin list/inspect/private assets/approve/reject, and shared runtime model metadata. All use existing auth/role/permission guards. Private bytes are never static-hosted before approval. Mock mode cannot publish. Approval validates/render-checks and requires explicit visual/source verification; existing models require the exact replacement key. Journal recovery and committed-approval serving protect interrupted promotions. Prior shared versions and their attribution are preserved.

## Screens

- Customer: `mobile/src/app/customer/vehicle3d/[carId].tsx`, linked from each Garage car; photo upload, consent, states/retry, private preview, optional catalog submission, status/notes and history.
- Parts Admin list: `mobile/src/app/dept/vehicle3d/index.tsx`, linked from Parts dashboard.
- Parts Admin inspect/review: `mobile/src/app/dept/vehicle3d/[id].tsx`; four private photos, real viewer, vehicle metadata, notes/attribution, approve/reject and explicit replacement.
- Shared behavior: `mobile/src/features/vehicle3d/`; existing car preview/fullscreen use the runtime catalog and coming-soon fallback.

## Checks

- Backend full suite: **117/117 passed**. Latest focused submission suite: **21/21 passed** after final catalog/ownership changes. Real JWT/Parts Admin guards, cross-user denial, private endpoints, generation/mock lifecycle, approval/rejection, correct generation and seed mapping, invalid GLB denial, duplicate/conflicting/explicit replacement and journal recovery covered. Temporary fixtures cleaned/rolled back, metadata snapshots restored.
- Backend and mobile `npx tsc --noEmit`: **0**.
- `npx prisma validate`: **passed**. `npx prisma migrate deploy`: **applied successfully**.
- Mobile tests: **26/26 passed**.
- Android Expo export: **passed**, 2,281 modules. Artifact in ignored `.private/vehicle3d-cleanup/android-export/`; promotion-test attribution absent from the artifact.
- Scoped Expo ESLint for changed mobile files: **0 errors, 0 warnings**. Repository-wide Expo lint encountered existing unrelated errors; those files were not modified.
- Fresh local audit: **38 neutral candidates + 29 red-paint candidates**, six views each; all final 21 reviewed in both. Local pinned Three.js 0.160.1; zero renderer remote requests. Evidence under ignored `3d-source/audit/final/` and `final-paint/`.
- Browser: **12/12 isolated visual fixture checks**, 390 x 844, draft/private preview/admin review in EN/AR and light/dark; no horizontal overflow, private previews reach viewer `shown`. Existing unrelated admin-tab `direction` style warning is visible in web development.
- `git diff --check`: passed. Working tree retained for the human to commit.

## Remaining manual verification

1. Physical Android/Expo Go: photo picker, background/resume, private asset authorization after token expiry, pinch/drag, 390px RTL and performance on the actual phone.
2. A consented real Meshy generation with the developer's backend key/account. Official integration verified against docs; no successful live provider call is claimed. Generated identity/front/up/materials and rights still require human review.
3. Deployment must package the repo metadata, mobile viewer source, local pinned Three/Chrome renderer dependencies and writable catalog paths. This workflow was implemented/tested as the local repository demo pipeline.
4. Approved Garage cars retain history and cannot be deleted. Delete unapproved submissions first to remove other associated Garage cars. Mock models cannot be submitted/promoted.

## Exact changed-file inventory

`M` = modified, `D` = production asset removed, `A (untracked)` = new file. Existing W204/manifest/credits/config changes were used as the starting point, not reset. All retained GLBs remain unchanged. Pre-existing `graphify-out/` is excluded from this task inventory and untouched.

- `M	backend/package-lock.json`
- `M	backend/package.json`
- `M	backend/prisma/schema.prisma`
- `D	backend/public/3d/audi-a3-8v.glb`
- `D	backend/public/3d/audi-a4-b6.glb`
- `D	backend/public/3d/audi-a4-b8.glb`
- `D	backend/public/3d/audi-a4-b9.glb`
- `D	backend/public/3d/audi-a6-c6.glb`
- `D	backend/public/3d/audi-a6-c7.glb`
- `D	backend/public/3d/audi-q5-8r.glb`
- `D	backend/public/3d/audi-q7-4l.glb`
- `D	backend/public/3d/bmw-3-series-e46.glb`
- `D	backend/public/3d/bmw-5-series-e34.glb`
- `D	backend/public/3d/bmw-5-series-e39.glb`
- `D	backend/public/3d/bmw-5-series-g30-g31.glb`
- `D	backend/public/3d/bmw-x3-e83.glb`
- `D	backend/public/3d/bmw-x3-g01.glb`
- `D	backend/public/3d/bmw-x5-e70.glb`
- `D	backend/public/3d/bmw-x5-g05.glb`
- `D	backend/public/3d/ford-fiesta-mk6.glb`
- `D	backend/public/3d/ford-focus-mk1.glb`
- `D	backend/public/3d/ford-focus-mk3.glb`
- `D	backend/public/3d/ford-focus-mk4.glb`
- `D	backend/public/3d/ford-kuga-mk2.glb`
- `D	backend/public/3d/ford-ranger-t6.glb`
- `D	backend/public/3d/hyundai-i10-ac3-ai3.glb`
- `D	backend/public/3d/hyundai-i20-pb.glb`
- `D	backend/public/3d/hyundai-i30-fd.glb`
- `D	backend/public/3d/hyundai-kona-os.glb`
- `D	backend/public/3d/hyundai-santa-fe-mx5.glb`
- `D	backend/public/3d/hyundai-tucson-lm-ix35.glb`
- `D	backend/public/3d/kia-cerato-yd.glb`
- `D	backend/public/3d/kia-rio-yb-sc.glb`
- `D	backend/public/3d/kia-sorento-um.glb`
- `D	backend/public/3d/kia-sportage-sl.glb`
- `D	backend/public/3d/mercedes-a-class-w169.glb`
- `D	backend/public/3d/mercedes-a-class-w176.glb`
- `D	backend/public/3d/mercedes-c-class-w202.glb`
- `D	backend/public/3d/mercedes-c-class-w204.glb`
- `D	backend/public/3d/mercedes-vito-w638.glb`
- `D	backend/public/3d/mitsubishi-l200-3rd-gen-k60-k70.glb`
- `D	backend/public/3d/mitsubishi-l200-4th-gen-ka-kb.glb`
- `D	backend/public/3d/mitsubishi-outlander-4th-gen-gm-gn.glb`
- `D	backend/public/3d/mitsubishi-pajero-2nd-gen-v20.glb`
- `D	backend/public/3d/mitsubishi-pajero-4th-gen-v80.glb`
- `D	backend/public/3d/nissan-juke-f15.glb`
- `D	backend/public/3d/nissan-micra-k13.glb`
- `D	backend/public/3d/nissan-navara-d22.glb`
- `D	backend/public/3d/nissan-x-trail-t32.glb`
- `D	backend/public/3d/opel-astra-f.glb`
- `D	backend/public/3d/opel-astra-g.glb`
- `D	backend/public/3d/opel-astra-h.glb`
- `D	backend/public/3d/opel-astra-k.glb`
- `D	backend/public/3d/opel-corsa-c.glb`
- `D	backend/public/3d/opel-corsa-e.glb`
- `D	backend/public/3d/opel-insignia-a.glb`
- `D	backend/public/3d/opel-mokka-b.glb`
- `D	backend/public/3d/opel-vectra-c.glb`
- `D	backend/public/3d/peugeot-2008-1st-gen-a94.glb`
- `D	backend/public/3d/peugeot-207-207.glb`
- `D	backend/public/3d/peugeot-208-1st-gen-a9.glb`
- `D	backend/public/3d/peugeot-301-m3.glb`
- `D	backend/public/3d/peugeot-308-1st-gen-t7.glb`
- `D	backend/public/3d/renault-captur-2nd-gen-jb-je.glb`
- `D	backend/public/3d/renault-kangoo-2nd-gen-x61.glb`
- `D	backend/public/3d/renault-megane-mk2.glb`
- `D	backend/public/3d/seat-ibiza-mk4-6j.glb`
- `D	backend/public/3d/skoda-octavia-mk4-nx.glb`
- `D	backend/public/3d/toyota-camry-xv40.glb`
- `D	backend/public/3d/toyota-corolla-e100.glb`
- `D	backend/public/3d/toyota-land-cruiser-j100.glb`
- `D	backend/public/3d/toyota-land-cruiser-j200.glb`
- `D	backend/public/3d/toyota-prius-xw30.glb`
- `D	backend/public/3d/toyota-yaris-xp130.glb`
- `D	backend/public/3d/toyota-yaris-xp90.glb`
- `D	backend/public/3d/volkswagen-golf-mk7.glb`
- `D	backend/public/3d/volkswagen-transporter-t4.glb`
- `M	backend/scripts/optimize-3d.ts`
- `M	backend/scripts/vehicle-audit-render.mjs`
- `M	backend/src/server.ts`
- `M	backend/src/services/garage.ts`
- `M	backend/tests/config-fixes.test.mjs`
- `M	backend/tests/vehicle-audit.test.mjs`
- `M	docs/3d/CREDITS.md`
- `M	docs/3d/STAGE-A-CONFIG-FIXES.md`
- `M	docs/3d/VEHICLE-3D-AUDIT.md`
- `M	docs/3d/models.json`
- `M	docs/agents/STATUS.md`
- `M	mobile/src/app/customer/car3d.tsx`
- `M	mobile/src/app/customer/garage.tsx`
- `M	mobile/src/features/car3d/CarPreview.tsx`
- `M	mobile/src/features/car3d/models.ts`
- `M	mobile/src/features/car3d/useCar3D.ts`
- `M	mobile/src/features/catalog/myCar.ts`
- `M	mobile/src/features/department/PartsAdminHome.tsx`
- `A (untracked)	backend/prisma/migrations/20261104190000_vehicle_3d_submissions/migration.sql`
- `A (untracked)	backend/scripts/register-typescript.mjs`
- `A (untracked)	backend/scripts/test-vehicle3d-suite.mjs`
- `A (untracked)	backend/scripts/vehicle3d-cleanup.ts`
- `A (untracked)	backend/scripts/vehicle3d-sync-generations.ts`
- `A (untracked)	backend/scripts/vehicle3d-viewer-check.mjs`
- `A (untracked)	backend/src/routes/vehicle3d.routes.ts`
- `A (untracked)	backend/src/services/vehicle3d-catalog.ts`
- `A (untracked)	backend/src/services/vehicle3d-generation.ts`
- `A (untracked)	backend/src/services/vehicle3d-submissions.ts`
- `A (untracked)	backend/src/services/vehicle3d-validation.ts`
- `A (untracked)	backend/tests/vehicle3d.test.ts`
- `A (untracked)	docs/3d/CUSTOMER-3D-WORKFLOW.md`
- `A (untracked)	docs/3d/FINAL-3D-CLEANUP.md`
- `A (untracked)	docs/3d/FINAL-GIT-STATUS.txt`
- `A (untracked)	docs/3d/IMPLEMENTATION-REPORT.md`
- `A (untracked)	docs/3d/cleanup-decisions.json`
- `A (untracked)	docs/3d/cleanup-overrides.json`
- `A (untracked)	mobile/src/app/customer/vehicle3d/[carId].tsx`
- `A (untracked)	mobile/src/app/dept/vehicle3d/[id].tsx`
- `A (untracked)	mobile/src/app/dept/vehicle3d/index.tsx`
- `A (untracked)	mobile/src/features/car3d/runtimeModels.ts`
- `A (untracked)	mobile/src/features/vehicle3d/api.ts`
- `A (untracked)	mobile/src/features/vehicle3d/screens.tsx`

## Final git status

The exact root `git status --short` output is saved in [FINAL-GIT-STATUS.txt](FINAL-GIT-STATUS.txt), including the pre-existing untracked graphify-out directory. No commit/push was performed.
## Managed catalog completion — 2026-11-05

The approved implementation persisted on `ui/blueprint`: three additive migrations, managed taxonomy, missing-car requests, private Meshy lifecycle, manual GLB review/import, supported-only Garage picker, and final revision-bound Parts Admin publication. The intentional 74 production GLB deletions remain; all 21 verified shared models remain active. No earlier work was reset or recreated.

Customer flow: Garage/picker → Request my car → brand/model/year plus optional generation/trim/notes → four guided photos and consent → PENDING_REVIEW. Parts Admin corrects taxonomy/year, rejects or approves eligibility, and separately starts generation. Technical/viewer validation yields a private customer preview. Parts Admin then starts final review, checks the exact current revision, and explicitly publishes. Customers cannot start Meshy or approve/publish; mock results cannot publish. Existing shared models require the exact current replacement key.

Parts Admin manages active/inactive brands, models, generations, aliases, missing-car requests and manual imports. Empty unused taxonomy can be hard-deleted. Formal relations and normalized legacy/string references (Garage, CustomerCar, Parts fitment, submissions/imports, original requests, tow/mechanic history and generation IDs) block deletion of referenced taxonomy. Deactivation hides inactive ancestry from both picker and runtime metadata while preserving history.

This continuation changed three mobile files: `features/vehicleCatalog/screens.tsx` searches Arabic names/aliases and clears manual-import confirmation when validation or the existing key changes; `features/vehicle3d/screens.tsx` remounts final review on model-revision/current-key changes; `features/catalog/VehiclePicker.tsx` initializes each editor session separately and resets search/paint state without effect cascades. No backend production code or migration changed in this continuation. Workflow/live-test docs now describe admin-only generation and the initial review gate. State-reset changes follow [React's official guidance](https://react.dev/learn/you-might-not-need-an-effect); Context7 lookup failed with npm EACCES and no escalation was available.

Fresh checks:

| Check | Result |
|---|---|
| Backend TypeScript | PASS, exit 0 |
| Mobile TypeScript | PASS, exit 0 |
| Prisma validate / migration status | PASS; all 39 migrations up to date |
| Focused managed-catalog integration | 18/18 PASS |
| Full backend suite | 148/148 PASS; injected/mock HTTP, no paid provider request |
| Mobile tests | 29/29 PASS |
| Scoped lint | PASS, zero errors/warnings, existing Expo flat configuration via `.private/mobile-eslint.cjs` |
| Android export | PASS, 2295 modules; ignored `.private/vehicle3d-managed/android-export` |
| Browser fixtures | 24/24 PASS, 390×844 EN/AR × light/dark: new request, initial review, Arabic catalog search, manual-import revision reset, generated-model revision reset, picker progression/reopen; zero horizontal overflow or page exceptions |
| Runtime catalog | PASS: 21 models / 21 generation mappings / 21 GLBs; 19 selectable model families; 74 intentional deletions, zero active deleted-file references, zero inactive picker generations, unique runtime keys |
| Revision/cache | Two consecutive runtime responses match; SHA-256 `bbc31195ca1a7a300559fd663a15b6177c6ddb7964a8bee3389b730f0488508c`; `Cache-Control: no-store`; existing mobile tests cover active-key authority/removal and 24-hour offline expiry |

Local-only integrity evidence is in `.private/vehicle3d-managed/integrity.json`; browser fixture results/screenshots are in the same directory (`ui-results.json`). Existing unrelated admin-tab `direction` and web shadow warnings remain visible in development; Diala's files were not changed. `git diff --check` passes. Exact final root status is in [FINAL-GIT-STATUS.txt](FINAL-GIT-STATUS.txt). Earlier phase sections are historical.

Manual checks remain physical Android/Expo Go photo picking, background/resume, gestures, 390px EN/AR and performance; a deliberately authorized real Meshy run and output/rights review; deployment renderer/storage packaging. No physical Expo Go verification or live provider success is claimed. No paid Meshy task, commit or push was started. Diala-owned areas and `graphify-out/` remain untouched.

