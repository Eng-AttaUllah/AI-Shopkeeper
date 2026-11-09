"use server";

import { AuthError } from "next-auth";

import { signIn } from "@/lib/auth";
import { createCustomerUser } from "@/modules/customers/service";
import { signupRateLimiter } from "@/lib/rate-limit";

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
  const phone = String(formData.get("phone") ?? "");

  const limit = signupRateLimiter.check(phone);
  if (!limit.allowed) {
    return {
      error: `Too many sign-up attempts. Try again in ${Math.ceil(
        limit.resetAfterMs / 1000,
      )} seconds.`,
    };
  }

  const parsed = {
    name: formData.get("name"),
    phone: formData.get("phone"),
    password: formData.get("password"),
  };

  const result = await createCustomerUser(parsed);

  if (!result.ok) {
    return {
      error: result.error,
      fieldErrors: result.fieldErrors,
    };
  }

  // Sign the new customer in. They have no shop yet; they can join one from
  // /shops after signing in.
  try {
    await signIn("credentials", {
      username: result.data.user.username,
      password: String(formData.get("password") ?? ""),
      redirectTo: "/shops",
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
