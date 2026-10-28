"use server";

import { revalidatePath } from "next/cache";

import { formatDate } from "@/lib/format";
import { requireUser } from "@/lib/require-user";
import { recordReconciliation } from "@/modules/cash/service";

export type CashCheckState =
  | {
      ok: true;
      dateLabel: string;
      expectedPaisa: number;
      countedPaisa: number;
      differencePaisa: number;
    }
  | { ok: false; error?: string; fieldErrors?: Record<string, string> };

function formDataToObject(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};

  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") {
      values[key] = value;
    }
  }

  return values;
}

export async function recordCashCheckAction(
  _previousState: CashCheckState,
  formData: FormData,
): Promise<CashCheckState> {
  const user = await requireUser();
  const result = await recordReconciliation(
    formDataToObject(formData),
    user.username,
  );

  if (!result.ok) {
    return { ok: false, error: result.error, fieldErrors: result.fieldErrors };
  }

  revalidatePath("/day-close");
  revalidatePath("/reports");

  return {
    ok: true,
    dateLabel: formatDate(result.data.businessDate),
    expectedPaisa: result.data.expectedPaisa,
    countedPaisa: result.data.countedPaisa,
    differencePaisa: result.data.differencePaisa,
  };
}
