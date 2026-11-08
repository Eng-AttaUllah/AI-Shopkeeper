import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type {
  AssistantTurn,
  ChatProvider,
  ChatRequest,
} from "@/lib/ai/types";
import { prisma } from "@/lib/db";
import type { Result } from "@/lib/result";
import { answerShopQuestion } from "@/modules/assistant/service";
import { createCustomer } from "@/modules/customers/service";
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

let shopId: string;

async function seedCashSale() {
  const product = expectOk(await createProduct(shopId, sugar));

  return expectOk(
    await createSale(shopId, {
      items: [{ productId: product.id, quantity: "2" }],
      discount: "0",
      paid: "400",
      paymentMethod: "CASH",
    }),
  );
}

beforeEach(async () => {
  const shop = await prisma.shop.create({
    data: { name: "Test Shop", currency: "PKR", timezone: "Asia/Karachi" },
  });
  shopId = shop.id;

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
        shopId,
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
        shopId,
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
        shopId,
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
        shopId,
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
      shopId,
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
      shopId,
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
      shopId,
    });

    expect(emptyResult.ok).toBe(false);
    if (!emptyResult.ok) {
      expect(emptyResult.error).toContain("did not return an answer");
    }

    const invalid = await answerShopQuestion({
      question: " ",
      provider: new FakeProvider([]),
      shopId,
    });

    expect(invalid.ok).toBe(false);
    if (!invalid.ok) {
      expect(invalid.error).toContain("at least 2");
    }
  });

  it("prepares a signed sale proposal without writing or exposing the token to the model", async () => {
    const product = expectOk(await createProduct(shopId, sugar));
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
        shopId,
      }),
    );

    expect(answer.answer).toContain("Confirm sale");
    expect(answer.tools).toContain("Sale proposal");
    expect(answer.proposal?.kind).toBe("sale");

    if (answer.proposal?.kind !== "sale") {
      throw new Error("Expected a sale proposal");
    }

    const saleProposal = answer.proposal.proposal;

    expect(saleProposal.preview.lines[0]?.productId).toBe(product.id);
    expect(saleProposal.preview.totalPaisa).toBe(32000);
    expect(await prisma.sale.count()).toBe(0);

    const stored = await prisma.product.findUnique({
      where: { id: product.id },
    });

    expect(stored?.stockMilli).toBe(10000);

    const toolMessage = provider.requests[1]?.messages.find(
      (message) => message.role === "tool",
    );

    expect(toolMessage?.content).toContain("Nothing has been saved");
    expect(toolMessage?.content).not.toContain(saleProposal.token);

    const systemPrompt = provider.requests[0]?.messages.find(
      (message) => message.role === "system",
    );

    expect(systemPrompt?.content).toContain("Confirm sale");
  });

  it("prepares a signed expense proposal without writing", async () => {
    const provider = new FakeProvider([
      {
        content: null,
        toolCalls: [
          {
            id: "call-1",
            name: "propose_expense",
            arguments: JSON.stringify({
              category: "electricity",
              amount: "500",
              note: "October bill",
            }),
          },
        ],
      },
      {
        content: "Review the expense and press Confirm expense.",
        toolCalls: [],
      },
    ]);

    const answer = expectOk(
      await answerShopQuestion({
        question: "Record 500 rupees electricity expense.",
        provider,
        userId: "user-1",
        shopId,
        now: new Date("2026-10-28T10:00:00.000Z"),
      }),
    );

    expect(answer.answer).toContain("Confirm expense");
    expect(answer.tools).toContain("Expense proposal");
    expect(answer.proposal?.kind).toBe("expense");

    if (answer.proposal?.kind !== "expense") {
      throw new Error("Expected an expense proposal");
    }

    const expenseProposal = answer.proposal.proposal;

    expect(expenseProposal.preview).toMatchObject({
      category: "ELECTRICITY",
      amountPaisa: 50000,
      date: "2026-10-28",
      note: "October bill",
    });
    expect(await prisma.expense.count()).toBe(0);

    const toolMessage = provider.requests[1]?.messages.find(
      (message) => message.role === "tool",
    );

    expect(toolMessage?.content).toContain("Nothing has been saved");
    expect(toolMessage?.content).not.toContain(expenseProposal.token);

    const systemPrompt = provider.requests[0]?.messages.find(
      (message) => message.role === "system",
    );

    expect(systemPrompt?.content).toContain("Confirm expense");
  });

  it("prepares a signed payment proposal without writing", async () => {
    const product = expectOk(await createProduct(shopId, sugar));
    const customer = expectOk(
      await createCustomer(shopId, {
        name: "Ali Khan",
        phone: "0300-1234567",
        note: "",
      }),
    );

    expectOk(
      await createSale(shopId, {
        items: [{ productId: product.id, quantity: "2" }],
        paymentMethod: "CREDIT",
        customerId: customer.id,
      }),
    );

    const provider = new FakeProvider([
      {
        content: null,
        toolCalls: [
          {
            id: "call-1",
            name: "propose_payment",
            arguments: JSON.stringify({
              customer: "Ali Khan",
              amount: "200",
            }),
          },
        ],
      },
      {
        content: "Review the payment and press Confirm payment.",
        toolCalls: [],
      },
    ]);

    const answer = expectOk(
      await answerShopQuestion({
        question: "Ali paid 200 on his khata.",
        provider,
        userId: "user-1",
        shopId,
        now: new Date("2026-10-28T10:00:00.000Z"),
      }),
    );

    expect(answer.answer).toContain("Confirm payment");
    expect(answer.tools).toContain("Payment proposal");
    expect(answer.proposal?.kind).toBe("payment");

    if (answer.proposal?.kind !== "payment") {
      throw new Error("Expected a payment proposal");
    }

    const paymentProposal = answer.proposal.proposal;

    expect(paymentProposal.preview).toMatchObject({
      customerId: customer.id,
      customerName: "Ali Khan",
      amountPaisa: 20000,
      balanceBeforePaisa: 32000,
      balanceAfterPaisa: 12000,
    });
    expect(await prisma.payment.count()).toBe(0);

    const toolMessage = provider.requests[1]?.messages.find(
      (message) => message.role === "tool",
    );

    expect(toolMessage?.content).toContain("Nothing has been saved");
    expect(toolMessage?.content).not.toContain(paymentProposal.token);
  });

  it("allows only one proposal per answer", async () => {
    const provider = new FakeProvider([
      {
        content: null,
        toolCalls: [
          {
            id: "call-1",
            name: "propose_expense",
            arguments: JSON.stringify({ category: "other", amount: "10" }),
          },
          {
            id: "call-2",
            name: "propose_expense",
            arguments: JSON.stringify({ category: "other", amount: "20" }),
          },
        ],
      },
      { content: "Review the first proposal.", toolCalls: [] },
    ]);

    const answer = expectOk(
      await answerShopQuestion({
        question: "Record two expenses.",
        provider,
        userId: "user-1",
        shopId,
        now: new Date("2026-10-28T10:00:00.000Z"),
      }),
    );

    expect(answer.proposal?.kind).toBe("expense");

    if (answer.proposal?.kind !== "expense") {
      throw new Error("Expected an expense proposal");
    }

    expect(answer.proposal.proposal.preview.amountPaisa).toBe(1000);

    const toolMessages = provider.requests[1]?.messages.filter(
      (message) => message.role === "tool",
    );

    expect(toolMessages).toHaveLength(2);
    expect(toolMessages?.[1]?.content).toContain("already prepared");
    expect(await prisma.expense.count()).toBe(0);
  });
});
