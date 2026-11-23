CREATE TABLE "ServiceRequest" (
 "id" TEXT NOT NULL,
 "customerId" TEXT NOT NULL,
 "mechanicId" TEXT NOT NULL,
 "clientRequestId" TEXT NOT NULL,
 "mode" TEXT NOT NULL CHECK ("mode" IN ('WORKSHOP','ON_SITE','ONLINE')),
 "title" TEXT NOT NULL,
 "description" TEXT NOT NULL,
 "vehicle" TEXT NOT NULL,
 "contactNumber" TEXT NOT NULL,
 "address" TEXT NOT NULL DEFAULT '',
 "status" TEXT NOT NULL DEFAULT 'NEW' CHECK ("status" IN ('NEW','ACCEPTED','IN_PROGRESS','COMPLETED','DECLINED','CANCELLED')),
 "version" INTEGER NOT NULL DEFAULT 0,
 "decisionNote" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "ServiceRequest_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "ServiceRequest_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "ServiceRequest_mechanicId_fkey" FOREIGN KEY ("mechanicId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ServiceRequest_customerId_clientRequestId_key" ON "ServiceRequest"("customerId","clientRequestId");
CREATE INDEX "ServiceRequest_mechanicId_status_createdAt_idx" ON "ServiceRequest"("mechanicId","status","createdAt");
CREATE INDEX "ServiceRequest_customerId_createdAt_idx" ON "ServiceRequest"("customerId","createdAt");
