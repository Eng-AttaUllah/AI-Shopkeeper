import { z } from "zod";

/** Alert review states. PENDING until the shopkeeper decides. */
export const CAMERA_ALERT_STATUSES = ["PENDING", "REVIEWED", "DISMISSED"] as const;

export type CameraAlertStatus = (typeof CAMERA_ALERT_STATUSES)[number];

/**
 * Payload posted by the camera service after it saves a clip.
 *
 * `clipPath` is a bare file name inside `media/camera/`, never a path with
 * directories, so a malicious or buggy caller cannot point the alert at an
 * arbitrary file on the laptop.
 */
export const cameraAlertSchema = z.object({
  clipPath: z
    .string()
    .trim()
    .min(1, "Missing clip name")
    .max(120, "Clip name is too long")
    .regex(/^[A-Za-z0-9._-]+$/, "Clip name must be a plain file name")
    .refine((value) => !value.startsWith("."), "Clip name must be a plain file name"),
  /** ISO 8601 with offset, for example 2026-11-04T10:30:00+05:00. */
  capturedAt: z.string().datetime({ offset: true }),
  durationMs: z
    .number()
    .int()
    .positive("Duration must be more than zero")
    .max(10 * 60 * 1000, "Clip is too long"),
});

export type CameraAlertInput = z.infer<typeof cameraAlertSchema>;

export const cameraReviewSchema = z.object({
  alertId: z.string().min(1, "Missing alert"),
  note: z.string().trim().max(300, "Use at most 300 characters").optional(),
});

export type CameraReviewInput = z.infer<typeof cameraReviewSchema>;
