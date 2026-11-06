# Body-kit fit test — BMW 3 Series E36 + M3 front bumper (2026-11-05)

**Car:** `bmw-3-series-e36` (active catalog model, Black Snow, CC BY 4.0).
**Part:** "(FREE) BMW E36 M3 front bumper" by slay, CC BY 4.0, https://sketchfab.com/3d-models/free-bmw-e36-m3-front-bumper-1360894f703943e3a19b82b90c166d89
(source GLB `3d-source/accessory-photos/test/free_bmw_e36_m3_front_bumper.glb`, 1.9 MB, 4 meshes, ~23k vertices, unpublished).

**How it was rendered:** `backend/scripts/accessory-fit-check.mjs --views=test` using the real mobile viewer code (`sceneHtml.ts`:
`build` → `buildAccessory` → `kitApply`), local Three.js r160 and headless Chrome. No hand placement: zero Adjust values.
Evidence (hashes, fit numbers): `fit-evidence.json`.

## What the fitter did

- Separate bumper mesh? **No.** The E36 bumper skin is part of the body shell mesh (`E36_coupe_bumper_R_trim_*`, which holds the whole body despite the name).
  The fog lights and plate are named `bumper_F2_*`, but there are fewer of them than shell vertices in the zone, so the fitter cuts the shell.
- Cut: painted body triangles inside the zone are split off exactly at the zone faces and hidden; 14 meshes hidden in total (cut pieces + fog lights, plate, radiator inside the zone).
- Part: turned 90° (its long axis was depth) and flipped 180° (the middle bulges forward), uniform scale 0.150, then +15 % height (the clamp limit) and −10 % depth.
  Aligned on the zone's top-front-centre.

## Screenshots

| File | View |
|---|---|
| `a-original-front-34.png` | original car |
| `b-part-on-front-34.png` | bumper on, the part's own finish (the author's material is blue) |
| `c-part-on-front.png` | front |
| `d-part-on-side.png` | side |
| `e-paint-to-match-34.png`, `e2-paint-to-match-red-34.png` | paint to match (silver, red) |
| `f-edge-closeup.png`, `f2-edge-closeup-side.png` | joint with the front fender, close |
| `z-default-zone-front-34.png`, `z-default-zone-side.png` | same part with the **untuned default zone** (12 % length × 45 % height) |

## Honest verdict

- **Normal viewing distance (3/4, front, side): convincing.** The M3 bumper reads as installed: width matches the car, top line meets the
  headlight/grille line, no holes, paint-to-match blends with the body in silver and red.
- **Close-up: visibly a separate part.** The bumper's side ends in a straight vertical edge just ahead of the wheel arch. There is a
  ~1–2 cm step to the fender and a thin sliver of the cut fender (light strip) shows between the part and the arch. The part also sits
  slightly proud of the fender line. This is a preview quality, not a photo-real fitment.
- **The default zone is NOT good enough for this car.** 12 % × 45 % cut away the fender noses and the headlight surrounds and left the
  engine bay visible (`z-default-*`). A tuned zone (`z 0.905–1, y 0–0.34`) was required. Every car model with a body-kit product
  will need a zone check by a Parts Admin. Tuned zones are admin-editable data for this reason (the E36 front zone is seeded).
- Height needed the full +15 % stretch: this aftermarket bumper is shallower than the stock E36 opening. Any part that needs more than
  15 % shows a gap at the bottom instead of being distorted. That is deliberate.
- Not tested here (no part files): rear bumper, skirts, lip, diffuser, flares, wing, spoiler, rack, rims, mirror covers. Their
  placement code exists and is covered by the mock pipeline only. The first real file of each type needs the same visual check.

**Recommendation:** ship "View on my car" as a labelled preview ("3D preview; real fitment may differ"), and only for parts the
Parts Admin has visually approved on a matching generation with a checked zone. That is what the publish gate enforces.
