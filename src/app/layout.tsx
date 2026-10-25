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
          <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-6 px-4">
            <Link href="/" className="text-sm font-semibold">
              AI Shopkeeper
            </Link>
            <nav aria-label="Main" className="flex items-center gap-4 text-sm">
              <Link
                href="/"
                className="text-ink-muted transition-colors hover:text-ink"
              >
                Dashboard
              </Link>
              <Link
                href="/products"
                className="text-ink-muted transition-colors hover:text-ink"
              >
                Products
              </Link>
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
