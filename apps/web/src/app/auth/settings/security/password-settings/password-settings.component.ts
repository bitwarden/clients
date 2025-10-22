import { Component, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { ChangePasswordComponent } from "@bitwarden/angular/auth/password-management/change-password";
import { InputPasswordFlow } from "@bitwarden/auth/angular";
import { UserDecryptionOptionsServiceAbstraction } from "@bitwarden/auth/common";
import { CalloutModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { WebauthnLoginSettingsModule } from "../../webauthn-login-settings";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
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
  ) {}

  async ngOnInit() {
    const userHasMasterPassword = await firstValueFrom(
      this.userDecryptionOptionsService.hasMasterPassword$,
    );
    if (!userHasMasterPassword) {
      await this.router.navigate(["/settings/security/two-factor"]);
      return;
    }
  }
}
