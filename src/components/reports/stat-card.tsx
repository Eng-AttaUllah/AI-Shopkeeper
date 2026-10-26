type StatCardProps = {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "error" | "success";
};

/** A single summary figure. Meaning is carried by the label, not colour alone. */
export function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: StatCardProps) {
  const valueTone =
    tone === "error"
      ? "text-error"
      : tone === "success"
        ? "text-success"
        : "text-ink";

  return (
    <div className="rounded-xl border border-line bg-surface p-4">
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
