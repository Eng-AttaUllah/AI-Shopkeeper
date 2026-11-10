import { promises as fs } from "node:fs";
import path from "node:path";

import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import {
  CAMERA_DIR,
  MAX_CAMERA_CLIPS,
  pruneOldClips,
  recordCameraAlert,
  reviewCameraAlert,
} from "@/modules/camera/service";

const createdFiles: string[] = [];

function iso(offsetMinutes: number): string {
  return new Date(Date.UTC(2026, 10, 4, 10, offsetMinutes)).toISOString();
}

async function writeClip(name: string): Promise<void> {
  await fs.mkdir(CAMERA_DIR, { recursive: true });
  await fs.writeFile(path.join(CAMERA_DIR, name), "clip-bytes");
  createdFiles.push(name);
}

let shopId: string;

beforeEach(async () => {
  const shopCount = await prisma.shop.count();
  const shop = await prisma.shop.create({
    data: {
      name: "Test Shop",
      currency: "PKR",
      timezone: "Asia/Karachi",
      shopId: `SP-${String(shopCount + 1).padStart(6, "0")}`,
    },
  });
  shopId = shop.id;

  await prisma.cameraAlert.deleteMany();
  await prisma.auditLog.deleteMany();
});

afterEach(async () => {
  for (const name of createdFiles.splice(0)) {
    await fs.rm(path.join(CAMERA_DIR, name), { force: true });
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("camera alerts", () => {
  it("records an alert when the clip file exists on disk", async () => {
    await writeClip("clip-20261104-a.mp4");

    const result = await recordCameraAlert(shopId, {
      clipPath: "clip-20261104-a.mp4",
      capturedAt: iso(0),
      durationMs: 12_000,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.status).toBe("PENDING");
      expect(result.data.durationMs).toBe(12_000);
    }

    const audit = await prisma.auditLog.findFirst({
      where: { action: "CAMERA_ALERT_RECORDED" },
    });

    expect(audit?.actor).toBe("camera-service");
  });

  it("refuses an alert whose clip file is missing", async () => {
    const result = await recordCameraAlert(shopId, {
      clipPath: "missing-clip.mp4",
      capturedAt: iso(0),
      durationMs: 12_000,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fieldErrors?.clipPath).toBeTruthy();
    }
    expect(await prisma.cameraAlert.count()).toBe(0);
  });

  it("rejects clip names that could escape the media directory", async () => {
    await writeClip("clip-outside.mp4");

    for (const clipPath of [
      "../secret.txt",
      "sub/dir/clip.mp4",
      ".hidden.mp4",
      "",
    ]) {
      const result = await recordCameraAlert(shopId, {
        clipPath,
        capturedAt: iso(0),
        durationMs: 12_000,
      });

      expect(result.ok).toBe(false);
    }

    expect(await prisma.cameraAlert.count()).toBe(0);
  });

  it("marks an alert reviewed with a note and writes the audit row", async () => {
    await writeClip("clip-review.mp4");
    const created = (await recordCameraAlert(shopId, {
      clipPath: "clip-review.mp4",
      capturedAt: iso(0),
      durationMs: 8_000,
    })) as { ok: true; data: { id: string } };

    const result = await reviewCameraAlert(
      shopId,
      { alertId: created.data.id, note: "Cat on the counter" },
      "REVIEWED",
      "owner",
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.status).toBe("REVIEWED");
      expect(result.data.reviewNote).toBe("Cat on the counter");
      expect(result.data.reviewedAt).not.toBeNull();
    }

    const audit = await prisma.auditLog.findFirst({
      where: { action: "CAMERA_ALERT_REVIEWED" },
    });

    expect(audit?.actor).toBe("owner");
    expect(audit?.before).toContain("PENDING");
  });

  it("re-applying the same review state is a no-op that succeeds", async () => {
    await writeClip("clip-twice.mp4");
    const created = (await recordCameraAlert(shopId, {
      clipPath: "clip-twice.mp4",
      capturedAt: iso(0),
      durationMs: 5_000,
    })) as { ok: true; data: { id: string } };

    await reviewCameraAlert(
      shopId,
      { alertId: created.data.id },
      "DISMISSED",
      "owner",
    );
    const again = await reviewCameraAlert(
      shopId,
      { alertId: created.data.id },
      "DISMISSED",
      "owner",
    );

    expect(again.ok).toBe(true);
    expect(
      await prisma.auditLog.count({ where: { action: "CAMERA_ALERT_REVIEWED" } }),
    ).toBe(1);
  });

  it("refuses to review an alert that does not exist", async () => {
    const result = await reviewCameraAlert(
      shopId,
      { alertId: "does-not-exist" },
      "REVIEWED",
      "owner",
    );

    expect(result.ok).toBe(false);
  });

  it("prunes clip files beyond retention but keeps the alert rows", async () => {
    const total = MAX_CAMERA_CLIPS + 2;

    for (let i = 0; i < total; i += 1) {
      const name = `clip-prune-${String(i).padStart(4, "0")}.mp4`;
      await writeClip(name);
      await prisma.cameraAlert.create({
        data: {
          clipPath: name,
          shopId,
          capturedAt: new Date(Date.UTC(2026, 10, 4, 9, i)),
          durationMs: 1_000,
        },
      });
    }

    const deleted = await pruneOldClips(shopId);

    expect(deleted).toBe(2);
    expect(await prisma.cameraAlert.count()).toBe(total);

    const oldest = await prisma.cameraAlert.findFirst({
      orderBy: { capturedAt: "asc" },
    });

    await expect(
      fs.access(path.join(CAMERA_DIR, oldest!.clipPath)),
    ).rejects.toThrow();
  });
});
