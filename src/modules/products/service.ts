import { Prisma } from "@/generated/prisma/client";
import type { Product } from "@/generated/prisma/client";
import { LOCAL_ACTOR, writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { rupeesToPaisa } from "@/lib/money";
import { formatQuantity, toMilli } from "@/lib/quantity";
import { fail, ok, type FieldErrors, type Result } from "@/lib/result";

import {
  adjustStockSchema,
  createProductSchema,
  fieldErrors,
  parseAliases,
  updateProductSchema,
} from "./schema";

/** An error whose message is safe and useful to show the shopkeeper. */
class ServiceError extends Error {
  constructor(
    message: string,
    readonly fieldErrors?: FieldErrors,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

function emptyToNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function handleError(error: unknown): Result<never> {
  if (error instanceof ServiceError) {
    return fail(error.message, error.fieldErrors);
  }

  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    return fail("A product with this name or barcode already exists.");
  }

  console.error("Product service error:", error);
  return fail("Something went wrong while saving. Please try again.");
}

/**
 * Create a product and its opening stock.
 *
 * The product row and the OPENING stock movement are written in one
 * transaction so stock can never exist without a movement (invariant 6).
 */
export async function createProduct(
  input: unknown,
  actor: string = LOCAL_ACTOR,
): Promise<Result<Product>> {
  const parsed = createProductSchema.safeParse(input);

  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrors(parsed.error));
  }

  const data = parsed.data;
  const nameNormalized = normalizeName(data.name);
  const barcode = emptyToNull(data.barcode);

  try {
    const product = await prisma.$transaction(async (tx) => {
      const duplicateName = await tx.product.findUnique({
        where: { nameNormalized },
      });

      if (duplicateName) {
        throw new ServiceError("A product with this name already exists.", {
          name: "Already used",
        });
      }

      if (barcode) {
        const duplicateBarcode = await tx.product.findUnique({
          where: { barcode },
        });

        if (duplicateBarcode) {
          throw new ServiceError(
            "That barcode is already used by another product.",
            { barcode: "Already used" },
          );
        }
      }

      const openingMilli = toMilli(data.openingStock);

      const created = await tx.product.create({
        data: {
          name: data.name,
          nameNormalized,
          category: emptyToNull(data.category),
          barcode,
          unit: data.unit,
          costPricePaisa: rupeesToPaisa(data.costPrice),
          salePricePaisa: rupeesToPaisa(data.salePrice),
          stockMilli: openingMilli,
          lowStockMilli: toMilli(data.lowStockLevel),
          aliases: {
            create: parseAliases(data.aliases).map((alias) => ({ alias })),
          },
        },
      });

      if (openingMilli !== 0) {
        await tx.stockMovement.create({
          data: {
            productId: created.id,
            quantityMilli: openingMilli,
            reason: "OPENING",
            note: "Opening stock",
          },
        });
      }

      await writeAudit(tx, {
        actor,
        action: "PRODUCT_CREATED",
        entityType: "Product",
        entityId: created.id,
        summary: `Product ${created.name} created`,
        before: null,
        after: {
          name: created.name,
          unit: created.unit,
          costPricePaisa: created.costPricePaisa,
          salePricePaisa: created.salePricePaisa,
          openingMilli,
        },
        details: {
          category: created.category,
          barcode: created.barcode,
        },
      });

      return created;
    });

    return ok(product);
  } catch (error) {
    return handleError(error);
  }
}

/** Update product details. Stock is never changed here. */
export async function updateProduct(
  id: string,
  input: unknown,
  actor: string = LOCAL_ACTOR,
): Promise<Result<Product>> {
  const parsed = updateProductSchema.safeParse(input);

  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrors(parsed.error));
  }

  const data = parsed.data;
  const nameNormalized = normalizeName(data.name);
  const barcode = emptyToNull(data.barcode);

  try {
    const product = await prisma.$transaction(async (tx) => {
      const existing = await tx.product.findUnique({ where: { id } });

      if (!existing) {
        throw new ServiceError("Product not found.");
      }

      const duplicateName = await tx.product.findUnique({
        where: { nameNormalized },
      });

      if (duplicateName && duplicateName.id !== id) {
        throw new ServiceError("A product with this name already exists.", {
          name: "Already used",
        });
      }

      if (barcode) {
        const duplicateBarcode = await tx.product.findUnique({
          where: { barcode },
        });

        if (duplicateBarcode && duplicateBarcode.id !== id) {
          throw new ServiceError(
            "That barcode is already used by another product.",
            { barcode: "Already used" },
          );
        }
      }

      await tx.productAlias.deleteMany({ where: { productId: id } });

      const updated = await tx.product.update({
        where: { id },
        data: {
          name: data.name,
          nameNormalized,
          category: emptyToNull(data.category),
          barcode,
          unit: data.unit,
          costPricePaisa: rupeesToPaisa(data.costPrice),
          salePricePaisa: rupeesToPaisa(data.salePrice),
          lowStockMilli: toMilli(data.lowStockLevel),
          aliases: {
            create: parseAliases(data.aliases).map((alias) => ({ alias })),
          },
        },
      });

      await writeAudit(tx, {
        actor,
        action: "PRODUCT_UPDATED",
        entityType: "Product",
        entityId: updated.id,
        summary: `Product ${updated.name} updated`,
        before: {
          name: existing.name,
          costPricePaisa: existing.costPricePaisa,
          salePricePaisa: existing.salePricePaisa,
        },
        after: {
          name: updated.name,
          costPricePaisa: updated.costPricePaisa,
          salePricePaisa: updated.salePricePaisa,
        },
        details: {
          unit: updated.unit,
          category: updated.category,
          barcode: updated.barcode,
        },
      });

      return updated;
    });

    return ok(product);
  } catch (error) {
    return handleError(error);
  }
}

/** Hide a product from sale screens without deleting its history. */
export async function setProductActive(
  id: string,
  isActive: boolean,
): Promise<Result<Product>> {
  try {
    const product = await prisma.product.update({
      where: { id },
      data: { isActive },
    });

    return ok(product);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return fail("Product not found.");
    }

    return handleError(error);
  }
}

/**
 * Change stock by a signed quantity and record why.
 *
 * Refuses to take stock below zero (invariant 3) and always writes a matching
 * movement row (invariant 6).
 */
export async function adjustStock(
  input: unknown,
  actor: string = LOCAL_ACTOR,
): Promise<Result<Product>> {
  const parsed = adjustStockSchema.safeParse(input);

  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrors(parsed.error));
  }

  const { productId, quantity, reason, note } = parsed.data;
  const deltaMilli = toMilli(quantity);

  if (deltaMilli === 0) {
    return fail("Enter a quantity other than zero.", {
      quantity: "Cannot be zero",
    });
  }

  try {
    const product = await prisma.$transaction(async (tx) => {
      const existing = await tx.product.findUnique({ where: { id: productId } });

      if (!existing) {
        throw new ServiceError("Product not found.");
      }

      const newStock = existing.stockMilli + deltaMilli;

      if (newStock < 0) {
        throw new ServiceError(
          `Only ${formatQuantity(existing.stockMilli, existing.unit)} in stock.`,
          { quantity: "More than available" },
        );
      }

      const updated = await tx.product.update({
        where: { id: productId },
        data: { stockMilli: newStock },
      });

      await tx.stockMovement.create({
        data: {
          productId,
          quantityMilli: deltaMilli,
          reason,
          note: emptyToNull(note),
        },
      });

      await writeAudit(tx, {
        actor,
        action: "STOCK_ADJUSTED",
        entityType: "Product",
        entityId: updated.id,
        summary: `Stock ${deltaMilli > 0 ? "+" : ""}${formatQuantity(deltaMilli, updated.unit)} for ${updated.name}`,
        before: { stockMilli: existing.stockMilli },
        after: { stockMilli: newStock },
        details: {
          deltaMilli,
          reason,
          note: emptyToNull(note),
        },
      });

      return updated;
    });

    return ok(product);
  } catch (error) {
    return handleError(error);
  }
}
