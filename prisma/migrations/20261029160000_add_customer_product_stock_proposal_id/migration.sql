-- Phase 7: link assistant proposals to the customer, product, or stock movement
-- they created. Nullable so records entered on the normal screens are unaffected.
-- Unique so a replayed confirmation cannot record the same change twice.
ALTER TABLE "customers" ADD COLUMN "proposalId" TEXT;
CREATE UNIQUE INDEX "customers_proposalId_key" ON "customers"("proposalId");

ALTER TABLE "products" ADD COLUMN "proposalId" TEXT;
CREATE UNIQUE INDEX "products_proposalId_key" ON "products"("proposalId");

ALTER TABLE "stock_movements" ADD COLUMN "proposalId" TEXT;
CREATE UNIQUE INDEX "stock_movements_proposalId_key" ON "stock_movements"("proposalId");

-- Product edits are updates, not new rows, so the audit row is the idempotency
-- record. Nullable so existing audit entries are unaffected.
ALTER TABLE "audit_logs" ADD COLUMN "proposalId" TEXT;
CREATE UNIQUE INDEX "audit_logs_proposalId_key" ON "audit_logs"("proposalId");
