# MOTEXA — Agent Guide (shared by Codex and Claude Code)

Read this whole file before doing anything. It is the single source of truth for every AI agent working in this repo.

## 1. What MOTEXA is
Graduation project (An-Najah National University, Computer Engineering) by Mohannad Hamad and Diala Bakir, supervised by Dr. Sufyan Samara.
A car-services platform for Palestine: verified mechanics, a car-parts marketplace (shops), tow-truck companies with real trucks, customer requests, admin review, and (planned) AI car diagnosis.
Currency: ILS, shown as "₪ 120.00". Languages: English + Arabic (full RTL). Cities: the shared 22-city Palestinian list.

## 2. Repo layout
- `backend/` — Express 5 + TypeScript (tsx watch), PostgreSQL `motexa_dev`, Prisma 7.x, argon2id, JWT (15 min, no refresh yet). Hand-written validation (no Zod). Every state change writes an AuditLog.
- `mobile/` — React Native, Expo SDK 57, Expo Router (routes in `mobile/src/app`), tested in **Expo Go on a real Android phone**.
  - `src/theme/` tokens (dark + light, bronze accent #E0A36F / #9A602D), `useTheme`, `makeStyles`
  - `src/core/` config (`apiUrl`), session, landing per role, constants (cities, categories, money, geo, files), hooks
  - `src/components/ui/` shared UI kit (Text, Button, Card, Badge, Chip, Input/SearchBar, Skeleton, EmptyState, ErrorState, Price, SectionHeader, StatusTimeline, ListRow, ImageTile…)
  - `src/components/layout/` Screen (safe area), DashboardLayout, AuthLayout, RoleGate, tab bar options
  - `src/components/*.tsx` (top level) = Diala's design components (Appearance, BrandSurfaces, EditorialUI, InteractiveButton, LanguageSwitch, MotexaVisual)
  - `src/features/*` feature-specific code (catalog, requests, tow, parts, shared/maps = Leaflet/OSM WebView)
- `apps/web/` — the web app (separate; React + Tailwind + shadcn). Not part of mobile work.

## 3. Ownership (do not cross without the owner's OK)
- **Diala:** auth (login/signup/OTP/activation/forgot password), admin management, admin tabs, mechanics + mechanics admin, her design components.
- **Mohannad:** tow, parts, catalog, files, requests, customer screens, provider screens, tow/parts admin screens, theme + shared UI kit.
- Shared files touched with agreement only: `auth.routes.ts` (/auth/me for all roles, login 403 returns role+status), `login.tsx` (landingFor per role), `Appearance.tsx` (dark default + remembered mode).

## 4. Hard rules
1. Work on the current branch (`feature/mohannad-mobile` unless told otherwise). Never push. Never commit — the human commits (no AI co-author lines).
2. No destructive git: no `reset --hard`, `clean`, `checkout -- <file>` on others' work, `stash drop`, force push, rebase.
3. Database: additive migrations only. Never `prisma migrate reset`, `db push`, or editing applied migrations. On merged branches use `npx prisma migrate deploy`.
4. Never commit or print secrets. `.env` files, `storage/`, uploads stay out of git. API keys live only in `backend/.env`.
5. No fake data on screen: no fake ratings, sales counts, ETAs, discounts. Demo data only in the dev seed (`backend/src/seed/test-accounts.ts`, `ALLOW_DEV_SEED`).
6. Privacy: customers never see provider phone/email/plates/licences; documents are private (owner + matching admin only).
7. Mobile: every new native package must work in Expo Go (`npx expo install <pkg>`); ask the human first. No NativeWind/Tailwind/CSS on mobile — StyleSheet + theme tokens + shared UI kit. Every screen: EN + AR, RTL, dark + light, 390px wide without overflow.
8. Proposal first for anything non-trivial: read, propose (files, plan), STOP and wait for "approved".
9. Finish with: mobile `npx tsc --noEmit` = 0, backend `npx tsc --noEmit` = 0, `npx prisma validate` when schema changed, plus `git status --short`.

## 5. Running locally (Windows, PowerShell)
- Backend: `cd backend; npm run dev` → health `http://<LAN-IP>:5000/api/health`
- Mobile: `cd mobile; npx expo start -c --offline` → scan with Expo Go. `mobile/.env`: `EXPO_PUBLIC_API_URL=http://<LAN-IP>:5000/api` (the laptop IP changes; check `ipconfig`).
- Dev seed: `cd backend; npx tsx src/seed/test-accounts.ts` (dev accounts `*@motexa.test`, password `Motexa-Dev-1234!`).

## 6. Working in tandem (Codex + Claude Code)
- Only ONE agent edits a given file area at a time. Default split: **Claude Code builds, Codex reviews** (or the human assigns areas explicitly).
- If both must write at the same time, use separate git worktrees/branches; the human merges.
- After every task, append a short entry to `docs/agents/STATUS.md`: date, agent, task, files changed, checks run, open issues. Read it before starting.
- Reviews go to `docs/agents/REVIEW.md` (findings with file:line, severity, suggested fix). Reviewers do not edit code unless asked.

## 7. Current state (update when it changes)
Done: tow fleet + company profile, parts shops + products (condition/type/fitment/categories/filters), provider files, requests (part inquiries, tow requests with state machine), customer storefront home, mechanics for customers (public catalog, profile, service requests, mechanic inbox), GPS nearest companies + OSM maps (Leaflet WebView), login per role, merge of Diala's admin OTP + fonts + admin tabs, theme tokens + shared UI kit on ALL of Mohannad's screens (customer, provider, tow/parts admin), 14 Codex review fixes. Diala's screens (auth, onboarding, admin tabs, mechanics admin) are NOT yet on the theme tokens.
In progress: UI direction agreement (ChatGPT + Claude review → final design spec), then UI polish phases.
Next: Emergency (one-tap tow request), ratings/reviews, orders (cash only), My Cars, AI diagnosis.