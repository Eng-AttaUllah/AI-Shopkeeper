"use server";

import { AuthError } from "next-auth";

import { signIn } from "@/lib/auth";
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

  const result = await createCustomerAccount(parsed);

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
