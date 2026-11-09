"use client";

import { useActionState } from "react";

import { approveJoinRequestAction } from "@/app/settings/actions";
import { rejectJoinRequestAction } from "@/app/settings/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { readClientLocale, translate } from "@/lib/dictionary";

type JoinRequestFormProps = {
  membershipId: string;
  approveAction: (
    state: { ok: boolean; error?: string },
    formData: FormData,
  ) => Promise<{ ok: boolean; error?: string }>;
  rejectAction: (
    state: { ok: boolean; error?: string },
    formData: FormData,
  ) => Promise<{ ok: boolean; error?: string }>;
};

export function JoinRequestForm({
  membershipId,
  approveAction,
  rejectAction,
}: JoinRequestFormProps) {
  const [approveState, approveFormAction, approvePending] = useActionState<
    { ok: boolean; error?: string },
    FormData
  >(approveAction, { ok: true });
  const [rejectState, rejectFormAction, rejectPending] = useActionState<
    { ok: boolean; error?: string },
    FormData
  >(rejectAction, { ok: true });

  const locale = readClientLocale();

  function t(key: string, params?: Record<string, string>): string {
    return translate(locale, key, params);
  }

  const approveError = approveState.ok ? undefined : approveState.error;
  const rejectError = rejectState.ok ? undefined : rejectState.error;

  return (
    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
      {/* Approve form */}
      <form action={approveFormAction} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <input type="hidden" name="membershipId" value={membershipId} />
        <div className="flex flex-col sm:flex-row gap-2">
          <Label htmlFor={`approve-customer-${membershipId}`}>
            {t("shops.linkCustomer")}
          </Label>
          <Input
            id={`approve-customer-${membershipId}`}
            name="linkToCustomerId"
            placeholder={t("shops.linkCustomer")}
            className="h-10 text-sm flex-1"
            disabled={approvePending}
          />
          <Label htmlFor={`approve-name-${membershipId}`}>
            {t("shops.createCustomer")}
          </Label>
          <Input
            id={`approve-name-${membershipId}`}
            name="createCustomerName"
            placeholder={t("customerRegistration.name")}
            className="h-10 text-sm flex-1"
            disabled={approvePending}
          />
          <Button
            type="submit"
            disabled={approvePending}
            className="h-10 px-4 text-sm"
          >
            {approvePending ? t("shops.approving") : t("shops.approve")}
          </Button>
        </div>
        {approveError ? (
          <p className="text-sm text-error">{approveError}</p>
        ) : null}
        {approveState.ok && !approvePending ? (
          <p className="text-sm text-success">{t("shops.approved")}</p>
        ) : null}
      </form>

      {/* Reject form */}
      <form action={rejectFormAction} className="flex flex-col sm:flex-row gap-2">
        <input type="hidden" name="membershipId" value={membershipId} />
        <Button
          type="submit"
          variant="destructive"
          disabled={rejectPending}
          className="h-10 px-4 text-sm"
        >
          {rejectPending ? t("shops.rejecting") : t("shops.reject")}
        </Button>
        {rejectError ? (
          <p className="text-sm text-error">{rejectError}</p>
        ) : null}
        {rejectState.ok && !rejectPending ? (
          <p className="text-sm text-success">{t("shops.rejected")}</p>
        ) : null}
      </form>
    </div>
  );
}
