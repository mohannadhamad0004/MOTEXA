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
