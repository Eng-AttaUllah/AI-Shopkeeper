import "dotenv/config";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import { PrismaClient } from "../src/generated/prisma/client";

const url = process.env["DATABASE_URL"];

if (!url) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env first.");
}

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url }),
});

/**
 * Seed data must be idempotent: running this repeatedly must never create
 * duplicate records. See `docs/code-standards.md`.
 */
async function main() {
  const existing = await prisma.shop.findFirst();

  if (existing) {
    console.log(`Seed skipped: shop "${existing.name}" already exists.`);
    return;
  }

  const shop = await prisma.shop.create({
    data: {
      name: "Demo General Store",
      currency: "PKR",
      timezone: "Asia/Karachi",
    },
  });

  console.log(`Seeded shop "${shop.name}" (${shop.id}).`);
}

main()
  .catch((error: unknown) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
