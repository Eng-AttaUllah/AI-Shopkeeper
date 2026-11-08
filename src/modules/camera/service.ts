import { promises as fs } from "node:fs";
import path from "node:path";

import type { CameraAlert } from "@/generated/prisma/client";
import { LOCAL_ACTOR, writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { fail, ok, type Result } from "@/lib/result";
import { fieldErrors } from "@/lib/zod";

import { cameraAlertSchema, cameraReviewSchema, type CameraAlertStatus } from "./schema";

/** Clips live on disk here; the database stores only metadata. */
export const CAMERA_DIR = path.resolve(process.cwd(), "media", "camera");

/** Retention: the newest clips are kept; older files are deleted. */
export const MAX_CAMERA_CLIPS = 200;

/** Actor recorded on audit rows written by the camera process. */
export const CAMERA_ACTOR = "camera-service";

/** An error whose message is safe and useful to show the shopkeeper. */
class ServiceError extends Error {
  constructor(
    message: string,
    readonly fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}

function handleError(error: unknown): Result<never> {
  if (error instanceof ServiceError) {
    return fail(error.message, error.fieldErrors);
  }

  console.error("Camera service error:", error);
  return fail("Something went wrong while saving. Please try again.");
}

/** Absolute path of a clip inside the camera directory. */
export function cameraClipPath(clipPath: string): string {
  return path.join(CAMERA_DIR, clipPath);
}

/**
 * Record a camera alert for `shopId` after the camera service saved a clip.
 *
 * The service writes the clip file first, then posts the metadata, so the
 * alert row must point at a file that exists. The row and its audit entry are
 * written in one transaction. Retention runs afterwards and only deletes old
 * clip files; review state and audit rows survive clip deletion.
 */
export async function recordCameraAlert(
  shopId: string,
  input: unknown,
): Promise<Result<CameraAlert>> {
  const parsed = cameraAlertSchema.safeParse(input);

  if (!parsed.success) {
    return fail("The camera alert payload is invalid.", fieldErrors(parsed.error));
  }

  const data = parsed.data;

  try {
    await fs.access(cameraClipPath(data.clipPath));
  } catch {
    return fail("The clip file does not exist on disk.", {
      clipPath: "Clip file not found",
    });
  }

  try {
    const alert = await prisma.$transaction(async (tx) => {
      const created = await tx.cameraAlert.create({
        data: {
          clipPath: data.clipPath,
          shopId,
          capturedAt: new Date(data.capturedAt),
          durationMs: data.durationMs,
        },
      });

      await writeAudit(tx, {
        actor: CAMERA_ACTOR,
        shopId,
        action: "CAMERA_ALERT_RECORDED",
        entityType: "CameraAlert",
        entityId: created.id,
        summary: `Motion clip ${data.clipPath} saved for review`,
        before: null,
        after: {
          clipPath: created.clipPath,
          capturedAt: created.capturedAt.toISOString(),
          durationMs: created.durationMs,
          status: created.status,
        },
      });

      return created;
    });

    await pruneOldClips(shopId);

    return ok(alert);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Mark an alert reviewed or dismissed. Changing between the two states is
 * allowed; re-applying the same state is a no-op that succeeds. Scoped to
 * `shopId` so one shop cannot review another shop's alert.
 */
export async function reviewCameraAlert(
  shopId: string,
  input: unknown,
  status: Exclude<CameraAlertStatus, "PENDING">,
  actor: string = LOCAL_ACTOR,
): Promise<Result<CameraAlert>> {
  const parsed = cameraReviewSchema.safeParse(input);

  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrors(parsed.error));
  }

  const data = parsed.data;
  const reviewedAt = new Date();
  const reviewNote = data.note?.trim() ? data.note.trim() : null;

  try {
    const alert = await prisma.$transaction(async (tx) => {
      const existing = await tx.cameraAlert.findFirst({
        where: { id: data.alertId, shopId },
      });

      if (!existing) {
        throw new ServiceError("Alert not found.");
      }

      if (existing.status === status) {
        return existing;
      }

      const updated = await tx.cameraAlert.update({
        where: { id: existing.id },
        data: { status, reviewedAt, reviewNote },
      });

      await writeAudit(tx, {
        actor,
        shopId,
        action: "CAMERA_ALERT_REVIEWED",
        entityType: "CameraAlert",
        entityId: updated.id,
        summary: `Motion clip ${updated.clipPath} marked ${status.toLowerCase()}`,
        before: {
          status: existing.status,
          reviewNote: existing.reviewNote,
        },
        after: {
          status: updated.status,
          reviewNote: updated.reviewNote,
        },
      });

      return updated;
    });

    return ok(alert);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Delete clip files beyond the retention limit, oldest first. Rows are kept
 * so the review history stays complete; a missing file is handled when the
 * shopkeeper tries to play it. Scoped to `shopId`.
 */
export async function pruneOldClips(shopId: string): Promise<number> {
  // Newest first; everything past the retention limit is the oldest set.
  const surplus = await prisma.cameraAlert.findMany({
    where: { shopId },
    orderBy: { capturedAt: "desc" },
    skip: MAX_CAMERA_CLIPS,
    select: { clipPath: true },
  });

  let deleted = 0;

  for (const alert of surplus) {
    try {
      await fs.unlink(cameraClipPath(alert.clipPath));
      deleted += 1;
    } catch {
      // The file may already be gone; nothing to clean up.
    }
  }

  return deleted;
}
