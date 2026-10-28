"use server";

import { AuthError } from "next-auth";

import { signIn } from "@/lib/auth";
import { loginSchema } from "@/lib/credentials";
import { fieldErrors } from "@/lib/zod";

export type LoginState =
  | {
      error?: string;
      fieldErrors?: Record<string, string>;
    }
  | null;

function safeRedirect(value: FormDataEntryValue | null): string {
  if (typeof value !== "string" || !value.startsWith("/")) {
    return "/";
  }

  const base = "http://shop.local";

  try {
    const target = new URL(value, base);

    if (target.origin !== new URL(base).origin) {
      return "/";
    }

    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return "/";
  }
}

export async function loginAction(
  _previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      error: "Enter your username and password.",
      fieldErrors: fieldErrors(parsed.error),
    };
  }

  try {
    await signIn("credentials", {
      username: parsed.data.username,
      password: parsed.data.password,
      redirectTo: safeRedirect(formData.get("from")),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Wrong username or password." };
    }

    throw error;
  }

  return null;
}
