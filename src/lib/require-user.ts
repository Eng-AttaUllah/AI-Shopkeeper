import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * Server-side session guard for mutations and protected reads.
 *
 * The proxy is an optimistic check; every server action still calls this
 * before touching data, as required by the architecture.
 */
export async function requireUser() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  return session.user;
}

/**
 * Server-side shopkeeper guard: only the user with an active OWNER membership
 * on a shop may pass. Returns the user, the shop, and the membership so callers
 * can scope every read and write to that shop.
 */
export async function requireShopkeeper() {
  const user = await requireUser();

  const membership = await prisma.shopMembership.findFirst({
    where: {
      userId: user.id,
      role: "OWNER",
      status: "ACTIVE",
    },
    include: { shop: true },
  });

  if (!membership) {
    redirect("/login");
  }

  return { user, shop: membership.shop, membership };
}

/**
 * Server-side customer-shop guard: only a user with an active CUSTOMER
 * membership on the given shop may read or write its khata. Returns the user,
 * the shop, the membership, and the linked ledger customer record.
 */
export async function requireCustomerShop(shopId: string) {
  const user = await requireUser();

  const membership = await prisma.shopMembership.findFirst({
    where: {
      userId: user.id,
      shopId,
      role: "CUSTOMER",
      status: "ACTIVE",
    },
    include: { shop: true, customer: true },
  });

  if (!membership) {
    redirect("/khata");
  }

  return { user, shop: membership.shop, membership, customer: membership.customer! };
}

/**
 * Resolve the signed-in user's active membership (shopkeeper or customer) and
 * the shop it belongs to. Used by customer-facing pages that don't yet know
 * which shop they're opening.
 */
export async function requireActiveMembership() {
  const user = await requireUser();

  const membership = await prisma.shopMembership.findFirst({
    where: { userId: user.id, status: "ACTIVE" },
    include: { shop: true, customer: true },
  });

  if (!membership) {
    redirect("/login");
  }

  return { user, shop: membership.shop, membership };
}
