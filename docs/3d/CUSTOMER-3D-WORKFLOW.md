# Managed vehicle catalog and customer missing-car workflow

The current taxonomy/publication split, revision management, accessory lifecycle and validation results are documented in [WORKFLOW-REPAIR.md](WORKFLOW-REPAIR.md). Earlier phase results below are historical.

Parts Admin can also use **Vehicle catalog → Import from Sketchfab**. Source inspection, private persistent preparation, review, attribution, publication and the live Volkswagen Beetle result are documented in [SKETCHFAB-IMPORT.md](SKETCHFAB-IMPORT.md). Published imports reach matching Garage vehicles through the same normal runtime catalog and **My car in 3D** path. The current library has 22 published models; the older baseline counts below are historical.

Customer entry: Garage or its normal vehicle picker → **Request my car**. The Garage picker exposes active managed taxonomy independently of 3D publication. A known generation without 3D remains selectable; its request reuses the canonical generation and existing Garage car, and repeated submission reuses its open request. For unknown taxonomy, enter brand, model and manufacture year, with optional generation/code, trim and notes. Save the draft, upload front/rear/left/right photos, and consent to processing and sharing the approved 3D representation. Submission becomes **PENDING_REVIEW**. Publication determines eligibility for the 3D viewer separately; historical Garage cars remain saved.

Parts Admin reviews the four private photos, corrects taxonomy/year, then rejects with notes or marks **APPROVED_FOR_GENERATION**. Approval alone creates no provider task. A separate Parts Admin **Start approved generation / retry** action queues the persistent worker; real mode also needs the backend paid opt-in. Customers cannot start Meshy or approve/publish. The older Garage private-submission entry sends requests into the same initial review flow; its generate endpoint now submits for review rather than starting generation.

After generation and technical/viewer validation, the owner can view the private model. Parts Admin begins final review and opens **Customer 3D submissions** to compare the exact current model revision and all four photos. Confirm identity, upright orientation, front direction, grounding, materials and rights before publication. Revalidation changes the model revision and invalidates visual confirmation. Existing shared models require explicit replacement of the exact current key. Mock outputs cannot enter final review/publication. Reviewed requests and approved history are retained; only drafts can be deleted. Rejected requests can be revised, with new photos/consent and initial review before another customer-requested attempt.

JPEG/PNG uploads are decoded, rotated, resized and re-encoded without EXIF/GPS. Photos, raw output and prepared previews are stored outside static hosting. Private asset routes require ownership or Parts Admin permission. Publishing exposes only the approved representation, never the original photos.

Parts dashboard → **Vehicle catalog** manages brands, models, generations, aliases and active status, opens customer requests, and supports private manual GLB imports. Unreferenced empty taxonomy can be deleted; referenced rows must be deactivated. Reference checks include Prisma relations plus original missing-car text, Garage/legacy car snapshots, Parts fitment, tow/mechanic history, submission/import references and legacy generation IDs. Deactivation hides an entire inactive ancestry from selection without removing saved history.

Parts dashboard → **3D workspace** links requests, **Vehicle 3D Models**, **Accessory 3D Models**, imports, part maps and fit review. Vehicle configuration/publication changes require the current revision. Private replacement candidates are reviewed before replacing the current asset. Accessory models support private preview, refit, unpublish and reviewed reactivation; protected publication/history references block destructive deletion. Customer accessory preview uses backend eligibility for each owned Garage car without activating or changing the selected car.

Manual GLB imports require active taxonomy and source/author/license details. Upload remains private; explicit validation normalizes geometry and renders six views with the actual viewer. Source up/heading, length, grounding and isolated paint selectors can be corrected. Publication requires visual confirmation tied to the current validation version, an unchanged prepared SHA-256, and an exact-key replacement confirmation when applicable. New validation or a changed existing key clears the mobile confirmations. Published imports are immutable. Invalid and known mock GLBs are rejected.

## Local backend configuration

Environment variables belong only in `backend/.env` or the backend process environment:

| Variable | Behavior |
|---|---|
| `MESHY_API_KEY` | Backend-only Meshy credential. Never returned to mobile or included in query strings. |
| `VEHICLE3D_MODE=mock` | Forces mock mode even when a key exists. This is the default. Real mode must be explicitly selected; a missing real-mode key fails closed. |
| `VEHICLE3D_MODE=real` | Select real generation; also requires a key and paid-generation opt-in. |
| `MESHY_ALLOW_PAID_GENERATION=1` | Explicit backend permission to create paid jobs. Generation still requires customer consent, initial Parts Admin approval and a separate Parts Admin start action. |
| `VEHICLE3D_MAX_MB` | GLB limit in MiB, default 8, bounded to 1–20. |
| `VEHICLE3D_THREE_DIR` | Exact local Three.js 0.160.1 package directory. Defaults to `.private/three-r160/package`. |

Mock mode builds a clearly labelled generic geometric preview. It does **not** reconstruct the photos, impersonate the chosen vehicle or permit catalog submission/promotion. It exercises upload, job processing, private storage and the real viewer.

Real generation uses Meshy's [multi-image API](https://docs.meshy.ai/en/api/multi-image-to-3d), with four private data URIs, front first, Meshy 7.1, GLB output, texturing and a 50,000 target polygon count. No private photo is made public to supply Meshy with a URL. Only HTTPS downloads from `assets.meshy.ai` are accepted; redirects are rejected and the stream has a byte limit. No signed URLs, provider response bodies or credentials are logged/persisted. Provider task identifiers are retained privately and excluded from all client DTOs/public catalog metadata.

The backend worker resumes database jobs after startup and polls every five seconds. PostgreSQL row locks plus expiring leases prevent duplicate workers; provider checks are scheduled ten seconds apart. HTTP runs outside database transactions. A request-intent marker is committed before a paid provider POST: an uncertain response or process interruption cannot silently repeat that POST. Unconfirmed requests fail with instructions to inspect the Meshy dashboard before explicitly retrying. Local deletion removes local access/files; an already-started remote task may still finish under Meshy's own lifecycle/retention rules.

Generation and approval require this repository's local renderer toolchain: installed backend/mobile dependencies, Chrome, mobile viewer source, and the pinned Three package. Missing renderer dependencies fail closed with a viewer-validation error. This is a repository-local demo/admin pipeline; deploying just `backend/dist` without the metadata, scripts, mobile source and renderer dependencies is insufficient. Existing glTF/Sharp/meshoptimizer dependencies used by backend services were moved from development to runtime dependencies; no mobile/native dependency was added.

## Technical validation

Checks include GLB magic/version/length/JSON, embedded resources only, decoded geometry and texture limits, supported static triangle geometry, finite coordinates and bounds, nonzero geometry, valid indices, sensible proportions, non-extreme scale and configured length. Animations and skins are rejected. Length is taken from existing generation metadata where available, otherwise 4.5 m. Normalization grounds the model and aligns its long horizontal axis. The actual MOTEXA Three.js r160 build path must load and render it in six directions.

Bounds can detect a vertical long axis but cannot establish semantic front direction or distinguish an upside-down car from an upright car of the same bounds. These remain explicit admin visual checks, alongside vehicle identity and source/redistribution rights. The validation report says `uprightOrientation: admin_visual_required`; it does not claim automatic semantic recognition.

Viewer startup has a 45-second error/retry deadline. Shared models without isolated recoloring retain their original finish, with a visible explanation. Private model bytes are fetched with bearer authorization into screen memory and excluded from the public model disk/session cache. Photo/model endpoints send `private, no-store`.

## Catalog consistency and recovery

`backend/src/services/vehicle3d-catalog.ts` is the metadata writer for optimizer generation, cleanup and promotion. `docs/3d/models.json` retains complete `viewerConfig` objects, including hand-tuned settings. It generates `models.ts` and credits, retaining attribution for still-served previous approved versions while excluding removed assets. The optimizer requires `--key=<key>` for asset work, including `--force`; `--write-only` regenerates metadata without touching model assets. `REMOVED` entries cannot be reactivated by the optimizer or seed.

Approval uses a stable immutable filename based on canonical generation and prepared content hash and the canonical generation manifest mapping used by generation seeding. It preserves previous metadata, attribution and the replaced key. A database advisory lock serializes catalog mutations. A private recovery journal stores metadata snapshots and the new GLB path before filesystem changes; failed/uncommitted promotions restore those snapshots and remove their new file. Startup and subsequent promotions recover unfinished journals. The public customer-key route additionally requires a **committed APPROVED submission**, preventing pre-commit or interrupted copies from being served. Older explicitly replaced assets are retained under their immutable approved filenames; the current generation/configuration points only to the new version.

`GET /api/catalog/3d-models` intersects active metadata, existing GLBs and current database generation keys. Mobile uses this runtime configuration, so new approvals do not require a new app bundle. Missing/inactive keys produce the existing coming-soon state and no missing-asset request. Customer approval polling refreshes the Garage/model catalog.

## API inventory

All routes require bearer authentication. Customer routes additionally require CUSTOMER and ownership. Review routes use the existing Parts Admin permission guard (`MANAGE_SPARE_PARTS`, or SUPER_ADMIN). Self-review is forbidden.

| Method | Path | Behavior |
|---|---|---|
| GET | `/api/catalog/3d-models` | Current active shared viewer configurations |
| GET | `/api/catalog/vehicle-3d-submissions` | Own submissions, newest first (up to 100) |
| POST | `/api/catalog/vehicle-3d-submissions` | Create/reuse an open submission for `garageCarId` |
| GET | `/api/catalog/vehicle-3d-submissions/:id` | Own metadata/status; no storage paths |
| PUT | `/api/catalog/vehicle-3d-submissions/:id/photos/:view` | Upload/replace `dataBase64`; view is front/rear/left/right |
| POST | `/api/catalog/vehicle-3d-submissions/:id/generate` | Compatibility entry: require processing + redistribution consent; submit for initial Parts Admin review, never start Meshy |
| POST | `/api/catalog/vehicle-3d-submissions/:id/submit` | Require `redistributionConsent: true`; submit a real ready model |
| GET | `/api/catalog/vehicle-3d-submissions/:id/assets/:asset` | Own front/rear/left/right/model bytes |
| POST | `/api/catalog/vehicle-3d-submissions/:id/regenerate` | Reset a ready/rejected/failed attempt privately; no paid request |
| DELETE | `/api/catalog/vehicle-3d-submissions/:id` | Delete unapproved submission and local assets |
| GET | `/api/admin/parts/vehicle-3d-submissions` | Review queue/history (up to 200) |
| GET | `/api/admin/parts/vehicle-3d-submissions/:id` | Review details and current existing shared key |
| GET | `/api/admin/parts/vehicle-3d-submissions/:id/assets/:asset` | Private review assets |
| POST | `/api/admin/parts/vehicle-3d-submissions/:id/approve` | Notes, explicit visual confirmation and exact `modelRevision`, optional exact replacement key |
| POST | `/api/admin/parts/vehicle-3d-submissions/:id/reject` | Required review notes |

| POST | `/api/admin/parts/vehicle-3d-submissions/:id/validate` | Repeat preparation/validation; optional explicit `preRotateX`/`rotateY` corrections |
| POST | `/api/admin/parts/vehicle-3d-submissions/:id/request-regeneration` | Return submitted model with required notes; customer must explicitly regenerate |

Managed catalog endpoints (same auth/Parts Admin guards):

| Method | Path | Behavior |
|---|---|---|
| GET/POST | `/api/catalog/vehicle-requests` | Customer list/create draft |
| GET/PATCH | `/api/catalog/vehicle-requests/:id` | Own status or edit draft details |
| PUT | `/api/catalog/vehicle-requests/:id/photos/:view` | Upload a guided draft photo |
| POST | `/api/catalog/vehicle-requests/:id/submit` | Four photos + consent → PENDING_REVIEW |
| GET | `/api/catalog/vehicle-requests/:id/assets/:asset` | Owner-only photos/model |
| GET | `/api/admin/parts/vehicle-requests` | Initial-review queue/history |
| GET/PATCH | `/api/admin/parts/vehicle-requests/:id` | Review/correct taxonomy and year |
| GET | `/api/admin/parts/vehicle-requests/:id/assets/:asset` | Private review photos/model |
| POST | `/api/admin/parts/vehicle-requests/:id/approve-initial` | Approve eligibility only; optional exact existing-key acknowledgement |
| POST | `/api/admin/parts/vehicle-requests/:id/reject-initial` | Reject with required notes |
| POST | `/api/admin/parts/vehicle-requests/:id/start-generation` | Explicit approved generation/retry |
| POST | `/api/admin/parts/vehicle-requests/:id/final-review` | Move ready real model into final review using saved sharing consent |
| POST | `/api/admin/parts/vehicle-requests/:id/regenerate` | Prepare a new attempt; separate start action remains required |
| GET | `/api/admin/parts/vehicles` | Full taxonomy including inactive/history rows |
| GET | `/api/admin/parts/vehicles/suggestions` | Possible matches; admin chooses overlapping generations |
| POST/PATCH/DELETE | `/api/admin/parts/vehicles/{brands,models,generations}[/:id]` | Create/edit/delete unused taxonomy; deactivate referenced rows through PATCH |
| GET/POST | `/api/admin/parts/vehicle-3d-imports` | List/import private GLBs |
| GET | `/api/admin/parts/vehicle-3d-imports/:id` | Import validation/review details |
| GET | `/api/admin/parts/vehicle-3d-imports/:id/model` | Private validated preview |
| POST | `/api/admin/parts/vehicle-3d-imports/:id/validate` | Prepare/render current viewer configuration |
| POST | `/api/admin/parts/vehicle-3d-imports/:id/publish` | Current validation + hash + visual/replacement checks |

Mutations write AuditLog entries. Approval records the generation, new key, previous key and content hash. Returned metadata contains booleans for available files, never disk paths. Account creation is limited to ten submissions/day and one open submission per Garage car; photos freeze during/after generation so submitted photos cannot diverge from their model.

## Verification and remaining manual checks

Additive migrations: `20261104190000_vehicle_3d_submissions`, `20261104210000_vehicle3d_provider_lifecycle`, and `20261105010000_managed_vehicle_catalog`. No existing table/column was dropped or renamed. No historical generations were deleted. The scoped sync cleared 74 retired model pointers with audit records; current pointers resolve to the 21 kept GLBs. Current validation results are in IMPLEMENTATION-REPORT.md.

Commands used:

```powershell
cd backend
npx tsc --noEmit
npx prisma validate
node scripts/test-vehicle3d-suite.mjs
node --import ./scripts/register-typescript.mjs --test tests/vehicle3d.test.ts
cd ../mobile
npx tsc --noEmit
node --test tests/*.test.mjs
npx eslint --config ../.private/mobile-eslint.cjs --max-warnings 0 src/features/vehicleCatalog src/features/vehicleRequests src/features/vehicle3d src/features/catalog/VehiclePicker.tsx
npx expo export --platform android --output-dir ../.private/vehicle3d-phase2/android-export
```

The test wrapper uses a process-only generated OTP test secret and serial execution to avoid unrelated short-timer test flakes. It does not edit `.env`. `register-typescript.mjs` is the Node 24 fallback for this Windows sandbox's `tsx` userInfo/ENOMEM error. Promotion integration tests roll back fixtures and restore metadata/asset snapshots; do not run them concurrently with manual catalog edits.

Results for the initial phase: backend 117/117, mobile 26/26. Current phase results are recorded in IMPLEMENTATION-REPORT.md; both TypeScript checks and Prisma validation pass. Changed mobile files pass scoped Expo ESLint. Repository-wide `expo lint` found existing errors in unrelated screens/hooks; no unrelated/Diala files were edited to address them. Android export passes. Twelve 390px browser fixture checks cover draft, private preview and admin review in EN/AR and light/dark, with no horizontal overflow; private previews actually reach the viewer's `shown` message. Browser evidence is under ignored `.private/vehicle3d-cleanup/`. An existing `direction` style warning from the untouched admin tab module is visible in web development.

Still manual: physical Android/Expo Go photo selection, lifecycle/backgrounding, pinch/drag and performance; a consented real Meshy generation using the developer's configured account; provider output identity/rights and visual review; deployment packaging/permissions for writable catalog files and the renderer toolchain. No physical Expo Go or successful live Meshy call is claimed.


## Provider lifecycle and review consent

The provider task/state/progress, provider timestamps, poll schedule, lease, attempt revision/history, safe failure code, raw/prepared private asset references, preparation configuration and live authorization survive restart in PostgreSQL. The public status enum remains DRAFT/PROCESSING/READY/SUBMITTED/APPROVED/REJECTED/FAILED. Internal stages distinguish QUEUED, REQUESTING, GENERATING, DOWNLOADING and PREPARING. Progress is displayed only when Meshy supplies a valid integer percentage during generation.

Repeated Generate clicks reuse PROCESSING. Recoverable polling/download failures retain the task and schedule retry; explicit retry after a corrected authentication/preparation failure resumes a known task/raw model. Failed/canceled provider jobs need an explicit new attempt. An interrupted or uncertain paid POST is never repeated automatically: inspect Meshy's dashboard first. The worker stops a local attempt after one hour; an explicit retry can resume a known job. Local deletion cancels access and suppresses late results; it does not promise cancellation/refund of an already running provider task.

Catalog-sharing consent is versioned (`catalog-share-v2`, timestamp). Customer revisions require consent and initial review again. An explicit Parts Admin retry of an already approved unchanged-photo request retains that request's saved consent. Copy explains that the 3D representation may become available to other MOTEXA users while original photos remain private. Raw generated GLB names/extras/copyright are stripped from the prepared export. Private records/audits retain the originating submission, source-photo attempt, task, reviewer, approval time and old/new model keys. Meshy provenance uses customer permission, never an invented Creative Commons license.

Parts Admin `/dept/3d-submissions` supports pending/generating/failed/approved/rejected filters. Validation and explicit orientation adjustment never auto-approve; each approval requires the admin's visual confirmation. Existing shared keys require an explicit replacement with the exact current key. Old approved assets retain attribution and audit history. Mock mode/provider/mock-source flags are independently checked on submit and approve, so changing only a mode label cannot promote mock data.

The runtime catalog returns a deterministic content revision and authoritative active-key list. Mobile validates every optional config field, merges eligible built-ins by key, and stores only public approved configuration with a 24-hour offline limit. A successful response that removes a key immediately excludes it; malformed responses fail closed. Offline devices cannot learn a new deletion until reconnecting; expiry bounds that unavoidable stale interval. With no trusted cache the viewer shows coming soon.
