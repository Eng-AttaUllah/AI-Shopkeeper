import type { z } from "zod";

import type { FieldErrors } from "./result";

/** Turn a Zod error into one message per field, keyed by the field name. */
export function fieldErrors(error: z.ZodError): FieldErrors {
  const result: FieldErrors = {};

  for (const issue of error.issues) {
    const key = issue.path[0];

    if (typeof key === "string" && result[key] === undefined) {
      result[key] = issue.message;
    }
  }

  return result;
}
