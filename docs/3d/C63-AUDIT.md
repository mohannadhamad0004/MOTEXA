# Independent W204 C63 candidate audit

Final classification: **REJECT — external provenance/license not verified; remains inactive.** Technical/visual assessment: **PASS_VARIANT**, independently of the old W204's broken-assembly rejection.

| Item | Finding |
|---|---|
| Identity | Mercedes-Benz C-Class W204, 2008 C63 AMG sedan variant |
| Current source | `3d-source/manual/mercedes-c-class-w204/w204-c63-source.glb` |
| Source SHA-256 | `9874b284da3f456fdd297d3bd8654d060c4bf875158f12df6cc16a54640c1022` |
| Identical local copies | `3d-source/mercedes-c-class-w204/model.glb` and the private cleanup backup |
| Embedded attribution | 007 / tangwang920, CC BY 4.0 |
| Source | [Sketchfab C63](https://sketchfab.com/3d-models/2008-mercedes-benz-c63-amg-1b769f1f8dd64aae9b0fb6f2d22a3a54) |
| External verification | Source page, embed and public model API inaccessible through available tools; no matching search result established the license independently |
| File size | 2,872,476 bytes, approximately 2.74 MiB |
| Geometry | 33,921 triangles, 50,523 vertices, 100 meshes, 14 materials, 10 textures, no animations |
| Raw dimensions | Approximately 0.01990 × 0.01455 × 0.04714 source units; scaling is necessary |
| Viewer dimensions | 1.9846 × 1.4506 × 4.7000 metres |
| Upright/heading | Upright, front +Z; `preRotateX=0`, `rotateY=0` |
| Grounding | Y minimum 0, `groundOffset=0`; no detached wheels/scenery observed |
| Paint | `c63color`; 14 painted mesh instances. Red-paint comparison changes the exterior while preserving wheels, glazing, lights and interior |
| Wheels | Four correctly positioned assemblies; separate rim/tire meshes. No unsupported wheel-swap capability is promised |
| Production | No production GLB restored; manifest inactive; no database model key assigned |

The prior baseline rejected a **different asset** with optimized SHA-256 `dc3a40dd178837d08889933a9be53f0025e33356d25dac74f837f4a076fac16a`. Its source hash is `8898dd80a0b0d51024b852b63fefad74b499e7f9e9bd8c2540b0d6bc3543fa3a`. Those findings cannot classify this C63. The prior cleanup incorrectly carried that decision forward. This report and `models.json.currentCandidateReview` supersede it for the current candidate.

Fresh six-view evidence exists for both neutral and red paint: front, front three-quarter, left side, rear three-quarter, rear and top three-quarter. It uses local Three.js **0.160.1**, the production HTML `build()` function, and the **same `modelForViewer()` serializer called by the real mobile hook**. Asset/config/viewer/hook/serializer/renderer hashes and per-image hashes are recorded in [c63-audit.json](c63-audit.json). Images are under ignored `.private/vehicle3d-phase2/c63-neutral/` and `c63-red/`. No remote renderer requests were allowed.

The generic import pipeline also normalized, technically validated and six-view rendered the C63 without publishing it. Prepared SHA-256: `45e7fcda8c07f5bb4750bfd6b2636e4ffc8973e6e9c97d6023bba717d8f063d3`. Prepared artifacts are under ignored `.private/vehicle3d-imports/<source hash>/`.

`backup-old/source-old.glb` is archived source only. `backup-old/production-old.glb` is retired production backup only. Neither was reactivated or republished. The other two intended vehicles are **not yet supplied / pending import**; these backups do not count as additional vehicles.

To revisit acceptance, obtain a genuine public source-API metadata snapshot matching the embedded source UID and compatible license, then perform explicit curator review. The generic importer defaults to preparation/rendering only and uses the shared catalog promotion/journal helper when publication is explicitly authorized. Missing provenance never silently publishes a model. No physical Expo Go verification is claimed.
