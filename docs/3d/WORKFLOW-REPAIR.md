# 3D workflow repair — 2026-11-08

Continued the existing uncommitted working tree on `ui/blueprint`. No reset, clean, stash, revert, commit, push, live Meshy/Sketchfab request, paid generation, Diala-owned edit, or `graphify-out/` edit was performed.

## Resulting workflow

- Managed brands, models and generations are independent of 3D publication. A known generation without a published model remains selectable for a request. Repeated requests reuse the same open request, preserve the Garage car and canonical generation, and expose grouped demand to Parts Admin. Unknown taxonomy remains unlinked until an admin selects its canonical generation.
- `/dept/3d` links requests, vehicle models, accessory models, imports, part maps, fit review and taxonomy. Parts Admin permissions protect the management API and private model previews.
- `/dept/3d/vehicles` lists retained revisions with source, rights, asset hash/size, publication, configuration, part-map review and usage. Configuration and publication writes require the current revision. Shape changes invalidate geometric review. Replacements go through a separately validated candidate; historical assets remain retained. Referenced models cannot be hard-deleted.
- `/dept/3d/accessories` lists request/generation/publication states and opens fit review and private model preview. Refit, unpublish and reviewed reactivation use the existing lifecycle. Private-candidate discard preserves task/credit history; published or referenced assets remain protected.
- Customer preview eligibility comes from the backend for each owned Garage car and each kit part. Previewing a compatible inactive car does not activate or modify it. A published model and current stored fit are required; stale/missing contracts fail closed.

## Stock visibility

`sceneHtml.ts` records each stock object's current `visible` value when the first active replacement hides it. It tracks the union of objects hidden by the active accessories. OFF restores a snapshot only when its final replacement is removed, then deletes the snapshot so the next ON cycle captures the current value again. Objects previously hidden stay hidden; overlapping accessories cannot reveal each other's stock pieces.

The offline renderer now uses the same `kitApply` OFF path. Regression coverage includes repeated cycles, initially invisible objects, overlapping replacements, independent bumper toggles and real viewer execution against the clearly labelled procedural fixture. QA refusals return through normal cleanup, closing Chrome and writing complete hashed evidence.

## Factual fit limitations

The E36 stock-derived rear bumper diagnostic fixture **fails clearance**. The fresh unforced run measures **21.6 mm intrusion and 12.7 mm contact gap against a 9.2 mm limit**; it produces no stored fit. This is stock-derived diagnostic geometry, not a real shop accessory or proof of a production body kit. See [real-e36-rear-refusal.json](lifecycle/real-e36-rear-refusal.json).

Corrected finite projected-edge seam measurements also reject the retained E36 M3 front bumper fixture at a **16.6 mm seam gap**, above the unchanged **10 mm** limit. Older tests that described this fixture as accepted relied on the NaN seam bug. They now require finite measurements, measured refusal, no replayable fit, and unchanged stock visibility. Positive publication tests use a separately mapped, explicitly synthetic car/bumper with real fitting and clearance checks. No fit threshold or production acceptance gate was relaxed.

## Reproduction and evidence

From `backend/`:

```powershell
npx tsc --noEmit
npx prisma validate
node scripts/test-vehicle3d-suite.mjs
node --import ./scripts/register-typescript.mjs --import ./scripts/test-no-paid-provider.mjs --test tests/e36-rear-clearance.test.mjs
```

The backend runner clones the development schema into a unique `motexa_test3d_*` schema, including enums, constraints and indexes, and drops only that test schema after completion. Tests use serial execution because catalog metadata files are shared. Live provider domains and their subdomains are blocked by the fetch preload; provider contract tests inject transports. A failed procedural-car setup now stops dependent lifecycle checks instead of falling back to the real E36.

From `mobile/`:

```powershell
npx tsc --noEmit
node --test tests/*.test.mjs
npx expo export --platform android --output-dir ../.private/3d-lifecycle/android-export
# Visual fixtures can use the local dev server, or an exported web directory:
$env:WEB_DIR='../.private/3d-lifecycle/web'
node tests/e2e/3d-lifecycle.cjs
```

Visual fixtures intercept all API/provider traffic and use local pinned Three.js and retained GLBs. Their actions never mutate accounts, Garage or the real database. Browser captures cover 390px EN/AR and light/dark, with overflow/page-exception checks. These fixtures demonstrate UI and viewer behavior; backend integration tests separately exercise actual authorization and lifecycle mutations.

Windows sandbox build limitation: the ordinary export hit EPERM during concurrent directory creation and Hermes could not write its sandbox temporary bytecode file. An ignored local wrapper under `.private/3d-lifecycle/` uses synchronous recursive directory creation and a temporary directory inside the workspace. It runs the installed Expo CLI and Hermes unchanged; app/package/config files were not modified. [Expo CLI documentation](https://docs.expo.dev/more/expo-cli/) was used after Context7's IDE terminal was unavailable under the session's never-approve policy.

The successful sandbox export command was `node ../.private/3d-lifecycle/export-in-sandbox.cjs export --platform android --max-workers 2 --output-dir ../.private/3d-lifecycle/android-export`, from `mobile/`. The bundle contains 2,398 modules and 100 assets, with a 7.6 MB Hermes bytecode bundle.

Browser validation completed **108/108** captures (27 per language/theme combination), including loose-part photos and submit controls, workspace navigation, approval without automatic generation, an explicit mocked Start, fit review, actual vehicle/accessory `shown` messages, an actual accessory `fit` message, customer ON/OFF/ON, zero Garage writes, and eight expected fixture management writes per admin session. All captures also check text encoding and Arabic right alignment. See [browser results](lifecycle/ui-validated/results.json).

Additional browser checks appeared in the shared working tree while finalizing. They were preserved and the current harness was rerun using an ignored local runner that redirects only its output to `ui-validated/`, keeping the other evidence intact.

Strict lint passes for the viewer/runtime and new model-management modules. Broader scoped lint reports **20 hook-rule errors and 2 warnings** in the pre-existing customer/accessory screens and Sketchfab import screen. These remain visible validation issues; no lint rule was disabled to conceal them.

The full isolated backend command executed **303 tests: 234 passed, 2 wing-render invocations timed out, and 67 checks skipped because they require a separately listening backend on port 5000**. The full cross-workflow lifecycle passed, including real-renderer stock-visibility assertions. The wing file's independent rerun passed **4/4**, covering both timed-out checks; its separate result is recorded in [validation-results.json](lifecycle/validation-results.json). The broad run's timeout failures are retained in the report rather than relabelled as a clean full-suite exit. Mobile tests pass **65/65**; backend/mobile TypeScript, Prisma validation and `git diff --check` pass.

Continuation edits: viewer stock visibility; offline fit/vehicle renderer cleanup and visibility/refusal probes; lifecycle and stock-visibility regressions; finite E36 refusal assertions; same-type failed-fit test fixture; a second customer for the provider-portal fixture to respect the new active-request constraint; provider-network test guard; browser fixture/management checks; workflow/report/status documentation and evidence. The already-built management screens and routes were exercised without recreating them.

Final validation results and exact working-tree status are recorded alongside this report. Physical Android/Expo Go photo picking, gestures, background/resume and performance remain device checks; an Android export is not a device test. No live provider success or real E36 rear-bumper acceptance is claimed.

## Later sandbox resume verification — 2026-11-08

This run continued the existing files and preserved concurrent report/evidence updates in the shared working tree. Its final totals are **67/67 mobile tests**, **9/9 focused mobile lifecycle/visibility/syntax tests**, **47/47 offline backend viewer/audit tests**, **13/13 database-independent Sketchfab/quality/rim tests**, and **2/2 mocked Meshy client contract tests**, with no skips in those fresh groups. The earlier **13/13 cross-workflow/autofit** result remains recorded; a fresh database-backed confirmation could not start because this sandbox denies PostgreSQL connections to both `::1:5432` and `127.0.0.1:5432` with `EACCES`. Both the requested focused runner and full runner were attempted. No escalation or permission change was requested.

The retained full-suite log remains **303 total: 234 passed, 2 failed, 67 skipped**. Its exact failures are `tests/accessory-replace.test.mjs:35` ("E36 wing zone fallback: everything of the body INSIDE the replace box is hidden while on, and comes back when off") and `:43` ("E36 wing without a replace zone hides nothing (the E36 spoiler is part of the body shell, so it needs a tuned zone)"). Both failed with child-renderer `ETIMEDOUT`. Both pass in this run's 47/47 viewer group. The 67 retained skips require a separately running backend. This does not establish a clean new full-suite run.

The valid existing web export was reused. `tests/e2e/static-export.cjs` serves files directly through browser request interception, resolves exported dynamic HTML documents, and limits the root-shell fallback to document navigation; missing scripts/fonts return 404. Both E2E runners support `WEB_DIR`, so Chrome requires no browser connection to localhost. Service workers are disabled in the harness. The mocked config-save response now mirrors the backend's removal of nullable optional settings, preventing an invalid fixture from emptying the runtime catalog. Production routing/app behavior was unchanged. This uses the documented [Playwright route fulfillment API](https://playwright.dev/docs/api/class-route#route-fulfill); Context7 was attempted inside the authorized sandbox and failed with `ENOTFOUND`.

Browser verification passes **144/144 captures** at 390 × 844: **108 lifecycle captures** (27 per language/theme) plus **36 Sketchfab captures** (9 per language/theme). All four combinations pass: EN light, EN dark, AR light, AR dark. Checks cover document overflow, page exceptions, `????` and replacement-character corruption; lifecycle Arabic captures also assert right alignment, and the Sketchfab URL field stays LTR. Representative screenshots were visually inspected, including Arabic workspace, shop request, model edit, fit review, missing-car form, generation failure, license refusal, and the actual customer viewer. Lower-page captures include loose-part photos and submit/save controls. See [lifecycle results](lifecycle/ui/results.json) and [Sketchfab results](lifecycle/sketchfab-ui/ui-results.json). The separately produced `ui-validated/` evidence is preserved.

| Target workflow | Evidence and outcome |
| --- | --- |
| Parts Shop accessory request | Product, compatible generation, loose-part/reference photos and request status render in all four modes. Retained lifecycle A exercises submission through real fitting and publication using a labelled synthetic fixture. |
| Approval / Start / generation | Browser assertions prove approval makes no Start request; a separate explicit mocked Start follows. Provider transports remain mocked and paid generation is disabled. Retained lifecycle/vehicle-generation tests cover persisted processing, validation, private review and publication. |
| Customer View on my car | Actual retained E36/wing renders emit `shown` and `fit`; ON/OFF/ON completes without fit errors or Garage writes. Backend eligibility and inactive compatible-car selection are covered by lifecycle A and mobile regression tests. |
| Existing managed generation without 3D | Lifecycle B reuses the generation, preserves its Garage car, deduplicates open requests and groups demand. Browser captures show its linked request/status. |
| Completely missing car | Lifecycle C uploads request photos, creates/corrects taxonomy and attaches one canonical generation. Browser captures cover the unknown-car request form. |
| Vehicle generation lifecycle | Retained mocked Meshy/vehicle tests cover request, review, private candidate, validation and explicit promotion; a fresh DB run is blocked as described above. |
| Sketchfab Add by Link | Fresh parser/license/archive checks pass; browser fixtures cover inspect, private preparation/review, publication, NC refusal, non-downloadable refusal and duplicate detection. Retained persistent workflow covers worker leases, quality/hash gates, part-map proposal and publication. Beetle was not downloaded again. |
| Vehicle model management | Retained lifecycle E covers list, safe config revision, preview, candidate replacement, promotion, deactivation/reactivation and deletion refusal. Referenced models remain protected. Browser controls/rendering pass. |
| Accessory model management | Retained lifecycle F covers list, private preview, refit, fit review, publication state, unpublish/reactivate and safe private-candidate discard. Browser review/publication/failure controls pass. |
| Stock replacement restoration | Five unit regressions cover exact snapshots, repeated cycles, overlap, independent body-kit parts, failed loads and late loads after car changes. Real viewer tests confirm mapped geometry and rims restore correctly. |

### Publication consistency audit

The fresh read-only [catalog audit](lifecycle/catalog-audit.json) finds **22 active entries and 22 public vehicle GLBs**, no missing/unexpected vehicle GLBs, no missing attribution, matching generated manifest/mobile config/credits, and no unfinished promotion journal. Beetle retains Angelos Gkanias attribution, its source URL and license, and SHA-256 `ad65d3b3205c45de56ab9b2ff4b50f66d960737793950d6b67aa4920bad6e1dd`.

Source audit confirms that the runtime catalog selects active, DB-published generations and requires a valid config and existing GLB; the public asset gate checks DB publication before static hosting. Configuration/publication changes require the current revision. Confirmed part maps must match the GLB hash; accessory fits must match current car/part hashes and fitter version; publish checks the reviewed fit snapshot. Candidates stay private until explicit promotion, which uses catalog locking and journal recovery. Browser lifecycle state agrees with its intercepted server responses. A fresh audit of actual DB publication, part-map and fit rows is **unverified in this sandbox** because PostgreSQL is inaccessible. Offline clients can retain the last validated catalog for up to 24 hours; immediate offline revocation was not established.

Backend and mobile TypeScript and Prisma validation pass. Scoped lint across 29 source/test files reports the same **20 errors / 2 warnings** as the retained 25-file source lint: `customer/car3d.tsx:45`; `accessory3d/customer.tsx:20,30,31,37`; `accessory3d/screens.tsx:109,120,138,179,352,353,482,563,576,584,663,676,686`; and `vehicleCatalog/importScreens.tsx:41` (some lines have multiple findings). Warnings are at `screens.tsx:353,580`. The four browser/helper/visibility test files pass lint with zero findings. Exact rules and locations are retained in `validation-results.json`; no production hook refactor or lint suppression was introduced for this harness repair.

Android export was rerun successfully with `node ../.private/3d-lifecycle/export-in-sandbox.cjs export --platform android --output-dir ../.private/3d-lifecycle/android-export`: exit 0, **2,398 modules, 100 assets, 7.6 MB Hermes bundle** `_expo/static/js/android/entry-0207bb604066c7a2687d7e073f078e14.hbc`. Only the existing ignored sandbox adapter was used. Physical Expo Go, real paid generation, and a fresh DB-backed full-suite success remain unverified. The E36 rear diagnostic still fails at **21.6 mm intrusion / 12.7 mm gap / 9.2 mm limit**; no fit threshold was changed.
