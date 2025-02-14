import { DialogModule } from "@angular/cdk/dialog";
import { CommonModule } from "@angular/common";
import { Component, Inject } from "@angular/core";
import { FormBuilder, ReactiveFormsModule } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { I18nPipe } from "@bitwarden/angular/platform/pipes/i18n.pipe";
import { WINDOW } from "@bitwarden/angular/services/injection-tokens";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/auth/abstractions/master-password.service.abstraction";
import { SsoLoginServiceAbstraction } from "@bitwarden/common/auth/abstractions/sso-login.service.abstraction";
import { TwoFactorService } from "@bitwarden/common/auth/abstractions/two-factor.service";
import { AuthResult } from "@bitwarden/common/auth/models/domain/auth-result";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import {
  LinkModule,
  TypographyModule,
  CheckboxModule,
  DialogService,
  ToastService,
} from "@bitwarden/components";

// FIXME: remove `src` and fix import
// eslint-disable-next-line no-restricted-imports
import { TwoFactorAuthAuthenticatorComponent } from "../../../../../libs/angular/src/auth/components/two-factor-auth/two-factor-auth-authenticator.component";
// FIXME: remove `src` and fix import
// eslint-disable-next-line no-restricted-imports
import { TwoFactorAuthEmailComponent } from "../../../../../libs/angular/src/auth/components/two-factor-auth/two-factor-auth-email.component";
// FIXME: remove `src` and fix import
// eslint-disable-next-line no-restricted-imports
import { TwoFactorAuthWebAuthnComponent } from "../../../../../libs/angular/src/auth/components/two-factor-auth/two-factor-auth-webauthn.component";
// FIXME: remove `src` and fix import
// eslint-disable-next-line no-restricted-imports
import { TwoFactorAuthYubikeyComponent } from "../../../../../libs/angular/src/auth/components/two-factor-auth/two-factor-auth-yubikey.component";
// FIXME: remove `src` and fix import
// eslint-disable-next-line no-restricted-imports
import { TwoFactorAuthComponent as BaseTwoFactorAuthComponent } from "../../../../../libs/angular/src/auth/components/two-factor-auth/two-factor-auth.component";
// FIXME: remove `src` and fix import
// eslint-disable-next-line no-restricted-imports
import { TwoFactorOptionsComponent } from "../../../../../libs/angular/src/auth/components/two-factor-auth/two-factor-options.component";
// FIXME: remove `src` and fix import
// eslint-disable-next-line no-restricted-imports
import {
  LoginStrategyServiceAbstraction,
  LoginEmailServiceAbstraction,
  UserDecryptionOptionsServiceAbstraction,
} from "../../../../../libs/auth/src/common/abstractions";
// FIXME: remove `src` and fix import
// eslint-disable-next-line no-restricted-imports
import { AsyncActionsModule } from "../../../../../libs/components/src/async-actions";
// FIXME: remove `src` and fix import
// eslint-disable-next-line no-restricted-imports
import { ButtonModule } from "../../../../../libs/components/src/button";
// FIXME: remove `src` and fix import
// eslint-disable-next-line no-restricted-imports
import { FormFieldModule } from "../../../../../libs/components/src/form-field";

import { TwoFactorAuthDuoComponent } from "./two-factor-auth-duo.component";

@Component({
  standalone: true,
  templateUrl:
    "../../../../../libs/angular/src/auth/components/two-factor-auth/two-factor-auth.component.html",
  selector: "app-two-factor-auth",
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
    RouterLink,
    CheckboxModule,
    TwoFactorOptionsComponent,
    TwoFactorAuthEmailComponent,
    TwoFactorAuthAuthenticatorComponent,
    TwoFactorAuthYubikeyComponent,
    TwoFactorAuthDuoComponent,
    TwoFactorAuthWebAuthnComponent,
  ],
  providers: [I18nPipe],
})
export class TwoFactorAuthComponent extends BaseTwoFactorAuthComponent {
  constructor(
    protected loginStrategyService: LoginStrategyServiceAbstraction,
    protected router: Router,
    i18nService: I18nService,
    platformUtilsService: PlatformUtilsService,
    environmentService: EnvironmentService,
    dialogService: DialogService,
    protected route: ActivatedRoute,
    logService: LogService,
    protected twoFactorService: TwoFactorService,
    loginEmailService: LoginEmailServiceAbstraction,
    userDecryptionOptionsService: UserDecryptionOptionsServiceAbstraction,
    protected ssoLoginService: SsoLoginServiceAbstraction,
    protected configService: ConfigService,
    masterPasswordService: InternalMasterPasswordServiceAbstraction,
    accountService: AccountService,
    formBuilder: FormBuilder,
    @Inject(WINDOW) protected win: Window,
    toastService: ToastService,
  ) {
    super(
      loginStrategyService,
      router,
      i18nService,
      platformUtilsService,
      environmentService,
      dialogService,
      route,
      logService,
      twoFactorService,
      loginEmailService,
      userDecryptionOptionsService,
      ssoLoginService,
      configService,
      masterPasswordService,
      accountService,
      formBuilder,
      win,
      toastService,
    );
    this.onSuccessfulLoginNavigate = this.goAfterLogIn;
  }

  protected override handleMigrateEncryptionKey(result: AuthResult): boolean {
    if (!result.requiresEncryptionKeyMigration) {
      return false;
    }
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.router.navigate(["migrate-legacy-encryption"]);
    return true;
  }
}
