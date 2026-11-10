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
  let shop = await prisma.shop.findFirst({
    orderBy: { createdAt: "asc" },
  });

  if (shop) {
    console.log(`Shop "${shop.name}" already exists.`);
  } else {
    const shopCount = await prisma.shop.count();
    shop = await prisma.shop.create({
      data: {
        name: "Demo General Store",
        currency: "PKR",
        timezone: "Asia/Karachi",
        shopId: `SP-${String(shopCount + 1).padStart(6, "0")}`,
      },
    });

    console.log(`Seeded shop "${shop.name}" (${shop.shopId}).`);
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

  // The shopkeeper's access to their shop is the OWNER membership. The
  // migration backfilled existing owners; this upsert keeps the seed
  // idempotent and covers a fresh owner created just now. Other membership
  // rows (customers, join requests) are never the seed's business.
  const membership = await prisma.shopMembership.upsert({
    where: {
      shopId_userId: { shopId: shop.id, userId: owner.user.id },
    },
    update: { role: "OWNER", status: "ACTIVE" },
    create: {
      shopId: shop.id,
      userId: owner.user.id,
      role: "OWNER",
      status: "ACTIVE",
    },
  });
  console.log(
    `OWNER membership ready for "${owner.user.username}" at "${shop.name}" (${membership.status}).`,
  );
}

main()
  .catch((error: unknown) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
