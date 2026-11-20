# Mechanics vs Tow — gap audit (2026-11-18)

Read from the code (backend routes/schema + mobile screens), not from plans. **[PAY]** = blocks online payment later. **[AI]** = blocks AI diagnosis later.

## 1. Side by side (what exists today)

| Capability | Tow (today) | Mechanics (today) | Gap |
|---|---|---|---|
| Who provides | Company (`TowCompanyProfile`) + its drivers (`TowDriver`, invited, licence reviewed) + trucks | One person = one MECHANIC account (`MechanicApplication`: workshop name/address, on-site / workshop / online flags, coverage cities) | **No garage-with-mechanics model** (see §2) |
| Location for matching | Real coordinates per truck/driver; nearest by GPS | City centre only (no workshop coordinates); map pins labelled approximate | Workshop pin + on-site coverage radius |
| Ways to request | Nearest available / choose company / choose driver (`TowChoice`) | Choose one mechanic only | "Nearest available mechanic for skill X" |
| Offers + timeout | `tow-offers.ts`: 3-min offer, auto re-offer to next nearest free driver, else ends with TIMEOUT and the customer is told | None: a request can sit in REQUESTED forever | Offer deadline + re-offer / expiry |
| Assignment | Company assigns a driver; driver accepts/declines | Mechanic is fixed at creation | Garage assigns one of its mechanics |
| Availability | Driver availability toggle; truck operational status | None (only the 3-open-requests cap) | Available / busy / off toggle, working hours |
| Statuses | REQUESTED → ACCEPTED → EN_ROUTE (+ arrived, loading stamps) → IN_PROGRESS (+ delivered) → COMPLETED; DECLINED / CANCELLED | REQUESTED → ACCEPTED → IN_PROGRESS → COMPLETED; DECLINED / CANCELLED | On-site: EN_ROUTE / ARRIVED. Workshop: CAR_RECEIVED, DIAGNOSING, WAITING_FOR_PARTS / WAITING_FOR_APPROVAL, READY_FOR_PICKUP |
| Live status for the customer | Status page polls; driver posts live location; map + route + ETA | Status page polls (15 s) while open; no position, no ETA | Live location/ETA for on-site jobs |
| Notifications (in-app) | Every transition + offers + chat + rating + reports (`notify`) | **None** for requests (only application notifications) | Notify customer + mechanic on every transition |
| Push (phone, app closed) | None (in-app list only) | None | Expo push for both (platform-wide) |
| Chat | Customer ↔ driver ↔ company per job (`/messages`) | **None** | Per-request chat; history kept after the job |
| Price / quote | **None** (no fare on `TowRequest`) | **None** | Quote → customer approves → final invoice **[PAY]** (tow needs it too) |
| Rating / review | `TowReview` (one per completed job, real ratings only) | None; public profile has no ratings | Review per completed job |
| Problem report | Customer report → admin reports list → close | None | Same flow |
| Admin oversight | Active-jobs map, job detail, history, admin cancel, reports | Mechanics admin reviews **applications** only; no view of requests | Request list/history, detail, cancel, reports, live map for on-site |
| Cancellation rules | Customer can't cancel after loading; system/admin cancel with reason | Customer: REQUESTED / ACCEPTED; no reason, no fee rule | Reasons + rules per stage **[PAY]** |
| Privacy | Plates/phones hidden; exact location only during the job | Done today: first name + area before accept, exact data only during the active job | — |
| Customer's car | Free-text car fields | Free-text make/model/year (the customer's Garage exists but isn't linked) | Link the request to a garage car **[AI]** |
| Attachments | Tow photos for trucks/drivers (not per request) | None on the request | Photos / audio / video of the problem **[AI]** |
| Outcome record | Delivered / completed stamps | Completed stamp only | Structured diagnosis + work done + parts used **[AI]** **[PAY]** |

## 2. Garages vs independent mechanics

**Independent mechanic** (what exists): one account, own skills, workshop and/or on-site. Needs: availability toggle, workshop pin + on-site radius, offers/timeout, notifications, chat, quote/invoice, rating.

**Garage with its own mechanics** (missing entirely). Mirror the tow company/driver pattern so the code and admin flows are reused:
- `GarageProfile` (like `TowCompanyProfile`): owner account, verification, documents, address + pin, opening hours, services, public profile.
- `GarageMechanic` (like `TowDriver`): invited by the garage, own login, skills + certificate review per person, availability.
- Assignment: the request goes to the garage; the owner assigns a mechanic (or auto-assign the first free one with the skill), with offer + timeout like tow.
- Capacity: bays / max open jobs per garage instead of the per-person cap of 3.
- Privacy and payouts: the customer sees the garage plus the assigned mechanic's first name; the money goes to the garage, not to the mechanic **[PAY]**.
- Admin: garage applications go into the same review queue as tow/parts (the super admin Requests overview gets a "Garage applications" row).

## 3. What mechanics need to reach the tow level (ordered)

| # | Item | Garage | Independent | Blocks |
|---|---|---|---|---|
| 1 | In-app notifications on every transition (+ Expo push later, platform-wide) | ✓ | ✓ | |
| 2 | Offer deadline + expiry / re-offer (no request stuck in REQUESTED) | ✓ | ✓ | |
| 3 | Per-request chat (history kept after the job) | ✓ | ✓ | |
| 4 | Quote: mechanic sends price (labour + parts lines, ILS) → customer approves before work | ✓ | ✓ | **[PAY]** |
| 5 | Final invoice at completion (lines, total, currency) + customer confirms completion | ✓ | ✓ | **[PAY]** |
| 6 | Cancellation reasons + rules per stage (who may cancel when; fees later) | ✓ | ✓ | **[PAY]** |
| 7 | Problem report → admin reports (dispute basis) | ✓ | ✓ | **[PAY]** |
| 8 | Richer statuses: on-site EN_ROUTE/ARRIVED; workshop CAR_RECEIVED → DIAGNOSING → WAITING_FOR_APPROVAL/PARTS → READY_FOR_PICKUP | ✓ | ✓ | |
| 9 | Live location + ETA for on-site jobs (reuse the tow driver location endpoint/map) | ✓ | ✓ | |
| 10 | Rating/review per completed job, shown on the public profile | ✓ | ✓ | |
| 11 | Workshop pin + on-site coverage radius; "nearest available for skill X" | ✓ | ✓ | |
| 12 | Availability toggle + working hours | ✓ | ✓ | |
| 13 | Admin: request list/history/detail, admin cancel, reports, live map | ✓ | ✓ | |
| 14 | Garage model: profile, invited mechanics, assignment, capacity (§2) | ✓ | — | **[PAY]** (payee) |
| 15 | Link the request to the customer's garage car (make/model/year/VIN/mileage) | ✓ | ✓ | **[AI]** |
| 16 | Attachments on the request (photos, audio of the noise, short video) | ✓ | ✓ | **[AI]** |
| 17 | Structured problem input (symptom category, warning lights, OBD codes if known) | ✓ | ✓ | **[AI]** |
| 18 | Structured outcome by the mechanic (diagnosis category, work done, parts used) | ✓ | ✓ | **[AI]** **[PAY]** |
| 19 | Consent to use request data for diagnosis models (privacy rule) | ✓ | ✓ | **[AI]** |

## 4. Summary of blockers
- **Online payment [PAY]:** quote + customer approval (4), final invoice + completion confirmation (5), cancellation/fee rules (6), disputes via reports (7), payee = garage vs mechanic (14), structured work/parts record (18). Tow has none of 4–6 either, so payment needs a shared "price → approve → invoice" piece for both.
- **AI diagnosis [AI]:** a request linked to a real car (15), media attachments (16), structured symptoms (17), structured mechanic outcomes to learn from and check against (18), and consent (19). Without 18 there is no ground truth to evaluate an AI suggestion against.
- Not blockers, but needed for parity: 1–3, 8–13.
