import { z } from "zod";

/**
 * The periods the assistant can ask tools about. They mirror the report
 * periods and add "yesterday" and "last_month", which shopkeepers ask for
 * often. `custom` requires `from` and `to` as `YYYY-MM-DD` shop-local keys.
 */
export const ASSISTANT_RANGES = [
  "today",
  "yesterday",
  "this_month",
  "last_month",
  "this_year",
  "custom",
] as const;

export const assistantRangeSchema = z.object({
  range: z
    .enum(ASSISTANT_RANGES)
    .default("today")
    .describe(
      "The period to report on. Use custom with from and to for any other dates.",
    ),
  from: z
    .string()
    .trim()
    .optional()
    .describe("Start date for a custom range, YYYY-MM-DD."),
  to: z
    .string()
    .trim()
    .optional()
    .describe("End date for a custom range, YYYY-MM-DD."),
});

export type AssistantRangeInput = z.infer<typeof assistantRangeSchema>;

const historyTurnSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(2000),
});

export type AssistantHistoryTurn = z.infer<typeof historyTurnSchema>;

/** The client sends only the last few final answers, never tool payloads. */
export const assistantHistorySchema = z
  .array(historyTurnSchema)
  .max(6)
  .default([]);

export const assistantQuestionSchema = z
  .string()
  .trim()
  .min(2, "Ask a question with at least 2 characters.")
  .max(500, "Keep the question under 500 characters.");

export const assistantRequestSchema = z.object({
  question: assistantQuestionSchema,
  history: assistantHistorySchema,
});
