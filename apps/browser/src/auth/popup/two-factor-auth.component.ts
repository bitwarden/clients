import { CommonModule } from "@angular/common";
import { Component, Inject, OnInit } from "@angular/core";
import { FormBuilder, ReactiveFormsModule } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";

import { TwoFactorAuthAuthenticatorComponent } from "@bitwarden/angular/auth/components/two-factor-auth/two-factor-auth-authenticator.component";
import { TwoFactorAuthWebAuthnComponent } from "@bitwarden/angular/auth/components/two-factor-auth/two-factor-auth-webauthn.component";
import { TwoFactorAuthYubikeyComponent } from "@bitwarden/angular/auth/components/two-factor-auth/two-factor-auth-yubikey.component";
import { TwoFactorAuthComponent as BaseTwoFactorAuthComponent } from "@bitwarden/angular/auth/components/two-factor-auth/two-factor-auth.component";
import { TwoFactorOptionsComponent } from "@bitwarden/angular/auth/components/two-factor-auth/two-factor-options.component";
import { JslibModule } from "@bitwarden/angular/jslib.module";
import { I18nPipe } from "@bitwarden/angular/platform/pipes/i18n.pipe";
import { WINDOW } from "@bitwarden/angular/services/injection-tokens";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/auth/abstractions/master-password.service.abstraction";
import { SsoLoginServiceAbstraction } from "@bitwarden/common/auth/abstractions/sso-login.service.abstraction";
import { TwoFactorService } from "@bitwarden/common/auth/abstractions/two-factor.service";
import { TwoFactorProviderType } from "@bitwarden/common/auth/enums/two-factor-provider-type";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SyncService } from "@bitwarden/common/platform/sync";
import {
  ButtonModule,
  FormFieldModule,
  AsyncActionsModule,
  CheckboxModule,
  DialogModule,
  LinkModule,
  TypographyModule,
  DialogService,
} from "@bitwarden/components";

import {
  LoginStrategyServiceAbstraction,
  LoginEmailServiceAbstraction,
  UserDecryptionOptionsServiceAbstraction,
} from "../../../../../libs/auth/src/common/abstractions";
import { BrowserApi } from "../../platform/browser/browser-api";
import BrowserPopupUtils from "../../platform/popup/browser-popup-utils";

import { TwoFactorAuthDuoComponent } from "./two-factor-auth-duo.component";
import { TwoFactorAuthEmailComponent } from "./two-factor-auth-email.component";

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
export class TwoFactorAuthComponent extends BaseTwoFactorAuthComponent implements OnInit {
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
    private syncService: SyncService,
    private messagingService: MessagingService,
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
    );
    super.onSuccessfulLoginTdeNavigate = async () => {
      this.win.close();
    };
    this.onSuccessfulLoginNavigate = this.goAfterLogIn;
  }

  async ngOnInit(): Promise<void> {
    await super.ngOnInit();

    if (this.route.snapshot.paramMap.has("webAuthnResponse")) {
      // WebAuthn fallback response
      this.selectedProviderType = TwoFactorProviderType.WebAuthn;
      this.token = this.route.snapshot.paramMap.get("webAuthnResponse");
      super.onSuccessfulLogin = async () => {
        // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.syncService.fullSync(true);
        this.messagingService.send("reloadPopup");
        window.close();
      };
      this.remember = this.route.snapshot.paramMap.get("remember") === "true";
      await this.submit();
      return;
    }

    if (await BrowserPopupUtils.inPopout(this.win)) {
      this.selectedProviderType = TwoFactorProviderType.Email;
    }

    // WebAuthn prompt appears inside the popup on linux, and requires a larger popup width
    // than usual to avoid cutting off the dialog.
    if (this.selectedProviderType === TwoFactorProviderType.WebAuthn && (await this.isLinux())) {
      document.body.classList.add("linux-webauthn");
    }
  }

  async ngOnDestroy() {
    if (this.selectedProviderType === TwoFactorProviderType.WebAuthn && (await this.isLinux())) {
      document.body.classList.remove("linux-webauthn");
    }
  }

  async isLinux() {
    return (await BrowserApi.getPlatformInfo()).os === "linux";
  }
}
