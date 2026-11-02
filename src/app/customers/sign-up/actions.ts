"use server";

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

  return null;
}
