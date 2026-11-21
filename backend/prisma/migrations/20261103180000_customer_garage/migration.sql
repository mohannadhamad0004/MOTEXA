BEGIN;

-- Preserve legacy generation IDs exactly. Stop atomically if a stale scalar cannot satisfy the new FK.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM "CustomerCar" c
    LEFT JOIN "VehicleGeneration" g ON g."id" = c."generationId"
    WHERE c."generationId" IS NOT NULL AND g."id" IS NULL
  ) THEN
    RAISE EXCEPTION 'Garage backfill blocked: legacy generation IDs need repair before migration';
  END IF;
END $$;

CREATE TABLE "CustomerGarageCar" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "nickname" VARCHAR(40),
  "make" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "color" TEXT,
  "generationId" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT false,
  "lastSelectedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CustomerGarageCar_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CustomerGarageCar_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CustomerGarageCar_generationId_fkey" FOREIGN KEY ("generationId") REFERENCES "VehicleGeneration"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "CustomerGarageCar_userId_idx" ON "CustomerGarageCar"("userId");
-- Deliberate raw SQL: the Prisma model documents this partial uniqueness constraint.
CREATE UNIQUE INDEX "CustomerGarageCar_one_active_per_user"
  ON "CustomerGarageCar"("userId") WHERE "isActive" = true;

-- A legacy car gets its user's existing UUID as its stable car ID; new cars use Prisma uuid().
-- User guard plus deterministic primary key prevents duplicate copies if this INSERT is repeated.
INSERT INTO "CustomerGarageCar"
  ("id", "userId", "make", "model", "year", "color", "generationId", "isActive", "lastSelectedAt", "createdAt", "updatedAt")
SELECT c."userId", c."userId", c."make", c."model", c."year", c."color", c."generationId", true, c."updatedAt", c."updatedAt", c."updatedAt"
FROM "CustomerCar" c
WHERE NOT EXISTS (SELECT 1 FROM "CustomerGarageCar" g WHERE g."userId" = c."userId")
ON CONFLICT ("id") DO NOTHING;

COMMIT;
