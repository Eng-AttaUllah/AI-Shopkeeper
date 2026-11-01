-- Phase 7: link an expense or payment to the assistant proposal that created
-- it. Nullable so records entered on the normal screens are unaffected.
-- Unique so a replayed confirmation cannot record the same change twice.
ALTER TABLE "payments" ADD COLUMN "proposalId" TEXT;
CREATE UNIQUE INDEX "payments_proposalId_key" ON "payments"("proposalId");

ALTER TABLE "expenses" ADD COLUMN "proposalId" TEXT;
CREATE UNIQUE INDEX "expenses_proposalId_key" ON "expenses"("proposalId");
