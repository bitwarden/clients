import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from "@angular/core";
import { RouterModule } from "@angular/router";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { TwoFactorAuthSecurityKeyIcon } from "@bitwarden/assets/svg";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import {
  AnonLayoutWrapperDataService,
  ButtonModule,
  IconModule,
  TypographyModule,
} from "@bitwarden/components";

import { BrowserApi } from "../../../platform/browser/browser-api";
import { LoginWithPasskeyResultService } from "../../services/login-with-passkey-result.service";
import { closePasskeyResultPopout } from "../utils/auth-popout-window";

export type PasskeyLoginState = "loggingIn" | "loginFailed";

@Component({
  selector: "app-login-with-passkey-result",
  templateUrl: "login-with-passkey-result.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, RouterModule, JslibModule, ButtonModule, IconModule, TypographyModule],
})
export class LoginWithPasskeyResultComponent implements OnInit {
  protected readonly currentState = signal<PasskeyLoginState>("loggingIn");

  protected readonly Icons = {
    TwoFactorAuthSecurityKeyIcon,
  };

  private readonly loginWithPasskeyResultService = inject(LoginWithPasskeyResultService);
  private readonly i18nService = inject(I18nService);
  private readonly validationService = inject(ValidationService);
  private readonly anonLayoutWrapperDataService = inject(AnonLayoutWrapperDataService);

  ngOnInit(): void {
    void this.completeLogin();
  }

  protected retry(): void {
    this.currentState.set("loggingIn");
    void this.completeLogin();
  }

  private async completeLogin(): Promise<void> {
    try {
      const outcome = await this.loginWithPasskeyResultService.completeLogin();

      if (outcome.success === false) {
        this.validationService.showError(outcome.errorMessage);
        this.currentState.set("loginFailed");
        this.setFailureIcon();
        return;
      }

      // Reload other open extension windows so they re-evaluate auth guards
      // and navigate to the vault. Then close this popout.
      BrowserApi.reloadOpenWindows(true); // true = exclude current window
      await closePasskeyResultPopout();
    } catch {
      this.validationService.showError(this.i18nService.t("invalidPasskeyPleaseTryAgain"));
      this.currentState.set("loginFailed");
      this.setFailureIcon();
    }
  }

  private setDefaultIcon(): void {
    this.anonLayoutWrapperDataService.setAnonLayoutWrapperData({
      pageIcon: this.Icons.TwoFactorAuthSecurityKeyIcon,
    });
  }

  private setFailureIcon(): void {
    // For now, use the same icon, but the component could show a different one.
    this.setDefaultIcon();
  }
}
