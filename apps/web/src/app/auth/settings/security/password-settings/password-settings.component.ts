import { Component, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { ChangePasswordComponent } from "@bitwarden/angular/auth/password-management/change-password";
import { InputPasswordFlow } from "@bitwarden/auth/angular";
import { UserDecryptionOptionsServiceAbstraction } from "@bitwarden/auth/common";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { CalloutModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { WebauthnLoginSettingsModule } from "../../webauthn-login-settings";

@Component({
  selector: "app-password-settings",
  templateUrl: "password-settings.component.html",
  imports: [CalloutModule, ChangePasswordComponent, I18nPipe, WebauthnLoginSettingsModule],
})
export class PasswordSettingsComponent implements OnInit {
  inputPasswordFlow = InputPasswordFlow.ChangePasswordWithOptionalUserKeyRotation;
  changePasswordFeatureFlag = false;

  constructor(
    private router: Router,
    private userDecryptionOptionsService: UserDecryptionOptionsServiceAbstraction,
    private accountService: AccountService,
  ) {}

  async ngOnInit() {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    const userHasMasterPassword = await firstValueFrom(
      this.userDecryptionOptionsService.hasMasterPasswordById$(userId),
    );

    if (!userHasMasterPassword) {
      await this.router.navigate(["/settings/security/two-factor"]);
      return;
    }
  }
}
