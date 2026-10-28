-- Phase 7: link a sale to the assistant proposal that created it.
-- Nullable so ordinary sell-screen sales are unaffected. Unique so a replayed
-- confirmation cannot create a second sale.
ALTER TABLE "sales" ADD COLUMN "proposalId" TEXT;
CREATE UNIQUE INDEX "sales_proposalId_key" ON "sales"("proposalId");
