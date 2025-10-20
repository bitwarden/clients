import { CommonModule } from "@angular/common";
import { Component, Input, OnInit, Output, EventEmitter } from "@angular/core";
import { ReactiveFormsModule, FormsModule, FormControl } from "@angular/forms";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { LoginStrategyServiceAbstraction } from "@bitwarden/auth/common";
import { TwoFactorService } from "@bitwarden/common/auth/abstractions/two-factor.service";
import { TwoFactorProviderType } from "@bitwarden/common/auth/enums/two-factor-provider-type";
import { TwoFactorEmailRequest } from "@bitwarden/common/auth/models/request/two-factor-email.request";
import { TwoFactorApiService } from "@bitwarden/common/auth/two-factor";
import { AppIdService } from "@bitwarden/common/platform/abstractions/app-id.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import {
  DialogModule,
  ButtonModule,
  LinkModule,
  TypographyModule,
  FormFieldModule,
  AsyncActionsModule,
  ToastService,
} from "@bitwarden/components";

import { TwoFactorAuthEmailComponentCacheService } from "./two-factor-auth-email-component-cache.service";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
 
@Component({
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
  providers: [
    {
      provide: TwoFactorAuthEmailComponentCacheService,
      useClass: TwoFactorAuthEmailComponentCacheService,
    },
  ],
})
export class TwoFactorAuthEmailComponent implements OnInit {
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
   
  @Input({ required: true }) tokenFormControl: FormControl | undefined = undefined;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
   
  @Output() tokenChange = new EventEmitter<{ token: string }>();

  twoFactorEmail: string | undefined = undefined;
  emailPromise: Promise<any> | undefined;
  emailSent = false;

  constructor(
    protected i18nService: I18nService,
    protected twoFactorService: TwoFactorService,
    protected loginStrategyService: LoginStrategyServiceAbstraction,
    protected platformUtilsService: PlatformUtilsService,
    protected logService: LogService,
    protected twoFactorApiService: TwoFactorApiService,
    protected appIdService: AppIdService,
    private toastService: ToastService,
    private cacheService: TwoFactorAuthEmailComponentCacheService,
  ) {}

  async ngOnInit(): Promise<void> {
    // Check if email was already sent
    const cachedData = this.cacheService.getCachedData();
    if (cachedData?.emailSent) {
      this.emailSent = true;
    }

    const providers = await this.twoFactorService.getProviders();

    if (!providers || providers.size === 0) {
      throw new Error("User has no 2FA Providers");
    }

    const email2faProviderData = providers.get(TwoFactorProviderType.Email);

    if (!email2faProviderData) {
      throw new Error("Unable to retrieve email 2FA provider data");
    }

    this.twoFactorEmail = email2faProviderData.Email;

    if (!this.emailSent) {
      await this.sendEmail(false);
    }
  }

  /**
   * Emits the token value to the parent component
   * @param event - The event object from the input field
   */
  onTokenChange(event: Event) {
    const tokenValue = (event.target as HTMLInputElement).value || "";
    this.tokenChange.emit({ token: tokenValue });
  }

  async sendEmail(doToast: boolean) {
    if (this.emailPromise !== undefined) {
      return;
    }

    // TODO: PM-17545 - consider building a method on the login strategy service to get a mostly
    // initialized TwoFactorEmailRequest in 1 call instead of 5 like we do today.
    const email = await this.loginStrategyService.getEmail();

    if (email == null) {
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: this.i18nService.t("sessionTimeout"),
      });
      return;
    }

    try {
      const request = new TwoFactorEmailRequest();
      request.email = email;

      request.masterPasswordHash = (await this.loginStrategyService.getMasterPasswordHash()) ?? "";
      request.ssoEmail2FaSessionToken =
        (await this.loginStrategyService.getSsoEmail2FaSessionToken()) ?? "";
      request.deviceIdentifier = await this.appIdService.getAppId();
      request.authRequestAccessCode = (await this.loginStrategyService.getAccessCode()) ?? "";
      request.authRequestId = (await this.loginStrategyService.getAuthRequestId()) ?? "";
      this.emailPromise = this.twoFactorApiService.postTwoFactorEmail(request);
      await this.emailPromise;

      this.emailSent = true;
      this.cacheService.cacheData({ emailSent: this.emailSent });

      if (doToast) {
        this.toastService.showToast({
          variant: "success",
          title: "",
          message: this.i18nService.t("verificationCodeEmailSent", this.twoFactorEmail),
        });
      }
    } catch (e) {
      this.logService.error(e);
    }

    this.emailPromise = undefined;
  }
}
