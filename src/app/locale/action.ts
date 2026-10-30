"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { COOKIE_NAME, type Locale } from "@/lib/i18n";

/** Remember the shopkeeper's locale in a cookie, then return them to `from`. */
export async function setLocaleAction(formData: FormData): Promise<void> {
  const locale = formData.get("locale");
  const from = formData.get("from");

  if (locale !== "en" && locale !== "ps") {
    return;
  }

  const cookieStore = await cookies();

  cookieStore.set(COOKIE_NAME, locale as Locale);

  redirect(typeof from === "string" ? from : "/");
}
