import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import Database from "better-sqlite3";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  createBackup,
  ensureDailyBackup,
  listBackups,
} from "@/lib/backup";
import { prisma } from "@/lib/db";
import type { Result } from "@/lib/result";
import { createProduct } from "@/modules/products/service";

const sugar = {
  name: "Sugar",
  category: "Grocery",
  unit: "kg",
  costPrice: "140",
  salePrice: "160",
  openingStock: "10",
  lowStockLevel: "1",
  barcode: "",
  aliases: "",
};

let backupDir: string;

function expectOk<T>(result: Result<T>): T {
  if (!result.ok) {
    throw new Error(`Expected success but got: ${result.error}`);
  }

  return result.data;
}

beforeAll(() => {
  backupDir = mkdtempSync(path.join(tmpdir(), "ai-shop-backups-"));
  process.env.BACKUP_DIR = backupDir;
});

beforeEach(async () => {
  const shopCount = await prisma.shop.count();
  await prisma.shop.create({
    data: { name: "Test Shop", currency: "PKR", timezone: "Asia/Karachi", shopId: `SP-${String(shopCount + 1).padStart(6, "0")}` },
  });
  await prisma.auditLog.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.cashReconciliation.deleteMany();
  await prisma.saleItem.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.productAlias.deleteMany();
  await prisma.product.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
  delete process.env.BACKUP_DIR;
  rmSync(backupDir, { recursive: true, force: true });
});

describe("backups", () => {
  it("writes a readable copy of the database", async () => {
    const shop = await prisma.shop.findFirst({ orderBy: { createdAt: "asc" } });
    const product = await createProduct(shop!.id, sugar);

    const backup = await createBackup(
      "manual",
      new Date("2026-10-26T10:00:00Z"),
    );

    expect(backup.name.startsWith("manual-20261026-")).toBe(true);
    expect(existsSync(backup.path)).toBe(true);
    expect(backup.sizeBytes).toBeGreaterThan(0);

    const listed = await listBackups();
    expect(listed.some((file) => file.name === backup.name)).toBe(true);

    const restored = new Database(backup.path, {
      readonly: true,
      fileMustExist: true,
    });

    try {
      const row = restored
        .prepare("SELECT COUNT(*) AS count FROM products")
        .get() as { count: number };

      expect(row.count).toBeGreaterThanOrEqual(1);
    } finally {
      restored.close();
    }
  });

  it("makes at most one daily backup per shop day", async () => {
    const first = await ensureDailyBackup(
      new Date("2026-10-27T10:00:00Z"),
    );
    const second = await ensureDailyBackup(
      new Date("2026-10-27T11:00:00Z"),
    );

    expect(first).not.toBeNull();
    expect(second).toBeNull();

    const daily = (await listBackups()).filter((file) =>
      file.name.startsWith("daily-20261027-"),
    );
    expect(daily).toHaveLength(1);
  });

  it("shares one daily backup between simultaneous first loads", async () => {
    const date = new Date("2026-10-28T10:00:00Z");
    const [first, second] = await Promise.all([
      ensureDailyBackup(date),
      ensureDailyBackup(date),
    ]);

    expect(first).not.toBeNull();
    expect(second?.name).toBe(first?.name);

    const daily = (await listBackups()).filter((file) =>
      file.name.startsWith("daily-20261028-"),
    );
    expect(daily).toHaveLength(1);
  });

  it("keeps only the last 30 daily backups", async () => {
    for (let index = 0; index < 32; index += 1) {
      await createBackup(
        "daily",
        new Date(Date.UTC(2026, 10, 1, 0, index, 0)),
      );
    }

    const daily = (await listBackups()).filter((file) =>
      file.name.startsWith("daily-"),
    );

    expect(daily).toHaveLength(30);
  });
});
