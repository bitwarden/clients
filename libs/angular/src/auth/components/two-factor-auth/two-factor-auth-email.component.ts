import { DialogModule } from "@angular/cdk/dialog";
import { CommonModule } from "@angular/common";
import { Component, EventEmitter, Output } from "@angular/core";
import { ReactiveFormsModule, FormsModule } from "@angular/forms";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { I18nPipe } from "@bitwarden/angular/platform/pipes/i18n.pipe";
import { LoginStrategyServiceAbstraction } from "@bitwarden/auth/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { TwoFactorService } from "@bitwarden/common/auth/abstractions/two-factor.service";
import { TwoFactorProviderType } from "@bitwarden/common/auth/enums/two-factor-provider-type";
import { TwoFactorEmailRequest } from "@bitwarden/common/auth/models/request/two-factor-email.request";
import { AppIdService } from "@bitwarden/common/platform/abstractions/app-id.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import {
  ButtonModule,
  LinkModule,
  TypographyModule,
  FormFieldModule,
  AsyncActionsModule,
} from "@bitwarden/components";

@Component({
  standalone: true,
  selector: "app-two-factor-auth-email",
  templateUrl: "two-factor-auth-email.component.html",
  imports: [
    CommonModule,
    JslibModule,
    DialogModule,
    ButtonModule,
    LinkModule,
    TypographyModule,
    ReactiveFormsModule,
    FormFieldModule,
    AsyncActionsModule,
    FormsModule,
  ],
  providers: [I18nPipe],
})
export class TwoFactorAuthEmailComponent {
  @Output() token = new EventEmitter<string>();

  twoFactorEmail: string = null;
  emailPromise: Promise<any>;
  tokenValue: string = "";

  constructor(
    protected i18nService: I18nService,
    protected twoFactorService: TwoFactorService,
    protected loginStrategyService: LoginStrategyServiceAbstraction,
    protected platformUtilsService: PlatformUtilsService,
    protected logService: LogService,
    protected apiService: ApiService,
    protected appIdService: AppIdService,
  ) {}

  async ngOnInit(): Promise<void> {
    const providerData = await this.twoFactorService.getProviders().then((providers) => {
      return providers.get(TwoFactorProviderType.Email);
    });
    this.twoFactorEmail = providerData.Email;

    if ((await this.twoFactorService.getProviders()).size > 1) {
      await this.sendEmail(false);
    }
  }

  async sendEmail(doToast: boolean) {
    if (this.emailPromise != null) {
      return;
    }

    if ((await this.loginStrategyService.getEmail()) == null) {
      this.platformUtilsService.showToast(
        "error",
        this.i18nService.t("errorOccurred"),
        this.i18nService.t("sessionTimeout"),
      );
      return;
    }

    try {
      const request = new TwoFactorEmailRequest();
      request.email = await this.loginStrategyService.getEmail();
      request.masterPasswordHash = await this.loginStrategyService.getMasterPasswordHash();
      request.ssoEmail2FaSessionToken =
        await this.loginStrategyService.getSsoEmail2FaSessionToken();
      request.deviceIdentifier = await this.appIdService.getAppId();
      request.authRequestAccessCode = await this.loginStrategyService.getAccessCode();
      request.authRequestId = await this.loginStrategyService.getAuthRequestId();
      this.emailPromise = this.apiService.postTwoFactorEmail(request);
      await this.emailPromise;
      if (doToast) {
        this.platformUtilsService.showToast(
          "success",
          null,
          this.i18nService.t("verificationCodeEmailSent", this.twoFactorEmail),
        );
      }
    } catch (e) {
      this.logService.error(e);
    }

    this.emailPromise = null;
  }
}
