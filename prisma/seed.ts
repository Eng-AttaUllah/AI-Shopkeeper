import "dotenv/config";

import { ensureOwner } from "@/lib/credentials";
import { prisma } from "@/lib/db";

/**
 * Seed data must be idempotent: running this repeatedly must never create
 * duplicate records. See `docs/code-standards.md`.
 *
 * The owner password comes from `.env`. Re-running the seed with a different
 * OWNER_PASSWORD updates the hash and increments tokenVersion, which signs out
 * existing sessions.
 */
async function main() {
  const existingShop = await prisma.shop.findFirst();

  if (existingShop) {
    console.log(`Shop "${existingShop.name}" already exists.`);
  } else {
    const shop = await prisma.shop.create({
      data: {
        name: "Demo General Store",
        currency: "PKR",
        timezone: "Asia/Karachi",
      },
    });

    console.log(`Seeded shop "${shop.name}" (${shop.id}).`);
  }

  const ownerPassword = process.env.OWNER_PASSWORD;

  if (!ownerPassword || ownerPassword === "replace-with-a-strong-password") {
    throw new Error(
      "OWNER_PASSWORD is not set to a real password. Add one to .env before seeding (at least 8 characters).",
    );
  }

  const owner = await ensureOwner({
    username: process.env.OWNER_USERNAME ?? "owner",
    password: ownerPassword,
    name: process.env.OWNER_NAME ?? "Shopkeeper",
  });

  if (owner.created) {
    console.log(`Seeded owner "${owner.user.username}" (${owner.user.id}).`);
  } else if (owner.passwordChanged) {
    console.log(`Updated the password for owner "${owner.user.username}".`);
  } else {
    console.log(`Owner "${owner.user.username}" already exists; password unchanged.`);
  }
}

main()
  .catch((error: unknown) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
