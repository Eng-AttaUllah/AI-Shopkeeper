import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import type { z } from "zod";

import { fail, ok, type Result } from "@/lib/result";

/** A proposal is deliberately short-lived; ask again if it expires. */
export const PROPOSAL_TTL_MS = 15 * 60 * 1000;
const MAX_TOKEN_LENGTH = 50_000;

function signingKey(purpose: string): Buffer {
  const secret = process.env.AUTH_SECRET;

  if (!secret || secret === "replace-with-a-long-random-string") {
    throw new Error("AUTH_SECRET is not configured.");
  }

  // Derive a purpose-specific key so the session secret is not reused raw and
  // a sale token cannot be accepted as an expense or payment token.
  return createHmac("sha256", secret).update(purpose).digest();
}

function signature(payloadBase64: string, purpose: string): string {
  return createHmac("sha256", signingKey(purpose))
    .update(payloadBase64)
    .digest("base64url");
}

function invalidProposal(): Result<never> {
  return fail(
    "This proposal is not valid. Ask the assistant to prepare it again.",
  );
}

/** Shared metadata for a new signed proposal. */
export function createProposalMetadata(now = new Date()): {
  proposalId: string;
  createdAt: string;
  expiresAt: string;
} {
  return {
    proposalId: randomUUID(),
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + PROPOSAL_TTL_MS).toISOString(),
  };
}

/** Sign a proposal payload. The token is opaque to the browser. */
export function signProposalPayload(
  payload: unknown,
  purpose: string,
): string {
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url",
  );

  return `${encoded}.${signature(encoded, purpose)}`;
}

/**
 * Verify a signed proposal and return its parsed payload.
 *
 * The token is bound to one signed-in user and expires after 15 minutes. It is
 * never a write by itself: the caller must still re-check the preview inside
 * the write transaction.
 */
export function verifyProposalPayload<
  T extends { userId: string; expiresAt: string },
>(
  token: string,
  schema: z.ZodType<T>,
  purpose: string,
  userId: string,
  now = new Date(),
): Result<T> {
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
    expectedSignature = signature(encoded, purpose);
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

  const parsed = schema.safeParse(decoded);

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
