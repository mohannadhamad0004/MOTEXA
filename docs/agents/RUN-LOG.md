# RUN-LOG — unattended run, 2026-11-18 (E-03 refresh tokens, login security, D-05, admin prisma, direction style)

## EVENING FIXES (2026-11-18, 18:15–18:45 UTC, your backend :5000 + Expo web :8081)
- Privacy: live as mechanic.nablus@ (EN + AR): before accepting, "Near Nablus (approximate)", no phone, API point 32.23/35.24, no exact text anywhere in the response or page. After accepting: exact address, pin and phone. Another mechanic gets 404. Test request deleted afterwards.
- Signup photo: a 4000×3000 38 MB PNG attaches in the mechanic signup form (AR); not submitted.
- Dashboard: tow 6 approved / 2 pending, parts 10 / 0, both match the DB; EN + AR.
- Requests tab: 6 waiting (2 tow companies, 3 trucks, 0 drivers, 0 shops, 1 3D, 0 mechanics); rows open /dept/requests (right department), /dept/tows/drivers, /dept/requests?seg=3d.
- Cleanup: see STATUS.md (3 TEST_DATA_REMOVED audit rows).
- Found, not fixed: MechanicReviewScreen logs "Unexpected text node: ." on web.

## LIVE VERIFICATION (2026-11-18, 17:53–18:12 UTC, your backend :5000 + Expo web :8081)
- :8081 had a fresh bundle; :8090 is still serving an old one (no `getAccessToken` in it). Tests used :8081.
- Refresh: on the polling tow-status page (customer@, request c1a3da96, polls every 5 s) I replaced the access token with an invalid one. Result: 401 → 1 `POST /auth/refresh` 200 → same request retried 200; polling continued, no dialog, refresh token rotated.
- Parallel: customer home fires 14–15 calls. With an expired-looking token, 1 refresh and 0 × 401. With an invalid token, 1 refresh and 1 × 401. No sign-out.
- Logout: `POST /auth/logout` sent; both tokens gone from storage; the old refresh token then gets 401 from the server; `/customer` goes to login.
- Rate limit (throwaway `throwaway.ratelimit.1118@motexa.test`, made for this and deleted afterwards): 5 × 401, then 429 even with the right password. EN dialog "Too many sign-in attempts. Please wait 15 minutes and try again."; AR dialog "محاولات تسجيل دخول كثيرة…" (390 px, RTL). Unlocked at 18:10 (correct password → 200). Wrong email and wrong password → identical body `INVALID_CREDENTIALS` / "Invalid email or password.".
- D-05 / direction: superadmin → `/admin`: `/api/auth/me` + `/api/admin-management/dashboard` 200, no `/api/api`, no direction warning.
- Regression: customer@ → /customer, shop@ → /provider/parts, tow@ → /provider/tow, admin.parts@ → /dept, audit.tow@ (its own password) → /dept. No API errors. Note: I first tried audit.tow@ with the dev password (one 401); the later successful login cleared that.
- Then: the D-05 URL pattern was fixed with `apiUrl()` in 7 Diala files + login.tsx (listed in STATUS.md). Live: dashboard, providers, profile, invitations and activation-verify each call `/api/...` once. Mobile tsc 0, tests 84/84.
- Cleanup: throwaway user deleted; 11 revoked refresh-token rows from my test sessions deleted (0 active ones left from me).

## FINAL REPORT (2026-11-18, run finished; all 5 fixes done, none failed twice)

**Fixed and how it was verified**
| # | What | Verified how |
|---|---|---|
| 1 | E-03: 15-min access token + 30-day rotating refresh token (SecureStore on the phone, session storage on web); `api()` refreshes once on 401 and retries; tokens are also refreshed ahead of time (< 60 s left) for screens that fetch directly; single-flight refresh so polling screens can't race; reuse of a rotated token revokes that sign-in; logout clears both and revokes on the server | backend `tests/auth-session.test.mjs` (rotate, reuse → revoked, parallel → one winner, logout revoke); mobile `tests/session-refresh.test.mjs` (expiry decode, single flight, 401 clears, offline keeps you signed in, sign-out not undone by a late refresh) |
| 2 | Login security: 5 failures per email / 20 per IP in 15 min → 429; unknown email compared against a dummy hash; identical 401 for wrong email or wrong password; login screen shows both messages in EN + AR | 3 HTTP tests (identical bodies, timing, lockout) + limiter unit test |
| 3 | D-05: admin tabs layout uses `apiUrl("/auth/me")` | tsc; code path checked (works with or without `/api` in the env URL) |
| 4 | `admin.routes.ts` uses the shared `prisma` (test-DB guard applies) | HTTP test: super-admin dashboard 200 on motexa_test; source has no `new PrismaClient` |
| 5 | `direction` moved out of `StyleSheet.create` in `admin/(tabs)/index.tsx` | web 390 px on a fresh Expo bundle: 0 console errors (the stale :8090 bundle still shows the error) |

Final checks: backend tsc 0, mobile tsc 0, `prisma validate` ok, backend `npm test` **320/320** (isolated motexa_test), mobile tests **84/84**. No git commands were run. Nothing committed.

**Before you test, on the laptop**
- Your backend was **not running** on :5000 when I started (connection refused). I didn't start it. Start it with `cd backend; npm run dev`. The migration is already applied to motexa_dev and the Prisma client is already generated.
- Your Expo web on :8090 is serving an old bundle (it has none of today's changes). Restart Expo with `-c` before testing on the phone.
- One-time effect: anyone signed in from before this change has no refresh token, so they are asked to sign in once more when their current 15-minute token runs out. After that sign-in they stay signed in.

**Database:** one additive migration, `20261118090000_refresh_tokens` (new empty table `RefreshToken`). No dev rows were created or changed; every test ran on motexa_test.

**Left (not fixed, logged in detail below):** the same raw `EXPO_PUBLIC_API_URL + "/api"` pattern (the cause of D-05) is still in 7 more Diala files. Small E-03 edge cases: a duplicated browser tab, the app being killed mid-refresh, a phone clock off by more than 14 minutes on Diala's raw-fetch admin screens, and an offline logout. The four LIST items are below.

**Needs your phone:** the whole flow on a real device. SecureStore, waking after idle, and Arabic + light on the login errors have not been checked on a phone. I could not run anything against a live backend because none was running.

**Changed in Diala's files** (also in STATUS.md): `mobile/src/app/auth/login.tsx`, `mobile/src/app/admin/(tabs)/_layout.tsx`, `.../(tabs)/index.tsx`, `.../(tabs)/more.tsx`, `.../(tabs)/providers.tsx`, `mobile/src/app/admin/admin-management.tsx`, `mobile/src/app/admin/profile.tsx`, `mobile/src/components/mechanic-api.ts`, `mobile/src/components/MechanicApplication.tsx`, `mobile/src/components/MechanicReviewScreen.tsx`, `backend/src/routes/auth.routes.ts` (shared), `backend/src/routes/admin.routes.ts`.

**Other files changed:** backend `prisma/schema.prisma`, `prisma/migrations/20261118090000_refresh_tokens/`, `src/services/auth-session.service.ts` (new), `tests/auth-session.test.mjs` (new); mobile `src/core/config/api.ts`, `src/core/session/session.tsx`, `src/core/session/sessionExpiry.ts`, `src/features/provider/ui.tsx`, `src/features/vehicle3d/api.ts`, `tests/session-refresh.test.mjs` (new); docs `AGENTS.md` (§3 rule), `docs/agents/STATUS.md`, this file.

**Phone checklist (10)**
1. Log in as customer@motexa.test, then close Expo Go fully, reopen it: you are still signed in.
2. Log in and leave the phone idle for **20+ minutes**. Then open Parts, a product and My requests: everything loads and you are not sent to login.
3. Open a tow request status (or a driver job / chat), leave it open for 20+ minutes: it keeps updating with no "session expired" alert.
4. Admin (superadmin@motexa.test): leave it idle for 20+ minutes, then switch tabs and open Profile: no sign-in screen.
5. Log out from Profile, then press Back: you can't get into the app. Log back in: it works.
6. Log in on two phones (or Expo Go + web) with the same account. Log out on one: the other stays signed in.
7. Enter a wrong password 5 times for one account. The 6th try shows "Too many sign-in attempts. Please wait 15 minutes…", even with the right password. (That email stays locked for 15 minutes, or until the backend restarts. Use a test account.)
8. Repeat 7 in Arabic + light mode: the Arabic message is readable and right-aligned at phone width.
9. Wrong password vs an email that doesn't exist: both show the same "Invalid email or password" (EN + AR).
10. Admin home tab in dark + light, EN + AR: the top bar (wordmark + language switch) looks as before, with no red "direction" error in the Expo terminal.

**LIST (not fixed) — recommendations**
- **D-04, admin Requests tab is a "Coming soon" placeholder** (`app/admin/(tabs)/requests.tsx`). Recommendation: either hide the tab until there is content, or make it a read-only overview that links to what already exists (tow admin requests/drivers waiting, provider applications, mechanic applications, 3D requests) with real counts. Diala's file, so it needs her decision.
- **Mechanic signup photos aren't resized** (`app/auth/mechanic-signup.tsx` uses `launchImageLibraryAsync({quality:0.5, base64:true})`, which compresses but keeps the full pixel size, and rejects anything over MAX_BYTES). Recommendation: use the existing `core/hooks/pickPhoto.ts` (JPEG, at most 1600 px, quality 0.75). That is a few lines, and big phone photos would stop failing the size check.
- **The super admin dashboard ignores tow/parts providers** (`admin.routes.ts` `/dashboard` only counts admins, mechanics, mechanic profiles and invitations). Recommendation: add counts for TOW_PROVIDER / PARTS_PROVIDER (active vs pending review), trucks and active tow jobs, using the same `prisma.*.count` pattern. Add matching tiles on the admin home.
- **A mechanic sees the customer's exact location before accepting** (`mechanic-requests.routes.ts` `common()` returns `location.point` at 6 decimals and the full `locationText` in every status, including REQUESTED). Recommendation: until ACCEPTED, send only the city/area and a rounded point (about 2 decimals, roughly 1 km) or a distance. Send the exact pin after Accept, the same way tow handles privacy. This is a privacy rule (AGENTS.md §4.6), so it's worth doing soon.

## Progress
- Access check: backend NOT listening on :5000 (connection refused; no `tsx watch` process). Per instructions I did not start one. Verification = tsc + `npm test` (it starts its own backend on a random port against the isolated `motexa_test` DB) + mobile tests.
- AGENTS.md §3: the rule text "never edit partner-owned files" did not exist literally; the equivalent was the §3 heading "(do not cross without the owner's OK)". Replaced it with the new rule (partner files only for listed bugs, minimal, listed in STATUS.md).

### 1. E-03 refresh tokens — DONE
- Backend: additive migration `20261118090000_refresh_tokens` (table `RefreshToken`: SHA-256 hash only, familyId, sessionVersion, expiresAt, revokedAt) applied to motexa_dev with `prisma migrate deploy`; `prisma validate` ok; DB-vs-schema diff has no RefreshToken lines (the other diff lines are old `updatedAt` default drift, not touched).
- `services/auth-session.service.ts`: access JWT stays 15 min; refresh token = 32 random bytes, 30 days, rotated on every use (atomic claim, so two parallel refreshes → one wins); a reused (already rotated/revoked) token revokes the whole family; a password change (sessionVersion) or inactive account ends it.
- `auth.routes.ts`: login also returns `refreshToken`; new `POST /api/auth/refresh` and `POST /api/auth/logout` (revokes the family; works with an expired access token; never fails).
- Mobile: `core/session/sessionExpiry.ts` (pure: `expiresSoon`, single-flight `createRefresher`), `core/config/api.ts` (`getAccessToken` refreshes when < 60 s left, `api()` refreshes once on 401 and retries, `saveSession`, `clearSession` = both tokens + server revoke, best effort), `core/session/session.tsx` (sign-out/session check). Every direct token reader now uses `getAccessToken()`, every sign-out `clearSession()`.
- Storage: SecureStore on native; web keeps the existing session-storage fallback (tab-scoped, gone when the tab closes).
- Polling screens (tow tracking, driver job, dispatch, chat) all go through `api()` → single-flight refresh, so a 15 s poll that hits the expiry refreshes once and retries.
- Decision: refresh only when an access token exists (code that deletes the access token still means "signed out").
- Known limits (logged, not fixed): (a) a duplicated browser tab copies session storage; both tabs then share one refresh token and the second refresh is treated as reuse → both signed out. (b) If the app is killed between the server rotating and the phone saving the new token, the next refresh is "reuse" → sign in again. (c) A phone clock off by > 14 min: `api()` and the session check still recover via the 401 retry; Diala's admin screens that use raw `fetch` would show their own error/sign-in instead. (d) Logout revoke is fire-and-forget: offline logout leaves the server token valid until it expires (30 days) but it is gone from the phone.
- Tests added: backend `tests/auth-session.test.mjs` (3: rotate + reuse revokes family, parallel single winner, logout revoke) — PASS; mobile `tests/session-refresh.test.mjs` (4) — PASS. Mobile tsc 0, mobile tests 84/84.
- E-03 checkpoint: backend tsc 0, full `npm test` 316/316 pass (isolated motexa_test), mobile tsc 0, mobile tests 84/84.

### 2. Login security — details
- `auth.routes.ts` login: failed attempts limited per email (5 / 15 min, case-insensitive) and per IP (20 / 15 min), in-process like the password-reset limiter (`createFailureLimiter` in auth-session.service.ts; a success clears the email counter; the check runs before the password). 429 `{code:"RATE_LIMITED"}`.
- Unknown email → argon2.verify against a dummy hash made at startup, so it costs the same as a wrong password; both get the identical 401 body `{code:"INVALID_CREDENTIALS", message:"Invalid email or password."}`. The 403 "not active" reply still only comes after a correct password (unchanged).
- Mobile `login.tsx`: 429 → "Too many sign-in attempts. Please wait 15 minutes and try again." / Arabic; 401 → localized neutral "Invalid email or password." (it showed the English server text in Arabic before).
- Tests (3 more in `tests/auth-session.test.mjs`): identical 401s + timing (unknown email not < 50 % of wrong-password time), lockout after 5 → 429, unit test of the window/clear. 6/6 PASS.
- Decision: per-IP counts only failures, so a whole campus behind one NAT is not blocked by normal sign-ins.

### 3. D-05 — DONE
- `app/admin/(tabs)/_layout.tsx` uses `apiUrl("/auth/me")` (right with or without `/api` in EXPO_PUBLIC_API_URL). Your current `.env` has no `/api` suffix, which is why it worked on this laptop.
- Same raw `${EXPO_PUBLIC_API_URL}/api/...` pattern still in Diala's `admin/(tabs)/index.tsx`, `providers.tsx`, `admin-management.tsx`, `admin/profile.tsx`, `auth/admin-activation.tsx`, `components/mechanic-api.ts`, `PasswordRecoveryScreen.tsx` (and `login.tsx` builds its own base). NOT changed (not listed); recommendation: switch them to `apiUrl()` in one pass.
- mobile tsc 0, mobile tests 84/84.

### 5. "Invalid style property direction" — DONE (done before 4 because it is mobile-only and could run while the backend suite was busy)
- `app/admin/(tabs)/index.tsx`: `direction:'ltr'` moved from `StyleSheet.create` (react-native-web validates only there) to the topbar's inline style; same layout.
- Verified on web 390 px: your Expo web on :8090 is stale (its bundle contains none of today's edits; its file watcher isn't picking up changes) and still logs the error. A fresh temporary Expo web on :8095 (started by me, stopped afterwards) loads `/auth/login` with 0 console errors (the same page logged the error on :8090). Your :8081 / :8090 Expo processes are untouched.
- Same pattern still inside `StyleSheet`-free inline objects in LanguageSwitch/more/profile/Mechanic* (inline, so no warning) — nothing to do.

### 2. Login security — DONE
- Full `npm test` 319/319, backend tsc 0, mobile tsc 0, mobile tests 84/84.

### 4. admin.routes.ts shared prisma — DONE
- Removed its own `PrismaClient`/`PrismaPg`; imports `prisma` from `src/prisma.ts`. Only one client is left in `src/` (besides type-only uses).
- New HTTP test: super-admin `/admin-management/dashboard` 200 on motexa_test. Final `npm test` 320/320.

---

# RUN-LOG — unattended run, 2026-11-13

## FINAL REPORT (2026-11-13, run finished; no hard stop hit)

**Fixed and verified**
| ID | What | Verified how |
|---|---|---|
| T-05 | Published accessories disappeared for customers after "Render final preview" (`preview()` cleared `visualVerifiedAt`) | Code fix + approved wing repair → customer API wing × E36 `allowed=true`, model + autoFit present |
| T-04 | "Couldn't load the 3D view" over a loaded car (Accessory fits, rims × E36) | Web 390: rims load via the admin asset (200) and draw on the E36, no overlay |
| T-01 | New driver invisible to the tow admin | Web 390: "Drivers waiting for licence review (1)" on Requests → driver with photo + licence; KPI counts drivers |
| T-02 / D-01 | Admin couldn't Approve / Request changes (labels cut at 390 px; photo edit didn't resubmit) | Web + API: Request changes → company sees reason + notification → photo resubmit → PENDING → Approve; Reject needs a reason |
| T-03 | Drivers saw the company's navigation | Web 390: driver home + job without company links |
| Tow workflow | Steps 1–7 end to end | API on the real backend + web screens (see Part 2 table) |

**Still broken / owner decisions**
- ~~E36 front bumper + rims~~ **resolved later the same morning** (repairs + owner re-approval/reactivation; all three `allowed=true`). Original note: the bumper and rims were still `allowed=false` for the customer: the bumper has no `reviewedAt` to restore from; the rims are unpublished and **rims × E36 is NOT approved in the DB** (no FIT_APPROVED after the 17:15 Refit). Your call: a one-row repair (`visualVerifiedAt = publishedAt`) or unpublish → final review → publish; Reactivate + approve the rims.
- **Grey photos:** your phone-browser result arrived as the placeholder `<shows / doesn't show>`, so per the plan I didn't change anything. From the PC all three photos load over the LAN IP.
- **Seeded Al-Noor demo job** (`c1a3da96…`, EN_ROUTE since 2026-10-30) blocks customer@motexa.test from requesting Al-Noor. Untouched.
- 🟡 B-01, B-02, B-03, C-01; ⬜ A-04, D-03; partner files D-04, D-05, E-03, DIRECTION-STYLE. Full list in KNOWN-ISSUES.md.

**Needs your phone:** maps + routes, location permission and live tracking, camera photo upload, Arabic + light on the new driver rows, the grey photos.

**Phone checklist (max 15)**
Parts (one phone):
1. admin.parts: Accessory fits → E36 → rims, wing, bumper each draw on the car, no error overlay.
2. customer: rear wing product → photo visible → **View on my car** → wing on the E36.
3. customer: phone browser `http://<LAN-IP>:5000/api/files/public/db40b665-d480-40cb-93e6-7d2c15778a65` → does the wing photo show?
4. customer: front bumper / rims → "coming soon" until you do the owner actions above.
5. Arabic + light on the product page.

Tow (two phones; A = company/admin/customer, B = driver):
6. A e2e.tow.1794038749: **Add driver** with a camera photo + licence.
7. A admin.tow: Requests → "Drivers waiting…" → Request changes → (company edits photo) → Approve.
8. A customer: request E2E Towing, pick "Run T.", set the destination pin; plate masked, no phone.
9. B run.driver2.840323: Accept → On the way (allow location) → map route to the pickup.
10. A customer: truck moving on the map, ETA, chat both ways.
11. B: Arrived → Loading → A: can't cancel.
12. B: Towing (route to destination) → Delivered → Completed.
13. A customer: rate → rating shown on the driver/company card.
14. A admin.tow: active tows map during the job; Tow history after.
15. Arabic + light on the driver job screen.

**Records created:** see Part 2 "Test data" (2 trucks, 2 drivers, 3 tow requests, chat, notifications), plus the audit row for the wing repair and the T-02 test decisions on driver@motexa.test (left APPROVED; its photo file re-uploaded with the same bytes).

**Left running:** your backend (port 5000, untouched). I also started Expo web on port 8085 for the checks; it's still running (stop it with Ctrl+C in its window, or end the `expo start --web --port 8085` node process).

**Files changed this run:** backend `services/accessory3d.ts` (preview), `services/accessory-autofit.ts`, `routes/tow.routes.ts`, `services/tow-dispatch.ts`; mobile `car3d/useCar3D.ts`, `car3d/Overlay.tsx`, `department/TowAdminHome.tsx`, `department/applications.tsx`, `app/dept/tows/drivers.tsx`, `components/layout/ProviderLayout.tsx`; docs `RUN-LOG.md`, `DEMO-CHECKLIST.md`, `KNOWN-ISSUES.md`, `BUGS-ADMIN-3D.md`, `STATUS.md`. Nothing committed. tsc: backend 0, mobile 0.

---

## Access check (06:35 UTC)
- Backend: `http://127.0.0.1:5000/api/health` OK, also on the LAN IP `192.168.88.8:5000`. Your own `npm run dev` (`tsx watch`) keeps running; I did not start another one.
- PostgreSQL: reachable through the backend Prisma client.

## PART 0 — accessory "coming soon" + photos

### Cause (found earlier this session)
- `preview()` in `backend/src/services/accessory3d.ts` set `visualVerifiedAt = null` even on a PUBLISHED accessory. The customer gate (`forProduct` → `live`) needs `visualVerifiedAt`, and publish only runs from READY_FOR_FINAL_REVIEW, so the part was stuck: still PUBLISHED in admin, but hidden from customers with no way back. Final review requires a new preview after every fit approval, so each approval at 17:06–17:07 cleared it.
- **Fix:** `preview()` keeps `visualVerifiedAt` when the status is PUBLISHED. `tsx watch` reloaded it at 08:28:10 local time; confirmed by comparing process start time with the file write time.

### Approved one-time repair (owner approved): `visualVerifiedAt = reviewedAt`
- Ran in one transaction, with an audit row `ACCESSORY3D_VISUAL_VERIFICATION_RESTORED` (actorId null, details: source + reason) per changed row.
- **Result: only the wing changed** (`e6fefd78…` → 2026-11-05T10:21:48Z). The bumper (`3329a3e2…`) and rims (`9359edf8…`) have **`reviewedAt = null`**: the demo seeds set `visualVerifiedAt` but never `reviewedAt`, and neither has a PUBLISH audit row. As agreed, rows with null `reviewedAt` stay unchanged. **Decision:** I did not pick another source value (that would be an unapproved publish decision). → **Owner action.**
- Read-only check after the repair: wing `visualVerifiedAt` set; bumper and rims still null.

### Fits × E36 (read-only, 06:35 UTC)
| part | fitVersion | approvedAt |
|---|---|---|
| wing | 4 | 2026-11-12 17:06:53 |
| front bumper | 6 | 2026-11-12 17:07:08 |
| rims | 8 | **null** |
- The owner said the rims were re-approved, but the DB has **no FIT_APPROVED audit for rims after the 17:15:41 REFIT**, and `approvedAt` is still null. The rims are also **deactivated** (unpublished at 2026-11-12 15:57). → **Owner action** (rules: I don't approve fits).

### Customer API as customer@motexa.test, E36 generation `6e4a77ca…` (after the repair)
| product | allowed | reason | model | autoFit |
|---|---|---|---|---|
| Rear wing | **true** | – | accessories/acc-7e40b463d76777b8.glb | yes |
| Front bumper | false | NO_ACCESSORY_3D | null | no |
| Mesh rims 17″ | false | NO_ACCESSORY_3D | null | no |

### What the owner must do for bumper + rims (2–3 taps, then check again)
- **Bumper:** `visualVerifiedAt` is null and there's no admin path back to a PUBLISHED part, so it needs either (a) the owner's approval for a one-row repair with `visualVerifiedAt = publishedAt` (2026-11-06 11:23) plus audit, or (b) Unpublish → re-run final review → Publish in Parts admin.
- **Rims:** Reactivate (blocked until a current fit is approved) → approve rims × E36 → same `visualVerifiedAt` question as the bumper.

### Grey photos
- PC tests over the LAN IP: all three product photos return 200 with real images, no auth, ~7 ms; installed-look photos return 200 with the customer token. Firewall allows Node on the Public Wi-Fi profile. No client cache.
- The phone-browser result in the owner's message was left as the placeholder `<shows / doesn't show>`. The run plan says to fix grey photos **only if the phone browser showed the image**, which isn't confirmed. **Decision: not changed.** Open for the phone checklist.

### "Couldn't load the 3D view" overlay over a loaded view
- **Reproduced** on Expo web (admin.parts, Accessory fits → BMW E36 → Mesh rims): the car rendered, but the console showed `404 /api/3d/accessories/acc-b463a391bdd04dfb.glb` and the full "Couldn't load the 3D view… Retry" overlay covered the car. The rims never drew, so the fit couldn't actually be reviewed.
- **Root cause:** `autoFits.list` (`backend/src/services/accessory-autofit.ts`) returned the public `file` for any PUBLISHED accessory, but the public asset route only serves visually verified, active ones. The rims are deactivated and unverified, so the request 404'd. `useCar3D` treated any failed asset (even an accessory's) as "the 3D view failed", and `Overlay` showed errors even after the first frame.
- **Fix:**
  - `accessory-autofit.ts`: `file` only when published + `visualVerifiedAt` + not deactivated (same rule as `isPublic3DAsset`); otherwise the screen uses its existing private admin loader.
  - `mobile/src/features/car3d/useCar3D.ts`: a failed **accessory** asset goes to `onFitError` (all three accessory viewers show it as a note, and on the fits screen it blocks Approve). Only the car file failing sets the view error.
  - `mobile/src/features/car3d/Overlay.tsx`: once a frame has been drawn, no error overlay.
- **Verified** (web 390): rims × E36 loads the model via `GET /admin/parts/accessory-3d/9359…/assets/model` → 200; the rims draw on the E36; no overlay. tsc: mobile 0, backend 0. The rims × E36 still shows "Auto-fit, not reviewed yet" → owner approves (rules).

### Follow-up (2026-11-13 ~07:07 UTC, owner approved)
- Front bumper `3329a3e2…`: `visualVerifiedAt = publishedAt` (2026-11-06T11:23:11.663Z) + audit `ACCESSORY3D_VISUAL_VERIFICATION_RESTORED` (source publishedAt). Read-only check OK.
- Customer API (E36): wing **true**, front bumper **true**, rims **false / NO_ACCESSORY_3D**. Rims at check time: still deactivated, E36 `approvedAt` null, `visualVerifiedAt` null. Reactivating doesn't set `visualVerifiedAt`, so the rims also need the same one-row repair (owner approval).

- Rims (~07:20 UTC, owner approved): owner re-approved rims × E36 (07:13:17, fitVersion 8); `visualVerifiedAt = publishedAt` (2026-11-06T13:06:52Z) + audit row; owner tapped **Reactivate model**.
- **Final customer API (E36): wing true · front bumper true · rims true.** Owner confirmed "View on my car" for all three on the phone.

## PART 1 — tow drivers

### T-01 (driver added by the company not visible to the tow admin)
- Read-only SQL: newest driver `driver@motexa.test` ("Mah"), created 2026-11-12 11:02 UTC, company Al-Noor (APPROVED), `approval = PENDING`, licence number 13467, files DRIVER_LICENCE + DRIVER_PHOTO saved.
- API `GET /admin/tow/drivers?status=PENDING` as admin.tow@motexa.test returns the driver with photo + licence. **The backend list was fine.**
- **Cause (app):** the tow admin's review queue only covers companies and trucks. The "Waiting for review" KPI = pendingCompanies + pendingTrucks and opens `/dept/requests`, and the Requests tab lists company applications only. Pending drivers are never counted or listed; the only way in was a plain "Review drivers' licences" card further down the home screen, with no count.
- **Fix:**
  - `backend/src/routes/tow.routes.ts` `/admin/tow/stats`: + `pendingDrivers` (count of PENDING drivers; additive field).
  - `mobile/src/features/department/TowAdminHome.tsx`: "Waiting for review" includes pendingDrivers; the drivers card shows a CountBadge.
  - `mobile/src/features/department/applications.tsx`: tow Requests tab gets a "Drivers waiting for licence review (n)" row at the top → `/dept/tows/drivers` (hidden when 0).
- tsc: mobile 0, backend 0.
- **Verified** (Expo web 390 px, admin.tow@motexa.test): Requests tab shows "Drivers waiting for licence review (1)" → drivers screen lists Mah with photo + licence. AR layout OK. The row hides once nothing is pending.
- Side note: my first Expo web start used `CI=1`, which turns off Metro's file watching, so edits didn't show up. Restarted without it (my own process on 8085; not yours).

### T-02 (admin can't Approve / Request changes)
- **Cause 1 (UI):** at 390 px the four actions (Approve, Request changes, Reject, Edit) shared one row; their labels were cut to "A" / "Re…" / "Rej…". **Fix:** `drivers.tsx` wraps them two per row (`HALF`).
- **Cause 2 (resubmit loop):** a company edit counted as a resubmission only if it changed the licence number or licence photo; a new driver photo or phone left the "changes requested" reason in place forever. **Fix:** `tow-dispatch.ts` updateDriver clears `approvalReason` on a photo/phone edit while PENDING + reason (stays PENDING).
- **Verified (real backend, driver@motexa.test):** Request changes from the screen (reason required) → company sees PENDING + reason + notification → company re-uploaded the same driver photo (PATCH `/tow/me/drivers/:id`) → PENDING, reason null → Approve from the screen → APPROVED + "Driver approved" notification. Reject: no reason → 400; with reason → company sees REJECTED + reason → re-approved. **Final state: APPROVED** (needed for Part 2).
- Data touched: driver@motexa.test's approval (created by you on the phone for testing; left APPROVED). Its DRIVER_PHOTO file id changed (same bytes, new upload): `65ca4484…` → `d3a6a8c9…`.
- Bug file: T-01, T-02 → ✅ (web + API); D-01 → ✅.

## PART 2 — full tow workflow (real backend + DB; API + Expo web 390 px)

**Decision:** customer@motexa.test already has a seeded **demo** job with Al-Noor (`c1a3da96…`, EN_ROUTE since 2026-10-30, driver Samer, notes "(demo)"), and the server allows one active request per customer + company. There's no other usable customer account and I won't change demo data, so steps 2–7 ran against **E2E Towing 1794038749** (approved test company from an earlier e2e run, owner `e2e.tow.1794038749@motexa.test`). Step 1 was done in both companies.

| Step | Result | How verified |
|---|---|---|
| 1. Company adds truck + driver (photo) → admin approves | ✅ | Al-Noor (tow@motexa.test): truck RUN-735923 + driver run.driver.736112 → PENDING in admin list with photo + licence, `pendingDrivers`=1 → truck + driver approved, truck linked. Same in E2E: truck RUN-840195 + driver run.driver2.840323 (created with the truck). |
| 2. Customer request WITH destination pin → driver/company card | ✅ | `POST /requests/tow` mode DRIVER: dropoff pin stored (32.2275, 35.2223); card: "Run T." (first name + initial), photo, real rating (none yet), truck type, **plate "•••• 95"** (masked), responsible company + city; no phone anywhere in the JSON. Free-driver list (customer) same rules. |
| 3. Company accepts + assigns (and customer picks a driver) | ✅ | (a) customer-picked driver → driver accepts; (b) mode COMPANY → company inbox → `POST /tow/me/requests/:id/assign` → driver sees it → accepts. |
| 4. Driver statuses in order + location | ✅ | EN_ROUTE → ARRIVED → LOADING → IN_PROGRESS → DELIVERED → COMPLETED all 200; COMPLETED before DELIVERED → 409. Pings → customer `driver.live` and admin active map follow (5 s server throttle is intended; pings <5 s apart are dropped). Distance 990 m in the summary. UI: driver job screen "Arrived" works (tap + confirm tap). |
| 5. Customer live status + chat; no cancel after loading | ✅ | Full plate shown only after acceptance; timeline + "About 1 min to you" from the live point (web screenshot). Chat both ways. Cancel while ACCEPTED → 200; cancel after LOADING → 409 CANCEL_NOT_ALLOWED, `canCancel=false`. |
| 6. Completion + rating; ratings update | ✅ | `canReview` true → 5★ → 201; second rating → 409 ALREADY_RATED. Driver 5.0 (1), 1 tow; company 5.0 (1), shown on the next request's card. |
| 7. Tow admin active map + history | ✅ (API) | Job in `/admin/tow/active-jobs` with live point while active; gone after completion; in `/admin/tow/jobs?status=COMPLETED`. |
| Map, routes (pickup → destination) | 📱 phone | Maps are native-only by design (`maps.web.tsx`: `MAPS_AVAILABLE=false`); web shows "The map is not available on this platform." |

### T-03 (found): tow drivers saw the company's navigation
- `ProviderLayout` (used by `/driver` screens) showed the company link chips (Dashboard, Jobs, Trucks, Drivers, Media, Settings…) and "back" to the company dashboard for a pure driver.
- **Fix:** `mobile/src/components/layout/ProviderLayout.tsx`: on `/driver` paths base = `/driver`, no company links. **Verified** web: driver home + job screen show no company links. tsc mobile 0.

### Test data created in Part 2 (all through the app's APIs)
| Record | Where | State left |
|---|---|---|
| Truck RUN-735923 (Isuzu NPR) | Al-Noor | APPROVED, **OUT_OF_SERVICE** (unused, kept out of customer view) |
| Driver run.driver.736112@motexa.test "Run Test Driver" (pw = dev password) | Al-Noor | APPROVED, **offline**, truck RUN-735923 |
| Truck RUN-840195 (Mitsubishi Canter) | E2E Towing 1794038749 | APPROVED, AVAILABLE |
| Driver run.driver2.840323@motexa.test "Run Test Driver Two" (pw = dev password) | E2E Towing 1794038749 | APPROVED, FREE, truck RUN-840195 (usable for the demo) |
| Tow request A `70a98041…` | customer@motexa.test → E2E | COMPLETED, rated 5★ |
| Tow request B `cc79b76d…` | customer → E2E (company mode) | CANCELLED (before loading) |
| Tow request C `314c373e…` | customer → E2E | COMPLETED, not rated |
| Chat messages (3 on A, 1 on C), notifications | — | — |
Images used for the truck/driver/licence uploads: `mobile/assets/images/motexa-mercedes-coastal.png` and `motexa-profile-membership.png` (app artwork, clearly not real documents).
