-- CreateTable
CREATE TABLE "shop_memberships" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "customerId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "shop_memberships_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "shop_memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "shop_memberships_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_audit_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actor" TEXT NOT NULL DEFAULT 'local',
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "before" TEXT,
    "after" TEXT,
    "details" TEXT,
    "proposalId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "shopId" TEXT,
    CONSTRAINT "audit_logs_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_audit_logs" ("action", "actor", "after", "before", "createdAt", "details", "entityId", "entityType", "id", "proposalId", "summary") SELECT "action", "actor", "after", "before", "createdAt", "details", "entityId", "entityType", "id", "proposalId", "summary" FROM "audit_logs";
DROP TABLE "audit_logs";
ALTER TABLE "new_audit_logs" RENAME TO "audit_logs";
CREATE UNIQUE INDEX "audit_logs_proposalId_key" ON "audit_logs"("proposalId");
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");
CREATE TABLE "new_camera_alerts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clipPath" TEXT NOT NULL,
    "capturedAt" DATETIME NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewedAt" DATETIME,
    "reviewNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "shopId" TEXT,
    CONSTRAINT "camera_alerts_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_camera_alerts" ("capturedAt", "clipPath", "createdAt", "durationMs", "id", "reviewNote", "reviewedAt", "status", "updatedAt") SELECT "capturedAt", "clipPath", "createdAt", "durationMs", "id", "reviewNote", "reviewedAt", "status", "updatedAt" FROM "camera_alerts";
DROP TABLE "camera_alerts";
ALTER TABLE "new_camera_alerts" RENAME TO "camera_alerts";
CREATE UNIQUE INDEX "camera_alerts_clipPath_key" ON "camera_alerts"("clipPath");
CREATE INDEX "camera_alerts_capturedAt_idx" ON "camera_alerts"("capturedAt");
CREATE TABLE "new_cash_reconciliations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessDate" DATETIME NOT NULL,
    "expectedPaisa" INTEGER NOT NULL,
    "countedPaisa" INTEGER NOT NULL,
    "differencePaisa" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "shopId" TEXT,
    CONSTRAINT "cash_reconciliations_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_cash_reconciliations" ("businessDate", "countedPaisa", "createdAt", "differencePaisa", "expectedPaisa", "id", "note", "updatedAt") SELECT "businessDate", "countedPaisa", "createdAt", "differencePaisa", "expectedPaisa", "id", "note", "updatedAt" FROM "cash_reconciliations";
DROP TABLE "cash_reconciliations";
ALTER TABLE "new_cash_reconciliations" RENAME TO "cash_reconciliations";
CREATE UNIQUE INDEX "cash_reconciliations_businessDate_key" ON "cash_reconciliations"("businessDate");
CREATE TABLE "new_customers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "note" TEXT,
    "proposalId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "shopId" TEXT,
    CONSTRAINT "customers_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_customers" ("createdAt", "id", "name", "note", "phone", "proposalId", "updatedAt") SELECT "createdAt", "id", "name", "note", "phone", "proposalId", "updatedAt" FROM "customers";
DROP TABLE "customers";
ALTER TABLE "new_customers" RENAME TO "customers";
CREATE UNIQUE INDEX "customers_proposalId_key" ON "customers"("proposalId");
CREATE INDEX "customers_name_idx" ON "customers"("name");
CREATE INDEX "customers_phone_idx" ON "customers"("phone");
CREATE TABLE "new_expenses" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "category" TEXT NOT NULL,
    "amountPaisa" INTEGER NOT NULL,
    "spentAt" DATETIME NOT NULL,
    "note" TEXT,
    "proposalId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "shopId" TEXT,
    CONSTRAINT "expenses_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_expenses" ("amountPaisa", "category", "createdAt", "id", "note", "proposalId", "spentAt") SELECT "amountPaisa", "category", "createdAt", "id", "note", "proposalId", "spentAt" FROM "expenses";
DROP TABLE "expenses";
ALTER TABLE "new_expenses" RENAME TO "expenses";
CREATE UNIQUE INDEX "expenses_proposalId_key" ON "expenses"("proposalId");
CREATE INDEX "expenses_spentAt_idx" ON "expenses"("spentAt");
CREATE TABLE "new_payments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT NOT NULL,
    "amountPaisa" INTEGER NOT NULL,
    "note" TEXT,
    "proposalId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "shopId" TEXT,
    CONSTRAINT "payments_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "payments_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_payments" ("amountPaisa", "createdAt", "customerId", "id", "note", "proposalId") SELECT "amountPaisa", "createdAt", "customerId", "id", "note", "proposalId" FROM "payments";
DROP TABLE "payments";
ALTER TABLE "new_payments" RENAME TO "payments";
CREATE UNIQUE INDEX "payments_proposalId_key" ON "payments"("proposalId");
CREATE INDEX "payments_customerId_createdAt_idx" ON "payments"("customerId", "createdAt");
CREATE TABLE "new_products" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "nameNormalized" TEXT NOT NULL,
    "category" TEXT,
    "barcode" TEXT,
    "unit" TEXT NOT NULL,
    "costPricePaisa" INTEGER NOT NULL,
    "salePricePaisa" INTEGER NOT NULL,
    "stockMilli" INTEGER NOT NULL DEFAULT 0,
    "lowStockMilli" INTEGER NOT NULL DEFAULT 0,
    "imagePath" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "proposalId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "shopId" TEXT,
    CONSTRAINT "products_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_products" ("barcode", "category", "costPricePaisa", "createdAt", "id", "imagePath", "isActive", "lowStockMilli", "name", "nameNormalized", "proposalId", "salePricePaisa", "stockMilli", "unit", "updatedAt") SELECT "barcode", "category", "costPricePaisa", "createdAt", "id", "imagePath", "isActive", "lowStockMilli", "name", "nameNormalized", "proposalId", "salePricePaisa", "stockMilli", "unit", "updatedAt" FROM "products";
DROP TABLE "products";
ALTER TABLE "new_products" RENAME TO "products";
CREATE UNIQUE INDEX "products_nameNormalized_key" ON "products"("nameNormalized");
CREATE UNIQUE INDEX "products_barcode_key" ON "products"("barcode");
CREATE UNIQUE INDEX "products_proposalId_key" ON "products"("proposalId");
CREATE INDEX "products_isActive_name_idx" ON "products"("isActive", "name");
CREATE TABLE "new_sales" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "number" TEXT NOT NULL,
    "totalPaisa" INTEGER NOT NULL,
    "discountPaisa" INTEGER NOT NULL DEFAULT 0,
    "paidPaisa" INTEGER NOT NULL,
    "changePaisa" INTEGER NOT NULL DEFAULT 0,
    "paymentMethod" TEXT NOT NULL DEFAULT 'CASH',
    "note" TEXT,
    "customerId" TEXT,
    "voidedAt" DATETIME,
    "voidedReason" TEXT,
    "proposalId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "shopId" TEXT,
    CONSTRAINT "sales_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "sales_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_sales" ("changePaisa", "createdAt", "customerId", "discountPaisa", "id", "note", "number", "paidPaisa", "paymentMethod", "proposalId", "totalPaisa", "voidedAt", "voidedReason") SELECT "changePaisa", "createdAt", "customerId", "discountPaisa", "id", "note", "number", "paidPaisa", "paymentMethod", "proposalId", "totalPaisa", "voidedAt", "voidedReason" FROM "sales";
DROP TABLE "sales";
ALTER TABLE "new_sales" RENAME TO "sales";
CREATE UNIQUE INDEX "sales_number_key" ON "sales"("number");
CREATE UNIQUE INDEX "sales_proposalId_key" ON "sales"("proposalId");
CREATE INDEX "sales_createdAt_idx" ON "sales"("createdAt");
CREATE INDEX "sales_customerId_createdAt_idx" ON "sales"("customerId", "createdAt");
CREATE TABLE "new_stock_movements" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "quantityMilli" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "reference" TEXT,
    "note" TEXT,
    "proposalId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "shopId" TEXT,
    CONSTRAINT "stock_movements_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "stock_movements_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_stock_movements" ("createdAt", "id", "note", "productId", "proposalId", "quantityMilli", "reason", "reference") SELECT "createdAt", "id", "note", "productId", "proposalId", "quantityMilli", "reason", "reference" FROM "stock_movements";
DROP TABLE "stock_movements";
ALTER TABLE "new_stock_movements" RENAME TO "stock_movements";
CREATE UNIQUE INDEX "stock_movements_proposalId_key" ON "stock_movements"("proposalId");
CREATE INDEX "stock_movements_productId_createdAt_idx" ON "stock_movements"("productId", "createdAt");
CREATE TABLE "new_users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'OWNER',
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "customerId" TEXT,
    CONSTRAINT "users_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_users" ("createdAt", "customerId", "id", "name", "passwordHash", "role", "tokenVersion", "updatedAt", "username") SELECT "createdAt", "customerId", "id", "name", "passwordHash", "role", "tokenVersion", "updatedAt", "username" FROM "users";
DROP TABLE "users";
ALTER TABLE "new_users" RENAME TO "users";
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
CREATE UNIQUE INDEX "users_customerId_key" ON "users"("customerId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "shop_memberships_customerId_key" ON "shop_memberships"("customerId");

-- CreateIndex
CREATE INDEX "shop_memberships_userId_status_idx" ON "shop_memberships"("userId", "status");

-- CreateIndex
CREATE INDEX "shop_memberships_shopId_status_idx" ON "shop_memberships"("shopId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "shop_memberships_shopId_userId_key" ON "shop_memberships"("shopId", "userId");

-- Phase 13 unit 13.2 backfill: the installation served exactly one shop, so
-- every existing business row belongs to it and every existing login gains a
-- matching membership. On a fresh (empty) database these statements are
-- no-ops, so the test suite builds the same schema from this migration.

UPDATE "products"
SET "shopId" = (SELECT "id" FROM "Shop" ORDER BY "createdAt" LIMIT 1)
WHERE "shopId" IS NULL;

UPDATE "stock_movements"
SET "shopId" = (SELECT "id" FROM "Shop" ORDER BY "createdAt" LIMIT 1)
WHERE "shopId" IS NULL;

UPDATE "sales"
SET "shopId" = (SELECT "id" FROM "Shop" ORDER BY "createdAt" LIMIT 1)
WHERE "shopId" IS NULL;

UPDATE "customers"
SET "shopId" = (SELECT "id" FROM "Shop" ORDER BY "createdAt" LIMIT 1)
WHERE "shopId" IS NULL;

UPDATE "payments"
SET "shopId" = (SELECT "id" FROM "Shop" ORDER BY "createdAt" LIMIT 1)
WHERE "shopId" IS NULL;

UPDATE "expenses"
SET "shopId" = (SELECT "id" FROM "Shop" ORDER BY "createdAt" LIMIT 1)
WHERE "shopId" IS NULL;

UPDATE "audit_logs"
SET "shopId" = (SELECT "id" FROM "Shop" ORDER BY "createdAt" LIMIT 1)
WHERE "shopId" IS NULL;

UPDATE "cash_reconciliations"
SET "shopId" = (SELECT "id" FROM "Shop" ORDER BY "createdAt" LIMIT 1)
WHERE "shopId" IS NULL;

UPDATE "camera_alerts"
SET "shopId" = (SELECT "id" FROM "Shop" ORDER BY "createdAt" LIMIT 1)
WHERE "shopId" IS NULL;

-- Every OWNER user becomes an ACTIVE OWNER member of the single shop.
INSERT INTO "shop_memberships" ("id", "shopId", "userId", "role", "status", "customerId", "createdAt", "updatedAt")
SELECT
  lower(hex(randomblob(16))),
  (SELECT "id" FROM "Shop" ORDER BY "createdAt" LIMIT 1),
  u."id",
  'OWNER',
  'ACTIVE',
  NULL,
  strftime('%Y-%m-%d %H:%M:%f', 'now'),
  strftime('%Y-%m-%d %H:%M:%f', 'now')
FROM "users" u
WHERE u."role" = 'OWNER';

-- Every user linked to a ledger customer holds that customer's shop and
-- ledger link. Owners are excluded so a user cannot gain two memberships
-- (the unique [shopId, userId] pair). A deleted customer leaves no row, so
-- a stale customerId links nothing.
INSERT INTO "shop_memberships" ("id", "shopId", "userId", "role", "status", "customerId", "createdAt", "updatedAt")
SELECT
  lower(hex(randomblob(16))),
  c."shopId",
  u."id",
  'CUSTOMER',
  'ACTIVE',
  c."id",
  strftime('%Y-%m-%d %H:%M:%f', 'now'),
  strftime('%Y-%m-%d %H:%M:%f', 'now')
FROM "users" u
JOIN "customers" c ON c."id" = u."customerId"
WHERE u."role" <> 'OWNER';
