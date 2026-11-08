import type { CameraAlert } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

/** Alerts for one shop, newest first. */
export async function listCameraAlerts(
  shopId: string,
  take = 100,
): Promise<CameraAlert[]> {
  return prisma.cameraAlert.findMany({
    where: { shopId },
    orderBy: { capturedAt: "desc" },
    take,
  });
}

export async function getCameraAlert(
  shopId: string,
  id: string,
): Promise<CameraAlert | null> {
  return prisma.cameraAlert.findFirst({ where: { id, shopId } });
}

/** Count of alerts still waiting for review, for a dashboard badge. */
export async function pendingCameraAlertCount(
  shopId: string,
): Promise<number> {
  return prisma.cameraAlert.count({ where: { shopId, status: "PENDING" } });
}
