# Parts admin redesign: approved plan

Status: approved, not built. Includes A-02 (body type) and A-05 (real upload error message). EN/AR + RTL, light + dark, Expo Go, real data only.

## Home
About 5 cards, each with a real count (hide a count rather than fake it): **Shops**, **Products**, **3D cars** (buttons "Add 3D model" and "Manage 3D models"), **3D accessories**, **Messages**. Counts from `GET /admin/parts/stats` and the existing request/queue endpoints.

## Decisions
1. **Add 3D model:** GLB upload or Sketchfab link -> validation -> private part-map review -> PREVIEW (admin inspects) -> "Approve" publishes to customers.
2. **Replace model:** same flow for an existing car. Customers keep the old model until the admin approves the new one; on approve the new model takes over atomically. The old model is no longer shown but is kept in revision history (restorable, never hard-deleted). If the new one is discarded, nothing changes for customers.
3. **Problems:** Hide a model (customers see no 3D for that car) until fixed or replaced; Show brings it back.
4. **After a replaced model is approved:** recompute accessory fits for that car and put them in "Accessory fits" for admin approval; hide "View on my car" for parts whose fit no longer matches until approved.
5. **Reuse run 1's private part-map access** for hidden cars and imports (A-03): `car-part-map.ts` + `GET /admin/parts/part-maps/:key/model`.

## Manage 3D models
List with status chips (Published, Hidden, In review, Failed; from the single effective-availability state of A-01), search, filters. Car detail: preview + Hide/Show; Edit details incl. body type (A-02); Replace model; Review part map; Revision history; Remove 3D from this car; Delete car generation only if unused (disabled with the reason otherwise).

## Endpoints
Existing: `/admin/parts/vehicle-3d-models` (list, get, `PATCH :key/config`, `POST :key/publication`, `DELETE :key`), `/admin/parts/vehicle-3d-imports` (create, `sketchfab/inspect`, `sketchfab`, `:id/validate|retry|discard|publish`), `/admin/parts/part-maps/:key[/model|/segment]`.
Approved to add (additive migration only if needed):
- body type accepted in the generation PATCH
- `GET …/:key/revisions`
- import `replaces` link + atomic swap on approve (old revision kept, restorable)
- generation usage check + guarded delete
- A-05: show the backend's `message`/`code` on upload failure and keep the form fields

## Build order (stop after step 2 with a short report)
1. Home cards
2. Manage 3D models: list + detail + hide/show/edit/remove
3. Add 3D model
4. Replace + revision history
5. Delete generation
