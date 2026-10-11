# MOTEXA

Car maintenance platform: customers upload a photo, video or audio of a car problem, an AI gives a preliminary diagnosis, and a mechanic confirms it.

## Project layout

| Folder            | What it is                                             |
| ----------------- | ------------------------------------------------------ |
| `apps/web/`       | React web app (Vite + CSS Modules)                     |
| `apps/mobile/`    | React Native app (not initialized yet)                 |
| `apps/api/`       | Node.js API (Express + PostgreSQL)                     |
| `packages/shared/`| Types, API client and validation shared by web + mobile |

Each feature and module folder has its own README explaining its purpose. Conventions are in `CLAUDE.md`.

## Getting started

Requirements: Node.js 22+. PostgreSQL is optional during development.

```sh
npm install
npm run dev                                    # api on :4000, web on :5173
```

Without a `DATABASE_URL`, the api uses an in-memory PostgreSQL (PGlite) that is migrated and filled with the web app's mock data on every start, so the marketplace search works with nothing else installed. Data resets when the api restarts.

To use a real PostgreSQL server instead (the migrations enable `pg_trgm` and `fuzzystrmatch`, which come with standard installs):

```sh
createdb fastfix
copy apps\api\.env.example apps\api\.env      # then set DATABASE_URL in apps/api/.env
npm run db:migrate -w @fastfix/api             # create the tables
npm run db:seed -w @fastfix/api                # fill the empty database with the mock data
npm run dev
```

API keys (AI, maps) go in `.env` only. The web and mobile apps call the api, never the AI provider directly.

## Test accounts

The web app currently uses mock data (`apps/web/src/auth/mockUsers.js`). These accounts exist on every start:

| Email | Password | Role | Use it to test |
| --- | --- | --- | --- |
| `admin@fastfix.test` | `Admin123!` | admin | `/admin`: approvals, users, tags, listings, requests |
| `customer@fastfix.test` | `Test123!` | customer | Requesting a mechanic / tow / part, 3D preview |
| `mechanic@fastfix.test` | `Test123!` | mechanic (approved, 2 approved skills, workshop photos) | Mechanic dashboard, public profile, "Ask about this part" |
| `shop@fastfix.test` | `Test123!` | parts_shop (approved, "Al-Quds Auto Parts") | Managing its own parts at `/parts-shop` |
| `shop2@fastfix.test` | `Test123!` | parts_shop (approved, "Ramallah Motors Supply") | Checking that shops can't edit each other's parts |
| `tow@fastfix.test` | `Test123!` | tow (approved, "Nablus Rescue Towing", 2 trucks) | Tow dashboard, public tow profile |
| `pending-mechanic@fastfix.test` | `Test123!` | mechanic (pending, 2 skills) | The pending page, and per-skill approval as admin |

All other seeded accounts (more mechanics, shops and tow companies) also use `Test123!`.

**Dev login:** when running `npm run dev`, the `/login` page shows a "Dev login" panel with one button per account above. It is only compiled into development builds; `npm run build` leaves it out.

**Refresh:** the mock login and account changes are kept in `sessionStorage`, so a page refresh keeps you logged in. Close the tab or click "Reset mock data" in the dev login panel to start fresh. Marketplace edits, requests, tags and the 3D selection still reset on refresh. (Temporary - removed once the real backend auth exists.)
