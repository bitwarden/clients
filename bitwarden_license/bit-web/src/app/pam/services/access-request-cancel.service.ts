import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { DialogService, ToastService } from "@bitwarden/components";

import { AccessRefreshService, AccessRequestSdkService } from "..";

/**
 * Withdraws the caller's outstanding request for a gated cipher, for entry points that start from a
 * cipher rather than a request id.
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
   * Re-reads the access state rather than trusting what the caller rendered, which may be stale.
   * Never rejects; the outcome is toasted and the refresh always announced.
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
