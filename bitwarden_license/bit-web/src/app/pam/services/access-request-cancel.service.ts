import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { DialogService, ToastService } from "@bitwarden/components";

import { AccessRefreshService, AccessRequestSdkService } from "..";

/**
 * The one place a caller's outstanding access request for a gated cipher is withdrawn. Both
 * entry points starting from a CIPHER — the cipher-view banner and the vault-row menu — share
 * this flow; pages that already hold a request id keep their own cancel calls.
 *
 * "Outstanding" mirrors the banner's withdraw semantics: pending or approved-but-unactivated,
 * either withdrawable until a lease mints, after which the lease governs access.
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
   * Withdraw the cipher's outstanding request, after confirming. Re-reads the access state at
   * call time, not trusting what the caller rendered, since the request may have been decided
   * or activated since.
   *
   * Never rejects: the outcome is surfaced as a toast, and the shared refresh signal always
   * announces so every leasing surface reconciles through the usual path.
   */
  async cancelOutstandingRequest(cipherId: string): Promise<void> {
    try {
      const state = await this.accessRequestSdkService.getCipherAccessState(cipherId);
      const request = state.pendingRequest ?? state.approvedRequest;
      if (request == null) {
        return;
      }
      const contentKey =
        state.pendingRequest != null
          ? "pamCancelRequestPendingConfirm"
          : "pamCancelRequestApprovedConfirm";
      const confirmed = await this.dialogService.openSimpleDialog({
        title: { key: "pamCancelRequestTitle" },
        content: { key: contentKey },
        acceptButtonText: { key: "pendingStateCancelRequest" },
        cancelButtonText: { key: "pamKeepRequest" },
        type: "danger",
      });
      if (!confirmed) {
        return;
      }
      await this.accessRequestSdkService.cancelAccessRequest(request.id);
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("pamCancelRequestCanceledToast"),
      });
    } catch (e) {
      this.logService.error(e);
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("pendingStateCancelError"),
      });
    } finally {
      this.accessRefreshService.notifyAccessChanged(cipherId);
    }
  }
}
