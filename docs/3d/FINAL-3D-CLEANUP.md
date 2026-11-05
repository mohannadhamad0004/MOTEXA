# Final 3D cleanup

Phase-2 W204 correction: the current C63 candidate has a different hash from the old broken W204. See [C63-AUDIT.md](C63-AUDIT.md). Its final status is REJECT solely because external provenance could not be verified; it remains inactive, so cleanup totals do not change. Both backup-old files remain archived.

Models before cleanup: 120 inventoried, 95 active production GLBs.

Models kept: 21. Models replaced: 0. Models removed: 99 (74 previously active, 25 already held). Remaining active shared models: 21.

No external replacement was selected. Sources and prior modified W204 are backed up privately. Historical PASS is visual evidence, not permission to release previously held assets. Heavy models were removed. No generations were deleted.

Fresh production-viewer renders: 38 initial keep candidates rendered in six views; 29 also rendered in six red-paint views. All final retained models were visually reviewed in both sets. Paint contamination, failed paint isolation, stripped geometry, and poor glazing caused further removals. Local Three.js 0.160.1 only; zero remote requests. Evidence is in ignored 3d-source/audit/final and final-paint. PASS_VARIANT denotes a visibly supported street/facelift/three-door variant, not a generic body/trim. Desktop rendering does not verify real Android performance.

| Key | Make/model/generation | Previous audit status | Final action | Final status | Reason | Replacement source |
|---|---|---|---|---|---|---|
| toyota-corolla-e170-e180 | Toyota Corolla E170/E180 | PASS | KEEP | PASS | Six-view comparison shows upright assembled vehicle, usable body/wheels/materials and shape consistent with mapped generation. | — |
| bmw-1-series-f20-f21 | BMW 1 Series F20/F21 | REPLACE | REMOVE | REMOVED | Existing provenance/quality hold retained; not promoted. Original is severely incomplete/fragmented around front and rear body; prepared remains broken. | — |
| bmw-3-series-e36 | BMW 3 Series E36 | PASS | KEEP | PASS_VARIANT | Six-view comparison shows upright assembled vehicle, usable body/wheels/materials and shape consistent with mapped generation. Verified variant: Street-modified E36. | — |
| bmw-3-series-e46 | BMW 3 Series E46 | UNCERTAIN | REMOVE | REMOVED | Existing keepBox removes exploded alternatives but prepared wheel placement/materials remain questionable. | — |
| bmw-5-series-e34 | BMW 5 Series E34 | REPLACE | REMOVE | REMOVED | Original and prepared both show displaced/missing wheels or major body/trim pieces; source assembly/geometry unsuitable as delivered. | — |
| bmw-5-series-e39 | BMW 5 Series E39 | UNCERTAIN | REMOVE | REMOVED | Source has distant exploded components and miniature framed body; mesh-selection/assembly review required. | — |
| bmw-5-series-e60-e61 | BMW 5 Series E60/E61 | UNCERTAIN | REMOVE | REMOVED | Existing provenance/quality hold retained; not promoted. Source and prepared contain vertically exploded body alternatives; cannot confirm safe component selection. | — |
| bmw-5-series-g30-g31 | BMW 5 Series G30/G31 | UNCERTAIN | REMOVE | REMOVED | Distant exploded geometry dominates bounds in both versions; inspect assembly selection before replacement. | — |
| bmw-x1-f48 | BMW X1 F48 | PASS | REMOVE | REMOVED | Existing provenance/quality hold retained; not promoted. Six-view comparison shows upright assembled vehicle, usable body/wheels/materials and shape consistent with mapped generation. | — |
| bmw-x1-u11 | BMW X1 U11 | PASS | REMOVE | REMOVED | Existing provenance/quality hold retained; not promoted. Six-view comparison shows upright assembled vehicle, usable body/wheels/materials and shape consistent with mapped generation. | — |
| bmw-x3-e83 | BMW X3 E83 | UNCERTAIN | REMOVE | REMOVED | Body surfaces remain partly translucent; material correction feasibility needs review. | — |
| bmw-x3-g01 | BMW X3 G01 | PASS | REMOVE | REMOVED | Fresh renders show patchy/translucent body and glazing surfaces; remove rather than investigate material reconstruction. | — |
| bmw-x5-e53 | BMW X5 E53 | PASS | KEEP | PASS_VARIANT | Six-view comparison shows upright assembled vehicle, usable body/wheels/materials and shape consistent with mapped generation. Verified variant: Restyled/facelift E53. | — |
| bmw-x5-e70 | BMW X5 E70 | UNCERTAIN | REMOVE | REMOVED | Broad paint corrected; source retains pink glazing/material artifacts. Not demo-approved. | — |
| bmw-x5-g05 | BMW X5 G05 | UNCERTAIN | REMOVE | REMOVED | Transparent patchy body in both versions; material correction needs review. | — |
| ford-fiesta-mk6 | Ford Fiesta Mk6 | REPLACE | REMOVE | REMOVED | Original and prepared both show displaced/missing wheels or major body/trim pieces; source assembly/geometry unsuitable as delivered. | — |
| ford-focus-mk1 | Ford Focus Mk1 | UNCERTAIN | REMOVE | REMOVED | Both versions contain multiple separate/overlapping body variants, with incorrect prepared heading; assembly selection needs review. | — |
| ford-focus-mk2 | Ford Focus Mk2 | PASS | REMOVE | REMOVED | Existing provenance/quality hold retained; not promoted. Six-view comparison shows upright assembled vehicle, usable body/wheels/materials and shape consistent with mapped generation. | — |
| ford-focus-mk3 | Ford Focus Mk3 | UNCERTAIN | REMOVE | REMOVED | Monochrome body/wheels and reversed heading; generation shape plausible but materials need review. | — |
| ford-focus-mk4 | Ford Focus Mk4 | PASS | REMOVE | REMOVED | No safe body paint configuration; original-finish-only model removed from the recolorable demo collection. | — |
| ford-kuga-mk2 | Ford Kuga Mk2 | FIX_PIPELINE | REMOVE | REMOVED | Prepared build throws SkinnedMesh missing bone matrixWorld error; original renders, though its orientation/materials also need work. Repair skeleton preservation before replacement decision. | — |
| ford-ranger-t6 | Ford Ranger T6 | PASS | REMOVE | REMOVED | Red-paint comparison changes only part of the body while hood, fenders and wheels remain featureless white; incomplete material handling. | — |
| ford-transit-8th-gen-facelift | Ford Transit 8th gen facelift | PASS | REMOVE | REMOVED | Existing provenance/quality hold retained; not promoted. Six-view comparison shows upright assembled vehicle, usable body/wheels/materials and shape consistent with mapped generation. | — |
| ford-transit-8th-gen-pre-facelift | Ford Transit 8th gen pre-facelift | PASS | REMOVE | REMOVED | Existing provenance/quality hold retained; not promoted. Six-view comparison shows upright assembled vehicle, usable body/wheels/materials and shape consistent with mapped generation. | — |
| hyundai-accent-lc | Hyundai Accent LC | PASS | KEEP | PASS | Six-view comparison shows upright assembled vehicle, usable body/wheels/materials and shape consistent with mapped generation. | — |
| hyundai-accent-x3 | Hyundai Accent X3 | PASS | REMOVE | REMOVED | Existing provenance/quality hold retained; not promoted. Six-view comparison shows upright assembled vehicle, usable body/wheels/materials and shape consistent with mapped generation. | — |
| hyundai-elantra-j2-rd | Hyundai Elantra J2/RD | PASS | REMOVE | REMOVED | Existing provenance/quality hold retained; not promoted. Six-view comparison shows upright assembled vehicle, usable body/wheels/materials and shape consistent with mapped generation. | — |
| hyundai-i10-ac3-ai3 | Hyundai i10 AC3/AI3 | UNCERTAIN | REMOVE | REMOVED | Whole-body material tint and low contrast; inspect material assignment before approval. | — |
| hyundai-i20-pb | Hyundai i20 PB | UNCERTAIN | REMOVE | REMOVED | Several body variants and detached kit pieces share the scene; selection/reassembly feasibility uncertain. | — |
| hyundai-i30-fd | Hyundai i30 FD | PASS_AFTER_FIX | REMOVE | REMOVED | Over 1M triangles; remove for predictable demo loading rather than invasive optimization. | — |
| hyundai-kona-os | Hyundai Kona OS | PASS | REMOVE | REMOVED | No safe body paint configuration; original-finish-only model removed from the recolorable demo collection. | — |
| hyundai-santa-fe-mx5 | Hyundai Santa Fe MX5 | UNCERTAIN | REMOVE | REMOVED | Vehicle is assembled but heading is reversed and roof/window surfaces are patchy; inspect materials and variant correctness. | — |
| hyundai-sonata-nf | Hyundai Sonata NF | UNCERTAIN | REMOVE | REMOVED | Existing provenance/quality hold retained; not promoted. Floor is fused into the single mesh Object_4/Object_0; node/config removal cannot isolate it. No geometry edited. | — |
| hyundai-tucson-lm-ix35 | Hyundai Tucson LM/ix35 | UNCERTAIN | REMOVE | REMOVED | Nearly white materials make details/wheels difficult to verify; keep for material/generation review. | — |
| kia-cerato-yd | Kia Cerato YD | PASS | REMOVE | REMOVED | No safe body paint configuration; original-finish-only model removed from the recolorable demo collection. | — |
| kia-optima-mg | Kia Optima MG | UNCERTAIN | REMOVE | REMOVED | Existing provenance/quality hold retained; not promoted. Baked/scan-like texture and background floor remain; quality borderline for demo. | — |
| kia-optima-tf | Kia Optima TF | UNCERTAIN | REMOVE | REMOVED | Existing provenance/quality hold retained; not promoted. Assembled but exact Optima generation and material quality require confirmation. | — |
| kia-rio-yb-sc | Kia Rio YB/SC | UNCERTAIN | REMOVE | REMOVED | All-white rendering obscures surfaces/wheel integrity; inspect materials before deciding. | — |
| kia-sorento-um | Kia Sorento UM | FIX_PIPELINE | REMOVE | REMOVED | Prepared build fails in SkinnedMesh bone matrixWorld evaluation; original renders but is sideways/pale. Skeleton handling must be repaired and then rechecked. | — |
| kia-sportage-sl | Kia Sportage SL | PASS | REMOVE | REMOVED | No safe body paint configuration; original-finish-only model removed from the recolorable demo collection. | — |
| mercedes-a-class-w169 | Mercedes-Benz A-Class W169 | PASS_AFTER_FIX | REMOVE | REMOVED | Red-paint comparison tints cabin/seats as well as the exterior; remove rather than keep broad unsafe paint assignment. | — |
| mercedes-a-class-w176 | Mercedes-Benz A-Class W176 | UNCERTAIN | REMOVE | REMOVED | Assembled but washed-out glazing/body materials need approval. | — |
| mercedes-c-class-w202 | Mercedes-Benz C-Class W202 | PASS | REMOVE | REMOVED | Over 1M triangles; remove for predictable demo loading rather than invasive optimization. | — |
| mercedes-c-class-w203 | Mercedes-Benz C-Class W203 | PASS_AFTER_FIX | KEEP | PASS_AFTER_FIX | Upright, assembled, grounded, front heading and framing verified improved in front-three-quarter, left-side and rear-three-quarter comparisons. | — |
| mercedes-c-class-w204 | Mercedes-Benz C-Class W204 | REPLACE | REMOVE | REMOVED | Original and prepared have empty wheel arches, wheel below body centre and loose underbody pieces: source assembly defect. | — |
| mercedes-e-class-w212 | Mercedes-Benz E-Class W212 | PASS_AFTER_FIX | KEEP | PASS_AFTER_FIX | Upright, assembled, grounded, front heading and framing verified improved in front-three-quarter, left-side and rear-three-quarter comparisons. | — |
| mercedes-vito-w447 | Mercedes-Benz Vito W447 | PASS | KEEP | PASS | Six-view comparison shows upright assembled vehicle, usable body/wheels/materials and shape consistent with mapped generation. | — |
| mercedes-vito-w638 | Mercedes-Benz Vito W638 | REPLACE | REMOVE | REMOVED | Original and prepared both show displaced/missing wheels or major body/trim pieces; source assembly/geometry unsuitable as delivered. | — |
| mitsubishi-l200-3rd-gen-k60-k70 | Mitsubishi L200 3rd gen / K60-K70 | UNCERTAIN | REMOVE | REMOVED | Over 1M triangles; remove for predictable demo loading rather than invasive optimization. | — |
| mitsubishi-l200-4th-gen-ka-kb | Mitsubishi L200 4th gen / KA-KB | PASS | REMOVE | REMOVED | Configured paint material does not exist in the served GLB; source remains red. Remove rather than guess broad recoloring. | — |
| mitsubishi-lancer-5th-6th-era-evo-iii | Mitsubishi Lancer 5th/6th-era Evo III | PASS | REMOVE | REMOVED | Existing provenance/quality hold retained; not promoted. Six-view comparison shows upright assembled vehicle, usable body/wheels/materials and shape consistent with mapped generation. | — |
| mitsubishi-outlander-4th-gen-gm-gn | Mitsubishi Outlander 4th gen / GM/GN | UNCERTAIN | REMOVE | REMOVED | Washed-out materials and exact-generation detail need confirmation. | — |
| mitsubishi-pajero-2nd-gen-v20 | Mitsubishi Pajero 2nd gen / V20 | UNCERTAIN | REMOVE | REMOVED | Large background walls dominate both renders and hide the car; isolate geometry before deciding suitability. | — |
| mitsubishi-pajero-4th-gen-v80 | Mitsubishi Pajero 4th gen / V80 | UNCERTAIN | REMOVE | REMOVED | Exploded wheel/body alternatives in both versions; safe variant selection/reassembly not confirmed. | — |
| nissan-juke-f15 | Nissan Juke F15 | UNCERTAIN | REMOVE | REMOVED | Assembled Juke faces backward in front view; heading configuration needs correction. | — |
| nissan-micra-k12 | Nissan Micra K12 | PASS | REMOVE | REMOVED | Existing provenance/quality hold retained; not promoted. Six-view comparison shows upright assembled vehicle, usable body/wheels/materials and shape consistent with mapped generation. | — |
| nissan-micra-k13 | Nissan Micra K13 | REPLACE | REMOVE | REMOVED | Original and prepared both show displaced/missing wheels or major body/trim pieces; source assembly/geometry unsuitable as delivered. | — |
| nissan-navara-d22 | Nissan Navara D22 | PASS | REMOVE | REMOVED | Red-paint comparison recolors wheels and trim with the body; broad material assignment is unsafe. | — |
| nissan-navara-d40 | Nissan Navara D40 | PASS | REMOVE | REMOVED | Existing provenance/quality hold retained; not promoted. Six-view comparison shows upright assembled vehicle, usable body/wheels/materials and shape consistent with mapped generation. | — |
| nissan-x-trail-t32 | Nissan X-Trail T32 | UNCERTAIN | REMOVE | REMOVED | Scene base and nearly white materials remain; geometry/material cleanup feasibility uncertain. | — |
| peugeot-2008-1st-gen-a94 | Peugeot 2008 1st gen / A94 | REPLACE | REMOVE | REMOVED | Original and prepared both show displaced/missing wheels or major body/trim pieces; source assembly/geometry unsuitable as delivered. | — |
| peugeot-206-206 | Peugeot 206 206 | PASS | REMOVE | REMOVED | Existing provenance/quality hold retained; not promoted. Six-view comparison shows upright assembled vehicle, usable body/wheels/materials and shape consistent with mapped generation. | — |
| peugeot-207-207 | Peugeot 207 207 | UNCERTAIN | REMOVE | REMOVED | Heading corrected; paint disabled to protect glass/trim, but source remains nearly featureless white. Material review needed. | — |
| peugeot-208-1st-gen-a9 | Peugeot 208 1st gen / A9 | REPLACE | REMOVE | REMOVED | Original and prepared both show displaced/missing wheels or major body/trim pieces; source assembly/geometry unsuitable as delivered. | — |
| peugeot-208-2nd-gen-p21 | Peugeot 208 2nd gen / P21 | PASS | KEEP | PASS | Six-view comparison shows upright assembled vehicle, usable body/wheels/materials and shape consistent with mapped generation. | — |
| peugeot-301-m3 | Peugeot 301 M3 | UNCERTAIN | REMOVE | REMOVED | Almost featureless white vehicle/wheels; materials need review rather than automatic replacement. | — |
| peugeot-308-1st-gen-t7 | Peugeot 308 1st gen / T7 | REPLACE | REMOVE | REMOVED | Original and prepared both show displaced/missing wheels or major body/trim pieces; source assembly/geometry unsuitable as delivered. | — |
| peugeot-308-2nd-gen-t9 | Peugeot 308 2nd gen / T9 | PASS | KEEP | PASS | Six-view comparison shows upright assembled vehicle, usable body/wheels/materials and shape consistent with mapped generation. | — |
| renault-captur-2nd-gen-jb-je | Renault Captur 2nd gen / JB/JE | UNCERTAIN | REMOVE | REMOVED | Nearly white vehicle; material acceptability cannot be confirmed. | — |
| renault-clio-mk2 | Renault Clio Mk2 | UNCERTAIN | REMOVE | REMOVED | Existing provenance/quality hold retained; not promoted. Wheel/body materials restored, but source pink glazing remains. Material review needed. | — |
| renault-fluence-l38 | Renault Fluence L38 | PASS_AFTER_FIX | KEEP | PASS_AFTER_FIX | Upright, assembled, grounded, front heading and framing verified improved in front-three-quarter, left-side and rear-three-quarter comparisons. | — |
| renault-kangoo-2nd-gen-x61 | Renault Kangoo 2nd gen / X61 | REPLACE | REMOVE | REMOVED | Original and prepared both show displaced/missing wheels or major body/trim pieces; source assembly/geometry unsuitable as delivered. | — |
| renault-megane-mk2 | Renault Megane Mk2 | UNCERTAIN | REMOVE | REMOVED | Exploded alternate body pieces persist; needs safe variant selection review. | — |
| seat-ibiza-mk4-6j | SEAT Ibiza Mk4 / 6J | UNCERTAIN | REMOVE | REMOVED | Assembled but white/plain materials obscure detail and generation confirmation. | — |
| skoda-fabia-mk2-5j | Skoda Fabia Mk2 / 5J | PASS | KEEP | PASS | Six-view comparison shows upright assembled vehicle, usable body/wheels/materials and shape consistent with mapped generation. | — |
| skoda-octavia-mk2-1z | Skoda Octavia Mk2 / 1Z | PASS | KEEP | PASS | Six-view comparison shows upright assembled vehicle, usable body/wheels/materials and shape consistent with mapped generation. | — |
| skoda-octavia-mk4-nx | Skoda Octavia Mk4 / NX | UNCERTAIN | REMOVE | REMOVED | Over 1M triangles; remove for predictable demo loading rather than invasive optimization. | — |
| toyota-c-hr-1st-gen | Toyota C-HR 1st gen | PASS | KEEP | PASS | Six-view comparison shows upright assembled vehicle, usable body/wheels/materials and shape consistent with mapped generation. | — |
| toyota-camry-xv20 | Toyota Camry XV20 | PASS_AFTER_FIX | KEEP | PASS_AFTER_FIX | Upright, assembled, grounded, front heading and framing verified improved in front-three-quarter, left-side and rear-three-quarter comparisons. | — |
| toyota-camry-xv30 | Toyota Camry XV30 | PASS_AFTER_FIX | REMOVE | REMOVED | Existing provenance/quality hold retained; not promoted. Upright, assembled, grounded, front heading and framing verified improved in front-three-quarter, left-side and rear-three-quarter comparisons. | — |
| toyota-camry-xv40 | Toyota Camry XV40 | PASS | REMOVE | REMOVED | Red-paint comparison tints glazing red; unsafe material assignment removed rather than broad recoloring. | — |
| toyota-camry-xv70 | Toyota Camry XV70 | PASS | KEEP | PASS | Six-view comparison shows upright assembled vehicle, usable body/wheels/materials and shape consistent with mapped generation. | — |
| toyota-corolla-e100 | Toyota Corolla E100 | PASS | REMOVE | REMOVED | Fresh renders show patchy roof/body surfaces and no isolated body paint configuration; remove from demo. | — |
| toyota-corolla-e210 | Toyota Corolla E210 | PASS | KEEP | PASS | Six-view comparison shows upright assembled vehicle, usable body/wheels/materials and shape consistent with mapped generation. | — |
| toyota-hilux-8th-gen | Toyota Hilux 8th gen | PASS | REMOVE | REMOVED | Existing provenance/quality hold retained; not promoted. Six-view comparison shows upright assembled vehicle, usable body/wheels/materials and shape consistent with mapped generation. | — |
| toyota-land-cruiser-j100 | Toyota Land Cruiser J100 | UNCERTAIN | REMOVE | REMOVED | White low-contrast source plus detached-looking front wheel pieces; material/assembly review required. | — |
| toyota-land-cruiser-j200 | Toyota Land Cruiser J200 | UNCERTAIN | REMOVE | REMOVED | Vehicle floats off-centre with oversized bounds/shadow; inspect stray geometry/origin before choosing normalization. | — |
| toyota-prius-xw20 | Toyota Prius XW20 | PASS | REMOVE | REMOVED | Existing provenance/quality hold retained; not promoted. Six-view comparison shows upright assembled vehicle, usable body/wheels/materials and shape consistent with mapped generation. | — |
| toyota-prius-xw30 | Toyota Prius XW30 | PASS_AFTER_FIX | REMOVE | REMOVED | Configured paint material does not exist in the served GLB; source remains mint green regardless of selected paint. Remove from demo. | — |
| toyota-rav4-xa40 | Toyota RAV4 XA40 | PASS | REMOVE | REMOVED | Existing provenance/quality hold retained; not promoted. Six-view comparison shows upright assembled vehicle, usable body/wheels/materials and shape consistent with mapped generation. | — |
| toyota-yaris-xp130 | Toyota Yaris XP130 | REPLACE | REMOVE | REMOVED | Original and prepared both show displaced/missing wheels or major body/trim pieces; source assembly/geometry unsuitable as delivered. | — |
| toyota-yaris-xp90 | Toyota Yaris XP90 | PASS | REMOVE | REMOVED | Fresh enlarged views show crude faceted body, patchy headlights and featureless glazing; remove the low-detail asset. | — |
| volkswagen-caddy-sb-latest | Volkswagen Caddy SB / latest | PASS | KEEP | PASS | Six-view comparison shows upright assembled vehicle, usable body/wheels/materials and shape consistent with mapped generation. | — |
| volkswagen-golf-mk3 | Volkswagen Golf Mk3 | PASS | REMOVE | REMOVED | Existing provenance/quality hold retained; not promoted. Six-view comparison shows upright assembled vehicle, usable body/wheels/materials and shape consistent with mapped generation. | — |
| volkswagen-golf-mk5 | Volkswagen Golf Mk5 | PASS | REMOVE | REMOVED | Existing provenance/quality hold retained; not promoted. Six-view comparison shows upright assembled vehicle, usable body/wheels/materials and shape consistent with mapped generation. | — |
| volkswagen-golf-mk7 | Volkswagen Golf Mk7 | REPLACE | REMOVE | REMOVED | Mapped as Golf Mk7 but visible rounded-headlamp/arched-grille body resembles Mk5; wrong generation; compare against the separate Mk5 entry. | — |
| volkswagen-polo-mk4-9n | Volkswagen Polo Mk4 / 9N | PASS_AFTER_FIX | KEEP | PASS_VARIANT | Upright, assembled, grounded, front heading and framing verified improved in front-three-quarter, left-side and rear-three-quarter comparisons. Verified variant: Three-door Polo 9N. | — |
| volkswagen-transporter-t4 | Volkswagen Transporter T4 | UNCERTAIN | REMOVE | REMOVED | Floating alternate front pieces and inconsistent wheel placement in both versions; selection/assembly needs review. | — |
| audi-a3-8l | Audi A3 8L | UNCERTAIN | REMOVE | REMOVED | Existing provenance/quality hold retained; not promoted. Prepared hood has patch artifacts absent from original; determine material/quantization cause before choosing a fix. | — |
| audi-a3-8v | Audi A3 8V | PASS | REMOVE | REMOVED | Fresh six-view render shows stripped roof/body and exposed racing interior; not a reliable representative vehicle for this demo. | — |
| audi-a4-b5 | Audi A4 B5 | PASS | KEEP | PASS | Six-view comparison shows upright assembled vehicle, usable body/wheels/materials and shape consistent with mapped generation. | — |
| audi-a4-b6 | Audi A4 B6 | UNCERTAIN | REMOVE | REMOVED | Both versions have visibly transparent/wire-like surfaces; material correction feasibility needs review. | — |
| audi-a4-b8 | Audi A4 B8 | PASS | REMOVE | REMOVED | Red-paint comparison recolors wheels and grille while most body remains dark; incorrect material assignment. | — |
| audi-a4-b9 | Audi A4 B9 | PASS | REMOVE | REMOVED | Red-paint comparison leaves the body white; paint selection does not control the exterior finish. | — |
| audi-a6-c6 | Audi A6 C6 | REPLACE | REMOVE | REMOVED | Original and prepared both show displaced/missing wheels or major body/trim pieces; source assembly/geometry unsuitable as delivered. | — |
| audi-a6-c7 | Audi A6 C7 | REPLACE | REMOVE | REMOVED | Original and prepared both show displaced/missing wheels or major body/trim pieces; source assembly/geometry unsuitable as delivered. | — |
| audi-q3-8u | Audi Q3 8U | PASS | KEEP | PASS | Six-view comparison shows upright assembled vehicle, usable body/wheels/materials and shape consistent with mapped generation. | — |
| audi-q5-8r | Audi Q5 8R | UNCERTAIN | REMOVE | REMOVED | Both versions have transparent patchy body/wheels; investigate material alpha settings before replacing. | — |
| audi-q7-4l | Audi Q7 4L | UNCERTAIN | REMOVE | REMOVED | Pale/low-contrast original and patchy prepared surfaces need material review. | — |
| opel-astra-f | Opel Astra F | UNCERTAIN | REMOVE | REMOVED | Floating body/trim and displaced wheels appear in original and prepared; assembly selection may help but needs review. | — |
| opel-astra-g | Opel Astra G | PASS | REMOVE | REMOVED | Fresh enlarged views show featureless opaque white glazing/roof patches; materials are not acceptable for the demo. | — |
| opel-astra-h | Opel Astra H | UNCERTAIN | REMOVE | REMOVED | Vertical car plus rig/gizmo objects in both versions; orientation and object selection need validation. | — |
| opel-astra-k | Opel Astra K | REPLACE | REMOVE | REMOVED | Original and prepared both show displaced/missing wheels or major body/trim pieces; source assembly/geometry unsuitable as delivered. | — |
| opel-corsa-b | Opel Corsa B | PASS_AFTER_FIX | KEEP | PASS_VARIANT | Upright, assembled, grounded, front heading and framing verified improved in front-three-quarter, left-side and rear-three-quarter comparisons. Verified variant: Three-door Corsa B. | — |
| opel-corsa-c | Opel Corsa C | REPLACE | REMOVE | REMOVED | Original and prepared both show displaced/missing wheels or major body/trim pieces; source assembly/geometry unsuitable as delivered. | — |
| opel-corsa-e | Opel Corsa E | REPLACE | REMOVE | REMOVED | Original and prepared both show displaced/missing wheels or major body/trim pieces; source assembly/geometry unsuitable as delivered. | — |
| opel-insignia-a | Opel Insignia A | UNCERTAIN | REMOVE | REMOVED | Multiple separate shells and body pieces in both versions; assembly-selection feasibility uncertain. | — |
| opel-mokka-b | Opel Mokka B | UNCERTAIN | REMOVE | REMOVED | Over 1M triangles; remove for predictable demo loading rather than invasive optimization. | — |
| opel-vectra-c | Opel Vectra C | REPLACE | REMOVE | REMOVED | Original and prepared both show displaced/missing wheels or major body/trim pieces; source assembly/geometry unsuitable as delivered. | — |
| seat-leon-mk1-1m | SEAT Leon Mk1 / 1M | PASS | REMOVE | REMOVED | Existing provenance/quality hold retained; not promoted. Six-view comparison shows upright assembled vehicle, usable body/wheels/materials and shape consistent with mapped generation. | — |
