NEXT SESSION: tow drivers + tow workflow (read fully first)

Read AGENTS.md, docs/agents/STATUS.md (latest entries) and docs/agents/BUGS-ADMIN-3D.md first.
Check access first: backend http://127.0.0.1:5000/api/health and PostgreSQL (read-only). Stop and tell me if blocked.
This task is approved (AGENTS.md rule 8 satisfied); start fixing.

BUGS I FOUND ON MY PHONE (fix first)
T-01: As a tow company, I added a new driver (with a photo). The driver does NOT appear on the tow admin side (drivers / review list).
   - Find the new driver in the DB (read-only): does the row exist? approval status? company? photo/licence saved?
   - Find why the tow admin list doesn't show it (status filter, company approval, query, permission, list endpoint vs screen).
   - Every new driver must appear for the tow admin as PENDING, with photo and licence, right after the company adds it.
T-02: As tow admin, I can't Approve or Request changes for a driver (e.g. missing information).
   - Reproduce with the driver from T-01.
   - Approve, Request changes (with a required reason) and Reject must all work from the admin screen; the company sees the decision and the reason; after Request changes, the company edits and resubmits, and the driver goes back to PENDING for the admin.
   - This also confirms D-01 (🟡) in BUGS-ADMIN-3D.md.
Add T-01 and T-02 as rows in BUGS-ADMIN-3D.md.

THEN: THE FULL TOW WORKFLOW, FOR REAL
Run it end to end on the real backend + database (API + Expo web at 390 px; I'll do the phone part):
1. Company adds a truck and a driver (photo) -> tow admin approves the driver.
2. Customer requests a tow WITH a destination pin -> sees the company/driver card (responsible company shown, no phone numbers, plate masked until assigned).
3. Company accepts and assigns the driver (or the customer picked the driver directly).
4. Driver: statuses in order (On the way -> Arrived -> Loading -> Towing -> Delivered/Completed); live location while the job screen is open; the route to pickup, then to the destination.
5. Customer: live status + map + chat; can't cancel after loading started.
6. Completion: summary + rating; ratings update for the driver and the company.
7. Tow admin: sees the job on the active tows map while active, and in history after.
Fix every blocker you find (root cause, small fixes). Log each one as a row (T-03, T-04 ...).
Test data: create it only through the app's real flows; list every account/record you created; don't delete real data.

FINAL
- backend + mobile tsc clean.
- Short report: table (ID, fixed?, how verified), what's still broken, and a TWO-PHONE checklist for me (max 12 checks: one phone as the driver, one as the customer) for what web can't prove: photo upload, location permission, live tracking, notifications.

RULES
- Don't commit, push or run destructive git commands.
- Additive migrations only.
- Don't touch Diala's files (AGENTS.md) or graphify-out/.
- Real data only; no mocks or fake data in the app.
- Privacy: customers never see phone numbers; full plate only after assignment.
- EN + AR, light + dark, Expo Go compatible.
- Leave my backend running.
