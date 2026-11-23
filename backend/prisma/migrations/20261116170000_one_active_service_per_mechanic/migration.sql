-- A pending request does not reserve a mechanic. Only ACCEPTED/IN_PROGRESS do.
-- Preserve all existing rows: abort rather than rewriting conflicting services.
BEGIN;
LOCK TABLE "ServiceRequest" IN SHARE ROW EXCLUSIVE MODE;
DO $$
BEGIN
 IF EXISTS (
  SELECT 1 FROM "ServiceRequest"
  WHERE "status" IN ('ACCEPTED','IN_PROGRESS')
  GROUP BY "mechanicId" HAVING COUNT(*) > 1
 ) THEN
  RAISE EXCEPTION 'Resolve existing active-service conflicts before applying the capacity rule';
 END IF;
END $$;
CREATE UNIQUE INDEX "ServiceRequest_one_active_mechanic"
 ON "ServiceRequest" ("mechanicId")
 WHERE "status" IN ('ACCEPTED','IN_PROGRESS');
COMMIT;
