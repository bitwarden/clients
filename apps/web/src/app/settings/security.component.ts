import { Component } from "@angular/core";

import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";

@Component({
  selector: "app-security",
  templateUrl: "security.component.html",
})
export class SecurityComponent {
  showChangePassword = true;

  constructor(private userVerificationService: UserVerificationService) {}

  async ngOnInit() {
    this.showChangePassword = await this.userVerificationService.hasMasterPassword();
  }
}
