import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Result } from "@/lib/result";
import {
  createSaleProposalToken,
  SALE_PROPOSAL_TTL_MS,
  verifySaleProposalToken,
} from "@/modules/assistant/proposal-token";
import type { SalePreview } from "@/modules/sales/pricing";

const now = new Date("2026-10-28T10:00:00.000Z");

const draft = {
  items: [{ productId: "product-1", quantity: "2" }],
  discount: "0",
  paid: "320",
  paymentMethod: "CASH" as const,
};

const preview: SalePreview = {
  paymentMethod: "CASH",
  customerId: null,
  customerName: null,
  note: null,
  lines: [
    {
      productId: "product-1",
      productName: "Sugar",
      unit: "kg",
      quantityMilli: 2000,
      unitPricePaisa: 16000,
      lineTotalPaisa: 32000,
    },
  ],
  subtotalPaisa: 32000,
  discountPaisa: 0,
  totalPaisa: 32000,
  paidPaisa: 32000,
  changePaisa: 0,
};

function expectOk<T>(result: Result<T>): T {
  if (!result.ok) {
    throw new Error(`Expected success but got: ${result.error}`);
  }

  return result.data;
}

const originalSecret = process.env.AUTH_SECRET;

beforeAll(() => {
  process.env.AUTH_SECRET = "test-secret-for-sale-proposals-0123456789";
});

afterAll(() => {
  if (originalSecret === undefined) {
    delete process.env.AUTH_SECRET;
  } else {
    process.env.AUTH_SECRET = originalSecret;
  }
});

describe("sale proposal tokens", () => {
  it("signs a proposal and verifies it for the same user", () => {
    const proposal = createSaleProposalToken({
      userId: "user-1",
      draft,
      preview,
      now,
    });

    expect(proposal.proposalId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(proposal.preview).toEqual(preview);
    expect(proposal.expiresAt).toBe(
      new Date(now.getTime() + SALE_PROPOSAL_TTL_MS).toISOString(),
    );

    const verified = expectOk(
      verifySaleProposalToken(proposal.token, "user-1", now),
    );

    expect(verified.proposalId).toBe(proposal.proposalId);
    expect(verified.draft).toEqual(draft);
    expect(verified.preview).toEqual(preview);
  });

  it("rejects a tampered payload", () => {
    const proposal = createSaleProposalToken({
      userId: "user-1",
      draft,
      preview,
      now,
    });
    const [encoded, signature] = proposal.token.split(".");

    expect(encoded).toBeDefined();
    expect(signature).toBeDefined();

    const tampered = `${encoded?.slice(0, -1)}A.${signature}`;

    expect(verifySaleProposalToken(tampered, "user-1", now).ok).toBe(false);
  });

  it("rejects a proposal prepared for another sign-in", () => {
    const proposal = createSaleProposalToken({
      userId: "user-1",
      draft,
      preview,
      now,
    });
    const result = verifySaleProposalToken(proposal.token, "user-2", now);

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error).toContain("different sign-in");
    }
  });

  it("rejects an expired proposal", () => {
    const proposal = createSaleProposalToken({
      userId: "user-1",
      draft,
      preview,
      now,
    });
    const result = verifySaleProposalToken(
      proposal.token,
      "user-1",
      new Date(now.getTime() + SALE_PROPOSAL_TTL_MS + 1),
    );

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error).toContain("expired");
    }
  });

  it("rejects a malformed token", () => {
    expect(verifySaleProposalToken("not-a-token", "user-1", now).ok).toBe(false);
    expect(verifySaleProposalToken("", "user-1", now).ok).toBe(false);
  });
});
