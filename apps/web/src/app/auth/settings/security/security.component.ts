import { Component, OnInit } from "@angular/core";

import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";

import { HeaderModule } from "../../../layouts/header/header.module";
import { SharedModule } from "../../../shared";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
 
@Component({
  templateUrl: "security.component.html",
  imports: [SharedModule, HeaderModule],
})
export class SecurityComponent implements OnInit {
  showChangePassword = true;
  changePasswordRoute = "password";

  constructor(private userVerificationService: UserVerificationService) {}

  async ngOnInit() {
    this.showChangePassword = await this.userVerificationService.hasMasterPassword();
  }
}
