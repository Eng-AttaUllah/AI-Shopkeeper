import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Naskh_Arabic } from "next/font/google";
import Link from "next/link";

import { LocaleSwitcher } from "@/components/locale-switcher";
import { signOutAction } from "@/app/auth-actions";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { getDirection, getLocale, type Locale, t } from "@/lib/i18n";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const notoNaskhArabic = Noto_Naskh_Arabic({
  variable: "--font-noto-naskh-arabic",
  subsets: ["arabic"],
});

export const metadata: Metadata = {
  title: "AI Shopkeeper Assistant",
  description:
    "Offline-first shop management: products, sales, customers, credit, and reports.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const user = session?.user;
  const locale: Locale = await getLocale();
  const dir = await getDirection(locale);

  return (
    <html
      lang={locale}
      dir={dir}
      className={`${geistSans.variable} ${geistMono.variable} ${notoNaskhArabic.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-page font-sans text-ink">
        <header className="border-b border-line bg-surface">
          <div className="mx-auto flex min-h-14 w-full max-w-5xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2">
            <Link
              href="/"
              className="order-1 shrink-0 text-sm font-semibold"
            >
              AI Shopkeeper
            </Link>

            <LocaleSwitcher locale={locale} />

            {user ? (
              <div className="order-2 ml-auto flex items-center gap-2 sm:order-3">
                <span className="text-sm text-ink-muted">
                  {await t("nav.signedInAs", { user: user.username })}
                </span>
                <form action={signOutAction}>
                  <Button
                    type="submit"
                    variant="ghost"
                    size="sm"
                    className="h-11 px-3 text-sm"
                  >
                    {await t("nav.signOut")}
                  </Button>
                </form>
              </div>
            ) : null}

            {user ? (
              <nav
                aria-label="Main"
                className="order-3 flex w-full items-center gap-x-4 overflow-x-auto text-sm [scrollbar-width:none] sm:order-2 sm:w-auto sm:overflow-visible [&::-webkit-scrollbar]:hidden"
              >
                <Link
                  href="/"
                  className="whitespace-nowrap text-ink-muted transition-colors hover:text-ink"
                >
                  {await t("nav.dashboard")}
                </Link>
                <Link
                  href="/sell"
                  className="whitespace-nowrap text-ink-muted transition-colors hover:text-ink"
                >
                  {await t("nav.sell")}
                </Link>
                <Link
                  href="/products"
                  className="whitespace-nowrap text-ink-muted transition-colors hover:text-ink"
                >
                  {await t("nav.products")}
                </Link>
                <Link
                  href="/sales"
                  className="whitespace-nowrap text-ink-muted transition-colors hover:text-ink"
                >
                  {await t("nav.sales")}
                </Link>
                <Link
                  href="/customers"
                  className="whitespace-nowrap text-ink-muted transition-colors hover:text-ink"
                >
                  {await t("nav.customers")}
                </Link>
                <Link
                  href="/reports"
                  className="whitespace-nowrap text-ink-muted transition-colors hover:text-ink"
                >
                  {await t("nav.reports")}
                </Link>
                <Link
                  href="/more"
                  className="whitespace-nowrap text-ink-muted transition-colors hover:text-ink"
                >
                  {await t("nav.more")}
                </Link>
              </nav>
            ) : null}
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
