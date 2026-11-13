# MOTEXA demo checklist (phones, Saturday)

Accounts only (passwords: the dev seed / your own notes, never in this file). Before you start: backend running (`cd backend; npm run dev`), `ipconfig` → put the LAN IP in `mobile/.env` (`EXPO_PUBLIC_API_URL=http://<LAN-IP>:5000`), `cd mobile; npx expo start -c`, scan with Expo Go. Phone browser: `http://<LAN-IP>:5000/api/health` must say "running".

## 0. Before the demo (one-time, from the RUN-LOG "Open for Saturday")
- [ ] Parts admin (**admin.parts@motexa.test**): Accessory fits → BMW 3 Series E36 → **Mesh rims** → check the rims on the car → "I reviewed…" → **Approve fit**. Then on the rims' 3D request: **Reactivate model**.
- [ ] Front bumper + rims customer visibility: decide on the `visualVerifiedAt` repair (RUN-LOG Part 0). Without it, only the **rear wing** shows "View on my car".
- [ ] Tow demo company: use **E2E Towing 1794038749** (owner **e2e.tow.1794038749@motexa.test**, driver **run.driver2.840323@motexa.test**), or first finish the seeded Al-Noor demo job with **driver2@motexa.test**. While that job is active, customer@motexa.test can't request Al-Noor again.

## 1. Parts: shop → parts admin → customer "View on my car" (one phone)
1. [ ] **shop@motexa.test**: My products → open an accessory product (rear wing for BMW E36) → **Submit for 3D** screen shows its 3D request state (photos, cars it fits).
2. [ ] **admin.parts@motexa.test**: Department → 3D → Accessories → open the wing's request → status, photos, final preview (**Render final preview** only if you change the fit; it no longer hides a published part).
3. [ ] Same admin: Car part maps → **Accessory fits** → BMW 3 Series E36 → wing, front bumper, rims each load on the car (no "Couldn't load the 3D view" over a loaded car). Approved rows show a check mark.
4. [ ] **customer@motexa.test** (active car: BMW 3 Series 2000 / E36): Parts → rear wing for BMW E36 → product photo shows → **View on my car** → 3D view with the wing on the E36.
5. [ ] Same customer: front bumper and rims products → "View on my car" if you did step 0, else "3D preview coming soon for your car" (expected).
6. [ ] Switch to Arabic + light: the same product page reads right-to-left, no cut text.

## 2. 3D admin: Add / Manage / Hide / Replace / Delete a 3D model (one phone)
Use a model you don't need for the demo (not the E36).
1. [ ] **admin.parts@motexa.test** → Department → 3D → **Add 3D model** → pick generation → upload / import → private preview → **Publish this 3D model?** → Published.
2. [ ] **Manage 3D models** → the new model is listed with its generation.
3. [ ] **Hide from customers** → customer (customer@motexa.test, car of that generation) gets "coming soon" → **Show to customers** → back.
4. [ ] **Replace model** → upload the new file → customers keep the old one until you approve → approve → old one gone (no history).
5. [ ] **Delete 3D model…** → the screen lists what is affected (part map, zones, accessory fits) → confirm → gone; audit row `VEHICLE3D_MODEL_DELETED`.

## 3. Tow: company → tow admin → customer → driver → completion (two phones)
Phone A = company / tow admin / customer (switch accounts). Phone B = driver.
1. [ ] Phone A **e2e.tow.1794038749@motexa.test**: Drivers → **Add driver** with a photo from the camera + licence photo → saved.
2. [ ] Phone A **admin.tow@motexa.test**: Home "Waiting for review" counts it; Requests tab → **Drivers waiting for licence review (1)** → **Request changes** (reason) → back as the company: the reason shows; edit the photo → driver back to Pending → tow admin **Approve**.
3. [ ] Phone A **customer@motexa.test**: Tow → choose E2E Towing → pick a free driver (**Run T.**) → set the pickup and **destination pin** → request. Card: company name, driver first name + initial, plate masked (•••• 95), no phone.
4. [ ] Phone B **run.driver2.840323@motexa.test**: the job appears → Accept → **On the way** (allow location; the map shows the route to the pickup).
5. [ ] Phone A customer: status "On the way", map with the truck moving, "About N min to you", full plate now, chat both ways.
6. [ ] Phone B: **Arrived** → **Loading the car** → Phone A: the cancel button is gone/refused.
7. [ ] Phone B: **Towing** (route now to the destination) → **Delivered** → **Completed**.
8. [ ] Phone A customer: summary (distance) → rate 5★ → driver and company show the new rating.
9. [ ] Phone A **admin.tow@motexa.test**: active tows map shows the job while it runs; afterwards it's in **Tow history**.
10. [ ] Arabic + light on the driver job screen and the customer tow screen.
