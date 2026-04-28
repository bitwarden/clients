// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { ActivatedRoute, Router, RouterModule } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  TwoFactorAuthSecurityKeyIcon,
  TwoFactorAuthSecurityKeyFailedIcon,
} from "@bitwarden/assets/svg";
// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { LoginSuccessHandlerService } from "@bitwarden/auth/common";
import { WebAuthnLoginServiceAbstraction } from "@bitwarden/common/auth/abstractions/webauthn/webauthn-login.service.abstraction";
import { WebAuthnLoginCredentialAssertionView } from "@bitwarden/common/auth/models/view/webauthn-login/webauthn-login-credential-assertion.view";
import { ClientType } from "@bitwarden/common/enums";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import {
  AnonLayoutWrapperDataService,
  ButtonModule,
  SvgModule,
  LinkModule,
  Translation,
  TypographyModule,
} from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";

import { LoginViaWebAuthnComponentService } from "./login-via-webauthn-component.service";

export type State = "assert" | "assertFailed";
// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-login-via-webauthn",
  templateUrl: "login-via-webauthn.component.html",
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    JslibModule,
    ButtonModule,
    SvgModule,
    LinkModule,
    TypographyModule,
  ],
})
export class LoginViaWebAuthnComponent implements OnInit {
  protected currentState: State = "assert";
  protected shouldShowPageIcon = true;
  protected shouldShowTroubleLoggingInText = true;
  protected useDifferentLoginMethodLinkText = "";
  private shouldAutoClosePopout = false;

  protected readonly Icons = {
    TwoFactorAuthSecurityKeyIcon,
    TwoFactorAuthSecurityKeyFailedIcon,
  };

  private readonly successRoutes: Record<ClientType, string> = {
    [ClientType.Web]: "/vault",
    [ClientType.Browser]: "/tabs/vault",
    [ClientType.Desktop]: "/vault",
    [ClientType.Cli]: "/vault",
  };

  protected get successRoute(): string {
    const clientType = this.platformUtilsService.getClientType();
    return this.successRoutes[clientType] || "/vault";
  }

  constructor(
    private webAuthnLoginService: WebAuthnLoginServiceAbstraction,
    private router: Router,
    private route: ActivatedRoute,
    private logService: LogService,
    private validationService: ValidationService,
    private i18nService: I18nService,
    private loginSuccessHandlerService: LoginSuccessHandlerService,
    private keyService: KeyService,
    private platformUtilsService: PlatformUtilsService,
    private anonLayoutWrapperDataService: AnonLayoutWrapperDataService,
    private messagingService: MessagingService,
    private loginViaWebAuthnComponentService: LoginViaWebAuthnComponentService,
  ) {}

  ngOnInit(): void {
    this.shouldShowPageIcon = this.loginViaWebAuthnComponentService.shouldShowPageIcon;
    this.shouldShowTroubleLoggingInText =
      this.loginViaWebAuthnComponentService.shouldShowTroubleLoggingInText;
    this.useDifferentLoginMethodLinkText = this.resolveTranslation(
      this.loginViaWebAuthnComponentService.useDifferentLoginMethodLinkText,
    );

    // Check if we should auto-close the popout after successful authentication
    this.shouldAutoClosePopout =
      this.route.snapshot.queryParamMap.get("autoClosePopout") === "true";

    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.authenticate();
  }

  protected retry() {
    this.currentState = "assert";
    // Reset to default icon on retry
    this.setDefaultIcon();
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.authenticate();
  }

  private async authenticate() {
    let assertion: WebAuthnLoginCredentialAssertionView;
    try {
      const options = await this.webAuthnLoginService.getCredentialAssertionOptions();
      assertion = await this.webAuthnLoginService.assertCredential(options);
    } catch (error) {
      this.validationService.showError(error);
      this.currentState = "assertFailed";
      this.setFailureIcon();
      return;
    }
    try {
      const authResult = await this.webAuthnLoginService.logIn(assertion);

      if (authResult.requiresTwoFactor) {
        this.validationService.showError(
          this.i18nService.t("twoFactorForPasskeysNotSupportedOnClientUpdateToLogIn"),
        );
        this.currentState = "assertFailed";
        this.setFailureIcon();
        return;
      }

      // Only run loginSuccessHandlerService if webAuthn is used for vault decryption.
      const userKey = await firstValueFrom(this.keyService.userKey$(authResult.userId));
      if (userKey) {
        await this.loginSuccessHandlerService.run(authResult.userId, null);
      }

      // If autoClosePopout is enabled and we're in a browser extension,
      // re-open the regular popup and close this popout window
      if (
        this.shouldAutoClosePopout &&
        this.platformUtilsService.getClientType() === ClientType.Browser
      ) {
        this.messagingService.send("openPopup");
        window.close();
        return;
      }

      await this.router.navigate([this.successRoute]);
    } catch (error) {
      if (error instanceof ErrorResponse) {
        this.validationService.showError(this.i18nService.t("invalidPasskeyPleaseTryAgain"));
      }
      this.logService.error(error);
      this.currentState = "assertFailed";
      this.setFailureIcon();
    }
  }

  private setDefaultIcon(): void {
    if (!this.shouldShowPageIcon) {
      return;
    }
    this.anonLayoutWrapperDataService.setAnonLayoutWrapperData({
      pageIcon: this.Icons.TwoFactorAuthSecurityKeyIcon,
    });
  }

  private setFailureIcon(): void {
    if (!this.shouldShowPageIcon) {
      return;
    }
    this.anonLayoutWrapperDataService.setAnonLayoutWrapperData({
      pageIcon: this.Icons.TwoFactorAuthSecurityKeyFailedIcon,
    });
  }

  private resolveTranslation(value: string | Translation): string {
    if (typeof value === "string") {
      return value;
    }
    const [p1, p2, p3] = (value.placeholders ?? []).map(String);
    return this.i18nService.t(value.key, p1, p2, p3);
  }
}
