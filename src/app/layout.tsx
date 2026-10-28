import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";

import { signOutAction } from "@/app/auth-actions";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
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

            {user ? (
              <div className="order-2 ml-auto flex items-center gap-2 sm:order-3">
                <span className="text-sm text-ink-muted">{user.username}</span>
                <form action={signOutAction}>
                  <Button
                    type="submit"
                    variant="ghost"
                    size="sm"
                    className="h-11 px-3 text-sm"
                  >
                    Sign out
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
                  Dashboard
                </Link>
                <Link
                  href="/sell"
                  className="whitespace-nowrap text-ink-muted transition-colors hover:text-ink"
                >
                  Sell
                </Link>
                <Link
                  href="/products"
                  className="whitespace-nowrap text-ink-muted transition-colors hover:text-ink"
                >
                  Products
                </Link>
                <Link
                  href="/sales"
                  className="whitespace-nowrap text-ink-muted transition-colors hover:text-ink"
                >
                  Sales
                </Link>
                <Link
                  href="/customers"
                  className="whitespace-nowrap text-ink-muted transition-colors hover:text-ink"
                >
                  Customers
                </Link>
                <Link
                  href="/reports"
                  className="whitespace-nowrap text-ink-muted transition-colors hover:text-ink"
                >
                  Reports
                </Link>
                <Link
                  href="/more"
                  className="whitespace-nowrap text-ink-muted transition-colors hover:text-ink"
                >
                  More
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
