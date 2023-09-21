import { Component } from "@angular/core";
import { Router } from "@angular/router";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { TwoFactorRecoveryRequest } from "@bitwarden/common/auth/models/request/two-factor-recovery.request";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

@Component({
  selector: "app-recover-two-factor",
  templateUrl: "recover-two-factor.component.html",
})
export class RecoverTwoFactorComponent {
  email: string;
  masterPassword: string;
  recoveryCode: string;
  formPromise: Promise<any>;

  constructor(
    private router: Router,
    private apiService: ApiService,
    private platformUtilsService: PlatformUtilsService,
    private i18nService: I18nService,
    private cryptoService: CryptoService,
    private authService: AuthService,
    private logService: LogService
  ) {}

  async submit() {
    try {
      const request = new TwoFactorRecoveryRequest();
      request.recoveryCode = this.recoveryCode.replace(/\s/g, "").toLowerCase();
      request.email = this.email.trim().toLowerCase();
      const key = await this.authService.makePreloginKey(this.masterPassword, request.email);
      request.masterPasswordHash = await this.cryptoService.hashMasterKey(this.masterPassword, key);
      this.formPromise = this.apiService.postTwoFactorRecover(request);
      await this.formPromise;
      this.platformUtilsService.showToast(
        "success",
        null,
        this.i18nService.t("twoStepRecoverDisabled")
      );
      this.router.navigate(["/"]);
    } catch (e) {
      this.logService.error(e);
    }
  }
}
