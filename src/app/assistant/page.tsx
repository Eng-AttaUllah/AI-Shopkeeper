import type { Metadata } from "next";

import { AssistantChat } from "@/components/assistant/assistant-chat";
import { isAssistantConfigured } from "@/lib/ai/config";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Assistant · AI Shopkeeper Assistant",
};

export default function AssistantPage() {
  const configured = isAssistantConfigured();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8">
      <header>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold">Assistant</h1>
          <span className="rounded-full bg-brand-soft px-2.5 py-1 text-sm font-medium text-brand">
            Read-only
          </span>
        </div>
        <p className="mt-2 text-sm text-ink-muted">
          Ask about sales, stock, credit, expenses, or cash. The assistant looks
          up the figures; it cannot change any records.
        </p>
      </header>

      {configured ? <AssistantChat /> : <AssistantSetupNotice />}

      <p className="text-sm text-ink-muted">
        Questions and the shop figures needed to answer them are sent to the
        configured AI provider. Use a local model if the shop data must stay on
        this laptop.
      </p>
    </main>
  );
}

function AssistantSetupNotice() {
  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      <h2 className="text-lg font-semibold">
        The assistant is not configured yet
      </h2>
      <p className="mt-2 text-sm text-ink-muted">
        The rest of the app works normally. To turn the assistant on, add these
        values to
        <code className="mx-1 rounded bg-subtle px-1.5 py-0.5 font-mono text-sm">
          .env
        </code>
        and restart the app:
      </p>

      <pre className="mt-4 overflow-x-auto rounded-lg bg-subtle p-4 text-sm">
        <code>{`AI_BASE_URL="https://api.openai.com/v1"
AI_API_KEY="your-key"
AI_MODEL="gpt-4o-mini"`}</code>
      </pre>

      <div className="mt-4 space-y-2 text-sm text-ink-muted">
        <p>
          <span className="font-medium text-ink">OpenAI:</span> the values
          above, with your key.
        </p>
        <p>
          <span className="font-medium text-ink">Ollama (local):</span>{" "}
          <code className="rounded bg-subtle px-1.5 py-0.5 font-mono">
            AI_BASE_URL=&quot;http://localhost:11434/v1&quot;
          </code>{" "}
          and{" "}
          <code className="rounded bg-subtle px-1.5 py-0.5 font-mono">
            AI_MODEL=&quot;llama3.1&quot;
          </code>
          . No API key is needed.
        </p>
        <p>
          Use a model that supports tool calling. The adapter also works with
          OpenRouter, Groq, LM Studio, and other OpenAI-compatible endpoints.
        </p>
      </div>
    </section>
  );
}
