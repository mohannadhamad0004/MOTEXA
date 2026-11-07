# Feature 2: shop accessories in 3D on the customer's car

Implemented on `ui/blueprint`, 2026-11-05, uncommitted. It reuses the Feature 1 pipeline (`MESHY-INTEGRATION.md`): Meshy client, private storage,
GLB safety checks, lease/checkpoint worker, exact-revision visual review, explicit paid opt-in, mock-never-publishes. No new app packages.
The body-kit fit test is in `bodykit-test/e36/VERDICT.md`.

## Lifecycle

`DRAFT` → (shop: Submit for 3D, consent) `PENDING_REVIEW` → (Parts Admin checked photos) `APPROVED_FOR_GENERATION` → (Parts Admin
explicitly starts; real = paid, needs `VEHICLE3D_MODE=real` + `MESHY_ALLOW_PAID_GENERATION=1` + key + "confirm paid" + shop monthly cap)
`GENERATING` → worker: provider task → download → `normalizeAccessory` → six-view preview on a fitting car → `READY_FOR_FINAL_REVIEW`
→ `PUBLISHED` (exact modelRevision, preview of that revision, visual confirmation, real Meshy result only) or `REJECTED` (notes) or
regenerate (→ `APPROVED_FOR_GENERATION`). A provider failure returns to `APPROVED_FOR_GENERATION` with the error. The shop edits only in
DRAFT / REJECTED; "Edit and resubmit" returns to DRAFT and stops serving a published model.

Duplicate / restart protection (same as Feature 1): start is a row-locked state transition (a second click returns the running job); the
worker claims with `FOR UPDATE SKIP LOCKED` + 180 s lease; a task id is saved before polling, so a restart resumes polling; a claim found
in `REQUESTING` without a task id fails closed (`PROVIDER_REQUEST_UNCONFIRMED`) and is never POSTed again automatically.
Credit cap: paid starts are counted per shop per calendar month (audit `ACCESSORY3D_PAID_START`), default 5, Parts Admin can change it.

## Data (migration `20261105120000_product_accessory_3d`, additive only)

- enums `AccessoryType` (11 types) and `Accessory3DStatus` (7 states)
- `ProductAccessory3D` (one per product): type, real size (`widthMm`, `heightMm`, `depthMm`, `lengthMm`, `rimInches`), installed-photo
  generation + `installed360`, `installedApprovedAt`, status, `revision`, `creditsUsed`, provider/lease/checkpoint fields, private
  model paths, `validation`, `preview`, `publishedFile`
- `ProductAccessory3DFit` (accessory × `VehicleGeneration`), `ProductAccessory3DPhoto` (`PART` 2–4 / `INSTALLED` 1–24, CHECK on kind)
- `AccessoryFitZone` (model3dKey × type → zone JSON): admin-tuned zones, merged into `GET /catalog/3d-models`; seeded with the E36 front bumper
- `AccessoryFitAdjust` (customer × product → Adjust values)
- `PartsShopProfile.accessory3dMonthlyCredits INT NOT NULL DEFAULT 5`

## Endpoints (all under `/api`, guards per route)

| Who | Method + path | Purpose |
|---|---|---|
| Shop | `GET /parts/me/products/:productId/accessory-3d` | eligibility (Body / Exterior accessories / Wheels) + accessory |
| Shop | `PUT …/accessory-3d` | type, fits generations, real size, installed-photo car, 360 flag |
| Shop | `POST …/accessory-3d/photos/:kind` · `DELETE …/photos/:photoId` | photos (re-encoded, EXIF/GPS stripped, private) |
| Shop | `POST …/submit` (`consent: true`) · `POST …/revise` · `DELETE …/accessory-3d` | submit / back to draft / delete |
| Shop | `GET …/assets/:asset` | own private photos, model, `preview-<view>` |
| Parts Admin | `GET /admin/parts/accessory-3d` · `GET …/:id` · `GET …/:id/assets/:asset` | queue, detail, private assets |
| Parts Admin | `POST …/:id/approve` · `reject` · `start` (`confirmPaid`) · `preview` (`generationId`) · `regenerate` · `publish` (`visuallyVerified`, `modelRevision`) | review |
| Parts Admin | `PUT /admin/parts/shops/:id/accessory-3d-credits` | monthly cap |
| Parts Admin | `GET /admin/parts/accessory-zones` · `PUT /admin/parts/accessory-zones/:key/:type` (`zone` or `null` = reset) | zone editor |
| Customer | `GET /catalog/products/:productId/accessory-3d` | published model, fits, approved installed photos |
| Customer | `GET/PUT /catalog/products/:productId/accessory-3d/adjust` | Adjust per customer + product (bounded) |
| Any signed-in | `GET /catalog/accessory-3d/photos/:photoId` | an approved installed photo |
| Public | `GET /api/3d/accessories/acc-<sha16>.glb` | served only while the product's accessory is PUBLISHED and not hidden |

## Viewer (`mobile/src/features/car3d/sceneHtml.ts`)

One accessory at a time (`state.kit = {type, file, size, paintMatch, adj}`). Zones: `model.zones[TYPE]` = `{meshes?, box?}` (fractions of the
car's box, y from the ground, z 0 = rear / 1 = front); defaults FRONT/REAR_BUMPER 12 % × 45 %, SIDE_SKIRTS lower 15 % between the wheels,
LIP / DIFFUSER bottom edges, FLARES / RIMS at the 4 wheels (wheel meshes clustered into quadrants, so one combined wheel mesh works),
WING 10 % / SPOILER 3 % in from the rear on the body surface, ROOF_RACK on the roof peak, MIRROR_COVERS on mirror-named meshes.
Body kits (bumpers, skirts) use separate named meshes when they really hold the zone, else the painted shell is cut exactly at the zone
faces and hidden while the part is on. Fit: longest axis → across (or along) the car, front/back from the bulge, uniform scale to the zone,
≤ 15 % per axis; bumpers align on the top edge. Add-ons attach (real size scales them). Paint to match = car paint on the part's main
material. Adjust = move / rotate / scale on top (mirrored for left copies). A fit failure only posts `fitError`; the car keeps showing.

## Part maps: general stock-part replacement (2026-11-06)

Every catalog car is split into **pieces** by the real viewer code (`sceneHtml.ts` `segment`): its meshes, then connected components inside
each mesh (vertices welded by world position at 1 mm). Piece id = `m<mesh index in the loaded file>c<component order>`; the same file and
code always give the same ids (tested), so a map is tied to the file's **sha256**.

- **Auto-label (proposal only)**: `PART_RULES_JS` (`autoLabel`): position/size rules in fractions of the car box (front/rear bumper at the
  ends below headlight height, spoiler on the top-rear deck, skirts low between the wheels, mirrors near the A-pillars, wheels = round
  corner pieces + what sits inside them minus brakes, roof rails on top). Names count only when the piece is most of its mesh (the E36
  exports its whole shell as `..._bumper_R_trim_...`) and only where the shape fits. Pieces lying inside a bumper / spoiler go with it
  (grille insert, fog lights, 3rd brake light), mechanical parts never. Confidence 0.9 name+shape, 0.6 shape, lowered for one side only /
  missing wheel corners / many candidates.
- **Data** (migration `20261106120000_car_part_map`, additive): `CarPartMap` (model3dKey PK, modelSha256, pieces, dims, proposal, map,
  confirmedAt, confirmedByUserId). Audit actions `PART_MAP_SEGMENTED / CONFIRMED / UNCONFIRMED`.
- **When**: after every catalog publish (imports + customer submissions, background), for any active model without a current segmentation
  when the Parts Admin opens the list, `POST .../segment` (button "Split into parts again"), or `npx tsx scripts/part-maps.ts [--force]`.
  A new file revision drops the old map (ids would be meaningless).
- **Endpoints** (Parts Admin): `GET /admin/parts/part-maps`, `GET /admin/parts/part-maps/:key`, `POST /admin/parts/part-maps/:key/segment`,
  `PUT /admin/parts/part-maps/:key` `{ modelSha256, map }` (`map: null` = unconfirm). Customers: a CONFIRMED map whose sha256 equals the
  served file rides in `GET /catalog/3d-models` as `partMap`; everything else falls back to zones.
- **Viewer**: a confirmed map splits each label's triangles into its own mesh at load (before any zone cut). Accessory ON hides its label
  (WING/SPOILER -> SPOILER, FRONT_BUMPER -> FRONT_BUMPER, REAR_BUMPER -> REAR_BUMPER, SIDE_SKIRTS, MIRROR_COVERS -> MIRRORS,
  RIMS -> WHEELS except tyre-named pieces, ROOF_RACK -> ROOF_RAILS) and fits to their bounds (add-ons: centre of the removed part, its
  width unless the shop gave a real width, then resting on the body); OFF shows them again. FRONT_LIP / REAR_DIFFUSER only take the
  bumper's bounds as their position (hiding a whole bumper for a lip would leave a hole). A label the map leaves empty, an unconfirmed
  map, or a one-piece (Meshy / scan) car uses the zone cut, still editable.
- **Editor**: `/dept/accessory-zones` -> "Part map" (default tab): confirmed count, car chips (tick = confirmed), label chips with counts and
  proposal confidence, the car with every piece coloured by label (chosen label bright, others dimmed, grey = none); a tap raycasts to the
  piece and toggles it in the chosen label; Confirm / Clear label / Back to the proposal / Unconfirm / Split again. "Zones (fallback)" tab =
  the old box editor.
- **Root cause of the E36 failure**: the stock spoiler is one connected component (`m109c1`, 4,576 triangles) of the body-paint mesh, bounds
  x 0.145-0.855, y 0.705-0.797, z 0.010-0.083; the saved replace box was x 0.16-0.84, y 0.735-0.90, z 0-0.075, so the cut left its base
  strip, both ends and its front edge. The old test only counted vertices inside that same box, so it passed.
- Evidence: `docs/3d/bodykit-test/e36-partmap/` (`wing/` g = wing on, g2 = stock hidden + wing invisible, h = off; `bumper/`; `editor/`).

## Auto-fit: accessories placed from the car's real geometry (2026-11-06)

One function in the viewer, `fitAccessory(car, src, type, size, zone)` (`sceneHtml.ts`; pure rules in `FIT_RULES_JS`, tested):

- **Wing / lip spoiler / roof rack**: the mount surface from rays seen from above (double-sided ray targets, so flipped single-sided panels
  count; each point the median of three rays 15 cm apart, so an antenna is not the roof; holes in the mesh dropped). Body type from the
  centreline profile: **sedan** (a boot lid between the rear edge and the rear window base, >= 4 % of the length) -> feet 10 % into the lid
  (lip spoiler 3 %), never over its edge, never past its middle, and a boot-lid wing never hangs behind the car; **hatch / SUV / van /
  estate** (roof runs to the rear) -> the top of the tailgate (roof-spoiler position); **pickup** (long low bed) -> no rear wing by default
  (fit error). Roof rack: the roof peak (or the mapped roof rails). The part's **feet** = its lowest 5 %, clustered left / right. **Scale**
  (uniform): the smallest of blade 92 % of the mount width (the lid / roof incl. its rounded edges), feet inside 85 % of it, 98 % of the
  body width there, the shop's real width when smaller, the height cap (wing 0.45 m, spoiler 0.15 m, rack 0.30 m above the surface).
  **Pitch** follows the slope (lid under a sedan wing's feet, else just ahead of the feet), at most 10 deg; every foot point is ray-cast down
  and the part lowered until the closest touches, then rolled (<= 3.4 deg) so the other foot touches too. A foot that would rest under glass
  (a cabin shelf) is a fit error, never a hidden part. Contact shadow (soft blob) under each foot.
- **Front lip / diffuser**: under the (mapped or zone) bumper, rays UP from the part's top until it touches the bumper's bottom edge.
- **Side skirts / bumpers**: the removed stock parts' bounds (part map or zone), as before. Rims / flares / mirrors: wheels / mirrors, as before.
- **Paint to match**: a clone of the car's OWN paint material (same metalness / roughness / clearcoat), without its normal map.

**Stored once** (migration `20261106180000_accessory_auto_fit`, additive): `AccessoryAutoFit` (accessory x generation: fit, carRevision =
sha256(model file + runtime config incl. zones / confirmed part map), partRevision, fitVersion, adj, approvedAt). Computed by the real viewer
headless (`accessory-fit-check.mjs --views=fit`) after publish (background), when the review preview is rendered, and when the Parts Admin
opens the fits of a car (missing / stale only). Bumping `FIT_VERSION` in sceneHtml.ts makes every stored fit stale -> recomputed.
The app replays the stored fit (`kit.fit`, validated in the viewer; a stale or malformed one is ignored and the part is fitted live) with
the Parts Admin's correction (`kit.baseAdj`) and the customer's Adjust on top (`kit.adj`; "Reset to auto-fit").

Endpoints: `GET /admin/parts/auto-fits?model3dKey=`, `PUT /admin/parts/auto-fits/:accessoryId/:generationId` `{ adj | null }` (approve;
null = reset to auto-fit); customers: `GET /catalog/products/:productId/accessory-3d?generationId=` adds `autoFit: { fit, adj }`.
Screen: `/dept/accessory-zones` -> **Accessory fits** (car model -> accessory: metrics, 3D, correction rows, Approve / Reset to auto-fit).

Evidence: `docs/3d/bodykit-test/autofit/` (`before/`, `after/` six views per car, `after-detail/` E36 close-ups + paint to match,
`types/` roof rack / spoiler / lip / diffuser / skirts with stand-in parts, `admin/` the admin tab EN/AR light/dark).

## Bumpers and body kits (2026-11-07)

- **Types**: FRONT_BUMPER / REAR_BUMPER (single products, `kitPart` MAIN) and **body kits** = one product with a FRONT and / or a REAR
  bumper, each its own 3D part (`ProductAccessory3D.kitPart`, unique per product + part; a DB CHECK keeps FRONT = front bumper,
  REAR = rear bumper). Same shop flow per part (`?part=FRONT|REAR` on every shop route: photos, consent, Meshy, review, publish).
- **Car-specific**: a bumper needs exact generations (never empty fits) and a non-Universal product (save and submit refuse otherwise).
- **"Replace" fit** (`sceneHtml.ts` `fitBumper`): only from the car's CONFIRMED part map (no map / no bumper label = "3D preview not
  available for this car": no "View on my car", no zone fallback). The new bumper takes the stock bumper's place: width by one uniform
  scale, at most +-5 % stretch in height / depth, top edge on the stock top edge, face on the stock face. Then **visible edge gaps**: the
  stock bumper's seam (its vertices within ~2 cm of the rest of the car: fenders / arches, lights, bonnet / boot line) against the new bumper
  flattened onto the plane you look at that edge from (front / rear view; side view for fenders and arches), within +-20 cm depth. p90 of a
  region > 10 mm, or reaching > 30 mm deeper into the car than the stock bumper -> fit error ("does not fit this car cleanly"), stored as a
  failed fit, shown to the admin with the reason; the customer keeps the stock bumper and gets a note.
- **Several parts at once**: the viewer takes `state.kits` (a kit's bumpers), each switched on / off on its own (its stock bumper comes back
  when off), Paint to match, Adjust per part (customer Adjust stored per part inside the same JSON column), "Reset to auto-fit".
  A part that failed on a car is not retried until the car / kit changes.
- **Stored fit / admin**: unchanged mechanism (`AccessoryAutoFit` per accessory part x generation; failures stored too).

Test (no Meshy yet, waiting for the photos in `docs/3d/bodykit-test/e36-bumper/` and approval of the credits): the ready-made CC BY
E36 M3 front bumper on the E36 = pass (bonnet line p90 0 mm / max 21.6 mm over 481 seam points, fenders 0 mm, stretch 1 / 1.05 / 0.966);
an E46 bumper = refused (fender / arch gap 20.7 mm); the wing as a "bumper" = refused (60 mm). Evidence: `bodykit-test/e36-bumper-fit/`.

## Screens

- Shop: product edit → **Show it in 3D on customers' cars** → `/provider/parts/accessory-3d/[productId]` (type, fits search, size, installed
  car + 360 flag, photo tips, consent, Submit for 3D, status, private six-view preview, Edit and resubmit).
- Parts Admin: Parts home → **Shop accessories in 3D** → `/dept/accessory3d` (filters) → `/dept/accessory3d/[id]` (photos, approve/reject,
  start with paid confirmation + credits left, preview on any fitting generation that has a 3D car, verify + publish, regenerate, monthly cap);
  `/dept/accessory-zones` (per car model and type, box editor, reset).
- Customer product page: **View on my car** (published + Garage car's generation fits + that generation has a 3D car), else
  "This part doesn't fit your <car>", no button when there is no 3D; **Installed look** gallery with "Shown on your car model" /
  "Shown on <generation>", 360° drag-to-spin for a 12+ set. `/customer/car3d?product=…` shows the part with On / Paint to match (rims: the shop's finish) and the
  reset view (double-tap). Adjust is Parts Admin only (`/dept/accessory-zones` → Accessory fits); offsets customers saved earlier stay in
  `AccessoryFitAdjust` but are no longer applied.

## Rims (STEP RIMS, 2026-11-06)

One rim part, drawn ×4. Product data (`ProductAccessory3D`, migration `20261109090000_accessory_rim_specs`, additive): `rimInches` (required
to submit), optional `rimWidthIn`, `rimPcd` ("5x112"), `rimOffsetMm` (ET), `rimFinish` (SILVER / BLACK / GUNMETAL / CHROME). Fitment:
exact generations, or **Universal by size** = a rim on a Universal product (no generation list; fitted and auto-fitted on every
published generation with a 3D car; customers see "Check PCD/offset with the shop before buying."). Rims never take paint to match:
the shop's finish is the material of the rim's main surface. The product page shows the filled-in specs.

Viewer (`wheelParts` + `fitRims` in `sceneHtml.ts`):
1. Wheels: confirmed part map WHEELS, else meshes named wheel / rim / tyre (EN/DE/ES/FR/PT, e.g. Pneu / Roda), else round pieces
   standing on the ground at the corners. Only the outer quarter of the car's width counts (a "roda" mesh may also hold the steering
   wheel; one tyre mesh may hold all four). The centre is then re-measured from the tyre's tread ring.
2. Per wheel, every mesh wholly inside the wheel's cylinder: tyre (named, or a ring reaching the tread), brake (named brake / disc /
   caliper / freio, or sitting inboard of the spokes) and rim (the rest). Measured: tyre outer diameter, tread width and centre, outer
   face, the inner edge of the outer sidewall; stock rim diameter and face.
3. Hidden: the stock rims. Kept: the stock tyres when they are their own piece AND the rim size is unchanged; else the whole wheel is
   hidden and a tyre is built in code (lathe, dark rubber, stock outer diameter + width) around the new rim, so a wheel is never empty.
   Brakes stay unless they (or a hub / bolt piece) reach past the back of the new rim's spokes: those would show through and are hidden.
4. Rim: on the axle, face at the stock rim's face, mirrored left / right, diameter = the stock rim's (or × product inches / measured
   stock inches), never wider than the tyre. Fit errors: < 20 mm of sidewall left, face past the tyre face, or past the arch further
   than the stock wheel. A model whose four wheel centres differ > 3 cm in height (steered front wheels) or with an odd tyre width
   (< 12 or > 40 cm) gets "3D preview not available" instead of a guess.
5. Stored per accessory × generation (auto-fit, `keep` = stock tyres kept, `hideMore` = clashing pieces, `tyres` = built tyres);
   Parts Admin "Accessory fits" shows it (with Adjust for the admin).

Measured on the catalog (CC BY BBS RS16 test rim, stock size; full list `.private/rims/all2.log`, evidence for E36 / W212 / A4 B5 /
Peugeot 208 in `docs/3d/bodykit-test/rims-fit/`): 17 of 21 active cars fit; Peugeot 308 refused (steered front wheels); Camry XV70,
Corolla E210, C-HR refused until their part map is confirmed (wheels merged into big meshes; with their stored proposals they fit,
one-piece wheel + built tyre). Test: `backend/tests/rims-viewer.test.mjs`.

Wheel inset (per car, Parts Admin "Accessory fits" → a rim row → "Wheel inset"): stored in the car's RIMS zone as
`wheelInsetMm: {front, rear}` (whole mm, 0-40; only RIMS takes it). While rims are on, the whole wheel moves inward per axle: the new rim,
a built tyre, and kept stock tyres (moved by name, `fit.shift`; only when each tyre mesh is one side + one axle and uniquely named, else
built tyres). Rims off = everything back exactly. Each rim fit measures the stock tyre face vs the fender per wheel (`tyreToFenderMm`,
< 0 = outside) and suggests the per-axle inset that makes it flush (`wheelInset.suggested`); the admin previews a draft live and saves it.
The car revision seen by other fitter types ignores the RIMS zone (`revisionOf`), so an inset never makes a wing / bumper fit stale.
Was applied on the dev DB to 5 cars (E36 16/29, X5 E53 7/7, W203 2/0, Fabia 3/9, Octavia 0/4 mm); since RIMS-GENERAL the move is automatic
and these overrides were reset on 2026-11-07 (no car has an inset now; the admin override stays available). Evidence: `docs/3d/bodykit-test/rims-fit/bmw-3-series-e36/wheel-inset/`.

Fit versions are per fitter group (`FIT_VERSIONS` + `FIT_GROUPS` in `sceneHtml.ts`, parsed by the server): rims / wings (wing, spoiler,
roof rack) / bumpers / other. Bump only the group whose fitter changed: only that group's stored fits go stale and are recomputed
automatically (admin fits list, publish); approved / admin-corrected fits of the other groups stay byte-identical (checked on the dev DB).

## Mock vs real

| | Status |
|---|---|
| Fitting code, zones, cut, paint to match, Adjust | real, used in the app and the admin preview renderer (`scripts/accessory-fit-check.mjs`) |
| E36 + M3 bumper fit test | real files, real viewer code (see verdict) |
| Meshy accessory generation | code path real, **never run live**; tests use a fake provider (no network) |
| Default `VEHICLE3D_MODE` | mock: a plain box stand-in, labelled, never publishable |
| UI checks | isolated browser fixtures (`.private/accessory3d-ui/`), every API call intercepted, nothing written |
| Other 10 accessory types | placement code only; no real part file tested yet |

To run one intentional live accessory generation, follow `MESHY-INTEGRATION.md` (same env switches), then approve and **Start** one
accessory in `/dept/accessory3d` with "confirm paid" ticked.
