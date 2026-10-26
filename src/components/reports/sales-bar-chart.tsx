import { formatPaisa } from "@/lib/format";

type ChartPoint = {
  key: string;
  label: string;
  revenuePaisa: number;
};

type SalesBarChartProps = {
  points: ChartPoint[];
  /** Describes the chart for assistive technology, e.g. "Daily revenue". */
  label: string;
};

/**
 * A server-rendered bar chart. A chart is the only place a non-table visual is
 * needed, so it is plain markup rather than a client-side chart library.
 */
export function SalesBarChart({ points, label }: SalesBarChartProps) {
  if (points.length === 0) {
    return null;
  }

  const max = Math.max(...points.map((point) => point.revenuePaisa), 1);
  const total = points.reduce(
    (sum, point) => sum + point.revenuePaisa,
    0,
  );
  const first = points[0];
  const last = points[points.length - 1];

  return (
    <figure>
      <div
        aria-hidden="true"
        className="flex h-40 items-end gap-1 border-b border-line"
      >
        {points.map((point) => {
          const height = Math.round((point.revenuePaisa / max) * 100);

          return (
            <div
              key={point.key}
              className="flex h-full flex-1 items-end"
              title={`${point.label}: ${formatPaisa(point.revenuePaisa)}`}
            >
              <div
                className="w-full rounded-t-md bg-brand/70"
                style={{ height: `${height}%` }}
              />
            </div>
          );
        })}
      </div>

      <div
        aria-hidden="true"
        className="mt-2 flex justify-between text-xs text-ink-muted"
      >
        <span>{first?.label}</span>
        <span>{last?.label}</span>
      </div>

      <figcaption className="sr-only">
        {label}. Total {formatPaisa(total)}.
      </figcaption>

      <table className="sr-only">
        <caption>{label}</caption>
        <thead>
          <tr>
            <th scope="col">Period</th>
            <th scope="col">Revenue</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point) => (
            <tr key={point.key}>
              <th scope="row">{point.label}</th>
              <td>{formatPaisa(point.revenuePaisa)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
