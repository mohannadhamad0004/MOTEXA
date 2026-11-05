# Meshy integration ? intentional live generation only

Implemented on `ui/blueprint`, 2026-11-04. No live generation was executed during development. Automated HTTP is mocked. The default is explicitly labelled, unpromotable mock mode.

## Official contract verified

The [current Multi-Image-to-3D documentation](https://docs.meshy.ai/en/api/multi-image-to-3d) and [error contract](https://docs.meshy.ai/en/api/errors) were checked on 2026-11-04. Backend uses `POST /openapi/v1/multi-image-to-3d` with four JPEG data URIs (front, rear, left, right), `ai_model: meshy-7.1`, `target_formats: [glb]`, texturing/PBR and target 50,000 polygons. GET of the returned opaque ID supplies PENDING/IN_PROGRESS/SUCCEEDED/FAILED/CANCELED, optional integer progress, millisecond timestamps and `model_urls.glb`. These choices are generation targets, not guarantees that a provider result will pass MOTEXA limits. Meshy task failures use `task_error.type`; raw provider messages are never returned/logged.

Context7 lookup was attempted but the CLI was blocked by the environment's EACCES/network restrictions; official documentation was inspected directly. No fallback to guessed endpoints was used.

## Backend architecture

- `meshy-client.ts`: typed, injectable HTTP client; no key/URL leakage. Auth/credits/forbidden/missing-task/malformed/timeout/rate-limit/download errors have safe codes. GET retries retain the known task. Paid POST responses that cannot be confirmed never cause an automatic second POST.
- `vehicle3d-generation.ts`: persistent worker, 5-second scan and 10-second provider poll schedule, expiring row leases and checkpoints. External HTTP runs outside database transactions. Raw output downloads into private storage, then a prepared private GLB is validated and rendered. A restart resumes the saved task/raw asset. Unknown paid request intent fails closed after lease expiry.
- `vehicle3d-validation.ts`: static self-contained GLB, bounded file/decoded resources, triangles, textures/materials, finite sensible dimensions, length normalization/grounding, explicit up/heading corrections, no guessed semantic orientation or destructive scenery deletion. Reports warn that front/up/vehicle identity/scenery require human inspection. Animations/skins are rejected. Prepared generated metadata strips names/extras/copyright; private originals stay private.
- `vehicle3d-submissions.ts`: existing owner-bound Garage workflow, attempt history, explicit consent, private assets, retry/regeneration and Parts Admin review. Mock mode/provider/source flags are checked independently on submission and promotion. Technical failure blocks approval. Revalidation resets recorded visual verification; approval always needs a fresh explicit visual confirmation.
- `vehicle3d-promotion.ts` and `vehicle3d-catalog.ts`: shared immutable-file promotion, generation mapping, manifest/config/credits, advisory serialization, recovery journal and provenance audit. A working shared model requires an explicit current-key replacement. Generated filenames contain canonical generation and a prepared content hash, never a submission/user/task ID. Public serving requires committed approval.

No private data/task IDs/signed URLs enter runtime catalog DTOs, credits or generated public metadata. Original photos are never published. Provider IDs, customer/submission linkage, source-photo attempt, reviewer, timestamps and replacement old/new keys remain in private database/audit records. Generated assets are shared using explicit customer permission, without inventing a CC license. This is a technical consent record; the project owner must confirm the account/provider terms and final legal copy before wider release.

## Environment and deployment

Configure only the backend process or ignored `backend/.env`; never mobile:

| Variable | Meaning |
|---|---|
| `MESHY_API_KEY` | Secret backend-only credential; never printed or committed |
| `VEHICLE3D_MODE` | `mock` by default; explicit `real` required for Meshy |
| `MESHY_ALLOW_PAID_GENERATION` | Must equal `1` to queue/create a real paid job |
| `VEHICLE3D_MAX_MB` | Prepared/raw GLB limit, default 8 MiB, bounded 1?20 |
| `VEHICLE3D_THREE_DIR` | Local exact Three.js 0.160.1 package; default `.private/three-r160/package` |

Generation requires customer processing/sharing consent, initial Parts Admin approval, and a separate Parts Admin start-generation action. Customers cannot queue Meshy; initial approval alone creates no task. Merely setting a key does not create jobs. Previously authorized tasks resume polling after restart; resetting mode to mock does not erase an already-created remote task. Legacy in-flight rows lacking the new explicit authorization are safely failed by the additive migration.

The demo pipeline needs the repository's backend/mobile dependencies, local Chrome/Three r160, renderer scripts and mobile viewer sources, plus writable manifest/config/credits/public/private folders. Do not deploy only compiled backend output. PostgreSQL holds provider/attempt state; private disk storage needs durable backup and appropriate owner-only server permissions. Use `npx prisma migrate deploy`, never reset/db push.

HTTP timeouts are 30 seconds, lease 180 seconds, local generation deadline one hour. Safe retries preserve known jobs; permanent provider failure requires customer action. Request-intent uncertainty requires Meshy dashboard inspection before an explicit retry. Deleting locally removes owner access and discards late output, but cannot promise remote cancellation/refund. No automatic provider deletion is performed. Downloads allow only HTTPS `assets.meshy.ai`, no credentials or nonstandard port, no redirects, with a streaming size cap. Output exceeding configured limits is rejected, not silently published or blindly optimized.

## Exactly one intentional live test

These steps are for the human to execute. They were not executed by the agent.

1. Put your real key in ignored `backend/.env` using your editor. Do not paste it into commands, screenshots, tickets or mobile. Confirm your Meshy plan/credits and photo-processing rights.
2. In one backend terminal, explicitly enable real generation:

```powershell
cd C:/Users/mohan/WebstormProjects/MOTEXA/backend
$env:VEHICLE3D_MODE = 'real'
$env:MESHY_ALLOW_PAID_GENERATION = '1'
npm run dev
```

3. As customer, open Garage → **Request my car**, enter brand/model/year and optional generation/trim/notes, upload front/rear/left/right photos of the same car, and consent to processing/catalog sharing. Press **Submit for Parts Admin review**. This creates PENDING_REVIEW and spends no Meshy credits. As Parts Admin, open Vehicle catalog → Customer vehicle requests, verify the photos, correct/assign active taxonomy/year and **Approve for generation**. Initial approval still spends no credits. If an existing shared model is present, explicitly acknowledge the replacement candidate.
4. As Parts Admin, intentionally press **Start approved generation / retry once** for that one request. This is the action that may spend credits. Do not batch-generate. Observe Starting → Generating (provider progress only) → Downloading → Preparing → Ready for final review, or a safe failure. Note the underlying submission ID. As customer, inspect **View my 3D car** privately. READY technical status does not establish identity/front/up/material quality.
5. To inspect restart persistence during that same task, restart the backend after its task is created; do not press Regenerate. It should continue the saved job. A request interrupted before ID confirmation is deliberately failed for dashboard inspection.
6. After finishing, run the read-only local report, substituting only your submission UUID:

```powershell
node --import ./scripts/register-typescript.mjs scripts/meshy-live-report.ts --submission-id=<submission-uuid>
```

The report does not call Meshy/create jobs. It masks the task ID, reports timestamped status/audit sequence, duration, prepared GLB size, technical/viewer results and preliminary eligibility. A full task ID is only available privately to the server operator if dashboard investigation is necessary. Do not publish it.

7. Catalog promotion is separate: as Parts Admin choose **Begin final visual review**, then open `/dept/3d-submissions` publication controls. Saved customer sharing consent is required. Compare all four photos and the current interactive model; correct orientation explicitly if needed and validate again. Check identity/year/body, wheels, geometry, scenery, grounding and rights. Confirm visual verification for the exact current model revision; a changed revision clears confirmation and rejects stale approval requests. A generation with a shared key requires **Replace existing model** for that exact key. Publish only if all checks pass; otherwise reject/request regeneration with notes. Mock models cannot publish. Original photos stay private.
8. Stop the backend, remove the paid-enable process variables or set mode to mock, and restart for ordinary demo use. No automatic repeat live test is authorized.

Record the masked task, duration/status sequence, resulting size, validation, actual viewer result and whether promotion passed all checks. Until these steps are performed, live Meshy success and physical Expo Go verification remain unverified.

## Future curated imports

`manual3d-import.ts` defaults to private preparation/validation/six-view rendering; it creates no customer or Garage record. Required arguments are `--file`, `--make`, `--model`, `--generation`; optional `--length`, `--paint`, `--up-degrees`, `--heading-degrees`. Use an existing catalog generation. Archived `backup-old` paths are refused.

```powershell
node --import ./scripts/register-typescript.mjs scripts/manual3d-import.ts --file=../3d-source/manual/<candidate>.glb --make=<make> --model=<model> --generation=<code> --paint=<isolated-material>
```

Artifacts/review are under ignored `.private/vehicle3d-imports/<source-sha256>/`. Publication additionally needs `--publish --reviewer-id=<active-parts-admin-uuid> --visual-verified --status=PASS_VARIANT` (or another accepted status), and exactly one legal-evidence file:

- `--source-api-metadata=<file>`: genuine Sketchfab API response matching embedded source UID, downloadable status, author and compatible cc0/by/by-sa license. Fetch evidence from the actual source, do not fabricate a snapshot.
- `--ownership-evidence=<private-file>`: actual MOTEXA ownership documentation with `sourceSha256`, `rightsHolder: MOTEXA`, `permission: redistribution-and-use`, `verifiedByUserId` matching reviewer, and a meaningful `description`. The record must reflect real ownership; this option does not establish rights by itself. Its hash/reviewer are retained privately.

Existing models require `--replace-existing-key=<exact-current-key>`. The tool rerenders final credited configuration before calling the same staged catalog/journal helper as customer approval. It never publishes merely because preparation succeeded. The C63 remains REJECT pending genuine external evidence; no alternative ownership claim was made for it.
