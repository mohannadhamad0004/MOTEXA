-- One active tow request per customer + company (additive: one partial unique index, no column or data change).
-- Active = REQUESTED / ACCEPTED / EN_ROUTE / IN_PROGRESS, the same set the API refuses a second request for.
-- Prisma cannot model a partial index, so it lives only here (same approach as Vehicle3DSubmission_one_open_per_car).
CREATE UNIQUE INDEX "TowRequest_one_active_per_customer_company" ON "TowRequest"("customerId", "companyId") WHERE "status" IN ('REQUESTED', 'ACCEPTED', 'EN_ROUTE', 'IN_PROGRESS');
