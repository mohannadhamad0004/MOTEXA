# STEP 3D-FROM-LINK — Sketchfab import and Beetle publication

Completed locally on `ui/blueprint`, 2026-11-07. This continues the persisted import; the source was not downloaded again. No Meshy credits were spent. No commit or push was performed by Codex. Existing implementation, other owners' files and `graphify-out/` were preserved.

The human checkpoint `81e5126` appeared during this continuation. The final working-tree changes record the subsequent publication, generated metadata, documentation and screenshot evidence. The persisted backend/mobile import implementation was reused.

## Published model

| Field | Result |
|---|---|
| Import | `32b36fb3-25fa-4e6f-922d-b153ed3c0ffe` |
| Final status | **PUBLISHED** through the existing Parts Admin publication endpoint |
| Managed selection | Volkswagen → Beetle → Type 1, 1945–2003 |
| Generation ID | `19febfb9-3b4a-4a5f-b2c0-ce33547da350` |
| Public model key | `manual-19febfb9-3b4a-4a5f-b2c0-ce33547da350-ad65d3b3205c45de` |
| Source | [Volkswagen beetle](https://sketchfab.com/3d-models/volkswagen-beetle-83276f21bd9c41e196c474350b43efb0) |
| Creator | [Angelos Gkanias](https://sketchfab.com/gkaniasag) |
| License | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); Sketchfab's saved label is `CC Attribution` |
| Downloaded source | 36,230,220 bytes, recorded from the earlier approved download; the persisted optimized checkpoint was reused |
| Prepared/public GLB | **6,396,332 bytes / 6.10 MiB**, identical hashes |
| Prepared SHA-256 | `ad65d3b3205c45de56ab9b2ff4b50f66d960737793950d6b67aa4920bad6e1dd` |
| Quality gate | **FULL**, four wheels within 0–3 mm of the lowest point; no quality warnings |
| Geometry | 378,179 triangles, 15 materials, 44 textures, no animations |
| Viewer dimensions | 1.738 × 1.690 × 4.500 m; length is the configured preparation scale |
| Paint | Original textured finish; automatic recoloring disabled, empty paint selectors |
| Part map | **PROPOSED**, 521 pieces, bound to the exact prepared SHA-256; unconfirmed |

Source SHA-256: `7a8b8aa9b6adc2b25b8af31c10d75fd4900e29385ee32f719e31e3312a13765a`. Preparation optimized geometry/textures and normalized transforms. It retained the original finish because complete safe paint segmentation was not verified. Source, creator/profile, license link and adaptation notice are retained in [CREDITS.md](CREDITS.md) and the manifest. The runtime viewer displays the creator and saved license label.

The saved READY record and private asset were checked before publication. All six original production-renderer views were inspected against their recorded asset hash. All 12 saved original/red-request screenshot hashes and their viewer, hook, serializer and renderer source hashes still match the current files. Publication used `POST /api/admin/parts/vehicle-3d-imports/:id/publish` with the exact current validation timestamp and explicit visual confirmation. No existing shared model was replaced. The shared promotion journal wrote the immutable GLB, manifest, generated mobile catalog and credits, generation mapping and audit record together.

The generated `CAR_MODELS` row comes from the shared catalog writer. There is no Beetle-specific branch in customer runtime selection, Garage code or the viewer.

## Parts Admin workflow

Open **Vehicle catalog → Import from Sketchfab** (`/dept/vehicles/imports/new`). Paste a model-page URL and inspect it before choosing an active managed brand/model/generation and its production years. Metadata inspection does not download an asset. The backend checks the source's actual downloadable flag and verified license metadata; CC0, CC BY and CC BY-SA are supported, while NC/ND, proprietary, unknown or contradictory metadata is refused. Attribution requirements continue to apply after publication.

The existing `Vehicle3DImport` workflow was extended with source evidence, UID duplicate detection, private preparation checkpoints, leases, stage/progress and sanitized errors. Additive migrations are `20261112120000_vehicle3d_sketchfab_imports` and `20261112121000_vehicle3d_import_stage`; no migration was rewritten during this continuation.

Stages: `QUEUED → DOWNLOADING → CONVERTING → OPTIMIZING → VALIDATING → GENERATING_PART_MAP → READY → PUBLISHED`. The original import status constraint remains intact; `importStage` carries the detailed Sketchfab stage. Failures can be retried; unpublished imports can be discarded with audited, scoped private-file cleanup. A persisted optimized checkpoint is reused on restart. Published imports are immutable and cannot be discarded.

The backend alone reads `SKETCHFAB_ACCESS_TOKEN` from its environment. No token or signed download URL is sent to mobile. Downloads have an exact host/path allowlist and a 128 MiB source ceiling. The bounded archive reader rejects path traversal, symlinks, corrupt/ambiguous archives and expansion bombs; glTF resources must resolve inside the archive. The final self-contained GLB must fit within 8 MiB. Existing technical validation, the actual production viewer, quality gate, unchanged asset hash and exact validation revision all gate publication. Existing generation keys require explicit exact-key replacement.

Review the private preview, original and red-paint test, identity, front direction, grounding, materials and attribution. Preserve the original finish when safe complete paint segmentation is uncertain. Quality `FULL` does not mark a semantic part map as confirmed.

After publication, **Confirm part map** opens `/dept/accessory-zones?model3dKey=<published-key>`. The Beetle's saved proposal was copied unchanged, including its pieces, proposal and asset hash. The import detail and Parts Admin part-map list expose its pending review. The normal runtime catalog omits unconfirmed semantic maps. No map was automatically confirmed to make accessory previews available.

| Method | Endpoint under `/api/admin/parts/vehicle-3d-imports` | Purpose |
|---|---|---|
| POST | `/sketchfab/inspect` | Inspect permitted source metadata and duplicates; no download |
| POST | `/sketchfab` | Queue the selected managed generation |
| GET | `/` and `/:id` | List and inspect imports |
| GET | `/:id/model` | Parts Admin-only prepared asset, `private, no-store` |
| POST | `/:id/validate` | Queue explicit preparation/revalidation |
| POST | `/:id/retry` | Retry a failed import |
| POST | `/:id/discard` | Discard an unpublished import |
| POST | `/:id/publish` | Existing promotion/publication workflow |

All import actions and private assets require Parts Admin permission. Other roles and anonymous callers are rejected before provider access. Public runtime metadata and the published GLB contain no credentials, private paths, original customer photos or lease data.

## Garage and runtime verification

Publication changed the active catalog from **21 to 22** models. `GET /api/catalog/3d-models` changed revision from

```text
1b56d6222a226d8c8030fd51983dc6a207717d147d1dd8290c9844a321581e47
```

to

```text
f837365d68bc7ad52624f7c183b566f0069409275d5baa57e19aad9bdbb27922
```

Repeated reads returned the same new revision and `Cache-Control: no-store`. The generation is published and points to the immutable public key. Manifest, generated mobile configurations and generated credits agree exactly.

A temporary isolated customer added a 1970 Beetle to Garage through the actual API. Garage and `GET /catalog/my-car` resolved the published managed generation. The real Expo application opened **Profile → See your car in 3D → My car in 3D**, requested the public Beetle GLB and rendered it. The original-finish notice and creator credit were checked in EN/AR and light/dark at 390 × 844. The fetched public GLB matched the private prepared asset's size and SHA-256. Customer and anonymous attempts to read the private import asset returned 403 and 401. The temporary verification account, Garage car and its test audit entries were removed afterward.

The live published import displayed **Confirm part map** in all four language/theme combinations. Clicking it opened the editor with this exact model key. Only the Three.js 0.160.1 CDN modules were mirrored from the existing local audit package; Garage, runtime metadata, import detail and model requests used the real local backend. No provider download or model response was mocked for this live verification.

## Validation and evidence

| Check | Result |
|---|---|
| Prisma validation | PASS |
| Backend TypeScript | PASS, exit 0 |
| Focused Sketchfab parser/archive/lifecycle/import/auth/publication/Garage tests | **13/13 PASS** |
| Focused vehicle3D/catalog/part-map/quality/auth/Garage/provider tests | **89/90 PASS**; sole failure is the six historical pointers below |
| Full backend suite | **284/285 PASS**, 0 skipped/cancelled; sole failure is the same six historical pointers below |
| Mobile TypeScript | PASS, exit 0 |
| Mobile tests, including Sketchfab/import and 3D runtime | **53/53 PASS** |
| Scoped Expo-flat ESLint | PASS, zero errors/warnings |
| Android Expo export | PASS, **2,387 modules**, Hermes bundle + 100 assets |
| Import UI fixtures | **28/28 PASS**, EN/AR × light/dark, 390px, no overflow/page exceptions |
| Live Garage and published import screenshots | **8/8 PASS**, EN/AR × light/dark, 390px, no overflow/page exceptions |
| Saved production-viewer evidence | Six original + six red-request views, exact asset hash; neither applies unverified paint |
| Final diff and status | `git diff --check` PASS; exact final status saved in [FINAL-GIT-STATUS.txt](sketchfab-import/FINAL-GIT-STATUS.txt) |

Evidence:

- [Live Garage/admin results](sketchfab-import/live/runtime/results.json), [customer EN/dark](sketchfab-import/live/runtime/customer-en-dark.png), [customer AR/light](sketchfab-import/live/runtime/customer-ar-light.png), [published import task](sketchfab-import/live/runtime/admin-en-dark.png).
- [Validation summary](sketchfab-import/validation-results.json), [exact final Git status](sketchfab-import/FINAL-GIT-STATUS.txt).
- [Import UI results](sketchfab-import/ui-results.json): isolated states use the retained E36 fixture, distinct from the actual Beetle live verification.
- [Original renderer evidence](sketchfab-import/live/original/evidence.json), [red-request evidence](sketchfab-import/live/red/evidence.json).
- Local test logs: `.private/step3d-checks/{sketchfab,vehicle3d-catalog-partmap-auth,full-backend}.log` and `results.json`.
- Android export: `.private/step3d-android-export/`.

Commands used:

```powershell
# backend
npx prisma validate
npx tsc --noEmit
node --import ./scripts/register-typescript.mjs --test --test-concurrency=1 tests/sketchfab-import.test.ts tests/sketchfab-lifecycle.test.ts
node --import ./scripts/register-typescript.mjs --test --test-concurrency=1 tests/vehicle3d.test.ts tests/managed-vehicle-catalog.test.ts tests/part-map.test.ts tests/model-gate.test.ts tests/meshy-generation.test.ts tests/garage.test.ts
node scripts/test-vehicle3d-suite.mjs
# mobile
npx tsc --noEmit
node --test tests/*.test.mjs
npx eslint --no-config-lookup --config ../.private/mobile-eslint.cjs --max-warnings 0 src/features/vehicleCatalog/api.ts src/features/vehicleCatalog/importScreens.tsx src/features/vehicleCatalog/importState.ts src/features/vehicleCatalog/screens.tsx src/features/vehicleCatalog/controls.tsx src/features/car3d/models.ts src/app/customer/car3d.tsx src/app/dept/vehicles/imports
npx expo export --platform android --output-dir ../.private/step3d-android-export
node tests/e2e/sketchfab-import.cjs
# repository
git diff --check
git status --short
```

The backend runner uses a process-only random OTP test secret; `.env` is never changed. Database/browser checks required execution outside the restricted sandbox because local database access returned `EACCES` inside it. Context7 resolved Expo and returned the official [Expo CLI export flags](https://docs.expo.dev/more/expo-cli/); the SDK 57-specific query had no matching snippet.

## Historical fixture pointers and limitations

Before publishing, all three generated catalog files already agreed; the previous credits mismatch was no longer present. No credits consistency repair or historical data cleanup was needed. The integrity test reaches `backend/tests/vehicle3d.test.ts:36`, where it expects zero stale generation pointers and finds six. All six records predate this feature's November 7 import and were present before publication:

| Generation ID | Fixture identity | Created UTC | Stale `model3dKey` |
|---|---|---|---|
| `dfc4397f-79f2-48ac-8423-8a2ffd4c0036` | Fixturec1b46f9b / A8 / D4 | 2026-11-06 10:39:43 | `manual-dfc4397f-79f2-48ac-8423-8a2ffd4c0036-367a81bd2cfb914f` |
| `da12fc91-2797-4f88-acd0-57e00bc83039` | f4cce803-7f13-454c-a875-2a461fb20c28 / Test | 2026-11-06 10:40:01 | `generated-da12fc91-2797-4f88-acd0-57e00bc83039-2634a9808ed914b3` |
| `346bda61-0b58-453d-9f68-9b18e7eb3c5f` | Fixture7ab18db7 / A8 / D4 | 2026-11-06 12:51:17 | `manual-346bda61-0b58-453d-9f68-9b18e7eb3c5f-367a81bd2cfb914f` |
| `af15d664-e802-4836-8146-9194345cb1ed` | b8ee5c9d-08b5-426b-a728-940fa388bec8 / Test | 2026-11-06 12:51:34 | `generated-af15d664-e802-4836-8146-9194345cb1ed-2634a9808ed914b3` |
| `205d9e64-5634-47b1-8844-29b1ba197aae` | Fixture16f88017 / A8 / D4 | 2026-11-06 12:52:58 | `manual-205d9e64-5634-47b1-8844-29b1ba197aae-367a81bd2cfb914f` |
| `1007b6b9-de57-49e4-aea7-1d441b255a52` | 767b8c37-f260-4b04-888b-87e5179faf92 / Test | 2026-11-06 12:53:15 | `generated-1007b6b9-de57-49e4-aea7-1d441b255a52-2634a9808ed914b3` |

The same IDs and pointers were verified unchanged after live Garage testing. They were not deleted, rewritten or excluded from the integrity assertion. The published Beetle key is valid and is not among them.

Remaining: human semantic part-map confirmation, safe complete paint segmentation if recoloring is desired, physical Android/Expo Go gestures/lifecycle/performance checks, and deployment of the normal model/metadata/database artifacts. This was a local publication; no hosting deployment was performed. The existing web development warning `Invalid style property of "direction"` comes from the untouched shared layout; no Diala-owned file was changed to suppress it.
