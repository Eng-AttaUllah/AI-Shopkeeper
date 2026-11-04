import type { CameraAlert } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

/** Alerts newest first, so the shopkeeper sees the latest motion first. */
export async function listCameraAlerts(take = 100): Promise<CameraAlert[]> {
  return prisma.cameraAlert.findMany({
    orderBy: { capturedAt: "desc" },
    take,
  });
}

export async function getCameraAlert(id: string): Promise<CameraAlert | null> {
  return prisma.cameraAlert.findUnique({ where: { id } });
}

/** Count of alerts still waiting for review, for a dashboard badge. */
export async function pendingCameraAlertCount(): Promise<number> {
  return prisma.cameraAlert.count({ where: { status: "PENDING" } });
}
