import { z } from "zod";

/**
 * Change-password form input. The current password is verified against the
 * stored hash; the new password follows the same rules as sign-up passwords.
 */
export const changePasswordSchema = z
  .object({
    currentPassword: z
      .string()
      .min(1, "Enter your current password.")
      .max(200, "Password is too long."),
    newPassword: z
      .string()
      .min(8, "Use at least 8 characters.")
      .max(200, "Password is too long."),
    confirmPassword: z.string().min(1, "Confirm the new password."),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "The two new passwords do not match.",
    path: ["confirmPassword"],
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
