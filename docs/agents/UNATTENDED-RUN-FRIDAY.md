UNATTENDED RUN (I'm away for 4–6 hours). Read all of this first.

I won't be here to answer questions. Work through the parts below in order, without stopping to ask me. When something is unclear, choose the safest reasonable option, write the decision in docs/agents/RUN-LOG.md, and continue. Stop ONLY for the hard stops listed at the end.

Read first: AGENTS.md, docs/agents/STATUS.md (latest entries), docs/agents/BUGS-ADMIN-3D.md, docs/agents/NEXT-SESSION-NOTES.md (if it exists), docs/agents/PARTS-ADMIN-REDESIGN.md.
Check access first: backend http://127.0.0.1:5000/api/health and PostgreSQL (read-only). Use MY backend on port 5000; don't start another backend on another port. If it's down, try `npm run dev` in backend/ once; if still blocked, write it in RUN-LOG.md and stop.

Keep a running log in docs/agents/RUN-LOG.md: for each part, what you did, what you found, what you fixed, how you verified it, and what's left. Update it as you go (not only at the end), so if you stop, the next session knows exactly where you were.

=====================================================================
PART 0: finish the current task (if not finished)
=====================================================================
The customer (customer@motexa.test, active car BMW E36) still sees "3D preview coming soon for your car" on the rear wing, front bumper and rims, although all three fits show "Approved" in Accessory fits. Product photos are also grey/blank on the phone for all three.
- Show the customer accessory API response for each product (allowed + reasons) and the fit rows (read-only SQL: approvedAt, fit version, current).
- Fix the cause (server or app). The goal: all three show "View on my car" for the E36 customer, and the 3D view loads.
- Grey photos: find why images don't load on the phone path (URL base, cache, auth headers on image requests, LAN serving) and fix it.
- Also fix: in Accessory fits (rims × E36) the "Couldn't load the 3D view" overlay appears on top of a view that loaded correctly. Only show it when loading really fails.

=====================================================================
PART 1: tow drivers (T-01, T-02)
=====================================================================
T-01: As a tow company I added a new driver (with a photo) from my phone. It does NOT appear on the tow admin side.
- Read-only SQL: find the newest driver(s): row exists? approval status? company? photo/licence saved?
- Find why the tow admin list doesn't show it (status filter, query, permission, endpoint vs screen) and fix it. Every new driver must appear for the tow admin as PENDING, with photo and licence.
T-02: As tow admin I can't Approve or Request changes for a driver.
- Approve, Request changes (required reason) and Reject must all work from the admin screen; the company sees the decision and reason; after Request changes the company edits and resubmits, and the driver is PENDING again.
- This also confirms D-01 in BUGS-ADMIN-3D.md.
Add T-01 and T-02 as rows in BUGS-ADMIN-3D.md.

=====================================================================
PART 2: the full tow workflow, for real
=====================================================================
Run end to end on the real backend + database (API + Expo web at 390 px; I'll do the phone part later):
1. Company adds a truck and a driver (photo) -> tow admin approves the driver.
2. Customer requests a tow WITH a destination pin -> sees the driver/company card (responsible company shown, no phone numbers, plate masked until assigned).
3. Company accepts and assigns the driver (also test: customer chooses a specific free driver).
4. Driver: statuses in order (On the way -> Arrived -> Loading -> Towing -> Delivered/Completed); location updates while the job is active (simulate them through the API); route to pickup, then to the destination.
5. Customer: live status + map + chat; can't cancel after loading started.
6. Completion: summary + rating; ratings update for the driver and the company.
7. Tow admin: sees the job on the active tows map while active, and in history after.
Fix every blocker you find (root cause, small fixes). Log each as a row (T-03, T-04 ...).
Test data: create it only through the app's real flows; list every account/record you created in RUN-LOG.md.

=====================================================================
PART 3: update the bug file and write the demo checklist
=====================================================================
1. docs/agents/BUGS-ADMIN-3D.md: make every row match reality (✅ verified for real / 🟡 fixed, not verified / ⬜ open / Partner file). Rows verified in earlier runs must show ✅ with evidence. Rewrite the Summary at the top with counts and a short "Open for Saturday" list.
2. Write docs/agents/DEMO-CHECKLIST.md: the exact steps I'll do on my phone(s) tomorrow, in order, for:
   - parts: shop -> parts admin (3D request, fits approval) -> customer "View on my car" on the E36;
   - 3D admin: Add / Manage / Hide / Replace / Delete a 3D model;
   - tow: company -> tow admin -> customer request -> driver statuses -> completion (two phones);
   with the test accounts to use for each step (accounts only, no passwords in this file).
3. Write docs/agents/KNOWN-ISSUES.md: short, honest list for my report (open bugs, test-suite failures and why, the W203 model limit, partner-file items for Diala, and future work: bake parts into named meshes, box cut for merged bumpers, more part types, FIT-QA sampling).

=====================================================================
RULES
=====================================================================
- NEVER commit, push, stash, reset, rebase or run any destructive git command. I commit myself.
- Migrations: additive only.
- Never edit Diala's partner-owned files (AGENTS.md list) or graphify-out/. List what she needs instead.
- Real data only: no mocks or fake data in the app; change data only through the app's APIs; read-only SQL for checking. Restore any business data you change for testing (except the test accounts/records the tow flow needs; list those).
- No Meshy credits. No new Sketchfab imports. Don't approve, unapprove or change accessory fits or part maps (except temporarily to test, then restore).
- Privacy: customers never see phone numbers; full plate only after assignment.
- EN + AR, light + dark, 390 px, Expo Go compatible, no raw text outside <Text>.
- Keep fixes small and focused; no refactors, no redesigns, no new features beyond what a bug needs.
- Before finishing each part: backend + mobile tsc clean.

HARD STOPS (stop and write why in RUN-LOG.md):
- anything that would need a non-additive migration, deleting real data, spending Meshy credits, or editing Diala's files;
- the backend or database can't be reached;
- the same fix failed twice (write what you tried).

FINAL REPORT (at the end, short, also at the top of RUN-LOG.md):
- What's fixed (with how it was verified), what's still broken, what needs my phone.
- A phone checklist for me (max 15 checks: parts on one phone; tow with two phones).
- Every account/record you created.
- Leave my backend running.
