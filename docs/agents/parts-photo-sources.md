# Parts product photo provenance

Last updated 2026-10-29. Covers the 32 products of APPROVED parts shops listed in `docs/agents/parts-missing-photos.md`.

**Result: 0 real photos uploaded.** No product photo could be both (a) matched to a verified product identity and (b) confirmed as legitimately usable in MOTEXA. Manufacturer catalogue images are copyrighted and no licence or reseller-media permission for MOTEXA was found; a Wikimedia Commons search (the only source with checkable reuse rights) found no exact-product photo for any target. Wrong or unlicensed images were not attached. Every target product stays hidden from customers.

**Rules used**
- Identity is matched only on a verified manufacturer/OE number or exact manufacturer model, never on appearance or a seller SKU.
- "Image Source" lists a manufacturer page as a *reference only*. Nothing was downloaded or copied from it.
- An image may be uploaded only through `PATCH /admin/parts/products/:id` (or the provider edit screen) as a PUBLIC `PRODUCT_IMAGE` of at least 2048 bytes.

**Identifier classes** (from the verification pass): A verified manufacturer/OE number; B real manufacturer model, retailer-verified only; C seller/seed SKU; D could not be verified; E conflicts with the product data.

## First photo batch: the 5 READY FOR PHOTO products (2026-10-29)

**Result: 0 uploaded.** All five product identities are verified, but for none of them could a photo be found that MOTEXA is allowed to reuse. A manufacturer page proves what the product is; it does not grant a licence to copy its images.

Where rights were looked for:
- **Manufacturer media terms:** no public licence covering a marketplace listing was found for 70mai, Mobil (ExxonMobil), Philips (Lumileds) or Thule. Bosch's published image-library terms are narrow (promotion of Bosch products, unaltered, with notices) and Bosch's aftermarket site forbids commercial use of its material without express prior written consent.
- **Openly licensed photos:** Wikimedia Commons had no exact-product photo for any of the five. The Openverse API throttled or timed out on all but one query ("70mai dash cam": 0 results), so that search is incomplete.
- **Shop-owned photos:** none supplied.

| Product | Brand | Verified identifier | Exact source | Source owner | Usage permission / status | Local uploaded filename | Upload result | Customer visibility | Notes |
|---|---|---|---|---|---|---|---|---|---|
| Dash Camera A400 1440P (`ccbeb6db-6ae9-4536-bccb-58eb0b458977`, Al-Mahaba) | 70mai | 70mai A400 | Reference only: https://www.70mai.com/a400/ | 70mai | No reuse permission found | — | VERIFIED PRODUCT — PHOTO RIGHTS NEEDED | Hidden (no photo) | Colour variant (grey / ivory / red) is not stored; the photo must match the colour in stock. |
| Brake Fluid DOT 4 (500 ml) (`f1e93c21-b118-45d8-b24b-762acb8b8c1c`, Hebron) | Bosch | 1987479106 (BF4-500ML) | Reference only: Bosch aftermarket catalogue (ap-ecat.boschaftermarket.com) | Robert Bosch GmbH | Commercial use needs Bosch's prior written consent | — | VERIFIED PRODUCT — PHOTO RIGHTS NEEDED | Hidden (no photo) | Photo must show DOT 4, 500 ml, the 1987479106 pack (not the 1 L 1987479107). |
| ATF 220 Dexron IID Transmission Fluid 1L (`8b9e1f70-312c-4ded-984b-d3c4425b2509`, Hebron) | Mobil | Mobil ATF 220, 1 L | Reference only: https://www.mobil.com/en/sap/our-products/products/mobil-atf-220 | ExxonMobil | No reuse permission found | — | VERIFIED PRODUCT — PHOTO RIGHTS NEEDED | Hidden (no photo) | Photo must show the 1 L ATF 220 can. |
| H7 Halogen Bulbs 12V 55W (pair) (`cb98327a-0804-4182-b832-3b9d5cafe92a`, Ramallah) | Philips | 12972PRC2 (Vision H7, 2-pack) | Reference only: Philips / Lumileds datasheets (documents.philips.com) | Lumileds (Philips brand licensee) | No reuse permission found | — | VERIFIED PRODUCT — PHOTO RIGHTS NEEDED | Hidden (no photo) | Photo must show the Vision 12972PRC2 two-pack, not the single 12972PRC1. |
| Roof Rack Cross Bars (`40c385e7-9e22-447c-98ba-d3427347b7ab`, Al-Mahaba) | Thule | Thule 711200 WingBar Evo 118, silver | Reference only: distributor listings (no Thule page confirmed) | Thule Group | No reuse permission found | — | VERIFIED PRODUCT — PHOTO RIGHTS NEEDED | Hidden (no photo) | Must be the 118 cm silver 711200 (black is 711220). Also a data issue before exposure: description says "with locks", distributors say locks are not included with the bars. |

**To unblock:** the shop photographs its own stock (simplest and fully owned), or MOTEXA gets written permission / dealer-media access from the manufacturer or its local distributor. Upload with `PATCH /admin/parts/products/:id` or the provider edit screen, and record the source and permission here. Thule's "with locks" description should be confirmed before that product is exposed.

## Final verified photo target list (data cleanup, 2026-10-29)

Supersedes the "Status" and "Ready for a licensed photo" lists below, which are kept as history. Fixes were applied through `PATCH /admin/parts/products/:id` (normal admin audit log) and mirrored in `backend/src/seed/test-accounts.ts`. Price, stock, category, condition, hidden state, shop, IDs and fitments were not touched. Fitment "N/A" = universal product, no vehicle fitment stored.

| # | Product | Brand | Final Verified Identifier | Identity Status | Fitment Status | Ready For Photo | Notes |
|---|---|---|---|---|---|---|---|
| 1 | Dash Camera A400 1440P | 70mai | 70mai A400 (stored SKU `70MAI-A400`) | VERIFIED (official 70mai page: 2560x1440) | N/A | YES | **Corrected:** name "Dash Camera Full HD" → "Dash Camera A400 1440P"; description "Full HD" → "1440P (2560x1440)". Colour (grey / ivory / red) is not stored: confirm with the shop before choosing the image. |
| 2 | Brake Fluid DOT 4 (500 ml) | Bosch | 1987479106 (BF4-500ML) | VERIFIED | N/A | YES | **Corrected:** part number 1987479107 (the 1 L code) → 1987479106. Name, description and price all describe the 500 ml product. Source: Bosch aftermarket catalogue entries for both numbers plus distributor listings; the Bosch catalogue returned HTTP 502 when re-checked today. |
| 3 | Front Brake Pads Set | Bosch | none (`BP-0986-424` is a truncated prefix) | UNCERTAIN | FITMENT NEEDS MANUAL REVIEW (Corolla 2014-19, Camry 2012-17 2.5L) | NO — IDENTITY UNCERTAIN | Needs the full 10-digit Bosch number. |
| 4 | Front Brake Discs (pair) | Brembo | 09.A727.11 (stored `09A72711`) | VERIFIED (official Brembo page: front, 280 mm, ventilated, UV painted, 2 units per box) | FITMENT NEEDS MANUAL REVIEW (Golf 2012-18, Octavia 2013-19) | NO — FITMENT UNCERTAIN | "(pair)" is correct; the earlier "sold per disc" flag was wrong. The Brembo page lists no applications, and its 68 mm centring does not suit the 57.1 mm VW hub, so the VW fitment is doubtful. |
| 5 | Tire 205/55 R16 Turanza | Bridgestone | Turanza 205/55 R16 91V, generation unknown | UNCERTAIN | N/A | NO — IDENTITY UNCERTAIN | T001 / T005 / Turanza 6 look different. |
| 6 | Edge 5W-30 Engine Oil 4L | Castrol | EDGE 5W-30 4L, variant unknown | UNCERTAIN | N/A | NO — IDENTITY UNCERTAIN | LL / M / other variants use different packs. |
| 7 | Alternator 120A | Denso | not found (`DAN-1211`) | UNCERTAIN | FITMENT NEEDS MANUAL REVIEW (Sportage 2016-21) | NO — IDENTITY UNCERTAIN | |
| 8 | Alloy Wheel 15-inch (Refurbished) | Enkei | none | UNCERTAIN | N/A (none stored) | NO — IDENTITY UNCERTAIN | No wheel model. |
| 9 | Timing Belt Kit with Water Pump | Gates | KP15578XS | VERIFIED (distributor listings only) | FITMENT NEEDS MANUAL REVIEW (stored Golf / Octavia; distributors list Nissan / Renault) | NO — FITMENT UNCERTAIN | Fitment conflict. |
| 10 | OBD2 Diagnostic Scanner | Launch | CRP123, variant unknown | UNCERTAIN | N/A | NO — IDENTITY UNCERTAIN | CRP123 / V2.0 / X / E / I. |
| 11 | Air Filter | Mahle | not confirmed (`LX-1780`; only LX 1780/3 found) | UNCERTAIN | FITMENT NEEDS MANUAL REVIEW (Elantra 2016-20) | NO — IDENTITY UNCERTAIN | Not changed to LX 1780/3: that is a round cartridge for VW / Audi / Mercedes, while this record is a "panel" filter for a Hyundai. Which product the shop has is unclear. |
| 12 | Engine Oil Filter | Mann | W 712/95 | VERIFIED (official Mann-Filter catalogue) | FITMENT NEEDS MANUAL REVIEW (stored Corolla / Yaris; published applications are VW / Audi) | NO — FITMENT UNCERTAIN | Fitment conflict. |
| 13 | Tire 195/65 R15 Energy Saver | Michelin | Energy Saver 195/65 R15 91H (EU tyre label exists) | VERIFIED | FITMENT NEEDS MANUAL REVIEW (Corolla 2010-18) | NO — FITMENT UNCERTAIN | |
| 14 | ATF 220 Dexron IID Transmission Fluid 1L | Mobil | Mobil ATF 220, 1 L (stored SKU `ATF-220-1L`) | VERIFIED (official Mobil product page: Dexron IID) | N/A | YES | **Corrected:** name "ATF Dexron III Transmission Fluid 1L" → "ATF 220 Dexron IID Transmission Fluid 1L". |
| 15 | Front Shock Absorber | Monroe | not found (`G16453`) | UNCERTAIN | FITMENT NEEDS MANUAL REVIEW (Corolla 2014-19) | NO — IDENTITY UNCERTAIN | |
| 16 | Iridium Spark Plug Set (4 pcs) | NGK | ILKAR7B11, stock no. 4912 (stored `ILKAR7B11-4`) | VERIFIED (distributor listings) | FITMENT NEEDS MANUAL REVIEW (Elantra, Tucson, Sportage) | NO — FITMENT UNCERTAIN | |
| 17 | Alloy Wheel 16" (Used) | OZ | none | UNCERTAIN | N/A (none stored) | NO — IDENTITY UNCERTAIN | |
| 18 | Rubber Floor Mats (4 pcs) | Petex | none (no "PTX" line) | UNCERTAIN | N/A | NO — IDENTITY UNCERTAIN | |
| 19 | H7 Halogen Bulbs 12V 55W (pair) | Philips | 12972PRC2 (Vision H7, 2-pack) | VERIFIED (Philips datasheets) | N/A (H7 base) | YES | |
| 20 | Clutch Kit 3-piece | Sachs | not found (`3000950936`) | UNCERTAIN | FITMENT NEEDS MANUAL REVIEW (Golf / Octavia 2009-13) | NO — IDENTITY UNCERTAIN | |
| 21 | Hydraulic Floor Jack 2T (Used) | Sealey | Sealey 1050CX (stored `SEAL-1050CX-U`) | VERIFIED model, used unit | N/A | NO — IDENTITY UNCERTAIN | Used item of unknown state: needs the shop's own photo, not a new-product image. |
| 22 | Socket Wrench Set 46 pcs | Stanley | not found (`STMT74393`) | UNCERTAIN | N/A | NO — IDENTITY UNCERTAIN | |
| 23 | Roof Rack Cross Bars | Thule | Thule 711200 WingBar Evo 118, silver (stored `TH-711200`) | VERIFIED (distributor listings) | N/A (bars only) | YES | Description says "with locks"; distributors say locks are not included with the bars. Not changed (distributor-only evidence). |
| 24 | Coolant Antifreeze 5L | Total | none (Coolelf range) | UNCERTAIN | N/A | NO — IDENTITY UNCERTAIN | |
| 25 | Quartz 7000 10W-40 Engine Oil 5L | Total | Quartz 7000 10W-40 5 L, variant unknown | UNCERTAIN | N/A | NO — IDENTITY UNCERTAIN | Energy / Diesel variants. |
| 26 | Brake Disc Front (Genuine) | Toyota | not found (`43512-02220`) | UNCERTAIN | FITMENT NEEDS MANUAL REVIEW (Corolla 2014-19) | NO — IDENTITY UNCERTAIN | |
| 27 | Steering Rack (Remanufactured) | TRW | JRP1034 | VERIFIED (distributor listings) | FITMENT NEEDS MANUAL REVIEW (stored Hyundai Accent; distributors list VW Touareg 7L) | NO — FITMENT UNCERTAIN | Fitment conflict. |
| 28 | Headlight Assembly Left (Used) | Valeo | none | UNCERTAIN | FITMENT NEEDS MANUAL REVIEW (Mercedes C-Class 2014-21) | NO — IDENTITY UNCERTAIN | |
| 29 | Radiator | Valeo | Valeo 735041 (stored `VAL-735041`) | VERIFIED (distributor listings) | FITMENT NEEDS MANUAL REVIEW (stored Peugeot 301 / 208; distributors list Fiat / Opel / Lancia / Alfa) | NO — FITMENT UNCERTAIN | Fitment conflict. |
| 30 | Car Battery 60Ah | Varta | not confirmed (`E24-560409`) | UNCERTAIN | FITMENT NEEDS MANUAL REVIEW (Yaris, Picanto) | NO — IDENTITY UNCERTAIN | Series and code disagree across sources. |
| 31 | Front Bumper Cover (Used) | Depo | none | UNCERTAIN | FITMENT NEEDS MANUAL REVIEW (Yaris 2012-19) | NO — IDENTITY UNCERTAIN | |
| 32 | Universal LED Headlight Bulb Kit (…for testing) | NoName | none | TEST RECORD | N/A | NO — TEST/EXCLUDED | Name says "for testing"; admin-hidden. |

Summary: 3 products corrected (#1, #2, #14). 0 fitments changed: no stored fitment could be confirmed against a manufacturer application list, and 6 conflict with published applications (#4, #9, #11, #12, #27, #29). READY FOR PHOTO: 5 (#1, #2, #14, #19, #23). Blocked: 19 identity uncertain, 7 fitment uncertain, 1 test/excluded. 16 products carry fitments; all 16 need manual review.

## Status (photo sourcing pass; superseded by the list above)

| # | Product | Brand | Verified ID | Image Source | Image Status | Upload Result | Customer Visible | Notes |
|---|---|---|---|---|---|---|---|---|
| 1 | Dash Camera Full HD | 70mai | 70mai A400 (stored `70MAI-A400`, C) | Reference only: [70mai EU store](https://eu.70mai.store/de/products/a400-dashcam-de) | PRODUCT IDENTITY NEEDS REVIEW | Not uploaded | No | Name says Full HD; the A400 is a 1440P camera. |
| 2 | Brake Fluid DOT 4 (500 ml) | Bosch | Conflict (E): stored 1987479107 = BF4-1L; 500 ml is 1987479106 | Reference only: [Bosch catalogue](https://ap-ecat.boschaftermarket.com/PH/en_PH/products/1987479107) | PRODUCT IDENTITY NEEDS REVIEW | Not uploaded | No | Size/number mismatch. Resolve before any photo. |
| 3 | Front Brake Pads Set | Bosch | None (`BP-0986-424` is a truncated prefix, C) | none | PRODUCT IDENTITY NEEDS REVIEW | Not uploaded | No | Needs the full 10-digit Bosch number and vehicle. |
| 4 | Front Brake Discs (pair) | Brembo | 09.A727.11 (A; stored without dots) | Reference only: [Brembo catalogue](https://www.bremboparts.com/asiapacific/ar/catalogue/disc/09-A727-11) | VERIFIED — IMAGE NOT LICENSED/AVAILABLE | Not uploaded | No | Brembo lists the number per disc; name says "(pair)". Confirm quantity. |
| 5 | Tire 205/55 R16 Turanza | Bridgestone | Turanza 205/55 R16, generation unknown (C) | none | PRODUCT IDENTITY NEEDS REVIEW | Not uploaded | No | T001 / T005 / Turanza 6 / Serenity Plus look different. |
| 6 | Edge 5W-30 Engine Oil 4L | Castrol | EDGE 5W-30 4L, variant unknown (C) | none | PRODUCT IDENTITY NEEDS REVIEW | Not uploaded | No | LL / M / other variants. |
| 7 | Alternator 120A | Denso | Not found (`DAN-1211`, D) | none | PRODUCT IDENTITY NEEDS REVIEW | Not uploaded | No | DAN1212 is an 80 A unit; 120 A unverified. |
| 8 | Alloy Wheel 15-inch (Refurbished) | Enkei | None (C) | none | PRODUCT IDENTITY NEEDS REVIEW | Not uploaded | No | Refurbished wheel with no model. |
| 9 | Timing Belt Kit with Water Pump | Gates | KP15578XS (B) | none (Gates page not found) | VERIFIED — IMAGE NOT LICENSED/AVAILABLE | Not uploaded | No | Retailer-verified only; confirm on Gates catalogue. |
| 10 | OBD2 Diagnostic Scanner | Launch | CRP123, variant unknown (B) | none | PRODUCT IDENTITY NEEDS REVIEW | Not uploaded | No | CRP123 / V2.0 / X / E / I differ. |
| 11 | Air Filter | Mahle | Not confirmed (`LX-1780`; only LX 1780/3 exists, D) | none | PRODUCT IDENTITY NEEDS REVIEW | Not uploaded | No | Missing suffix. |
| 12 | Engine Oil Filter | Mann | W 712/95 (A) | Reference only: [Mann-Filter catalogue](https://www.mann-filter.com/us-en/catalog/search-results/product.html/w712/95_mann-filter.html) | VERIFIED — IMAGE NOT LICENSED/AVAILABLE | Not uploaded | No | |
| 13 | Tire 195/65 R15 Energy Saver | Michelin | Energy Saver 195/65 R15 91H, version unknown (C) | none | PRODUCT IDENTITY NEEDS REVIEW | Not uploaded | No | Energy Saver vs Energy Saver+. |
| 14 | ATF Dexron III Transmission Fluid 1L | Mobil | Conflict (E): Mobil ATF 220 is Dexron IID | none | PRODUCT IDENTITY NEEDS REVIEW | Not uploaded | No | Name says Dexron III. |
| 15 | Front Shock Absorber | Monroe | Not found (`G16453`, D) | none | PRODUCT IDENTITY NEEDS REVIEW | Not uploaded | No | |
| 16 | Iridium Spark Plug Set (4 pcs) | NGK | ILKAR7B11, stock no. 4912 (B; `-4` is a shop pack suffix) | none | VERIFIED — IMAGE NOT LICENSED/AVAILABLE | Not uploaded | No | Retailer-verified; not ILZKAR7B11. |
| 17 | Alloy Wheel 16" (Used) | OZ | None (C) | none | PRODUCT IDENTITY NEEDS REVIEW | Not uploaded | No | Used wheel, no model. |
| 18 | Rubber Floor Mats (4 pcs) | Petex | None (`PTX-MAT-4`, C) | none | PRODUCT IDENTITY NEEDS REVIEW | Not uploaded | No | No Petex "PTX" line exists. |
| 19 | H7 Halogen Bulbs 12V 55W (pair) | Philips | 12972PRC2, Vision H7 2-pack (A) | Reference only: Philips datasheets on documents.philips.com | VERIFIED — IMAGE NOT LICENSED/AVAILABLE | Not uploaded | No | Number and "(pair)" agree. |
| 20 | Clutch Kit 3-piece | Sachs | Not found (`3000950936`, D) | none | PRODUCT IDENTITY NEEDS REVIEW | Not uploaded | No | |
| 21 | Hydraulic Floor Jack 2T (Used) | Sealey | Sealey 1050CX (stored `SEAL-1050CX-U`, C) | none | PRODUCT IDENTITY NEEDS REVIEW | Not uploaded | No | Used item: a new-product photo would misrepresent it. Needs a photo of the actual unit. |
| 22 | Socket Wrench Set 46 pcs | Stanley | Not found (`STMT74393`, D) | none | PRODUCT IDENTITY NEEDS REVIEW | Not uploaded | No | Known 46-pc set is STMT72794-8. |
| 23 | Roof Rack Cross Bars | Thule | Thule 711200 WingBar Evo 118 silver (stored `TH-711200`, B) | none (retailers only) | VERIFIED — IMAGE NOT LICENSED/AVAILABLE | Not uploaded | No | Retailer-verified; confirm on thule.com. |
| 24 | Coolant Antifreeze 5L | Total | None (Coolelf range, C) | none | PRODUCT IDENTITY NEEDS REVIEW | Not uploaded | No | |
| 25 | Quartz 7000 10W-40 Engine Oil 5L | Total | Quartz 7000 10W-40, variant unknown (C) | none | PRODUCT IDENTITY NEEDS REVIEW | Not uploaded | No | Energy vs Diesel. |
| 26 | Brake Disc Front (Genuine) | Toyota | Not found (`43512-02220`, D) | none | PRODUCT IDENTITY NEEDS REVIEW | Not uploaded | No | Verify in a Toyota parts catalogue. |
| 27 | Steering Rack (Remanufactured) | TRW | JRP1034, VW Touareg 7L (B) | none (retailers only) | VERIFIED — IMAGE NOT LICENSED/AVAILABLE | Not uploaded | No | Retailer-verified. A remanufactured unit; a photo of the actual unit is better. |
| 28 | Headlight Assembly Left (Used) | Valeo | None (C) | none | PRODUCT IDENTITY NEEDS REVIEW | Not uploaded | No | Used, trim unknown. |
| 29 | Radiator | Valeo | Valeo 735041 (stored `VAL-735041`, B) | none (retailers only) | PRODUCT IDENTITY NEEDS REVIEW | Not uploaded | No | Seed fitments (Peugeot 301/208) conflict with retailer fitments (Fiat/Opel/Lancia/Alfa). |
| 30 | Car Battery 60Ah | Varta | Not confirmed (`E24-560409`, D) | none | PRODUCT IDENTITY NEEDS REVIEW | Not uploaded | No | Series/code disagree across sources. |
| 31 | Front Bumper Cover (Used) | Depo | None (C) | none | PRODUCT IDENTITY NEEDS REVIEW | Not uploaded | No | Used; year/trim unknown. |
| 32 | Universal LED Headlight Bulb Kit (…for testing) | NoName | None (C) | none | PRODUCT IDENTITY NEEDS REVIEW | Not uploaded | No | Test-titled and admin-hidden; probably not real inventory. |

## Excluded

| Product | Shop | Status |
|---|---|---|
| Cabin Air Filter (CF-2210) | Speedy Spares (REJECTED) | EXCLUDED TEST PRODUCT |
| Spark Plug Set (04465-02220) | Speedy Spares (REJECTED) | EXCLUDED TEST PRODUCT |
| [ADMUI] Test Oil Filter (ADM-UI-001) | Hebron Spare Parts Center | EXCLUDED TEST PRODUCT |

## NEEDS MANUAL PRODUCT IDENTIFICATION

#1, #2, #3, #5, #6, #7, #8, #10, #11, #13, #14, #15, #17, #18, #20, #21, #22, #24, #25, #26, #28, #29, #30, #31, #32 (25 products). They stay hidden from customers until identified and photographed.

## Ready for a licensed photo

#4 Brembo 09.A727.11, #9 Gates KP15578XS, #12 Mann W 712/95, #16 NGK ILKAR7B11, #19 Philips 12972PRC2, #23 Thule 711200, #27 TRW JRP1034 (7 products). Identity is verified; what is missing is an image MOTEXA may use. Legitimate routes: the shop photographs its own stock, the shop supplies the supplier's media with permission, or MOTEXA gets reseller media access from the manufacturer/distributor. Record the source here when one is uploaded.

## Existing image audit

- 34 `PRODUCT_IMAGE` rows exist (32 targets + 2 Speedy Spares). All are 96x96 seed tiles of 233–264 bytes generated by `backend/src/seed/test-accounts.ts`. Several products share the same tile bytes (8 shared groups).
- None of them matches any image under `mobile/assets`, `mobile/src` or `backend/src` (sha256 compared): no admin, mascot, blueprint or other UI art is attached to a product.
- 9 placeholder files on disk no longer match the sha256 stored in their row (a later seed run rewrote the files). Harmless for placeholders; noted for data hygiene.
- At first the placeholder rows and files were kept and only hidden by the API `realPhoto()` guard.
- **2026-10-29 cleanup:** all 34 seed tiles (rows + files) were deleted from the dev DB, and `seed/test-accounts.ts` no longer creates product images (it also removes legacy tiles under 2048 bytes from the products it seeds). Products without a photo remain valid admin / provider records and stay hidden from customers.
