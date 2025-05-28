import { Component, OnInit } from "@angular/core";

import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

import { HeaderModule } from "../../../layouts/header/header.module";
import { SharedModule } from "../../../shared";

@Component({
  templateUrl: "security.component.html",
  standalone: true,
  imports: [SharedModule, HeaderModule],
})
export class SecurityComponent implements OnInit {
  showChangePassword = true;
  changePasswordRoute = "change-password";

  constructor(
    private userVerificationService: UserVerificationService,
    private configService: ConfigService,
  ) {}

  async ngOnInit() {
    this.showChangePassword = await this.userVerificationService.hasMasterPassword();

    const changePasswordRefreshFlag = await this.configService.getFeatureFlag(
      FeatureFlag.PM16117_ChangeExistingPasswordRefactor,
    );
    if (changePasswordRefreshFlag) {
      this.changePasswordRoute = "password";
    }
  }
}
