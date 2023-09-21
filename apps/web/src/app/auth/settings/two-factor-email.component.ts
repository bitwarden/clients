import { Component } from "@angular/core";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { TwoFactorProviderType } from "@bitwarden/common/auth/enums/two-factor-provider-type";
import { TwoFactorEmailRequest } from "@bitwarden/common/auth/models/request/two-factor-email.request";
import { UpdateTwoFactorEmailRequest } from "@bitwarden/common/auth/models/request/update-two-factor-email.request";
import { TwoFactorEmailResponse } from "@bitwarden/common/auth/models/response/two-factor-email.response";
import { AuthResponse } from "@bitwarden/common/auth/types/auth-response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { DialogService } from "@bitwarden/components";

import { TwoFactorBaseComponent } from "./two-factor-base.component";

@Component({
  selector: "app-two-factor-email",
  templateUrl: "two-factor-email.component.html",
})
export class TwoFactorEmailComponent extends TwoFactorBaseComponent {
  type = TwoFactorProviderType.Email;
  email: string;
  token: string;
  sentEmail: string;
  formPromise: Promise<TwoFactorEmailResponse>;
  emailPromise: Promise<unknown>;

  override componentName = "app-two-factor-email";

  constructor(
    apiService: ApiService,
    i18nService: I18nService,
    platformUtilsService: PlatformUtilsService,
    logService: LogService,
    userVerificationService: UserVerificationService,
    private stateService: StateService,
    dialogService: DialogService
  ) {
    super(
      apiService,
      i18nService,
      platformUtilsService,
      logService,
      userVerificationService,
      dialogService
    );
  }

  auth(authResponse: AuthResponse<TwoFactorEmailResponse>) {
    super.auth(authResponse);
    return this.processResponse(authResponse.response);
  }

  submit() {
    if (this.enabled) {
      return super.disable(this.formPromise);
    } else {
      return this.enable();
    }
  }

  async sendEmail() {
    try {
      const request = await this.buildRequestModel(TwoFactorEmailRequest);
      request.email = this.email;
      this.emailPromise = this.apiService.postTwoFactorEmailSetup(request);
      await this.emailPromise;
      this.sentEmail = this.email;
    } catch (e) {
      this.logService.error(e);
    }
  }

  protected async enable() {
    const request = await this.buildRequestModel(UpdateTwoFactorEmailRequest);
    request.email = this.email;
    request.token = this.token;

    return super.enable(async () => {
      this.formPromise = this.apiService.putTwoFactorEmail(request);
      const response = await this.formPromise;
      await this.processResponse(response);
    });
  }

  private async processResponse(response: TwoFactorEmailResponse) {
    this.token = null;
    this.email = response.email;
    this.enabled = response.enabled;
    if (!this.enabled && (this.email == null || this.email === "")) {
      this.email = await this.stateService.getEmail();
    }
  }
}
