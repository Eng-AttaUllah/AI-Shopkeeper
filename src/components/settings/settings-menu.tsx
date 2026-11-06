"use client";

import { useEffect, useRef, useState } from "react";

import Link from "next/link";

import { Info, KeyRound, Menu, ShieldCheck, User, X } from "lucide-react";

import { Button } from "@/components/ui/button";

type SettingsMenuLabels = {
  open: string;
  title: string;
  account: string;
  security: string;
  changePassword: string;
  about: string;
  close: string;
};

/**
 * The settings menu behind the hamburger button in the header.
 *
 * It is a client component only for the open/close state. Every item is a
 * plain link to a section of `/settings`, so it works for the owner and for
 * customers and never depends on JavaScript for the destination.
 */
export function SettingsMenu({ labels }: { labels: SettingsMenuLabels }) {
  const [open, setOpen] = useState(false);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    closeButton.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const items = [
    { href: "/settings#account", label: labels.account, icon: User },
    { href: "/settings#security", label: labels.security, icon: ShieldCheck },
    {
      href: "/settings#change-password",
      label: labels.changePassword,
      icon: KeyRound,
    },
    { href: "/settings#about", label: labels.about, icon: Info },
  ];

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-label={labels.open}
        aria-expanded={open}
        aria-controls="settings-menu"
        onClick={() => setOpen(true)}
        className="h-11 w-11 shrink-0 px-0"
      >
        <Menu className="size-5" aria-hidden="true" />
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label={labels.close}
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/30"
          />
          <div
            id="settings-menu"
            role="dialog"
            aria-modal="true"
            aria-label={labels.title}
            className="absolute inset-y-0 start-0 flex w-72 max-w-[85vw] flex-col border-e border-line bg-surface p-5 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{labels.title}</h2>
              <Button
                ref={closeButton}
                type="button"
                variant="ghost"
                size="sm"
                aria-label={labels.close}
                onClick={() => setOpen(false)}
                className="h-10 w-10 px-0"
              >
                <X className="size-5" aria-hidden="true" />
              </Button>
            </div>

            <nav aria-label={labels.title} className="mt-4 flex flex-col gap-1">
              {items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-base text-ink transition-colors hover:bg-subtle"
                >
                  <item.icon className="size-5 text-ink-muted" aria-hidden="true" />
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      ) : null}
    </>
  );
}
