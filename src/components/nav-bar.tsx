"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  BarChart3,
  Ellipsis,
  LayoutDashboard,
  Package,
  ReceiptText,
  ShoppingCart,
  Users,
  type LucideIcon,
} from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Extra path prefixes that should light this item up (e.g. More). */
  also?: string[];
};

const ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/sell", label: "Sell", icon: ShoppingCart },
  { href: "/products", label: "Products", icon: Package },
  { href: "/sales", label: "Sales", icon: ReceiptText },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  {
    href: "/more",
    label: "More",
    icon: Ellipsis,
    also: [
      "/assistant",
      "/expenses",
      "/day-close",
      "/alerts",
      "/backups",
      "/audit",
    ],
  },
];

function isActive(pathname: string, item: NavItem): boolean {
  if (item.href === "/") {
    return pathname === "/";
  }

  if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
    return true;
  }

  return (item.also ?? []).some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * The main section bar.
 *
 * A client component only so it can mark the current section with
 * `usePathname()`; the links themselves are ordinary navigations. The active
 * item gets a brand-tinted pill and `aria-current="page"`.
 */
export function NavBar({ labels }: { labels: Record<string, string> }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="order-3 flex w-full items-center gap-1 overflow-x-auto text-sm [scrollbar-width:none] sm:order-2 sm:w-auto sm:overflow-visible [&::-webkit-scrollbar]:hidden"
    >
      {ITEMS.map((item) => {
        const active = isActive(pathname, item);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-2 transition-colors ${
              active
                ? "bg-brand-soft font-medium text-brand"
                : "text-ink-muted hover:bg-subtle hover:text-ink"
            }`}
          >
            <item.icon className="size-4" aria-hidden="true" />
            {labels[item.href] ?? item.label}
          </Link>
        );
      })}
    </nav>
  );
}
