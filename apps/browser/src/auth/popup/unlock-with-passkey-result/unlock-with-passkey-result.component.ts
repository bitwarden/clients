import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from "@angular/core";
import { Router, RouterModule } from "@angular/router";

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
import { UnlockWithPasskeyResultService } from "../../services/unlock-with-passkey-result.service";
import { closePasskeyResultPopout } from "../utils/auth-popout-window";

export type PasskeyUnlockState = "unlocking" | "unlockFailed";

@Component({
  selector: "app-unlock-with-passkey-result",
  templateUrl: "unlock-with-passkey-result.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, RouterModule, JslibModule, ButtonModule, IconModule, TypographyModule],
})
export class UnlockWithPasskeyResultComponent implements OnInit {
  protected readonly currentState = signal<PasskeyUnlockState>("unlocking");

  protected readonly Icons = {
    TwoFactorAuthSecurityKeyIcon,
  };

  private readonly unlockWithPasskeyResultService = inject(UnlockWithPasskeyResultService);
  private readonly validationService = inject(ValidationService);
  private readonly i18nService = inject(I18nService);
  private readonly router = inject(Router);
  private readonly anonLayoutWrapperDataService = inject(AnonLayoutWrapperDataService);

  ngOnInit(): void {
    void this.completeUnlock();
  }

  protected retry(): void {
    this.currentState.set("unlocking");
    void this.completeUnlock();
  }

  private async completeUnlock(): Promise<void> {
    try {
      const outcome = await this.unlockWithPasskeyResultService.completeUnlock();

      if (outcome.success === false) {
        if (outcome.canceled) {
          await closePasskeyResultPopout();
          return;
        }

        this.validationService.showError(outcome.errorMessage);
        this.currentState.set("unlockFailed");
        this.setFailureIcon();
        return;
      }

      // Reload other open extension windows so they re-evaluate auth guards
      // and navigate to the vault. Then close this popout.
      BrowserApi.reloadOpenWindows(true); // true = exclude current window
      await closePasskeyResultPopout();
      await this.router.navigate(["/tabs/vault"]);
    } catch {
      this.validationService.showError(this.i18nService.t("invalidPasskeyPleaseTryAgain"));
      this.currentState.set("unlockFailed");
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
