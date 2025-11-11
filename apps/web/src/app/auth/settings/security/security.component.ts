import { Component, OnInit } from "@angular/core";
import { Observable } from "rxjs";

import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

import { HeaderModule } from "../../../layouts/header/header.module";
import { SharedModule } from "../../../shared";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "security.component.html",
  imports: [SharedModule, HeaderModule],
})
export class SecurityComponent implements OnInit {
  showChangePassword = true;
  changePasswordRoute = "password";
  consolidatedSessionTimeoutComponent$: Observable<boolean>;

  constructor(
    private userVerificationService: UserVerificationService,
    private configService: ConfigService,
  ) {
    this.consolidatedSessionTimeoutComponent$ = this.configService.getFeatureFlag$(
      FeatureFlag.ConsolidatedSessionTimeoutComponent,
    );
  }

  async ngOnInit() {
    this.showChangePassword = await this.userVerificationService.hasMasterPassword();
  }
}
