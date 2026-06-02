import { Injectable } from "@angular/core";
import { Params, Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ToastService } from "@bitwarden/components";

export interface AcceptFlowConfig {
  requiredParameters: string[];
  failedMessage: string;
  failedShortMessage?: string;
  authedHandler: (params: Params) => Promise<void>;
  unauthedHandler: (params: Params) => Promise<void>;
  getErrorMessage?: (apiError: string | null) => string;
}

@Injectable({ providedIn: "root" })
export class AcceptFlowService {
  constructor(
    private authService: AuthService,
    private router: Router,
    private i18nService: I18nService,
    private toastService: ToastService,
  ) {}

  async run(queryParams: Params, config: AcceptFlowConfig): Promise<void> {
    const missingParam = config.requiredParameters.some(
      (p) => queryParams?.[p] == null || queryParams[p] === "",
    );

    if (missingParam) {
      await this.handleError(null, config);
      return;
    }

    const status = await firstValueFrom(this.authService.activeAccountStatus$);

    if (status !== AuthenticationStatus.LoggedOut) {
      try {
        await config.authedHandler(queryParams);
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : null;
        await this.handleError(message, config);
      }
    } else {
      await config.unauthedHandler(queryParams);
    }
  }

  private async handleError(apiError: string | null, config: AcceptFlowConfig): Promise<void> {
    const message = config.getErrorMessage
      ? config.getErrorMessage(apiError)
      : this.defaultErrorMessage(apiError, config);

    this.toastService.showToast({ message, variant: "error", timeout: 10000 });
    await this.router.navigate(["/"]);
  }

  private defaultErrorMessage(apiError: string | null, config: AcceptFlowConfig): string {
    const shortKey = config.failedShortMessage ?? "inviteAcceptFailedShort";
    return apiError != null
      ? this.i18nService.t(shortKey, apiError)
      : this.i18nService.t(config.failedMessage);
  }
}
