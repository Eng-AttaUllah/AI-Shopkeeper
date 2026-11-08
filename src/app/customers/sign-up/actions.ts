"use server";

import { AuthError } from "next-auth";

import { signIn } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createCustomerAccount } from "@/modules/customers/service";

export type CustomerRegistrationState =
  | {
      error?: string;
      fieldErrors?: Record<string, string>;
    }
  | null;

export async function customerRegistrationAction(
  _previousState: CustomerRegistrationState,
  formData: FormData,
): Promise<CustomerRegistrationState> {
  const parsed = {
    name: formData.get("name"),
    phone: formData.get("phone"),
    password: formData.get("password"),
  };

  // Single-shop transition: the new customer's ledger record belongs to the
  // installation's shop until shopkeeper/customer joining is built in 13.5.
  const shop = await prisma.shop.findFirst({ orderBy: { createdAt: "asc" } });

  if (!shop) {
    return {
      error: "No shop is configured yet. Contact the platform operator.",
    };
  }

  const result = await createCustomerAccount(shop.id, parsed);

  if (!result.ok) {
    return {
      error: result.error,
      fieldErrors: result.fieldErrors,
    };
  }

  // Sign the new customer in and send them straight to their khata. `signIn`
  // throws a redirect error on success, which Next.js handles.
  try {
    await signIn("credentials", {
      username: result.data.user.username,
      password: String(formData.get("password") ?? ""),
      redirectTo: "/customers/khata",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return {
        error:
          "Account created, but automatic sign-in failed. Please sign in from the login page.",
      };
    }

    throw error;
  }

  return null;
}
