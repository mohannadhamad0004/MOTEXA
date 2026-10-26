-- Frees the "MechanicDocument" name for the profile-based onboarding table created in 20261025120000_mechanic_onboarding.
-- Rename only: no data is changed or dropped. RENAME CONSTRAINT also renames the primary key's index.
ALTER TABLE "MechanicDocument" RENAME TO "MechanicApplicationDocument";
ALTER TABLE "MechanicApplicationDocument" RENAME CONSTRAINT "MechanicDocument_pkey" TO "MechanicApplicationDocument_pkey";
ALTER TABLE "MechanicApplicationDocument" RENAME CONSTRAINT "MechanicDocument_applicationId_fkey" TO "MechanicApplicationDocument_applicationId_fkey";
