import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import { fail, ok, type Result } from "@/lib/result";
import type { SalePreview } from "@/modules/sales/pricing";
import type { CreateSaleInput } from "@/modules/sales/schema";

import {
  saleProposalPayloadSchema,
  type SaleProposal,
  type SaleProposalPayload,
} from "./proposal-schema";

/** A proposal is deliberately short-lived; ask again if it expires. */
export const SALE_PROPOSAL_TTL_MS = 15 * 60 * 1000;
const MAX_TOKEN_LENGTH = 50_000;

function signingKey(): Buffer {
  const secret = process.env.AUTH_SECRET;

  if (!secret || secret === "replace-with-a-long-random-string") {
    throw new Error("AUTH_SECRET is not configured.");
  }

  // Derive a purpose-specific key so the session secret is not reused raw.
  return createHmac("sha256", secret)
    .update("assistant-sale-proposal")
    .digest();
}

function signature(payloadBase64: string): string {
  return createHmac("sha256", signingKey())
    .update(payloadBase64)
    .digest("base64url");
}

function invalidProposal(): Result<never> {
  return fail(
    "This proposal is not valid. Ask the assistant to prepare it again.",
  );
}

/** Sign a sale draft and preview for the shopkeeper to confirm. */
export function createSaleProposalToken(input: {
  userId: string;
  draft: CreateSaleInput;
  preview: SalePreview;
  now?: Date;
}): SaleProposal {
  const now = input.now ?? new Date();
  const payload: SaleProposalPayload = {
    v: 1,
    kind: "sale",
    proposalId: randomUUID(),
    userId: input.userId,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + SALE_PROPOSAL_TTL_MS).toISOString(),
    draft: input.draft,
    preview: input.preview,
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url",
  );

  return {
    token: `${encoded}.${signature(encoded)}`,
    proposalId: payload.proposalId,
    expiresAt: payload.expiresAt,
    preview: payload.preview,
  };
}

/**
 * Verify a proposal token and return its signed draft and preview.
 *
 * A token is bound to one signed-in user and expires after 15 minutes. It is
 * never a write by itself: the caller must still re-price inside the write
 * transaction.
 */
export function verifySaleProposalToken(
  token: string,
  userId: string,
  now = new Date(),
): Result<SaleProposalPayload> {
  if (
    typeof token !== "string" ||
    token.length === 0 ||
    token.length > MAX_TOKEN_LENGTH
  ) {
    return invalidProposal();
  }

  const parts = token.split(".");

  if (parts.length !== 2) {
    return invalidProposal();
  }

  const [encoded, receivedSignature] = parts;

  if (!encoded || !receivedSignature) {
    return invalidProposal();
  }

  let expectedSignature: string;

  try {
    expectedSignature = signature(encoded);
  } catch {
    return fail("The assistant is not configured correctly.");
  }

  let received: Buffer;
  let expected: Buffer;

  try {
    received = Buffer.from(receivedSignature, "base64url");
    expected = Buffer.from(expectedSignature, "base64url");
  } catch {
    return invalidProposal();
  }

  if (
    received.length !== expected.length ||
    !timingSafeEqual(received, expected)
  ) {
    return invalidProposal();
  }

  let decoded: unknown;

  try {
    decoded = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    return invalidProposal();
  }

  const parsed = saleProposalPayloadSchema.safeParse(decoded);

  if (!parsed.success) {
    return invalidProposal();
  }

  if (parsed.data.userId !== userId) {
    return fail("This proposal was prepared for a different sign-in.");
  }

  if (new Date(parsed.data.expiresAt).getTime() <= now.getTime()) {
    return fail(
      "This proposal has expired. Ask the assistant to prepare it again.",
    );
  }

  return ok(parsed.data);
}
