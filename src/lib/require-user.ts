import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";

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
 * Server-side role guard: only the shopkeeper (OWNER) may pass.
 * Use for actions that mutate shop data (sales, products, expenses, etc.).
 */
export async function requireOwner() {
  const user = await requireUser();

  if (user.role !== "OWNER") {
    redirect("/customers/khata");
  }

  return user;
}
