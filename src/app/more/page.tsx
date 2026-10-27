import Link from "next/link";

const TOOLS = [
  {
    href: "/expenses",
    title: "Expenses",
    description: "Record rent, bills, salaries, and other shop costs.",
  },
  {
    href: "/day-close",
    title: "Day close",
    description: "Compare counted cash with the cash the app expects.",
  },
  {
    href: "/backups",
    title: "Backups",
    description: "Make a copy of the shop database and see past backups.",
  },
  {
    href: "/audit",
    title: "Audit log",
    description: "See every money and stock change in one place.",
  },
] as const;

export default function MorePage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8">
      <header>
        <h1 className="text-3xl font-semibold">More tools</h1>
        <p className="mt-1 text-sm text-ink-muted">
          The less frequent jobs, kept out of the way.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {TOOLS.map((tool) => (
          <Link
            key={tool.href}
            href={tool.href}
            className="rounded-xl border border-line bg-surface p-5 transition-colors hover:border-brand/40 hover:bg-subtle"
          >
            <h2 className="text-lg font-semibold">{tool.title}</h2>
            <p className="mt-1 text-sm text-ink-muted">{tool.description}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
