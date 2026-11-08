import { Prisma } from "@/generated/prisma/client";
import type { Product, StockMovement } from "@/generated/prisma/client";
import { LOCAL_ACTOR, writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { rupeesToPaisa } from "@/lib/money";
import { formatQuantity, toMilli } from "@/lib/quantity";
import { fail, ok, type FieldErrors, type Result } from "@/lib/result";

import {
  matchesProductPreview,
  matchesProductUpdatePreview,
  matchesStockAdjustmentPreview,
  productSnapshotFromInput,
  productSnapshotFromProduct,
  productSnapshotsEqual,
  type ProductPreview,
  type ProductUpdatePreview,
  type StockAdjustmentPreview,
} from "./preview";
import {
  adjustStockSchema,
  createProductSchema,
  fieldErrors,
  parseAliases,
  updateProductSchema,
} from "./schema";

import { normalizeText } from "@/lib/text";

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
  return normalizeText(name).toLowerCase();
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

export type CreateProductOptions = {
  /** Set only when confirming an assistant proposal. */
  proposalId?: string;
  /** The preview the shopkeeper confirmed; the write must match it. */
  expectedPreview?: ProductPreview;
};

export type CreateProductOutcome = {
  product: Product;
  alreadyConfirmed: boolean;
};

/**
 * Create a product and its opening stock, optionally from a signed assistant
 * proposal.
 *
 * The product row, its opening stock movement, and its audit row are written in
 * one transaction so stock can never exist without a movement (invariant 6).
 * The unique proposal id makes a replayed confirmation idempotent.
 * Everything is scoped to `shopId` so products never leak between shops.
 */
export async function createProductWithStatus(
  shopId: string,
  input: unknown,
  actor: string = LOCAL_ACTOR,
  options: CreateProductOptions = {},
): Promise<Result<CreateProductOutcome>> {
  const parsed = createProductSchema.safeParse(input);

  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrors(parsed.error));
  }

  const data = parsed.data;

  if (
    options.expectedPreview &&
    !matchesProductPreview(data, options.expectedPreview)
  ) {
    return fail(
      "This product proposal changed before it was confirmed. Ask the assistant to prepare it again.",
    );
  }

  const nameNormalized = normalizeName(data.name);
  const barcode = emptyToNull(data.barcode);

  try {
    const outcome = await prisma.$transaction(async (tx) => {
      if (options.proposalId) {
        const existing = await tx.product.findUnique({
          where: { proposalId: options.proposalId },
        });

        if (existing) {
          return { product: existing, alreadyConfirmed: true };
        }
      }

      const duplicateName = await tx.product.findFirst({
        where: { shopId, nameNormalized },
      });

      if (duplicateName) {
        throw new ServiceError("A product with this name already exists.", {
          name: "Already used",
        });
      }

      if (barcode) {
        const duplicateBarcode = await tx.product.findFirst({
          where: { shopId, barcode },
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
          shopId,
          proposalId: options.proposalId ?? null,
          aliases: {
            create: parseAliases(data.aliases).map((alias) => ({ alias })),
          },
        },
      });

      if (openingMilli !== 0) {
        await tx.stockMovement.create({
          data: {
            productId: created.id,
            shopId,
            quantityMilli: openingMilli,
            reason: "OPENING",
            note: "Opening stock",
          },
        });
      }

      await writeAudit(tx, {
        actor,
        shopId,
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
          proposalId: created.proposalId,
          source: options.proposalId
            ? "assistant_proposal"
            : "product_screen",
        },
        proposalId: options.proposalId,
      });

      return { product: created, alreadyConfirmed: false };
    });

    return ok(outcome);
  } catch (error) {
    // A concurrent confirmation may win the unique proposal index.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002" &&
      options.proposalId
    ) {
      const existing = await prisma.product.findUnique({
        where: { proposalId: options.proposalId },
      });

      if (existing) {
        return ok({ product: existing, alreadyConfirmed: true });
      }
    }

    return handleError(error);
  }
}

export async function createProduct(
  shopId: string,
  input: unknown,
  actor: string = LOCAL_ACTOR,
): Promise<Result<Product>> {
  const result = await createProductWithStatus(shopId, input, actor);

  if (!result.ok) {
    return result;
  }

  return ok(result.data.product);
}

export type UpdateProductOptions = {
  /** Set only when confirming an assistant proposal. */
  proposalId?: string;
  /** The preview the shopkeeper confirmed; the write must match it. */
  expectedPreview?: ProductUpdatePreview;
};

export type UpdateProductOutcome = {
  product: Product;
  alreadyConfirmed: boolean;
};

/**
 * Update product details. Stock is never changed here.
 *
 * For an assistant proposal the audit row carries the unique proposal id, so a
 * replay returns the product without applying the edit twice. The signed
 * before-state is compared with the current row inside the transaction; a
 * price or name changed in the meantime rejects the stale proposal.
 * Everything is scoped to `shopId`.
 */
export async function updateProductWithStatus(
  shopId: string,
  id: string,
  input: unknown,
  actor: string = LOCAL_ACTOR,
  options: UpdateProductOptions = {},
): Promise<Result<UpdateProductOutcome>> {
  const parsed = updateProductSchema.safeParse(input);

  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrors(parsed.error));
  }

  const data = parsed.data;

  if (
    options.expectedPreview &&
    (options.expectedPreview.productId !== id ||
      !matchesProductUpdatePreview(data, options.expectedPreview))
  ) {
    return fail(
      "This product proposal changed before it was confirmed. Ask the assistant to prepare it again.",
    );
  }

  const nameNormalized = normalizeName(data.name);
  const barcode = emptyToNull(data.barcode);

  try {
    const outcome = await prisma.$transaction(async (tx) => {
      if (options.proposalId) {
        const existingAudit = await tx.auditLog.findUnique({
          where: { proposalId: options.proposalId },
        });

        if (existingAudit) {
          if (existingAudit.entityId !== id) {
            throw new ServiceError(
              "This proposal belongs to a different product.",
            );
          }

          const existing = await tx.product.findUnique({ where: { id } });

          if (!existing) {
            throw new ServiceError("Product not found.");
          }

          return { product: existing, alreadyConfirmed: true };
        }
      }

      const existing = await tx.product.findFirst({
        where: { id, shopId },
        include: { aliases: true },
      });

      if (!existing) {
        throw new ServiceError("Product not found.");
      }

      if (options.expectedPreview) {
        const current = productSnapshotFromProduct(existing);

        if (!productSnapshotsEqual(current, options.expectedPreview.before)) {
          throw new ServiceError(
            "The product changed since this proposal was prepared. Ask the assistant to prepare it again.",
          );
        }
      }

      const duplicateName = await tx.product.findFirst({
        where: { shopId, nameNormalized },
      });

      if (duplicateName && duplicateName.id !== id) {
        throw new ServiceError("A product with this name already exists.", {
          name: "Already used",
        });
      }

      if (barcode) {
        const duplicateBarcode = await tx.product.findFirst({
          where: { shopId, barcode },
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
        shopId,
        action: "PRODUCT_UPDATED",
        entityType: "Product",
        entityId: updated.id,
        summary: `Product ${updated.name} updated`,
        before: productSnapshotFromProduct(existing),
        after: productSnapshotFromInput(data),
        details: {
          unit: updated.unit,
          category: updated.category,
          barcode: updated.barcode,
          proposalId: options.proposalId,
          source: options.proposalId
            ? "assistant_proposal"
            : "product_screen",
        },
        proposalId: options.proposalId,
      });

      return { product: updated, alreadyConfirmed: false };
    });

    return ok(outcome);
  } catch (error) {
    // A concurrent confirmation may win the unique audit proposal index.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002" &&
      options.proposalId
    ) {
      const existingAudit = await prisma.auditLog.findUnique({
        where: { proposalId: options.proposalId },
      });

      if (existingAudit) {
        const existing = await prisma.product.findUnique({
          where: { id: existingAudit.entityId },
        });

        if (existing) {
          return ok({ product: existing, alreadyConfirmed: true });
        }
      }
    }

    return handleError(error);
  }
}

/** Update product details from the product screen. */
export async function updateProduct(
  shopId: string,
  id: string,
  input: unknown,
  actor: string = LOCAL_ACTOR,
): Promise<Result<Product>> {
  const result = await updateProductWithStatus(shopId, id, input, actor);

  if (!result.ok) {
    return result;
  }

  return ok(result.data.product);
}

/** Hide a product from sale screens without deleting its history. */
export async function setProductActive(
  shopId: string,
  id: string,
  isActive: boolean,
): Promise<Result<Product>> {
  try {
    const existing = await prisma.product.findFirst({
      where: { id, shopId },
    });

    if (!existing) {
      return fail("Product not found.");
    }

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

export type AdjustStockOptions = {
  /** Set only when confirming an assistant proposal. */
  proposalId?: string;
  /** The preview the shopkeeper confirmed; the write must match it. */
  expectedPreview?: StockAdjustmentPreview;
};

export type AdjustStockOutcome = {
  product: Product;
  movement: StockMovement;
  alreadyConfirmed: boolean;
};

/**
 * Change stock by a signed quantity and record why.
 *
 * Refuses to take stock below zero (invariant 3) and always writes a matching
 * movement row (invariant 6). The unique proposal id on the movement makes a
 * replayed confirmation idempotent; the signed before-stock rejects a stale
 * proposal. Everything is scoped to `shopId`.
 */
export async function adjustStockWithStatus(
  shopId: string,
  input: unknown,
  actor: string = LOCAL_ACTOR,
  options: AdjustStockOptions = {},
): Promise<Result<AdjustStockOutcome>> {
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
    const outcome = await prisma.$transaction(async (tx) => {
      if (options.proposalId) {
        const existingMovement = await tx.stockMovement.findUnique({
          where: { proposalId: options.proposalId },
          include: { product: true },
        });

        if (existingMovement) {
          return {
            product: existingMovement.product,
            movement: existingMovement,
            alreadyConfirmed: true,
          };
        }
      }

      const existing = await tx.product.findFirst({
        where: { id: productId, shopId },
      });

      if (!existing) {
        throw new ServiceError("Product not found.");
      }

      if (
        options.expectedPreview &&
        !matchesStockAdjustmentPreview(
          parsed.data,
          existing.stockMilli,
          options.expectedPreview,
        )
      ) {
        throw new ServiceError(
          "The stock changed since this proposal was prepared. Ask the assistant to prepare it again.",
        );
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

      const movement = await tx.stockMovement.create({
        data: {
          productId,
          shopId,
          quantityMilli: deltaMilli,
          reason,
          note: emptyToNull(note),
          proposalId: options.proposalId ?? null,
        },
      });

      await writeAudit(tx, {
        actor,
        shopId,
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
          proposalId: movement.proposalId,
          source: options.proposalId
            ? "assistant_proposal"
            : "product_screen",
        },
        proposalId: options.proposalId,
      });

      return { product: updated, movement, alreadyConfirmed: false };
    });

    return ok(outcome);
  } catch (error) {
    // A concurrent confirmation may win the unique proposal index.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002" &&
      options.proposalId
    ) {
      const existingMovement = await prisma.stockMovement.findUnique({
        where: { proposalId: options.proposalId },
        include: { product: true },
      });

      if (existingMovement) {
        return ok({
          product: existingMovement.product,
          movement: existingMovement,
          alreadyConfirmed: true,
        });
      }
    }

    return handleError(error);
  }
}

/** Change stock from the product screen. */
export async function adjustStock(
  shopId: string,
  input: unknown,
  actor: string = LOCAL_ACTOR,
): Promise<Result<Product>> {
  const result = await adjustStockWithStatus(shopId, input, actor);

  if (!result.ok) {
    return result;
  }

  return ok(result.data.product);
}
