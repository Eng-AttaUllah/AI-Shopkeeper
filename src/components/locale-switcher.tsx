"use client";

import { usePathname } from "next/navigation";

import { setLocaleAction } from "@/app/locale/action";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/lib/i18n";

/**
 * Language switcher rendered on every signed-in page.
 *
 * It is a client component so it can read the current pathname and send the
 * shopkeeper back to the same page after switching locale. The underlying
 * write is a server action that sets the `shop_locale` cookie.
 */
export function LocaleSwitcher({ locale }: { locale: Locale }) {
  const pathname = usePathname();

  const other: Locale = locale === "en" ? "ps" : "en";
  const label = other === "en" ? "English" : "پښتو";

  return (
    <form action={setLocaleAction}>
      <input type="hidden" name="locale" value={other} />
      <input type="hidden" name="from" value={pathname} />
      <Button type="submit" variant="outline" size="sm" className="h-9 px-2.5 text-xs">
        {label}
      </Button>
    </form>
  );
}
