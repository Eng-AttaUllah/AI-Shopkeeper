"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import { askAssistantAction } from "@/app/assistant/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const SUGGESTIONS = [
  "How much did I sell today?",
  "What is low in stock?",
  "Who owes me the most?",
  "What was my net profit this month?",
  "How much cash should be in the drawer?",
  "What was my last sale?",
] as const;

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  tools?: string[];
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
            <p className="text-base font-medium">What would you like to know?</p>
            <p className="mt-1 text-sm text-ink-muted">
              Try one of these, or type your own question below.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => askQuestion(suggestion)}
                  disabled={pending}
                  className="min-h-11 rounded-full border border-line bg-surface px-3 py-2 text-sm transition-colors hover:bg-subtle disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {suggestion}
                </button>
              ))}
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
                  {message.role === "user" ? "You" : "Assistant"}
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
                    <span className="text-sm text-ink-muted">Checked:</span>
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
              </div>
            </div>
          ))}

          {pending ? (
            <div className="flex justify-start">
              <div className="max-w-[90%]">
                <p className="mb-1 text-sm font-medium text-ink-muted">
                  Assistant
                </p>
                <div className="rounded-xl border border-line bg-surface px-4 py-3 text-base text-ink-muted">
                  Checking the shop…
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
            placeholder="Ask about sales, stock, credit, or cash…"
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
            {pending ? "Thinking…" : "Ask"}
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
