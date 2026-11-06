# Live Meshy accessory test: E36 LTW rear wing (2026-11-05)

**TEST ONLY: the source photos are Garagistic's vendor listing photos (no licence, private local dev database, see CREDITS.md). Do not ship this model or these renders.**

## What ran

- Product "Rear wing for BMW E36" (shop@motexa.test, Exterior accessories, ₪450, stock 5), accessory type WING, real width 1300 mm (not stated by the listing), fits E36.
- Input to Meshy: 2 loose-wing photos (`wing-1`, `wing-2`, converted WebP → JPG). 3 installed photos used only for the "Installed look" gallery.
- **Exactly one paid Meshy multi-image task** (started 10:16:58 UTC, PENDING → IN_PROGRESS 45/58/80/99 % → SUCCEEDED at ~10:18:26, about 90 s). Shop credits: 1 / 5.
- The download was refused at first: the GLB was 8.2 MiB, over the 8 MiB `VEHICLE3D_MAX_MB` default (fail-closed, as designed). Fixed by
  adding a free **resume of the same task** (Feature 1 already had it for vehicles) and restarting the backend in normal mode with
  `VEHICLE3D_MAX_MB=12`. No second task, no second credit.
- Result: 130,820 triangles, 1 material, 3 textures, 8.2 MiB, prepared model revision `12b68d69ee8ba8bc`, published as `accessories/acc-7e40b463d76777b8.glb`.

## Tuning

The automatic WING anchor (10 % of the length in from the rear) put the wing at the boot-lid / rear-window line, overlapping the glass
(`z-untuned-default-*`). Two changes:

1. **Tuned WING zone for `bmw-3-series-e36`: box z 0.04–0.10** (saved through the admin zone API, in the DB). Add-on anchors now follow a tuned box (before, only bumpers/skirts used zones).
2. **Rest on the feet:** wing / spoiler / rack now sit on the lower body surface under their two ends instead of the centreline (the boot lid curves down to the sides): −1.9 cm here.

No orientation correction was needed: the end plates are tallest at the rear, like the installed photos.

## Screenshots

`a-original-rear-34`, `b-part-on-rear-34`, `c-part-on-side`, `d-part-on-top`, `e-paint-to-match-rear-34` (silver), `e2-paint-to-match-red-rear-34`,
`f-edge-closeup-foot`, `f2-edge-closeup-side`, `f3-edge-closeup-rear`; `z-untuned-default-*` = before tuning.

## Honest verdict

- **Shape: good for 2 photos.** It is clearly this LTW wing: one-piece blade, swept end plates, correct proportions. Meshy did not invent extra parts or scenery.
- **Surface: visibly AI-generated up close.** The blade and end plates are lumpy/wavy with soft, uneven edges (`f2`) and blotchy baked lighting in the texture; it is not a clean CAD part. At normal app distance (rear 3/4, side) it reads well, especially with **paint to match**, which hides the texture blotches (`e2` looks close to the real installed photos).
- **Fit: acceptable after tuning.** Correct spot on the boot lid, correct width and direction. In the foot close-up a hairline gap (~1 cm) remains at the outer edge because the lid also slopes along the car under the foot; a customer can nudge it with Adjust. The E36 model's own small boot spoiler stays underneath (add-ons never hide car geometry).
- **Size: too heavy for mobile.** 8.2 MiB and 131k triangles for one wing is bigger than most of our cars. It works, but before real use, accessories should get an explicit optimisation step (webp ≤ 1024 textures + meshopt, as in `optimize-3d.ts`), probably to ~1–2 MB.
- **Real width is a guess** (1300 mm); the listing does not state it.

**Overall:** the pipeline works end to end with a real provider (one paid task, private download, validation, preview on the matching car, exact-revision publish, public serving gated on PUBLISHED). The wing is good enough as a labelled "3D preview" at normal distance, not as a close-up product render.
