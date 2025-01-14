import { Injectable } from "@angular/core";

import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ToastService } from "@bitwarden/components";

@Injectable({
  providedIn: "root",
})
export class BillingNotificationService {
  constructor(
    private i18nService: I18nService,
    private toastService: ToastService,
  ) {}

  handleError(error: unknown, customMessage?: string) {
    const message = this.getErrorMessage(error, customMessage);
    this.toastService.showToast({
      variant: "error",
      title: null,
      message,
    });
    throw error; // Re-throw to allow caller to handle if needed
  }

  showSuccess(messageKey: string) {
    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t(messageKey),
    });
  }

  private getErrorMessage(error: unknown, customMessage?: string): string {
    if (error instanceof ErrorResponse) {
      return error.getSingleMessage();
    }
    return this.i18nService.t(customMessage ?? "errorOccurred");
  }
}
