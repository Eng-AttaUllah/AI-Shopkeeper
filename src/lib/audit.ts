import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

/**
 * Append-only audit trail.
 *
 * Every money or stock change writes an entry inside the same transaction as
 * the change itself, so a committed change always has its audit row and a
 * failed transaction leaves neither behind.
 */

export type AuditEntry = {
  /** Defaults to "local" until Auth.js is scheduled. */
  actor?: string;
  /** Machine-readable action, for example SALE_CREATED or STOCK_ADJUSTED. */
  action: string;
  entityType: string;
  entityId: string;
  /** One line a shopkeeper can read without decoding JSON. */
  summary: string;
  /** State before the change; null or omitted for a create. */
  before?: Record<string, unknown> | null;
  /** State after the change. */
  after?: Record<string, unknown> | null;
  /** Extra context that is not a state snapshot. */
  details?: Record<string, unknown>;
};

/** The only local user until sign-in exists. */
export const LOCAL_ACTOR = "local";

export async function writeAudit(
  tx: Prisma.TransactionClient,
  entry: AuditEntry,
): Promise<void> {
  await tx.auditLog.create({
    data: {
      actor: entry.actor ?? LOCAL_ACTOR,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      summary: entry.summary,
      before: entry.before ? JSON.stringify(entry.before) : null,
      after: entry.after ? JSON.stringify(entry.after) : null,
      details: entry.details ? JSON.stringify(entry.details) : null,
    },
  });
}

/** Recent audit entries, newest first. */
export async function listAuditLogs(take = 100) {
  return prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take,
  });
}
