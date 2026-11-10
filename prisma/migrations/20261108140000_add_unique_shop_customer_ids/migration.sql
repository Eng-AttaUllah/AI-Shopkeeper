-- Phase 13 unit 13.8: Add unique display IDs for shops (SP-000001) and customers (CST-000001)
-- SQLite does not support ALTER COLUMN, so tables are rebuilt.

PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

-- ---- Shop: add shopId column ----
DROP TABLE IF EXISTS "shop_new";

CREATE TABLE "shop_new" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'PKR',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Karachi',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- Insert existing shops with sequential shopId (SP-000001, SP-000002, ...)
INSERT INTO "shop_new" ("id", "shopId", "name", "currency", "timezone", "createdAt", "updatedAt")
SELECT
    "id",
    'SP-' || printf('%06d', ROW_NUMBER() OVER (ORDER BY "createdAt")),
    "name",
    "currency",
    "timezone",
    "createdAt",
    "updatedAt"
FROM "Shop";

DROP TABLE "Shop";
ALTER TABLE "shop_new" RENAME TO "Shop";
CREATE UNIQUE INDEX "Shop_shopId_key" ON "Shop"("shopId");

-- ---- Customer: add customerId column ----
DROP TABLE IF EXISTS "customer_new";

CREATE TABLE "customer_new" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "note" TEXT,
    "proposalId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "shopId" TEXT NOT NULL,
    CONSTRAINT "customer_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Insert existing customers with sequential customerId (CST-000001, CST-000002, ...)
INSERT INTO "customer_new" ("id", "customerId", "name", "phone", "note", "proposalId", "createdAt", "updatedAt", "shopId")
SELECT
    "id",
    'CST-' || printf('%06d', ROW_NUMBER() OVER (ORDER BY "createdAt")),
    "name",
    "phone",
    "note",
    "proposalId",
    "createdAt",
    "updatedAt",
    "shopId"
FROM "customers";

DROP TABLE "customers";
ALTER TABLE "customer_new" RENAME TO "customers";
CREATE UNIQUE INDEX "Customer_customerId_key" ON "customers"("customerId");
CREATE INDEX "Customer_name_idx" ON "customers"("name");
CREATE INDEX "Customer_phone_idx" ON "customers"("phone");
CREATE INDEX "Customer_shopId_idx" ON "customers"("shopId");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
