import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-page font-sans text-ink">
        <header className="border-b border-line bg-surface">
          <div className="mx-auto flex min-h-14 w-full max-w-5xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2">
            <Link href="/" className="shrink-0 text-sm font-semibold">
              AI Shopkeeper
            </Link>
            <nav
              aria-label="Main"
              className="flex w-full items-center gap-x-4 overflow-x-auto text-sm [scrollbar-width:none] sm:w-auto sm:overflow-visible [&::-webkit-scrollbar]:hidden"
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
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
