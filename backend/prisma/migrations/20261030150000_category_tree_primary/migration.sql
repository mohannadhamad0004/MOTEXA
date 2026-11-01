-- AlterTable
ALTER TABLE "PartsProduct" ADD COLUMN     "legacyCategory" TEXT;


-- Keep every product's category as it was (additive; nothing reads it).
UPDATE "PartsProduct" SET "legacyCategory" = "category" WHERE "legacyCategory" IS NULL;

-- One primary category per product, always the most specific one. Products still on a broad category that now has
-- sub-categories move by what their name says; a product that matches none stays where it is (it still shows under its
-- category, and the shop must pick a sub-category the next time it edits the product). Each product moves at most once.
UPDATE "PartsProduct" SET "category" = 'BULBS'                WHERE "category" = 'LIGHTING'     AND "name" ~* 'bulb';
UPDATE "PartsProduct" SET "category" = 'FOG_LIGHTS'           WHERE "category" = 'LIGHTING'     AND "name" ~* 'fog';
UPDATE "PartsProduct" SET "category" = 'TAIL_LIGHTS'          WHERE "category" = 'LIGHTING'     AND "name" ~* '(tail|rear) ?light';
UPDATE "PartsProduct" SET "category" = 'HEADLIGHTS'           WHERE "category" = 'LIGHTING'     AND "name" ~* 'head ?light';
UPDATE "PartsProduct" SET "category" = 'BATTERIES'            WHERE "category" = 'ELECTRICAL'   AND "name" ~* 'batter';
UPDATE "PartsProduct" SET "category" = 'ALTERNATORS_STARTERS' WHERE "category" = 'ELECTRICAL'   AND "name" ~* '(alternator|starter)';
UPDATE "PartsProduct" SET "category" = 'WIRING_FUSES'         WHERE "category" = 'ELECTRICAL'   AND "name" ~* '(wir|fuse|relay)';
UPDATE "PartsProduct" SET "category" = 'BRAKE_PADS'           WHERE "category" = 'BRAKE_SYSTEM' AND "name" ~* 'pad';
UPDATE "PartsProduct" SET "category" = 'BRAKE_DISCS'          WHERE "category" = 'BRAKE_SYSTEM' AND "name" ~* '(disc|rotor)';
UPDATE "PartsProduct" SET "category" = 'CABIN_FILTERS'        WHERE "category" = 'FILTERS'      AND "name" ~* 'cabin';
UPDATE "PartsProduct" SET "category" = 'OIL_FILTERS'          WHERE "category" = 'FILTERS'      AND "name" ~* 'oil filter';
UPDATE "PartsProduct" SET "category" = 'AIR_FILTERS'          WHERE "category" = 'FILTERS'      AND "name" ~* 'air filter';
UPDATE "PartsProduct" SET "category" = 'SPARK_PLUGS'          WHERE "category" = 'ENGINE'       AND "name" ~* 'spark';
UPDATE "PartsProduct" SET "category" = 'TIMING_BELTS'         WHERE "category" = 'ENGINE'       AND "name" ~* 'timing';
