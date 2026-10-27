import type { CashReconciliation } from "@/generated/prisma/client";
import { writeAudit } from "@/lib/audit";
import { addKarachiDays, karachiDateKeyToDate } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { formatDate, formatPaisa } from "@/lib/format";
import { rupeesToPaisa } from "@/lib/money";
import { fail, ok, type Result } from "@/lib/result";
import { fieldErrors } from "@/lib/zod";

import { cashBreakdown } from "./queries";
import { cashReconciliationSchema } from "./schema";

function emptyToNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Save the counted cash for a shop day and compare it with expected cash.
 *
 * Expected cash is recomputed inside the transaction, so a sale or expense
 * recorded a moment earlier cannot make the saved comparison stale. Re-running
 * the same day updates the existing row rather than creating a duplicate.
 */
export async function recordReconciliation(
  input: unknown,
): Promise<Result<CashReconciliation>> {
  const parsed = cashReconciliationSchema.safeParse(input);

  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrors(parsed.error));
  }

  const data = parsed.data;
  const businessDate = karachiDateKeyToDate(data.date);

  if (!businessDate) {
    return fail("Choose a valid date.", { date: "Invalid date" });
  }

  const countedPaisa = rupeesToPaisa(data.counted);
  const range = {
    start: businessDate,
    end: addKarachiDays(businessDate, 1),
  };

  try {
    const reconciliation = await prisma.$transaction(async (tx) => {
      const breakdown = await cashBreakdown(tx, range);
      const differencePaisa = countedPaisa - breakdown.expectedPaisa;
      const note = emptyToNull(data.note);

      const existing = await tx.cashReconciliation.findUnique({
        where: { businessDate },
      });

      const saved = await tx.cashReconciliation.upsert({
        where: { businessDate },
        create: {
          businessDate,
          expectedPaisa: breakdown.expectedPaisa,
          countedPaisa,
          differencePaisa,
          note,
        },
        update: {
          expectedPaisa: breakdown.expectedPaisa,
          countedPaisa,
          differencePaisa,
          note,
        },
      });

      await writeAudit(tx, {
        action: "CASH_RECONCILED",
        entityType: "CashReconciliation",
        entityId: saved.id,
        summary: `Cash check ${formatDate(businessDate)} · ${
          differencePaisa === 0
            ? "balanced"
            : `${formatPaisa(differencePaisa)} difference`
        }`,
        before: existing
          ? {
              expectedPaisa: existing.expectedPaisa,
              countedPaisa: existing.countedPaisa,
              differencePaisa: existing.differencePaisa,
              note: existing.note,
            }
          : null,
        after: {
          expectedPaisa: saved.expectedPaisa,
          countedPaisa: saved.countedPaisa,
          differencePaisa: saved.differencePaisa,
          note: saved.note,
        },
        details: { businessDate: businessDate.toISOString() },
      });

      return saved;
    });

    return ok(reconciliation);
  } catch (error) {
    console.error("Cash reconciliation error:", error);
    return fail("Something went wrong while saving the cash check.");
  }
}
