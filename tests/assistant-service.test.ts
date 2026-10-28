import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type {
  AssistantTurn,
  ChatProvider,
  ChatRequest,
} from "@/lib/ai/types";
import { prisma } from "@/lib/db";
import type { Result } from "@/lib/result";
import { answerShopQuestion } from "@/modules/assistant/service";
import { createProduct } from "@/modules/products/service";
import { createSale } from "@/modules/sales/service";

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

function expectOk<T>(result: Result<T>): T {
  if (!result.ok) {
    throw new Error(`Expected success but got: ${result.error}`);
  }

  return result.data;
}

class FakeProvider implements ChatProvider {
  readonly requests: ChatRequest[] = [];
  private readonly turns: AssistantTurn[];

  constructor(turns: AssistantTurn[]) {
    this.turns = [...turns];
  }

  async complete(request: ChatRequest): Promise<AssistantTurn> {
    this.requests.push({
      messages: [...request.messages],
      tools: request.tools,
    });

    const turn = this.turns.shift();

    if (!turn) {
      throw new Error("No more fake turns");
    }

    return turn;
  }
}

async function seedCashSale() {
  const product = expectOk(await createProduct(sugar));

  return expectOk(
    await createSale({
      items: [{ productId: product.id, quantity: "2" }],
      discount: "0",
      paid: "400",
      paymentMethod: "CASH",
    }),
  );
}

beforeEach(async () => {
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

const originalSecret = process.env.AUTH_SECRET;

beforeAll(() => {
  process.env.AUTH_SECRET = "test-secret-for-sale-proposals-0123456789";
});

afterAll(async () => {
  if (originalSecret === undefined) {
    delete process.env.AUTH_SECRET;
  } else {
    process.env.AUTH_SECRET = originalSecret;
  }

  await prisma.$disconnect();
});

describe("answerShopQuestion", () => {
  it("runs a read-only tool and returns the model's answer", async () => {
    await seedCashSale();

    const provider = new FakeProvider([
      {
        content: null,
        toolCalls: [
          {
            id: "call-1",
            name: "sales_summary",
            arguments: JSON.stringify({ range: "today" }),
          },
        ],
      },
      { content: "You sold Rs. 320.00 today.", toolCalls: [] },
    ]);

    const answer = expectOk(
      await answerShopQuestion({
        question: "How much did I sell today?",
        provider,
      }),
    );

    expect(answer.answer).toBe("You sold Rs. 320.00 today.");
    expect(answer.tools).toEqual(["Sales summary"]);
    expect(provider.requests).toHaveLength(2);

    const toolNames = provider.requests[0]?.tools.map(
      (tool) => tool.function.name,
    );

    expect(toolNames).toContain("sales_summary");
    expect(toolNames).toContain("low_stock");
    expect(toolNames).not.toContain("delete_sale");

    const toolMessage = provider.requests[1]?.messages.find(
      (message) => message.role === "tool",
    );

    expect(toolMessage?.content).toContain("Rs. 320.00");
  });

  it("answers without tools and includes a short history", async () => {
    const provider = new FakeProvider([
      { content: "I can help with shop questions.", toolCalls: [] },
    ]);

    const answer = expectOk(
      await answerShopQuestion({
        question: "What can you do?",
        history: [
          { role: "user", content: "Hello" },
          { role: "assistant", content: "Hello. Ask me about the shop." },
        ],
        provider,
      }),
    );

    expect(answer.answer).toBe("I can help with shop questions.");
    expect(answer.tools).toEqual([]);

    const messages = provider.requests[0]?.messages;

    expect(
      messages?.some(
        (message) =>
          message.role === "user" && message.content === "Hello",
      ),
    ).toBe(true);
    expect(
      messages?.some(
        (message) =>
          message.role === "assistant" &&
          message.content === "Hello. Ask me about the shop.",
      ),
    ).toBe(true);
  });

  it("feeds an unknown tool error back to the model without running it", async () => {
    await seedCashSale();

    const provider = new FakeProvider([
      {
        content: null,
        toolCalls: [
          { id: "call-1", name: "delete_sale", arguments: "{}" },
        ],
      },
      { content: "I cannot do that.", toolCalls: [] },
    ]);

    const answer = expectOk(
      await answerShopQuestion({
        question: "Delete my last sale.",
        provider,
      }),
    );

    expect(answer.answer).toBe("I cannot do that.");
    expect(answer.tools).toEqual([]);

    const toolMessage = provider.requests[1]?.messages.find(
      (message) => message.role === "tool",
    );

    expect(toolMessage?.content).toContain("Unknown tool");
    expect(await prisma.sale.count()).toBe(1);
  });

  it("deduplicates labels when a tool is called more than once", async () => {
    await seedCashSale();

    const provider = new FakeProvider([
      {
        content: null,
        toolCalls: [
          {
            id: "call-1",
            name: "sales_summary",
            arguments: JSON.stringify({ range: "today" }),
          },
          {
            id: "call-2",
            name: "sales_summary",
            arguments: JSON.stringify({ range: "yesterday" }),
          },
        ],
      },
      { content: "Today was better.", toolCalls: [] },
    ]);

    const answer = expectOk(
      await answerShopQuestion({
        question: "Compare today with yesterday.",
        provider,
      }),
    );

    expect(answer.tools).toEqual(["Sales summary"]);
    expect(
      provider.requests[1]?.messages.filter(
        (message) => message.role === "tool",
      ),
    ).toHaveLength(2);
  });

  it("returns a readable failure when the provider is unreachable", async () => {
    const provider: ChatProvider = {
      async complete() {
        throw new Error("offline");
      },
    };

    const result = await answerShopQuestion({
      question: "How much did I sell today?",
      provider,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("could not reach");
    }
  });

  it("stops after the maximum number of model rounds", async () => {
    const provider = new FakeProvider(
      Array.from({ length: 4 }, (_, index) => ({
        content: null,
        toolCalls: [
          { id: `call-${index}`, name: "low_stock", arguments: "{}" },
        ],
      })),
    );

    const result = await answerShopQuestion({
      question: "What is low in stock?",
      provider,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("too many steps");
    }
  });

  it("rejects an empty answer and an invalid question", async () => {
    const empty = new FakeProvider([{ content: "   ", toolCalls: [] }]);

    const emptyResult = await answerShopQuestion({
      question: "Hello",
      provider: empty,
    });

    expect(emptyResult.ok).toBe(false);
    if (!emptyResult.ok) {
      expect(emptyResult.error).toContain("did not return an answer");
    }

    const invalid = await answerShopQuestion({
      question: " ",
      provider: new FakeProvider([]),
    });

    expect(invalid.ok).toBe(false);
    if (!invalid.ok) {
      expect(invalid.error).toContain("at least 2");
    }
  });

  it("prepares a signed sale proposal without writing or exposing the token to the model", async () => {
    const product = expectOk(await createProduct(sugar));
    const provider = new FakeProvider([
      {
        content: null,
        toolCalls: [
          {
            id: "call-1",
            name: "propose_sale",
            arguments: JSON.stringify({
              items: [{ product: "Sugar", quantity: "2" }],
              paymentMethod: "CASH",
              paid: "400",
            }),
          },
        ],
      },
      {
        content: "Review the proposal and press Confirm sale.",
        toolCalls: [],
      },
    ]);

    const answer = expectOk(
      await answerShopQuestion({
        question: "Sell 2 kg of sugar for cash.",
        provider,
        userId: "user-1",
      }),
    );

    expect(answer.answer).toContain("Confirm sale");
    expect(answer.tools).toContain("Sale proposal");
    expect(answer.proposal?.preview.lines[0]?.productId).toBe(product.id);
    expect(answer.proposal?.preview.totalPaisa).toBe(32000);
    expect(await prisma.sale.count()).toBe(0);

    const stored = await prisma.product.findUnique({
      where: { id: product.id },
    });

    expect(stored?.stockMilli).toBe(10000);

    const toolMessage = provider.requests[1]?.messages.find(
      (message) => message.role === "tool",
    );

    expect(toolMessage?.content).toContain("Nothing has been saved");
    expect(toolMessage?.content).not.toContain(answer.proposal?.token);

    const systemPrompt = provider.requests[0]?.messages.find(
      (message) => message.role === "system",
    );

    expect(systemPrompt?.content).toContain("Confirm sale");
  });
});
