import Link from "next/link";

import {
  dismissAlertAction,
  markAlertReviewedAction,
} from "@/app/alerts/actions";
import { AlertReviewForm } from "@/components/alerts/alert-review-form";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/format";
import { requireShopkeeper } from "@/lib/require-user";
import { t } from "@/lib/i18n";
import { listCameraAlerts } from "@/modules/camera/queries";

export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  const { shop } = await requireShopkeeper();

  const [alerts, cameraTokenConfigured] = await Promise.all([
    listCameraAlerts(shop.id),
    Promise.resolve(Boolean(process.env.CAMERA_ALERT_TOKEN)),
  ]);

  const pendingLabel = await t("alerts.pending");
  const reviewedLabel = await t("alerts.reviewed");
  const dismissedLabel = await t("alerts.dismissed");
  const backLabel = await t("alerts.backToMore");
  const titleLabel = await t("alerts.title");
  const subtitleLabel = await t("alerts.subtitle");
  const notConfiguredLabel = await t("alerts.notConfigured");
  const noAlertsLabel = await t("alerts.noAlerts");
  const durationLabel = await t("alerts.duration");
  const dismissedNoteLabel = await t("alerts.dismissedNote");

  function statusBadge(status: string) {
    if (status === "REVIEWED") {
      return <Badge variant="outline">{reviewedLabel}</Badge>;
    }

    if (status === "DISMISSED") {
      return <Badge variant="secondary">{dismissedLabel}</Badge>;
    }

    return <Badge>{pendingLabel}</Badge>;
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 px-4 py-8">
      <div>
        <Link
          href="/more"
          className="text-sm text-ink-muted transition-colors hover:text-ink"
        >
          {backLabel}
        </Link>
        <h1 className="mt-2 text-3xl font-semibold">{titleLabel}</h1>
        <p className="mt-1 text-sm text-ink-muted">{subtitleLabel}</p>
      </div>

      {!cameraTokenConfigured ? (
        <p className="rounded-lg border border-line bg-surface px-4 py-3 text-sm text-ink-muted">
          {notConfiguredLabel}
        </p>
      ) : null}

      {alerts.length === 0 ? (
        <p className="rounded-md bg-subtle px-3 py-2 text-sm text-ink-muted">
          {noAlertsLabel}
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {alerts.map((alert) => (
            <li
              key={alert.id}
              className="rounded-xl border border-line bg-surface p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{formatDateTime(alert.capturedAt)}</p>
                  <p className="text-sm text-ink-muted">
                    {durationLabel}: {Math.round(alert.durationMs / 1000)}s
                  </p>
                </div>
                {statusBadge(alert.status)}
              </div>

              {alert.status === "DISMISSED" ? (
                <p className="mt-3 text-sm text-ink-muted">
                  {alert.reviewNote ?? dismissedNoteLabel}
                </p>
              ) : (
                <>
                  <video
                    controls
                    preload="metadata"
                    className="mt-3 aspect-video w-full max-w-md rounded-lg bg-black"
                    src={`/api/camera/clips/${alert.id}`}
                  />
                  {alert.status === "PENDING" ? (
                    <AlertReviewForm
                      alertId={alert.id}
                      reviewedAction={markAlertReviewedAction}
                      dismissedAction={dismissAlertAction}
                    />
                  ) : alert.reviewNote ? (
                    <p className="mt-3 text-sm text-ink-muted">{alert.reviewNote}</p>
                  ) : null}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
