import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { DialogService, ToastService } from "@bitwarden/components";

import { AccessRefreshService, AccessRequestSdkService } from "..";

/**
 * The one place a caller's outstanding access request for a gated cipher is withdrawn. Both
 * entry points that start from a CIPHER — the cipher-view banner and the vault-row menu — share
 * this flow; the pages that already hold a request id (`MyAccessService`,
 * `AccessRequestDetailService`, `ApproverInboxService`) keep their own cancel calls, because
 * their reload and toast semantics belong to those surfaces.
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
      const contentKey =
        state.pendingRequest != null
          ? "pamCancelRequestPendingConfirm"
          : "pamCancelRequestApprovedConfirm";
      const confirmed = await this.dialogService.openSimpleDialog({
        title: { key: "pamCancelRequestTitle" },
        content: { key: contentKey },
        acceptButtonText: { key: "pendingStateCancelRequest" },
        cancelButtonText: { key: "pamKeepRequest" },
        type: "warning",
      });
      if (!confirmed) {
        return;
      }
      await this.accessRequestSdkService.cancelAccessRequest(request.id);
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("pendingStateCancelSuccess"),
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
