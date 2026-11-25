-- Why a Vehicle3DImport attempt failed (shown to the Parts Admin). Additive, nullable.
ALTER TABLE "Vehicle3DImport" ADD COLUMN "failureDetail" JSONB;
