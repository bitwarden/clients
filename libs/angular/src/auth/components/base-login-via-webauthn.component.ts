// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Directive, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { LoginSuccessHandlerService } from "@bitwarden/auth/common";
import { WebAuthnLoginServiceAbstraction } from "@bitwarden/common/auth/abstractions/webauthn/webauthn-login.service.abstraction";
import { ForceSetPasswordReason } from "@bitwarden/common/auth/models/domain/force-set-password-reason";
import { WebAuthnLoginCredentialAssertionView } from "@bitwarden/common/auth/models/view/webauthn-login/webauthn-login-credential-assertion.view";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { KeyService } from "@bitwarden/key-management";

export type State = "assert" | "assertFailed";

@Directive()
export class BaseLoginViaWebAuthnComponent implements OnInit {
  protected currentState: State = "assert";

  protected successRoute = "/vault";
  protected forcePasswordResetRoute = "/update-temp-password";

  constructor(
    private webAuthnLoginService: WebAuthnLoginServiceAbstraction,
    private router: Router,
    private logService: LogService,
    private validationService: ValidationService,
    private i18nService: I18nService,
    private loginSuccessHandlerService: LoginSuccessHandlerService,
    private keyService: KeyService,
  ) {}

  ngOnInit(): void {
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.authenticate();
  }

  protected retry() {
    this.currentState = "assert";
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
      return;
    }
    try {
      const authResult = await this.webAuthnLoginService.logIn(assertion);

      if (authResult.requiresTwoFactor) {
        this.validationService.showError(
          this.i18nService.t("twoFactorForPasskeysNotSupportedOnClientUpdateToLogIn"),
        );
        this.currentState = "assertFailed";
        return;
      }

      // Only run loginSuccessHandlerService if webAuthn is used for vault decryption.
      const userKey = await firstValueFrom(this.keyService.userKey$(authResult.userId));
      if (userKey) {
        await this.loginSuccessHandlerService.run(authResult.userId);
      }

      if (authResult.forcePasswordReset == ForceSetPasswordReason.AdminForcePasswordReset) {
        await this.router.navigate([this.forcePasswordResetRoute]);
        return;
      }

      await this.router.navigate([this.successRoute]);
    } catch (error) {
      if (error instanceof ErrorResponse) {
        this.validationService.showError(this.i18nService.t("invalidPasskeyPleaseTryAgain"));
      }
      this.logService.error(error);
      this.currentState = "assertFailed";
    }
  }
}
