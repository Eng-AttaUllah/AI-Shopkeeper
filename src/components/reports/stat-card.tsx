type StatCardProps = {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "error" | "success";
  /** Decorative top accent for the default tone; error/success win. */
  accent?: "brand" | "money";
};

/** A single summary figure. Meaning is carried by the label, not colour alone. */
export function StatCard({
  label,
  value,
  hint,
  tone = "default",
  accent = "brand",
}: StatCardProps) {
  const valueTone =
    tone === "error"
      ? "text-error"
      : tone === "success"
        ? "text-success"
        : "text-ink";

  const accentBar =
    tone === "error"
      ? "bg-error"
      : tone === "success"
        ? "bg-success"
        : accent === "money"
          ? "bg-money"
          : "bg-brand";

  return (
    <div className="relative overflow-hidden rounded-xl border border-line bg-surface p-4">
      <span
        aria-hidden="true"
        className={`absolute inset-x-0 top-0 h-1 ${accentBar}`}
      />
      <p className="text-sm text-ink-muted">{label}</p>
      <p
        className={`mt-1 text-xl font-semibold tabular-nums sm:text-3xl ${valueTone}`}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-ink-muted">{hint}</p> : null}
    </div>
  );
}
