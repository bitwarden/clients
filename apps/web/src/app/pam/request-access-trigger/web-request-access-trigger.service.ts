import { Injectable, inject } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { DialogService, ToastService } from "@bitwarden/components";
import { PamApiService, RequestAccessOutcome, RequestAccessTrigger } from "@bitwarden/pam";

import {
  RequestAccessModalComponent,
  RequestAccessModalResult,
} from "../request-access-modal/request-access-modal.component";

/**
 * Host-side implementation of {@link RequestAccessTrigger}: calls
 * {@link PamApiService.getAccessPreCheck} to resolve the approval outcome, then
 * opens {@link RequestAccessModalComponent} so the user can supply the matching
 * body (duration for automatic, window + reason for human). The modal posts to
 * `POST /ciphers/{id}/lease` itself; this service just orchestrates and toasts
 * the pre-check failure path.
 */
@Injectable()
export class WebRequestAccessTrigger extends RequestAccessTrigger {
  private readonly pamApi = inject(PamApiService);
  private readonly dialogService = inject(DialogService);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);
  private readonly logService = inject(LogService);

  async requestAccess(cipherId: string): Promise<RequestAccessOutcome> {
    let outcome: "active" | import("@bitwarden/pam").AccessApprovalMode;
    try {
      const preCheck = await this.pamApi.getAccessPreCheck(cipherId);
      outcome = preCheck.hasActiveLease ? "active" : preCheck.approvalMode;
    } catch (e) {
      this.logService.error(e);
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("requestAccessModalGenericError"),
      });
      return "dismissed";
    }

    const ref = RequestAccessModalComponent.open(this.dialogService, { cipherId, outcome });
    const result = await firstValueFrom(ref.closed);

    switch (result?.kind) {
      case RequestAccessModalResult.LeaseCreated:
        return "lease-created";
      case RequestAccessModalResult.RequestCreated:
        return "request-created";
      // AlreadyResolved → user already has access or a pending request; from
      // the gate's POV that's effectively "lease-created" (the open should try
      // a fetch) and "request-created" (no fetch) respectively. Without the
      // distinction we default to "dismissed" so the gate falls back safely.
      default:
        return "dismissed";
    }
  }
}
