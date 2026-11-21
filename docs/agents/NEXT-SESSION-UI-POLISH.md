NEXT SESSION: UI polish (shop 3D wizard, admin 3D request screen, settings, consistent layout)

Read AGENTS.md and docs/agents/STATUS.md (latest entries) first. Check my backend on port 5000 (health) before testing; don't start another backend.
Work in the parts below, in order. STOP after each part with a short report + screenshots (EN dark, AR light, 390 px) so I can test and commit. Don't start the next part until I say "next".

GOAL: the app must look like one polished product, simple for non-technical shop owners and tow companies. Follow the existing Garage design system (colours, fonts, cards, spacing, radius); don't invent a new style.

=====================================================================
PART A: the shop's "Show it in 3D" wizard (it works; polish it)
=====================================================================
Bugs:
1. Category rule: "Roof Rack Cross Bars" still offers Front bumper / Rear bumper / Rear wing. Cards must come from the product's category: bumpers/body kits -> Front + Rear bumper; wing/spoiler -> Rear wing; wheels/rims -> Rims; if only one fits, preselect it and start at step 2. Any other category (roof racks, lips, mirrors...): no "Show it in 3D" anywhere (product menu, product page); show "3D preview isn't available for this kind of part yet". Test with the roof rack, a bumper product, the E36 wing and the rims.
2. Leftover test request: a Rear bumper request on "Roof Rack Cross Bars" (mascot images as part photos) is still "Waiting for Parts Admin review". Remove it through the app's own flows (or tell me exactly how), and list any other test records left.
3. Size step (EN): two lines cross the number box above and below "174". Fix the border.

Design improvements:
4. Focused flow: inside the wizard, hide the shop's tab row (Dashboard / Products / Orders / 3D Parts...) and the settings gear. The header is only: back/close, step title, product name. Leaving asks "Save draft and leave?" (the draft is already autosaved).
5. Step 1 part cards: replace the line drawings (front and rear bumper look almost identical) with 4 images rendered from our own 3D viewer: BMW E36, neutral silver paint, three-quarter angle, the part highlighted in the accent colour, the rest of the car slightly muted (front bumper from the front, rear bumper and rear wing from the rear, rims from the side). Same framing, 2× resolution, compressed, saved as static assets, good in light and dark. Layout: if 2 cards, side by side; if 1, it's preselected; never a lone orphan card on its own row (use full-width cards if 3).
6. Remove the "Product: …" footer line (the product is already in the header).
7. Step 3 angle guides: the current blob drawings are hard to read. Show a simple silhouette of THAT part (bumper/wing/rim) seen from that angle, with a small camera icon showing where to stand. Keep the "2 of 4 photos · 2 more recommended" bar. Each filled slot: tap to view large, with Replace / Remove.
8. Step 4: show the unit next to the number ("174 cm", plus "about 1.74 m wide" under it); bigger ± buttons; the "Remove" under installed photos as a small × badge on the thumbnail instead of red text.
9. Step 5: make the consent row a large tappable card (the whole row toggles the checkbox, 48 px+); Submit stays disabled until it's ticked, with the reason shown.
10. Arabic: isolate Latin model codes so car names read cleanly (e.g. "مرسيدس الفئة C W203" without jumbled order), including search placeholders.

=====================================================================
PART B: the parts admin's 3D request screen
=====================================================================
11. "A previous candidate stays in the history" contradicts our rule (a 3D model exists or is deleted; no old versions kept). Check what really happens to an old candidate when "Use this file as the 3D model" is pressed and the new one is approved: it must be deleted; make the text say so.
12. Clearer words: "Loose part photos (sent to the 3D provider)" -> "Photos of the part"; Fits lines like "Mercedes C-Class W203 (2000–2007) · shown in installed photos · has a 3D model".
13. Use a 3D cube icon on the "The shop sent its own 3D file" card (not a plain square).
14. Show the product's real category next to the part type; if they don't match (e.g. roof rack product, bumper request), show a warning to the admin.

=====================================================================
PART C: move language/theme into Profile
=====================================================================
15. Move the language (English/Arabic) and theme (light/dark/system) controls out of the top of screens (the gear/settings panel in headers) into the Profile/Settings page as an "Appearance & language" section, for: parts admin, tow admin, parts shop, tow company and tow driver. Applied instantly, saved as today. Remove the header gear where it only opened these settings. If any of this lives in Diala's files, tell me the file:line and leave it. Tell me where the customer's controls are; don't change customer screens.

=====================================================================
PART D: one consistent layout across the 4 roles (PROPOSAL FIRST)
=====================================================================
16. Audit (read-only first) the parts admin, tow admin, parts shop and tow company screens and list the inconsistencies: headers, tab bars vs pill rows, card styles, list rows (with the ⋮ menus), empty states, section titles, primary-button placement, spacing. Screenshots side by side.
17. Propose ONE shared layout for all four (header, navigation, list row, card, empty state, primary action) in max 20 lines, using existing shared components where possible. Wait for my "approved" before changing screens; then apply it role by role, stopping after each role.

=====================================================================
RULES
=====================================================================
- Never commit, push, stash, reset or run destructive git commands. (Last session used git stash; don't.)
- Additive migrations only (none should be needed for UI).
- Don't touch Diala's partner-owned files (AGENTS.md list) or graphify-out/.
- Real data only; restore anything you change while testing; list any test records you create and remove them at the end.
- No Meshy credits; no new Sketchfab imports.
- EN + AR (RTL), light + dark, 390 px, Expo Go compatible, touch targets ≥ 44 px, no raw text outside <Text>.
- Backend + mobile tsc clean and mobile tests passing at the end of each part.
