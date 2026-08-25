import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { uuidAsString } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { DialogService, SimpleDialogOptions, ToastService } from "@bitwarden/components";

import {
  AccessRefreshService,
  AccessRequestId,
  AccessRequestSdkService,
  AccessRequestView,
} from "..";

/**
 * The one place a caller's outstanding access request is withdrawn. Every surface that offers the
 * withdrawal — the cipher-view banner and the vault-row menu, which start from a CIPHER, and the
 * request drawer, which starts from a REQUEST — shares this flow, so the confirmation copy and the
 * withdraw semantics cannot drift apart. The remaining pages that hold a request id
 * (`MyAccessService`, `ApproverInboxService`) keep their own cancel calls, because their
 * reload and toast semantics belong to those surfaces. The requester-facing one of those — the
 * "My requests" list — still asks this flow's question, through {@link confirmWithdrawal}, so the
 * confirmation stays single-sourced even where the mutation is not.
 *
 * "Outstanding" mirrors the banner's withdraw semantics: a pending request or an
 * approved-but-unactivated one — either can be withdrawn until a lease is minted, after which
 * the lease (not the request) governs access.
 */
export class AccessRequestCancelService {
  constructor(
    private readonly accessRequestSdkService: AccessRequestSdkService,
    private readonly accessRefreshService: AccessRefreshService,
    private readonly dialogService: DialogService,
    private readonly toastService: ToastService,
    private readonly i18nService: I18nService,
    private readonly logService: LogService,
  ) {}

  /**
   * Withdraw the cipher's outstanding request, after confirming. Re-reads the access state at the
   * moment of the call rather than trusting what the caller rendered — the request may have been
   * decided or activated since, and the confirmation has to describe the state that actually
   * exists. Never rejects: the outcome is surfaced as a toast here, and the shared refresh signal
   * is always announced so every leasing surface reconciles through the usual path.
   */
  async cancelOutstandingRequest(cipherId: string): Promise<void> {
    try {
      const state = await this.accessRequestSdkService.getCipherAccessState(cipherId);
      const request = state.pendingRequest ?? state.approvedRequest;
      if (request == null) {
        return;
      }
      await this.confirmAndCancel(request.id, state.pendingRequest != null);
    } catch (e) {
      this.reportFailure(e);
    } finally {
      this.accessRefreshService.notifyAccessChanged(cipherId);
    }
  }

  /**
   * Withdraw a request the caller already holds the id of, after the same confirmation
   * {@link cancelOutstandingRequest} shows. Re-reads the request rather than trusting the status
   * the caller rendered, for the same reason: it may have been decided or activated since, and a
   * request that is no longer outstanding is left alone.
   *
   * Never rejects, and always announces the shared refresh signal. Returns whether the request was
   * actually withdrawn, so a surface holding its own copy of the request knows to re-read it —
   * the refresh signal reaches the cipher-scoped surfaces, not the request-scoped ones.
   */
  async cancelRequestById(requestId: AccessRequestId): Promise<boolean> {
    let cipherId: string | undefined;
    try {
      const request = await this.accessRequestSdkService.getAccessRequest(requestId);
      cipherId = uuidAsString(request.cipherId);
      if (!isOutstanding(request)) {
        return false;
      }
      return await this.confirmAndCancel(request.id, request.status === "pending");
    } catch (e) {
      this.reportFailure(e);
      return false;
    } finally {
      this.accessRefreshService.notifyAccessChanged(cipherId);
    }
  }

  /**
   * Ask the withdrawal confirmation on behalf of a surface that owns the mutation itself — the
   * "My requests" list, whose rows reconcile through an optimistic local patch that a shared
   * withdrawal would turn into a full reload. Only the question is shared; the caller still
   * performs the withdrawal and reports its outcome.
   *
   * @returns whether the reader confirmed.
   */
  async confirmWithdrawal(pending: boolean): Promise<boolean> {
    return await this.dialogService.openSimpleDialog(cancelConfirmation(pending));
  }

  /** @returns whether the request was withdrawn, as opposed to kept. */
  private async confirmAndCancel(id: AccessRequestId, pending: boolean): Promise<boolean> {
    const confirmed = await this.confirmWithdrawal(pending);
    if (!confirmed) {
      return false;
    }
    await this.accessRequestSdkService.cancelAccessRequest(id);
    this.toastService.showToast({
      variant: "success",
      message: this.i18nService.t("pamCancelRequestCanceledToast"),
    });
    return true;
  }

  private reportFailure(e: unknown): void {
    this.logService.error(e);
    this.toastService.showToast({
      variant: "error",
      message: this.i18nService.t("pendingStateCancelError"),
    });
  }
}

/**
 * The confirmation every withdrawal asks. Built in one place so the two entry points cannot end up
 * asking the reader different questions about the same action.
 */
function cancelConfirmation(pending: boolean): SimpleDialogOptions {
  return {
    title: { key: "pamCancelRequestTitle" },
    content: {
      key: pending ? "pamCancelRequestPendingConfirm" : "pamCancelRequestApprovedConfirm",
    },
    acceptButtonText: { key: "pendingStateCancelRequest" },
    cancelButtonText: { key: "pamKeepRequest" },
    type: "danger",
  };
}

/**
 * The request-scoped reading of "outstanding" — what `getCipherAccessState` reports as its
 * `pendingRequest` / `approvedRequest`, derived from a request the caller already holds.
 */
function isOutstanding(request: AccessRequestView): boolean {
  return (
    request.status === "pending" ||
    (request.status === "approved" && request.producedLeaseId == null)
  );
}
