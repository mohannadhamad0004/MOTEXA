# Tracked demo product photos

Only owned, authorized or licensed product photographs may be committed here.
Five user-supplied images are present for the requested local demo evaluation. Their original sources and usage rights are unverified. Reserved filenames are not permission
to use manufacturer/retailer images. Product identity verification is separate
from photo reuse permission (see `docs/agents/parts-photo-sources.md` and STATUS.md
at the repository root for the previous review).

Before committing each photo, replace the pending provenance fields below with
the exact source URL or owned-photo reference, copyright owner, licence/permission
and evidence reference (including attribution requirements), reviewer/date and
any edits in Notes. Do not commit private permission documents; reference their
approved private record. Confirm the pictured model and package match the product.

| MOTEXA product | Brand | Verified OEM/model (previous review) | Source | Source owner | Usage/licensing status | Filename | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Dash Camera A400 1440P | 70mai | A400, 1440P | User supplied in workspace; original source URL not provided | Unknown; brand is not proof of copyright ownership | Usage rights uncertain; user requested local graduation/demo evaluation; no licence established | `70mai_A400_1440P.jpg` | shop@motexa.test; stable key 70MAI-A400 |
| Brake Fluid DOT 4 (500 ml) | Bosch | 1987479106, 500 ml | User supplied in workspace; original source URL not provided | Unknown; brand is not proof of copyright ownership | Usage rights uncertain; user requested local graduation/demo evaluation; no licence established | `bosch_1987479106_dot4_500ml.jpg` | shop.hebron@motexa.test; stable key remains 1987479107; current product number 1987479106 |
| ATF 220 Dexron IID Transmission Fluid 1L | Mobil | ATF 220, 1 L | User supplied in workspace; original source URL not provided | Unknown; brand is not proof of copyright ownership | Usage rights uncertain; user requested local graduation/demo evaluation; no licence established | `mobil_ATF220_1L.jpg` | shop.hebron@motexa.test; stable key ATF-220-1L |
| H7 Halogen Bulbs 12V 55W (pair) | Philips | 12972PRC2, Vision H7 C2 / 2-pack | User supplied in workspace; original source URL not provided | Unknown; brand is not proof of copyright ownership | Usage rights uncertain; user requested local graduation/demo evaluation; no licence established | `philips_12972PRC2_H7_C2.jpg` | shop.ramallah@motexa.test; stable key 12972PRC2 |
| Roof Rack Cross Bars | Thule | 711200 WingBar Evo 118 silver | User supplied in workspace; original source URL not provided | Unknown; brand is not proof of copyright ownership | Usage rights uncertain; user requested local graduation/demo evaluation; no licence established | `thule_711200_wingbar_evo.jpg` | shop@motexa.test; stable key TH-711200; previous review flags the existing "with locks" description for confirmation before customer exposure |

## Installation and safety

- The existing guarded dev seed calls `parts-photos.ts` after resolving the actual
  product ID through the existing stable identity/legacy lookup. The map uses shop
  email plus stable seed key; it does not alter product data or IDs.
- Adding an image here is a reviewed authorization step. The seed does not parse
  this Markdown or determine licensing automatically. Add only approved photos
  with completed provenance. JPEG bytes must pass the normal upload checks and
  the existing 2 KB minimum / 5 MB maximum.
- Tracked source -> `storage/provider-files/seed-product-<product hash>-<SHA-256>.jpg`
  -> PUBLIC `ProviderFile` with purpose PRODUCT_IMAGE -> existing
  `/api/files/public/<id>` route -> customer app. Mobile imports no seed assets.
  Runtime storage stays ignored. No schema or upload-route changes are needed.
- **Insert only:** any existing PRODUCT_IMAGE row blocks installation, including
  private, tiny, legacy, missing-on-disk or previously seed-installed images.
  Uploader, size, hash and filename are not reliable ownership evidence. The seed
  never replaces, repairs or deletes an existing image. The old size-based tile
  cleanup is deliberately removed because size alone cannot prove ownership.
- Unchanged reruns create no additional rows or files. The existing unique
  (productId, purpose) constraint protects concurrent installs; the row is claimed
  in a transaction before writing. Installation and its AuditLog commit together.
  Exclusive runtime creation reuses only identical bytes; mismatched bytes cause
  an error without overwriting anything.
- **Changed source:** an existing image is preserved, even if its hash differs.
  Use the normal Provider/Admin change-photo workflow for intentional replacement.
  Automatic seed replacement needs a future reliable ownership mechanism. Normal
  uploads remain authoritative and their existing replacement behavior is intact.
- If a transaction fails after writing bytes, a runtime orphan can remain (disk
  and SQL are not one transaction). Retrying the same product/source reuses it.
  No automatic orphan deletion runs; changing the source after such a failure can
  leave the previous orphan for explicit manual inspection.
- Missing source: skip successfully, create no row/file/placeholder, and preserve
  any existing image. A product with no photo keeps the existing Admin/Provider
  "Product photo required" state and is excluded by the customer catalog rule.
  An invalid present file fails explicitly; it is never silently installed.
- The surrounding dev seed retains its existing product/fitment reset behavior;
  this photo helper changes only image rows and installation audit records. Do not
  run the full seed merely to preview an image on a database with curated data.

No images were downloaded, uploaded or installed as part of this architecture task.

## Installation check — 2026-10-29

All five reserved image files are absent from this directory and no matching
filenames were found elsewhere in the workspace. Only this README exists here.
Sources, source owners and reuse permissions remain unknown for all five; no
licensing or graduation/demo-only usage claim has been established for actual
files. Installation and visual verification await the images and their provenance.

Thule's unsupported phrase "with locks" was removed from the seed description
and the existing dev product description: "Aluminium roof bars." No other product
data was changed by this correction. The earlier flag in the table records the
prior review; the unsupported wording has now been removed.

## Actual installation ? 2026-10-29

The earlier missing-file check above is historical. All five files are now present, decode fully as JPEGs, and were visually inspected. Files were installed unchanged through the existing insert-only helper. Do not interpret local demo use as a copyright licence or permission to commit/distribute these images. Original source and rights evidence still need to be supplied.

| Filename | Dimensions | Bytes | Visual notes |
| --- | --- | --- | --- |
| `70mai_A400_1440P.jpg` | 1024 x 1024 | 30636 | 70mai camera; lens shows 1440P; filename maps to A400, exact model not printed visibly |
| `bosch_1987479106_dot4_500ml.jpg` | 800 x 800 | 45619 | Bosch DOT 4, 500 ml label; OEM mapping from previous review |
| `mobil_ATF220_1L.jpg` | 1024 x 1024 | 72875 | Mobil ATF 220 and 1L visible |
| `philips_12972PRC2_H7_C2.jpg` | 1500 x 1500 | 150630 | Philips H7 12972PRC2 packaging with pair illustration |
| `thule_711200_wingbar_evo.jpg` | 1000 x 1000 | 40799 | Thule silver bars with end-detail photos; exact length/model not readable in photo; mapping from previous review |

All five source files remain unmodified. Source attribution cannot be inferred from brand logos. No external images were downloaded. Thule description remains corrected to "Aluminium roof bars."
