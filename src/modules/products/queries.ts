import type { Product, ProductAlias } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { fromMilli } from "@/lib/quantity";
import { normalizeText } from "@/lib/text";

export type ProductWithAliases = Product & { aliases: ProductAlias[] };

export type ListProductsOptions = {
  search?: string;
  includeInactive?: boolean;
};

/** Products for the list screen, newest names sorted alphabetically. */
export async function listProducts(
  options: ListProductsOptions = {},
): Promise<ProductWithAliases[]> {
  const term = options.search?.trim();

  let products = await prisma.product.findMany({
    where: {
      ...(options.includeInactive ? {} : { isActive: true }),
    },
    include: { aliases: { orderBy: { alias: "asc" } } },
    orderBy: { name: "asc" },
  });

  if (term) {
    const normalized = normalizeText(term);

    products = products.filter((product) => {
      const haystack = [
        product.name,
        product.category ?? "",
        product.barcode ?? "",
        ...product.aliases.map((alias) => alias.alias),
      ]
        .map((part) => normalizeText(part))
        .join(" ");

      return haystack.includes(normalized);
    });
  }

  return products;
}

/** One product with its aliases and most recent stock movements. */
export async function getProduct(id: string) {
  return prisma.product.findUnique({
    where: { id },
    include: {
      aliases: { orderBy: { alias: "asc" } },
      stockMovements: { orderBy: { createdAt: "desc" }, take: 10 },
    },
  });
}

/**
 * Active products at or below their low-stock level.
 *
 * Filtered in memory because the comparison is between two columns, and the
 * shop has a small number of products.
 */
export async function lowStockProducts(): Promise<ProductWithAliases[]> {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    include: { aliases: true },
    orderBy: { name: "asc" },
  });

  return products.filter(
    (product) => product.stockMilli <= product.lowStockMilli,
  );
}

/** Total cost value of everything currently in stock. */
export async function inventoryValuePaisa(): Promise<number> {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    select: { stockMilli: true, costPricePaisa: true },
  });

  return products.reduce(
    (total, product) =>
      total + Math.round(fromMilli(product.stockMilli) * product.costPricePaisa),
    0,
  );
}

export type SellableProduct = {
  id: string;
  name: string;
  category: string | null;
  unit: string;
  salePricePaisa: number;
  stockMilli: number;
  lowStockMilli: number;
  aliases: string[];
};

/**
 * The columns the sell screen needs, with aliases flattened so the client can
 * search by the names people actually use.
 */
export async function listSellableProducts(): Promise<SellableProduct[]> {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      category: true,
      unit: true,
      salePricePaisa: true,
      stockMilli: true,
      lowStockMilli: true,
      aliases: { select: { alias: true }, orderBy: { alias: "asc" } },
    },
    orderBy: { name: "asc" },
  });

  return products.map((product) => ({
    ...product,
    aliases: product.aliases.map((row) => row.alias),
  }));
}

export type StockDrift = {
  id: string;
  name: string;
  cachedMilli: number;
  computedMilli: number;
};

/**
 * Compare each product's cached stock with the sum of its stock movements.
 * An empty result means the cache is consistent. Used by tests and by a repair
 * routine; see invariant 9.
 */
export async function reconcileStock(): Promise<StockDrift[]> {
  const [products, sums] = await Promise.all([
    prisma.product.findMany({
      select: { id: true, name: true, stockMilli: true },
    }),
    prisma.stockMovement.groupBy({
      by: ["productId"],
      _sum: { quantityMilli: true },
    }),
  ]);

  const computed = new Map(
    sums.map((row) => [row.productId, row._sum.quantityMilli ?? 0]),
  );

  return products
    .map((product) => ({
      id: product.id,
      name: product.name,
      cachedMilli: product.stockMilli,
      computedMilli: computed.get(product.id) ?? 0,
    }))
    .filter((row) => row.cachedMilli !== row.computedMilli);
}
