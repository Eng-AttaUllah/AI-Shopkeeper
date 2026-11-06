import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Naskh_Arabic } from "next/font/google";
import Link from "next/link";

import { LocaleSwitcher } from "@/components/locale-switcher";
import { signOutAction } from "@/app/auth-actions";
import { NavBar } from "@/components/nav-bar";
import { SettingsMenu } from "@/components/settings/settings-menu";
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
  const isCustomer = user?.role === "CUSTOMER";
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
            {user ? (
              <SettingsMenu
                labels={{
                  open: await t("settings.menuOpen"),
                  title: await t("settings.menuTitle"),
                  account: await t("settings.account"),
                  security: await t("settings.security"),
                  changePassword: await t("settings.changePassword"),
                  about: await t("settings.about"),
                  close: await t("settings.menuClose"),
                }}
              />
            ) : null}

            <Link
              href={isCustomer ? "/customers/khata" : "/"}
              className="order-2 shrink-0 text-sm font-semibold"
            >
              AI Shopkeeper
            </Link>

            <div className="order-2 sm:order-4">
              <LocaleSwitcher locale={locale} />
            </div>

            {user ? (
              <div className="order-2 ml-auto flex items-center gap-2 sm:order-5">
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

            {user && !isCustomer ? (
              <NavBar
                labels={{
                  "/": await t("nav.dashboard"),
                  "/sell": await t("nav.sell"),
                  "/products": await t("nav.products"),
                  "/sales": await t("nav.sales"),
                  "/customers": await t("nav.customers"),
                  "/reports": await t("nav.reports"),
                  "/more": await t("nav.more"),
                }}
              />
            ) : null}
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
