import { Injectable, WritableSignal, inject } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { DialogService, ToastService } from "@bitwarden/components";

import type { AccessDecisionVerdict } from "../abstractions/access-lease";
import { decideAccessErrorMessageKey } from "../helpers/decide-access-error";

import { DecideDialogComponent, DecideDialogParams } from "./decide-dialog/decide-dialog.component";

/** Raised once the approver confirms and the mutation starts; lowered once it settles. */
export type ApproverActionBusy = (busy: boolean) => void;

/** An {@link ApproverActionBusy} that tracks `key` in a set of in-flight row ids. */
export function rowBusy(ids: WritableSignal<Set<string>>, key: string): ApproverActionBusy {
  return (busy) =>
    ids.update((current) => {
      const next = new Set(current);
      if (busy) {
        next.add(key);
      } else {
        next.delete(key);
      }
      return next;
    });
}

/**
 * An approver's decide, revoke and withdraw-approval as every surface offers them: the confirm,
 * the success and failure toasts, and the error log. The caller hands in the mutation as `run` and
 * keeps its own busy state, since the tabs track rows and the request dialog tracks one request.
 *
 * Which requests qualify is not decided here; callers gate on {@link isLiveManagedLease} and
 * {@link isUnstartedApproval}, plus their own managed and viewer checks.
 *
 * Provided on each component that offers the actions, not in root, so its confirms open through
 * the `DialogService` that component resolves: the request dialog's own `DialogModule` provides
 * one, and a route-level provider would not reach a dialog, whose injector is built from root.
 */
@Injectable()
export class ApproverActionsService {
  private readonly dialogService = inject(DialogService);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);
  private readonly logService = inject(LogService);

  /**
   * Confirm and record a decision. Any dismissal other than an explicit confirm (Cancel, the
   * header X, Escape, a backdrop click) closes with `undefined` and leaves the request untouched.
   *
   * `run` gets the verdict the dialog closed with, not `params.verdict`: the approve variant can
   * switch to "Deny request" in place.
   */
  async decide(
    params: DecideDialogParams,
    run: (verdict: AccessDecisionVerdict, comment: string | undefined) => Promise<void>,
    busy: ApproverActionBusy,
  ): Promise<void> {
    const result = await firstValueFrom(
      DecideDialogComponent.open(this.dialogService, { data: params }).closed,
    );
    if (!result?.confirmed) {
      return;
    }
    await this.perform(
      () => run(result.verdict, result.comment),
      busy,
      result.verdict === "approve" ? "pamInboxApprovedToast" : "pamInboxDeniedToast",
      decideAccessErrorMessageKey,
    );
  }

  /**
   * Confirm and end a lease that is running right now. The confirm is not optional: this cuts off
   * access someone is already using, and every dismissal route resolves false.
   */
  async revoke(run: () => Promise<void>, busy: ApproverActionBusy): Promise<void> {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "pamInboxRevoke" },
      content: { key: "pamInboxRevokeConfirm" },
      acceptButtonText: { key: "pamInboxRevoke" },
      type: "warning",
    });
    if (!confirmed) {
      return;
    }
    await this.perform(run, busy, "pamInboxRevokedToast", () => "pamInboxRevokeFailed");
  }

  /**
   * Confirm and withdraw an approval the requester has not started. Confirmed first, since it
   * takes a decision away from a third party and cannot be undone. `cipherName` names the item in
   * the confirm, so pass the same text the caller shows for it.
   */
  async withdrawApproval(
    cipherName: string,
    run: () => Promise<void>,
    busy: ApproverActionBusy,
  ): Promise<void> {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "pamInboxWithdrawApproval" },
      content: { key: "pamInboxWithdrawApprovalConfirm", placeholders: [cipherName] },
      acceptButtonText: { key: "pamInboxWithdrawApproval" },
      type: "warning",
    });
    if (!confirmed) {
      return;
    }
    await this.perform(
      run,
      busy,
      "pamInboxApprovalWithdrawnToast",
      () => "pamInboxWithdrawApprovalFailed",
    );
  }

  /**
   * Run a confirmed mutation under the caller's busy flag, then toast its outcome. `failureKey`
   * reads what was thrown, so a refusal the server worded gets its own copy.
   */
  private async perform(
    run: () => Promise<void>,
    busy: ApproverActionBusy,
    successKey: string,
    failureKey: (e: unknown) => string,
  ): Promise<void> {
    busy(true);
    try {
      await run();
      this.toastService.showToast({ variant: "success", message: this.i18nService.t(successKey) });
    } catch (e) {
      this.logService.error(e);
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t(failureKey(e)),
      });
    } finally {
      busy(false);
    }
  }
}
