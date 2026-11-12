# Box-select in the part-map editor — read-only check (2026-11-12)

**1. What already exists**
- Zone cut: `splitZone` mobile/src/features/car3d/sceneHtml.ts:299 (triangles cut exactly at the box faces); used by `replaceZone` sceneHtml.ts:467-503 (`how` = "tuned box" / "computed box"). Default bumper boxes are in `KIT` sceneHtml.ts:272-281.
- Stock-part box: the zone editor's 6 number fields (fractions of the car box) mobile/src/features/accessory3d/screens.tsx:425-445 and the replace box screens.tsx:~727. Saved by `setZone` backend/src/services/accessory3d.ts:578 (validated by `parseZone` backend/src/services/vehicle3d-validation.ts:193), merged into the model by accessory3d.ts:188-201.
- Red preview: `previewApply` sceneHtml.ts:1469 (hidden part red, fit box green), driven by `zonePreview` from the zone editor.
- Part-map editor: tap one piece at a time, `PartMapEditor` screens.tsx:479 + `pickPiece` sceneHtml.ts:1508. Every piece already stores its bounds as box fractions (`b`, `carPieces` sceneHtml.ts:~405), so "pieces inside a box" is a filter over data we already have.
- Missing: picking the 4 points on the car, and selecting all pieces in a box.

**2. Can it be added without a refactor? Yes for selecting pieces, no for merged bumpers.**
- Selecting pieces (cars with separate bumper pieces): only mobile code. screens.tsx: a "Box" mode, plus `p.b` inside box → add to `draft[label]`; the existing `confirmPartMap` saves it. sceneHtml.ts: 4 taps cast rays onto the car (like `pickPiece`) and post the points; their min/max gives the box; draw it with the existing green `Box3Helper`. The editor API sends only the piece count (`pieces: pieces.length`, car-part-map.ts:173). So the box test runs inside the WebView, against the `segment()` boxes it already has, and it posts the ids back. No backend change. No changes to fitting, hiding or the customer viewer.
- Merged bumper (W203): you can save the box as the zone (`setZone`, no backend change) and the red preview shows the cut. **But a bumper fit will not use it:** `fitBumper` throws unless `zone.how === "part map"` (sceneHtml.ts:707). On the server, bumpers need a confirmed map label too: `fitEligibility` backend/src/services/accessory-autofit.ts:137, `partMap` accessory3d.ts:118/137, `partLimit` car-part-map.ts:116. So "box instead of pieces" for bumpers is a change to the fitting rules in 4 places (the viewer guard plus 3 server checks). It is not just an addition. `bumperGaps`/`coveredStock` read only `zone.hide`/`zone.T`, which a box cut also gives, so the code change would be small, but it changes behaviour.

**3. Would Meshy parts fit the box space?**
- Size and position: yes. `fitBumper` scales the part to the box width, allows only ±5 % stretch in height and depth, and puts the top edge and front face on the box (sceneHtml.ts:713-716).
- Clean fit: often not. A part is refused when a seam gap is over 10 mm (p90) or it sits more than 30 mm into the body (`BUMPER_MAX_GAP_MM`, sceneHtml.ts:638). A box cut leaves flat, straight edges, and a curved Meshy bumper will not meet them. Expect gaps or holes at the box faces (worst at the wheel arches and the light line), so many will be refused or look wrong. Pieces selected with the box keep the real seam, so Meshy parts fit those as well as they fit today.

**4. Estimate**
- Box-select for separate pieces: **small** (mobile only, about 1-2 files).
- Box cut as the bumper on merged cars: **medium**: rules change in the viewer and 3 server checks, plus fit-QA again.
- Main risk: on a merged body, a box cut is a straight cut through curved bodywork. Shop bumpers then fail the 10 mm gap gate. If we relax the gate to make them pass, customers see holes or floating parts. Test one W203 with a real Meshy bumper (`--views` evidence) before building it.
