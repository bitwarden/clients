import { Component, OnInit } from "@angular/core";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { TwoFactorProviderType } from "@bitwarden/common/auth/enums/two-factor-provider-type";
import { EmailTokenRequest } from "@bitwarden/common/auth/models/request/email-token.request";
import { EmailRequest } from "@bitwarden/common/auth/models/request/email.request";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";

@Component({
  selector: "app-change-email",
  templateUrl: "change-email.component.html",
})
export class ChangeEmailComponent implements OnInit {
  masterPassword: string;
  newEmail: string;
  token: string;
  tokenSent = false;
  showTwoFactorEmailWarning = false;

  formPromise: Promise<any>;

  constructor(
    private apiService: ApiService,
    private i18nService: I18nService,
    private platformUtilsService: PlatformUtilsService,
    private cryptoService: CryptoService,
    private messagingService: MessagingService,
    private logService: LogService,
    private stateService: StateService
  ) {}

  async ngOnInit() {
    const twoFactorProviders = await this.apiService.getTwoFactorProviders();
    this.showTwoFactorEmailWarning = twoFactorProviders.data.some(
      (p) => p.type === TwoFactorProviderType.Email && p.enabled
    );
  }

  async submit() {
    this.newEmail = this.newEmail.trim().toLowerCase();
    if (!this.tokenSent) {
      const request = new EmailTokenRequest();
      request.newEmail = this.newEmail;
      request.masterPasswordHash = await this.cryptoService.hashMasterKey(
        this.masterPassword,
        await this.cryptoService.getOrDeriveMasterKey(this.masterPassword)
      );
      try {
        this.formPromise = this.apiService.postEmailToken(request);
        await this.formPromise;
        this.tokenSent = true;
      } catch (e) {
        this.logService.error(e);
      }
    } else {
      const request = new EmailRequest();
      request.token = this.token;
      request.newEmail = this.newEmail;
      request.masterPasswordHash = await this.cryptoService.hashMasterKey(
        this.masterPassword,
        await this.cryptoService.getOrDeriveMasterKey(this.masterPassword)
      );
      const kdf = await this.stateService.getKdfType();
      const kdfConfig = await this.stateService.getKdfConfig();
      const newMasterKey = await this.cryptoService.makeMasterKey(
        this.masterPassword,
        this.newEmail,
        kdf,
        kdfConfig
      );
      request.newMasterPasswordHash = await this.cryptoService.hashMasterKey(
        this.masterPassword,
        newMasterKey
      );
      const newUserKey = await this.cryptoService.encryptUserKeyWithMasterKey(newMasterKey);
      request.key = newUserKey[1].encryptedString;
      try {
        this.formPromise = this.apiService.postEmail(request);
        await this.formPromise;
        this.reset();
        this.platformUtilsService.showToast(
          "success",
          this.i18nService.t("emailChanged"),
          this.i18nService.t("logBackIn")
        );
        this.messagingService.send("logout");
      } catch (e) {
        this.logService.error(e);
      }
    }
  }

  reset() {
    this.token = this.newEmail = this.masterPassword = null;
    this.tokenSent = false;
  }
}
