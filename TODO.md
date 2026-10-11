# MOTEXA — Project To-Do

✅ = done  ⬜ = not done yet

Most "done" frontend items still use **mock data**. They become real in Phase 3 (backend).

## Phase 0 — Setup
- ✅ Stack decided (on paper): React (web), React Native (mobile), Node.js (backend), PostgreSQL
- ✅ React web app installed and running (Vite)
- ✅ PostgreSQL installed on your computer
- ⬜ React Native / Expo installed and a mobile app created
- ✅ GitHub repo (MOTEXA), working branch `mohand`, PR-into-main workflow
- ✅ Monorepo layout: `apps/{web,mobile,api}`, `packages/shared`
- ✅ `.gitignore` (`node_modules/`, `.env`, `.claude/`, `.idea/`)
- ✅ `CLAUDE.md` with stack, roles, folder conventions
- ✅ `apps/web/src` skeleton
- ✅ `apps/api/src` folders and placeholder files only (modules: auth, cars, diagnosis, marketplace, logistics, certification) — no working backend yet
- ✅ `apps/mobile/src` empty folders only — no React Native project yet

## Phase 1 — Naming and model fixes
- ✅ Driver → **Tow Company** (a company with multiple trucks)
- ✅ Shop Owner → **Parts Shop** (many independent shops on one platform)
- ✅ Customer dashboard removed (customers use public pages + profile menu)
- ✅ UML class diagram updated (Tow company owns Trucks, Parts Shop, Requests, Tags)
- ✅ Update the old project-plan document (still says "Driver" and the old name)

## Phase 2 — Accounts (frontend, mock)
- ✅ Shared login page, redirect by role
- ✅ Multi-step signup per role (mechanic skills + certificates, workshop photos; shop license + photos; tow company license + trucks with papers)
- ✅ Forgot / reset password pages
- ✅ Pending-approval page
- ✅ Dev test accounts + dev login panel
- ✅ Account and Profile pages for every role (menu links exist, pages not built)
- ✅ Tow company manages its trucks after signup (add / edit / remove)
- ⬜ Customer profile menu: AI Agent (past diagnoses), Chats, Reports, My Cars

## Public pages (frontend, mock)
- ✅ Marketplace with fuzzy search (typos, part numbers in any format, multi-word)
- ✅ Public shop pages
- ✅ Parts Shop adds and manages only its own parts
- ✅ Mechanics directory + public mechanic profiles (certificates private, "Verified" badge)
- ✅ Tow companies directory + public profiles (documents and plates private)
- ✅ Browse without login; login required to send requests
- ✅ Request forms: Request service, Request tow, Ask about this part
- ✅cla Service modes: on-site / workshop visit / online consultation
- ⬜ Ratings and reviews (not decided yet)

## Admin (frontend, mock)
- ✅ Admin overview
- ✅ Approvals with per-skill approval and required verification method
- ✅ User management (suspend / reactivate)
- ✅ Tags for parts, mechanics, and tow companies
- ✅ Hide rule-breaking parts
- ✅ Requests monitor

## UI
- ✅ Design system and shared components
- ✅ Light / dark mode
- ✅ Home page with AI diagnosis upload (photo, video, engine sound recording) — mock results
- ✅ 3D car preview placeholder in the marketplace

## Phase 3 — Real backend + database
- ⬜ Install PostgreSQL (Windows installer from postgresql.org)
- ⬜ Create the database + migrations
- ⬜ Real authentication (password hashing, JWT, refresh tokens, reset-password email)
- ⬜ Server-side authorization (roles, approval status, shop ownership)
- ⬜ File uploads (public photos; private certificates and documents)
- ⬜ Seed script with test accounts
- ⬜ Connect frontend auth and admin pages to the real API

## Phase 4 — Real AI diagnosis (Gemini)
- ⬜ Gemini API key on the backend only
- ⬜ Diagnosis endpoint: upload → Gemini → structured report saved to the database
- ⬜ Mechanic sees the report next to the original photo / video / audio
- ⬜ Mechanic confirms or corrects the diagnosis; log AI-vs-mechanic agreement for the thesis
- ⬜ (Optional) Car-specific dashboard warning-light model

## Phase 5 — Role dashboards and communication
- ⬜ Mechanic: receive, accept, decline requests
- ⬜ Tow company: receive tow requests, assign a truck, update status
- ⬜ Parts Shop: answer part questions
- ⬜ Chats between customer and mechanic / tow company / shop
- ⬜ Reports
- ⬜ Notifications (request accepted, account approved)

## Phase 6 — Marketplace and search (backend)
- ⬜ Parts, shops, mechanics, tow companies from the database
- ⬜ Part compatibility tables (VehicleVariant + PartFitment) for shared parts
- ⬜ Backend smart search with PostgreSQL pg_trgm + synonyms
- ⬜ Buying parts: real orders/payment, or sale outside MOTEXA? (not decided yet)

## Phase 7 — Tow logistics
- ⬜ Find nearest available trucks, rank by driving time (Mapbox or openrouteservice)
- ⬜ Truck status (available / en route / busy)

## Phase 8 — 3D preview
- ⬜ 3–10 licensed GLB car models with attachment points
- ⬜ React Three Fiber viewer replacing the placeholder

## Phase 9 — Mobile app
- ⬜ Install Expo (React Native) and create the app inside `apps/mobile`
- ⬜ Build the mobile screens using the same API as the web

## Phase 10 — Academic deliverables
- ✅ Abstract (GP1) drafted
- ⬜ Keep the abstract in sync if the scope changes
- ⬜ Diagrams saved in a `/docs` folder in the repo
- ⬜ AI accuracy evaluation from the mechanic corrections

## Open decisions
- ⬜ Buying parts: orders and payment inside MOTEXA, or contact only?
- ⬜ Ratings and reviews?
- ⬜ Arabic language support (right-to-left layout)?
