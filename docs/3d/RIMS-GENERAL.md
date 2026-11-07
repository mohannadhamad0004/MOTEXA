# Rims: automatic placement on every car (STEP RIMS-GENERAL)

Viewer: `mobile/src/features/car3d/sceneHtml.ts` (rims fitter group, `FIT_VERSIONS.rims` 5 → 6; wings / bumpers / other unchanged).
Test rim: `backend/public/3d/accessories/acc-512a47b76cd1b556.glb` ("Mesh rims 17″" demo product, CC BY BBS RS16, plain cap), 17″, silver.
Data: `docs/3d/rims-general-audit.json` (all numbers, per wheel), made by `backend/scripts/rims-general-audit.ts` (read-only: production
viewer in headless Chrome, each car's runtime config from the DB **with any stored wheel inset removed**, so these are the automatic results).

## How it works (no per-car settings)
1. **Wheels.** A seed only *locates* each wheel: confirmed part map WHEELS, else the stored automatic proposal (now sent as its 40
   biggest pieces per corner), else wheel-named meshes, else round pieces on the ground. Then every connected piece of any mesh lying
   wholly inside that wheel's cylinder belongs to the wheel (a partial proposal, merged wheels and tread made of loose blocks all work).
   In meshes shared with the car only round pieces (9 of 12 sectors), centre pieces, or small rim-face inserts are taken; calipers,
   brackets, liners and underbody bits stay with the car.
2. **Axle.** Per wheel from its tyre ring: PCA, refined to the direction across which the tyre is narrowest (uneven vertex density no
   longer tilts it). Steered / cambered wheels: the rim is turned to that axle. Refused only if the axle cannot be measured.
3. **Arch line.** Rays from outside, sideways (steering removed, camber kept), at 11 angles round the top of the arch (40–140°) and
   growing radii; the first painted-body hit outboard of the tyre centre is the arch edge, the outermost body point 16 mm above it is the
   line; median, outliers dropped.
4. **Move.** The whole wheel (tyre + rim, kept or built tyre) along its own axle so the tyre's outermost point is 5 mm inside the line
   (3–8 mm accepted); max 40 mm either way; the largest safe move: the tyre's real outline swept from stock must not cross the fender,
   inner arch or suspension, and brakes / hubs may not reach further in front of the new rim's spokes than at stock. No safe move = stock
   position + warning. Each wheel separately.
5. **Brakes.** Brake / hub parts that would stand in front of the new rim's spokes (a deeper rim than stock) are hidden while rims are
   on. OFF = the stock model exactly (the rims group removed, hidden meshes shown, nothing edited).
6. **Override.** The Parts Admin per-axle inset (Accessory fits → "Override (mm inward)") replaces the automatic move; "Back to
   automatic" removes it.

## Result: 21 / 21 cars show rims
84 wheels: 79 end 3–8 mm inside the arch line; the other 5 (E36 ×3, Camry XV70 front ×2) say why (below). Largest move 34.9 mm.
Arch gap: + = tyre face inside the line, − = outside (mm). Moved: + = outward, − = inward, along the wheel's axle.
"Old inset" = the per-car inset still stored in the dev DB from the previous step (ignored in this table; see *Open*).

| Car | Wheels from | Arch gap before → after | Moved | Tyre | Old inset | Limits / notes |
|---|---|---|---|---|---|---|
| audi-a4-b5 | proposal | FL +27.7 → +5<br>FR +31.7 → +5<br>RL +8.3 → +5<br>RR +12.4 → +5 | FL +22.7<br>FR +26.7<br>RL +3.3<br>RR +7.4 | built |  | FL: 2 brake part(s) hidden<br>FR: 2 brake part(s) hidden<br>RL: 4 brake part(s) hidden<br>RR: 3 brake part(s) hidden |
| audi-q3-8u | proposal | FL +35.1 → +5<br>FR +35.1 → +5<br>RL +34.9 → +5<br>RR +34.9 → +5 | FL +30.1<br>FR +30.1<br>RL +29.9<br>RR +29.9 | built |  | FL: 1 brake part(s) hidden<br>FR: 1 brake part(s) hidden<br>RL: 1 brake part(s) hidden<br>RR: 1 brake part(s) hidden |
| bmw-3-series-e36 | confirmed | FL +20 → +13.2<br>FR +16 → +11.6<br>RL +14.1 → +11.8<br>RR +9 → +5 | FL +6.7<br>FR +4.4<br>RL +2.3<br>RR +4 | built | F 16 / R 29 | FL: limited, by fender (E36_coupe_bumper_R_trim_BM)<br>FR: limited, by inner arch/suspension (E36_coupe_bumper_R_trim_BM)<br>RL: limited, by inner arch/suspension (E36_coupe_bumper_R_trim_BM) |
| bmw-x5-e53 | proposal | FL +3.7 → +5<br>FR +6.3 → +5<br>RL +19.4 → +5<br>RR +22 → +5 | FL -1.3<br>FR +1.3<br>RL +14.4<br>RR +17 | built | F 7 / R 7 | RL: low axle confidence<br>RR: low axle confidence |
| hyundai-accent-lc | proposal | FL +31.5 → +5<br>FR +21.9 → +5<br>RL +33.8 → +5<br>RR +24 → +5 | FL +26.5<br>FR +16.9<br>RL +28.8<br>RR +19 | built |  | — |
| mercedes-c-class-w203 | proposal | FL -1.6 → +5<br>FR +24 → +5<br>RL -2.2 → +5<br>RR +23.4 → +5 | FL -6.6<br>FR +19<br>RL -7.2<br>RR +18.4 | stock | F 2 / R 0 | — |
| mercedes-e-class-w212 | proposal | FL +2.3 → +3.3<br>FR +2.3 → +3.3<br>RL +10.5 → +5<br>RR +10.5 → +5 | FL -0.9<br>FR -0.9<br>RL +5.5<br>RR +5.5 | built |  | FL: limited, by brake/hub, low axle confidence, 2 brake part(s) hidden<br>FR: limited, by brake/hub, low axle confidence, 2 brake part(s) hidden<br>RL: low axle confidence, 2 brake part(s) hidden<br>RR: low axle confidence, 2 brake part(s) hidden |
| mercedes-vito-w447 | proposal | FL +29.3 → +5<br>FR +29.3 → +5<br>RL +23.4 → +5<br>RR +31.9 → +5 | FL +24.3<br>FR +24.3<br>RL +18.4<br>RR +26.9 | stock |  | — |
| opel-corsa-b | proposal | FL -4.3 → +5<br>FR -4.7 → +5<br>RL +4.9 → +4.9<br>RR +4.9 → +4.9 | FL -9.3<br>FR -9.7<br>RL 0<br>RR 0 | built |  | — |
| peugeot-208-2nd-gen-p21 | proposal | FL +27.4 → +5<br>FR +27 → +5<br>RL +39.9 → +5<br>RR +39.5 → +5 | FL +22.4<br>FR +22<br>RL +34.9<br>RR +34.5 | built |  | — |
| peugeot-308-2nd-gen-t9 | proposal | FL +33.3 → +5<br>FR +27.4 → +5<br>RL +27.7 → +5<br>RR +12.5 → +5 | FL +28.3<br>FR +22.4<br>RL +22.7<br>RR +7.5 | built |  | FL: 1 brake part(s) hidden<br>FR: 2 brake part(s) hidden<br>RL: 2 brake part(s) hidden<br>RR: 2 brake part(s) hidden |
| renault-fluence-l38 | proposal | FL +31.9 → +5<br>FR +33.1 → +5<br>RL +31.7 → +5<br>RR +32.9 → +5 | FL +26.9<br>FR +28.1<br>RL +26.7<br>RR +27.9 | stock |  | — |
| skoda-fabia-mk2-5j | proposal | FL -4.7 → +5<br>FR -4.7 → +5<br>RL -13.4 → +5<br>RR -13.4 → +5 | FL -9.7<br>FR -9.7<br>RL -18.4<br>RR -18.4 | built | F 3 / R 9 | — |
| skoda-octavia-mk2-1z | proposal | FL +1.4 → +5<br>FR -1 → +5<br>RL -2.2 → +5<br>RR -4.6 → +5 | FL -3.6<br>FR -6<br>RL -7.2<br>RR -9.6 | built | F 0 / R 4 | — |
| toyota-c-hr-1st-gen | proposal | FL +11.1 → +5<br>FR +11.1 → +5<br>RL +11 → +5<br>RR +11 → +5 | FL +6.1<br>FR +6.1<br>RL +6<br>RR +6 | built |  | FL: 1 brake part(s) hidden<br>RL: 1 brake part(s) hidden |
| toyota-camry-xv20 | proposal | FL +9.3 → +5<br>FR +20.9 → +5<br>RL +4.3 → +5<br>RR +16 → +5 | FL +4.3<br>FR +15.9<br>RL -0.7<br>RR +11 | stock |  | FL: 1 brake part(s) hidden<br>RL: 1 brake part(s) hidden<br>RR: 1 brake part(s) hidden |
| toyota-camry-xv70 | proposal | FL +0.8 → +0.8<br>FR +0.8 → +0.8<br>RL +2.8 → +5<br>RR +3.1 → +5 | FL 0<br>FR 0<br>RL -2.2<br>RR -1.9 | built |  | FL: kept stock, by inner arch/suspension (Object_5)<br>FR: kept stock, by inner arch/suspension (Object_5) |
| toyota-corolla-e170-e180 | proposal | FL +17.6 → +5<br>FR +17.6 → +5<br>RL +14.6 → +5<br>RR +14.6 → +5 | FL +12.6<br>FR +12.6<br>RL +9.6<br>RR +9.6 | built |  | FL: low axle confidence<br>FR: low axle confidence<br>RL: low axle confidence<br>RR: low axle confidence |
| toyota-corolla-e210 | proposal | FL +3.2 → +5<br>FR +3.2 → +5<br>RL +7.1 → +5<br>RR +7.1 → +5 | FL -1.8<br>FR -1.8<br>RL +2.1<br>RR +2.1 | built |  | — |
| volkswagen-caddy-sb-latest | proposal | FL +3.7 → +4.7<br>FR +3.7 → +4.7<br>RL +3.7 → +4.7<br>RR +3.7 → +4.7 | FL -1<br>FR -1<br>RL -1<br>RR -1 | built |  | FL: limited, by brake/hub, 2 brake part(s) hidden<br>FR: limited, by brake/hub, 1 brake part(s) hidden<br>RL: limited, by brake/hub, 1 brake part(s) hidden<br>RR: limited, by brake/hub, 1 brake part(s) hidden |
| volkswagen-polo-mk4-9n | proposal | FL +27 → +5<br>FR +26.8 → +5<br>RL +17.6 → +5<br>RR +17.4 → +5 | FL +22<br>FR +21.8<br>RL +12.6<br>RR +12.4 | stock |  | FL: 1 brake part(s) hidden<br>FR: 1 brake part(s) hidden<br>RL: 1 brake part(s) hidden<br>RR: 1 brake part(s) hidden |

Not at 3–8 mm: E36 FL / FR / RL end 12–13 mm inside (the fender lip / black arch liner curls down over the tyre: only 2–7 mm outward
is free), Camry XV70 front stays 0.8 mm inside (the inner arch is 1.6 mm away). Limited but inside the band: W212 front 3.3 mm (its brake
disc hat already reaches into the deep test rim at stock), Caddy 4.7 mm (calipers). "Tyre built" = the product is 17″ and the car's stock rim another size (the stock tyre is kept on
Vito, Fluence, Camry XV20, Polo, W203). Low axle confidence = a warning only (the axle is still measured).

Steered wheels: none of the 21 models has its wheels steered (largest measured yaw 0°). Checked by turning the E36 front wheels 15° in
the test harness (`--steer=15`): axle read as 14.9°, rims follow it, arch measured (the turned tyre's corner 43–48 mm outside, the strut
blocks the inward move: stock position + warning). Screens: `rims-general/bmw-3-series-e36/steer/`.

## Screenshots (`docs/3d/rims-general/<car>/`)
Before / after, front three-quarter and side: `before-front-three-quarter.png`, `before-side.png`, `on-front-three-quarter.png`,
`on-left-side.png` (+ `on-right-side`, `on-rear`, `on-wheel-closeup`, and the `off-*` set = rims off, stock car back) for E36, W212,
A4 B5, Peugeot 208, Peugeot 308 and Corolla E210. Admin screen (390 px, EN/AR × light/dark): `rims-general/ui/`.

## Open
- ~~Old per-car insets still in the dev DB~~ **Cleared 2026-11-07** (FIT-QA tiers step): the 5 overrides (E36 16/29, X5 7/7, W203 2/0,
  Fabia 3/9, Octavia 0/4) were reset through the same service call as "Back to automatic" (audited ZONE_RESET as the Parts Admin who set
  them); no RIMS zone is left, every car uses the automatic move.
- Not checked on a phone (Expo Go). The 3D numbers come from the same viewer code in headless Chrome.
- Admin routes fix: `/api/admin/parts/part-maps` and `/api/admin/parts/auto-fits` were not routed (404) by `server.ts`; now they are.
