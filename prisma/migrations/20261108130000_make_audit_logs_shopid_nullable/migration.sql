-- Phase 13 unit 13.5: audit_logs.shopId is nullable because account creation
-- (customer self-registration) happens before a shop context exists.
-- SQLite does not support ALTER COLUMN, so the table is rebuilt.

PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

DROP TABLE IF EXISTS "audit_logs_new";

CREATE TABLE "audit_logs_new" (
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

INSERT INTO "audit_logs_new" ("id", "actor", "action", "entityType", "entityId", "summary", "before", "after", "details", "proposalId", "createdAt", "shopId")
SELECT "id", "actor", "action", "entityType", "entityId", "summary", "before", "after", "details", "proposalId", "createdAt", "shopId" FROM "audit_logs";

DROP TABLE "audit_logs";
ALTER TABLE "audit_logs_new" RENAME TO "audit_logs";
CREATE UNIQUE INDEX "audit_logs_proposalId_key" ON "audit_logs"("proposalId");
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
