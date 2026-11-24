# 01 — How to run MOTEXA and how the tests work

The project is developed on Windows (PowerShell) with the backend on the laptop and the app on a real Android phone in Expo Go,
both on the same Wi-Fi. Node 24 is what the laptop uses.

## 1. What you need
- Node.js (24.x is the version in use) and npm.
- PostgreSQL running locally, with a database for development (the project uses `motexa_dev`).
- An Android phone with **Expo Go** installed, on the same network as the laptop.
- Optional: Google Chrome / Playwright Chromium, only for the 3D auto-fit, previews and the headless tests (see §5).

## 2. Run the backend
```powershell
cd backend
npm install              # also runs "prisma skills sync" (postinstall; failure is ignored)
npx prisma generate      # makes src/generated/prisma (git-ignored)
npx prisma migrate deploy  # applies prisma/migrations to the DATABASE_URL database
npm run dev              # tsx watch src/server.ts  ->  http://<LAN-IP>:5000/api/health
```
Rules from `AGENTS.md`: migrations are additive only; never `prisma migrate reset` or `prisma db push`.

### Seed data (development only)
| Command | What it fills | Guard |
|---|---|---|
| `npm run seed:vehicles` | the vehicle list (`Vehicle`) from `src/vehicleCatalog.ts` + body types from `src/seed/vehicle-body-types.csv` | none (idempotent upsert) |
| `npm run seed:generations` | car generations (`VehicleGeneration`) from `docs/3d/generations-master.tsv` and the photo / 3D manifests | none |
| `npx tsx src/seed/super-admin.ts` | the one super admin, from `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` / `SUPER_ADMIN_NAME` | refuses if the email exists or the password is under 12 chars |
| `npm run seed:test` (`src/seed/test-accounts.ts`) | dev accounts for every role, all `@motexa.test` | refuses in production and unless `ALLOW_DEV_SEED=true` |
| `npm run seed:providers`, `seed:mechanics`, `seed:tow-drivers` | demo providers, mechanics, drivers | `ALLOW_DEV_SEED=true` |
| `npx tsx src/seed/demo-parts-shop.ts`, `demo-rims.ts`, `demo-e36-bumper.ts` | demo shop products and 3D demo parts | `ALLOW_DEV_SEED=true` |

The dev accounts share one password: the `DEV_PASSWORD` constant in `backend/src/seed/test-accounts.ts`.

### Emails in development
`services/email.service.ts` tries SMTP first (`SMTP_HOST` set), then Resend (`RESEND_API_KEY` + `RESEND_FROM_EMAIL`). If neither is set
and `NODE_ENV` is not `production`, it **prints** the email in the backend terminal as one line starting with `[DEV EMAIL]`. That is
where you read signup codes, admin invitation links and password-recovery codes while developing. In production, a missing mail
configuration is an error.

## 3. Run the mobile app
```powershell
cd mobile
npm install
# mobile/.env:  EXPO_PUBLIC_API_URL=http://<LAN-IP>:5000/api   (check the laptop IP with ipconfig; it changes)
npx expo start -c --offline   # scan the QR code with Expo Go
```
- `apiUrl()` in `mobile/src/core/config/api.ts` accepts the URL with or without `/api` at the end.
- `npx expo start --web` gives a browser preview. Maps are not available there (`features/shared/maps.web.tsx` shows a message),
  and the camera / GPS / secure storage behave differently. The phone is the real target.

## 4. Environment variables (names only)

### `backend/.env`
Currently set in the dev file: `DATABASE_URL`, `JWT_SECRET`, `PORT`, `ALLOW_DEV_SEED`, `SKETCHFAB_API_TOKEN`, `MESHY_API_KEY`,
`OTP_HASH_SECRET`. All names the code reads:

| Name | Read in | Purpose |
|---|---|---|
| `DATABASE_URL` | `src/prisma.ts`, `prisma.config.ts` | PostgreSQL connection. Required (the server throws without it). |
| `JWT_SECRET` | `services/auth-session.service.ts`, `middleware/auth.middleware.ts` | signs access tokens; must be at least 32 characters |
| `PORT` | `src/server.ts` | API port, default 5000 |
| `NODE_ENV` | many files | `production` turns off dev fallbacks (printed emails, dev seed); `test` is set only by `npm test` |
| `OTP_HASH_SECRET` | `services/otp.service.ts` | HMAC key for every 6-digit code; must be 64 hex characters, otherwise sending a code fails |
| `ALLOW_DEV_SEED` | `src/seed/*.ts` | must be `true` for the demo seeds |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | `services/email.service.ts` | real email over SMTP (port 465 or 587, TLS required) |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | `services/email.service.ts` | real email through Resend (used when SMTP is not set) |
| `ADMIN_ACTIVATION_URL` | `routes/admin-invitations.routes.ts` | base of the admin invitation link (dev default: this server's `/api/auth/admin/open-invitation`) |
| `EXPO_GO_BASE_URL`, `EXPO_GO_ACTIVATION_URL` | `routes/admin-otp.routes.ts`, `routes/admin-invitations.routes.ts` | dev only: open the invitation in Expo Go (`exp://…`) instead of `motexa://` |
| `MECHANIC_DOCUMENT_DIR` | `routes/mechanics.routes.ts` | folder for private mechanic documents (default `.private/mechanic-documents`) |
| `GEO_MIN_LAT`, `GEO_MAX_LAT`, `GEO_MIN_LNG`, `GEO_MAX_LNG` | `src/geo.ts` | the accepted map area (default: a box around Palestine) |
| `TOW_OFFER_MINUTES` | `services/tow-dispatch.ts` | how long a tow offer waits for an answer (default 3) |
| `MESHY_API_KEY` | `services/meshy-client.ts`, `accessory3d.ts` | Meshy photo-to-3D API key |
| `MESHY_ALLOW_PAID_GENERATION` | `services/generation-runtime.ts` | `0` switches paid generation off (outside tests it is ON unless set to `0`) |
| `VEHICLE3D_MODE` | `services/generation-runtime.ts` | `real` lets a test process use the real provider path; otherwise tests use mock mode |
| `VEHICLE3D_MAX_MB` | `services/vehicle3d-validation.ts` | maximum 3D model size, 1–20 MB, default 8 |
| `VEHICLE3D_THREE_DIR` | `scripts/accessory-fit-check.mjs` | local three.js r160 used by the headless viewer (default `.private/three-r160/package`) |
| `SKETCHFAB_API_TOKEN`, `SKETCHFAB_ACCESS_TOKEN` | `services/sketchfab-client.ts` | Sketchfab API token / OAuth token for model imports |
| `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD`, `SUPER_ADMIN_NAME` | `seed/super-admin.ts` | the one-time super admin seed |
| `TEST_DATABASE_URL` | `scripts/test.mjs` | optional; default is the dev URL with the database name `motexa_test` |
| `API_URL`, `MOTEXA_DEV_PORT`, `NODE_TEST_CONTEXT` | tests | set automatically by the test runner, never by hand |

### `mobile/.env`
| Name | Purpose |
|---|---|
| `EXPO_PUBLIC_API_URL` | the backend address the phone calls, e.g. `http://<LAN-IP>:5000/api`. `EXPO_PUBLIC_` means it is built into the app, so it must never hold a secret. |

### Root `.env`
`PIXABAY_API_KEY` exists, but no file in `backend/src`, `backend/scripts`, `mobile/src` or `mobile/scripts` reads it.

Secrets live only in `backend/.env`, which is git-ignored (`.gitignore`: `.env`, `**/.env`).

## 5. How the tests work

### Backend: `cd backend; npm test`
`npm test` runs `backend/scripts/test.mjs`, which builds a safe, separate test world every time:
1. Sets `NODE_ENV=test`.
2. **Drops and re-creates** a database called `motexa_test` (or `TEST_DATABASE_URL`). It refuses to run if the name does not end in
   `_test` or equals the dev database.
3. Applies all migrations with `prisma migrate deploy`.
4. Copies the dev data **read-only** into it (a `READ ONLY` transaction on the dev side), because many tests need the real cars,
   part maps and 3D models. The `RateLimit` table is not copied.
5. Starts its **own backend** on a random port, with a random `JWT_SECRET` and `OTP_HASH_SECRET`, `VEHICLE3D_MODE=mock`, paid
   generation off and empty Meshy / Sketchfab keys.
6. Runs every `tests/*.test.ts` and `tests/*.test.mjs` with Node's built-in test runner, one file at a time
   (`--test-concurrency=1`).

Extra safety nets:
- `src/prisma.ts` throws if a test process is not `NODE_ENV=test`, and if `NODE_ENV=test` points at a database not ending in `_test`.
- `scripts/test-no-paid-provider.mjs` replaces `fetch` so a test can never reach `meshy.ai`, `sketchfab.com` or the developer's own
  backend on port 5000.
- `services/meshy-client.ts` refuses a real call under `NODE_ENV=test` unless a fake transport is injected.

Tests that need a browser run the **real** 3D viewer code headless through `scripts/accessory-fit-check.mjs` (Playwright Chromium
from `mobile/node_modules`, and a local three.js copy, see `VEHICLE3D_THREE_DIR`).

What the 51 backend test files cover:

| Area | Test files |
|---|---|
| Sign-up, login, tokens, roles | `customer-signup.test.mjs`, `auth-session.test.mjs`, `auth-security.test.mjs`, `apply.test.mjs`, `four-roles-permissions.test.mjs` |
| Password recovery | `password-reset.test.ts`, `password-reset-completion.test.ts`, `password-reset-db.test.ts`, `password-reset-route.test.ts` |
| Mechanics | `mechanic-onboarding.test.mjs`, `mechanic-request-privacy.test.mjs`, `mechanics-admin-requests.test.mjs` |
| Tow | `tow-dispatch.test.ts`, `tow-drivers-flow.test.ts`, `tow-drivers-phase3.test.ts` |
| Parts and orders | `parts-orders.test.ts`, `fitment.test.ts`, `categories.test.ts`, `catalog-badges.test.ts`, `parts-photos.test.ts`, `numbers.test.ts` |
| Garage and vehicle list | `garage.test.ts`, `generations.test.ts`, `managed-vehicle-catalog.test.ts` |
| Customer car 3D (photos → model) | `vehicle3d.test.ts`, `meshy-generation.test.ts`, `lifecycle-3d.test.ts`, `old-candidates.test.ts` |
| Sketchfab imports | `sketchfab-import.test.ts`, `sketchfab-lifecycle.test.ts`, `sketchfab-host.test.mjs` |
| Shop accessories in 3D | `accessory3d.test.ts`, `accessory-preparation.test.ts`, `autofit.test.ts`, `part-map.test.ts`, `model-gate.test.ts`, `rim-seed.test.ts` |
| Real viewer, headless | `autofit-viewer.test.mjs`, `bumper-viewer.test.mjs`, `rims-viewer.test.mjs`, `part-map-viewer.test.mjs`, `accessory-replace.test.mjs`, `fit-qa-viewer.test.mjs`, `e36-rear-clearance.test.mjs` |
| Other | `error-codes.test.ts`, `provider-media.test.ts`, `provider-portal.test.ts`, `review-fixes.test.ts`, `config-fixes.test.mjs`, `vehicle-audit*.test.mjs` |

Some HTTP test files say "needs the dev backend on :5000". Under `npm test` they use `API_URL`, i.e. the test backend; they only skip
when no backend answers.

**Last recorded result**: 340/340 backend tests and 86/86 mobile tests (`docs/agents/STATUS.md`, 2026-11-21). I did not re-run them
while writing this guide. `docs/agents/KNOWN-ISSUES.md` lists `lifecycle-3d.test.ts` as intermittent once.

### Mobile
- `mobile/tests/*.test.mjs` (20 files) use Node's test runner on the app's **pure** modules (no React Native): session refresh
  (`session-refresh.test.mjs`), landing per role (`landing.test.mjs`), error-code parity EN/AR with the backend
  (`error-codes-parity.test.mjs`), Arabic bidi text (`bidi.test.mjs`), numbers with Arabic digits, location rules, the 3D viewer's
  fit / part / rim rules, and a syntax check of the big viewer script (`viewer-syntax.test.mjs`).
  There is no `npm test` script in `mobile/package.json`; run them from `mobile/` with `node --test tests/*.test.mjs`
  (Node 24 runs the `.ts` imports directly).
- `mobile/tests/e2e/*.cjs` are **manual** Playwright click-throughs on the Expo web build (port 8083) against a running backend, at
  390 px width; they take screenshots into `docs/agents/`.

### Type checks
`npx tsc --noEmit` in `backend/` and in `mobile/`, and `npx prisma validate` after a schema change (the project's finish rule in
`AGENTS.md`).

## 6. Useful backend scripts (`backend/scripts/`)
These are developer tools, not part of the running API:
- `fit-qa.ts` + `fit-qa-report.ts`: puts every published accessory on every active car in the real viewer and writes
  `docs/3d/fit-qa/` and `docs/3d/FIT-QA.md`. Read-only for the database.
- `accessory-fit-check.mjs`: the headless viewer runner the backend itself calls for auto-fits, previews and part maps.
- `optimize-3d.ts`, `optimize-accessory.mjs`, `manual3d-import.ts`, `sketchfab-batch.ts`: preparing and importing 3D models.
- `fetch-generation-photos.ts`: downloads one credited Wikimedia photo per generation into `backend/public/cars/`.
- `simulate-drive.ts`, `drivers-fixture.ts`: tow driver demos.
