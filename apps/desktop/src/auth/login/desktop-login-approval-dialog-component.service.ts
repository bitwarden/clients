import { Injectable } from "@angular/core";

import {
  DefaultLoginApprovalDialogComponentService,
  LoginApprovalDialogComponentServiceAbstraction,
} from "@bitwarden/angular/auth/login-approval";
import { I18nService as I18nServiceAbstraction } from "@bitwarden/common/platform/abstractions/i18n.service";

@Injectable()
export class DesktopLoginApprovalDialogComponentService
  extends DefaultLoginApprovalDialogComponentService
  implements LoginApprovalDialogComponentServiceAbstraction
{
  constructor(private i18nService: I18nServiceAbstraction) {
    super();
  }

  async showLoginRequestedAlertIfWindowNotVisible(email?: string): Promise<void> {
    const isVisible = await ipc.platform.isWindowVisible();
    if (!isVisible) {
      await ipc.auth.loginRequest(
        this.i18nService.t("accountAccessRequested"),
        this.i18nService.t("confirmAccessAttempt", email),
        this.i18nService.t("close"),
      );
    }
  }
}
