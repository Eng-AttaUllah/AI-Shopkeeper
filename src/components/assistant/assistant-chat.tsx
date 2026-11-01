"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import { askAssistantAction } from "@/app/assistant/actions";
import { ProposalCard } from "@/components/assistant/proposal-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AssistantProposal } from "@/modules/assistant/proposal-schema";
import {
  readClientLocale,
  translate,
  type Locale,
} from "@/lib/dictionary";

const SUGGESTION_KEYS = [
  "assistant.suggestion.salesToday",
  "assistant.suggestion.lowStock",
  "assistant.suggestion.topDebt",
  "assistant.suggestion.netProfit",
  "assistant.suggestion.drawerCash",
  "assistant.suggestion.expense",
  "assistant.suggestion.payment",
] as const;

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  tools?: string[];
  proposal?: AssistantProposal;
};

let nextMessageId = 0;

function messageId(): string {
  nextMessageId += 1;

  return `message-${nextMessageId}`;
}

export function AssistantChat() {
  const [pending, startTransition] = useTransition();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const locale: Locale = readClientLocale();

  function t(key: string): string {
    return translate(locale, key);
  }

  function askQuestion(rawQuestion: string) {
    const asked = rawQuestion.trim();

    if (asked.length < 2 || pending) {
      return;
    }

    const history = messages
      .slice(-6)
      .map(({ role, content }) => ({ role, content }));

    setMessages((previous) => [
      ...previous,
      { id: messageId(), role: "user", content: asked },
    ]);
    setQuestion("");
    setError(null);

    startTransition(async () => {
      try {
        const result = await askAssistantAction({ question: asked, history });

        if (result.ok) {
          setMessages((previous) => [
            ...previous,
            {
              id: messageId(),
              role: "assistant",
              content: result.data.answer,
              tools: result.data.tools,
              proposal: result.data.proposal,
            },
          ]);
        } else {
          setError(result.error);
        }
      } catch (requestError) {
        console.error("Assistant request failed:", requestError);
        setError(
          "The assistant could not answer right now. Check the connection and try again.",
        );
      }
    });
  }

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, pending]);

  return (
    <section className="flex h-[60vh] min-h-[22rem] max-h-[36rem] flex-col overflow-hidden rounded-xl border border-line bg-surface">
      <div className="flex-1 overflow-y-auto bg-subtle p-4">
        {messages.length === 0 && !pending ? (
          <div className="mx-auto max-w-xl py-6 text-center">
            <p className="text-base font-medium">{t("assistant.empty.title")}</p>
            <p className="mt-1 text-sm text-ink-muted">
              {t("assistant.empty.body")}
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {SUGGESTION_KEYS.map((suggestionKey) => {
                const suggestion = t(suggestionKey);

                return (
                  <button
                    key={suggestionKey}
                    type="button"
                    onClick={() => askQuestion(suggestion)}
                    disabled={pending}
                    className="min-h-11 rounded-full border border-line bg-surface px-3 py-2 text-sm transition-colors hover:bg-subtle disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {suggestion}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={
                message.role === "user" ? "flex justify-end" : "flex justify-start"
              }
            >
              <div
                className={
                  message.role === "user" ? "max-w-[85%]" : "max-w-[90%]"
                }
              >
                <p className="mb-1 text-sm font-medium text-ink-muted">
                  {message.role === "user" ? t("assistant.userLabel") : t("assistant.assistantLabel")}
                </p>
                <div
                  className={
                    message.role === "user"
                      ? "whitespace-pre-wrap rounded-xl bg-brand px-4 py-3 text-base leading-6 text-white"
                      : "whitespace-pre-wrap rounded-xl border border-line bg-surface px-4 py-3 text-base leading-6"
                  }
                >
                  {message.content}
                </div>
                {message.tools && message.tools.length > 0 ? (
                  <div className="mt-2 flex flex-wrap items-center gap-1">
                    <span className="text-sm text-ink-muted">
                      {t("assistant.checked")}
                    </span>
                    {message.tools.map((tool) => (
                      <span
                        key={tool}
                        className="rounded-full bg-subtle px-2 py-0.5 text-sm text-ink-muted"
                      >
                        {tool}
                      </span>
                    ))}
                  </div>
                ) : null}
                {message.proposal ? (
                  <ProposalCard proposal={message.proposal} />
                ) : null}
              </div>
            </div>
          ))}

          {pending ? (
            <div className="flex justify-start">
              <div className="max-w-[90%]">
                <p className="mb-1 text-sm font-medium text-ink-muted">
                  {t("assistant.assistantLabel")}
                </p>
                <div className="rounded-xl border border-line bg-surface px-4 py-3 text-base text-ink-muted">
                  {t("assistant.checking")}
                </div>
              </div>
            </div>
          ) : null}

          <div ref={endRef} />
        </div>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          askQuestion(question);
        }}
        className="border-t border-line p-3"
      >
        <div className="flex items-center gap-2">
          <Input
            name="question"
            value={question}
            onChange={(event) => {
              setQuestion(event.target.value);
              if (error) {
                setError(null);
              }
            }}
            placeholder={t("assistant.placeholder")}
            maxLength={500}
            minLength={2}
            required
            autoComplete="off"
            enterKeyHint="send"
            aria-label="Your question"
            className="h-11 flex-1 text-base"
          />
          <Button
            type="submit"
            disabled={pending || question.trim().length < 2}
            className="h-11 px-5 text-base"
          >
            {pending ? "Thinking…" : t("assistant.askButton")}
          </Button>
        </div>
        {error ? (
          <p
            role="alert"
            className="mt-2 rounded-lg border border-error/30 bg-error/5 px-3 py-2 text-sm text-error"
          >
            {error}
          </p>
        ) : null}
      </form>
    </section>
  );
}
