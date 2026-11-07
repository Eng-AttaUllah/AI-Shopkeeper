import type { Metadata } from "next";

import { AssistantChat } from "@/components/assistant/assistant-chat";
import { isAssistantConfigured } from "@/lib/ai/config";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Assistant · EasyShop",
};

export default async function AssistantPage() {
  const configured = isAssistantConfigured();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8">
      <header>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold">{await t("page.assistant")}</h1>
          <span className="rounded-full bg-brand-soft px-2.5 py-1 text-sm font-medium text-brand">
            {await t("assistant.readOnlyBadge")}
          </span>
        </div>
        <p className="mt-2 text-sm text-ink-muted">
          {await t("assistant.subtitle")}
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

async function AssistantSetupNotice() {
  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      <h2 className="text-lg font-semibold">
        {await t("assistant.setup.title")}
      </h2>
      <p className="mt-2 text-sm text-ink-muted">
        {await t("assistant.setup.body")}
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
          <span className="font-medium text-ink">Gemini:</span>{" "}
          <code className="rounded bg-subtle px-1.5 py-0.5 font-mono">
            AI_BASE_URL=&quot;https://generativelanguage.googleapis.com/v1beta/openai&quot;
          </code>{" "}
          and{" "}
          <code className="rounded bg-subtle px-1.5 py-0.5 font-mono">
            AI_MODEL=&quot;gemini-3.5-flash-lite&quot;
          </code>
          , with your key.
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
