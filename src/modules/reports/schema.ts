import { z } from "zod";

/**
 * The report periods the page offers. `custom` uses the `from` and `to`
 * `YYYY-MM-DD` keys; the other periods are anchored to the shop's today.
 */
export const REPORT_PERIODS = ["today", "month", "year", "custom"] as const;

export type ReportPeriod = (typeof REPORT_PERIODS)[number];

/**
 * Search parameters are external input, so they are validated before use.
 * An unknown period falls back to today rather than failing the page.
 */
export const reportQuerySchema = z.object({
  period: z.enum(REPORT_PERIODS).catch("today"),
  from: z.string().trim().optional().catch(undefined),
  to: z.string().trim().optional().catch(undefined),
});

export type ReportQuery = z.infer<typeof reportQuerySchema>;
