import { Component, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { ChangePasswordComponent, InputPasswordFlow } from "@bitwarden/auth/angular";
import { UserDecryptionOptionsServiceAbstraction } from "@bitwarden/auth/common";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
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
    private configService: ConfigService,
  ) {}

  async ngOnInit() {
    this.changePasswordFeatureFlag = await this.configService.getFeatureFlag(
      FeatureFlag.PM16117_ChangeExistingPasswordRefactor,
    );

    const userHasMasterPassword = await firstValueFrom(
      this.userDecryptionOptionsService.hasMasterPassword$,
    );
    if (!userHasMasterPassword) {
      await this.router.navigate(["/settings/security/two-factor"]);
      return;
    }
  }
}
