-- Add CUSTOMER role to User model and link User to Customer via customerId.

-- Redefine the role column to allow CUSTOMER.
-- SQLite does not support ALTER COLUMN, so we recreate the table.

-- Clean up any partially created table from a previous failed attempt.
DROP TABLE IF EXISTS "users_new";

-- Step 1: Create new users table with customerId and updated role.
CREATE TABLE "users_new" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'OWNER',
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "customerId" TEXT,
    CONSTRAINT "users_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE
);

-- Step 2: Copy data from old table.
INSERT INTO "users_new" ("id", "username", "name", "passwordHash", "role", "tokenVersion", "createdAt", "updatedAt", "customerId")
SELECT "id", "username", "name", "passwordHash", "role", "tokenVersion", "createdAt", "updatedAt", NULL FROM "users";

-- Step 3: Drop old table.
DROP TABLE "users";

-- Step 4: Rename new table.
ALTER TABLE "users_new" RENAME TO "users";

-- Step 5: Recreate unique index.
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
CREATE UNIQUE INDEX "users_customerId_key" ON "users"("customerId");
