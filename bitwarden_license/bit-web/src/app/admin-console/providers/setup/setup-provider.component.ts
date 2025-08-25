import { Component } from "@angular/core";
import { Params } from "@angular/router";

import { BitwardenLogo } from "@bitwarden/assets/svg";
import { BaseAcceptComponent } from "@bitwarden/web-vault/app/common/base.accept.component";

@Component({
  selector: "app-setup-provider",
  templateUrl: "setup-provider.component.html",
  standalone: false,
})
export class SetupProviderComponent extends BaseAcceptComponent {
  protected logo = BitwardenLogo;
  failedShortMessage = "inviteAcceptFailedShort";
  failedMessage = "inviteAcceptFailed";

  requiredParameters = ["providerId", "email", "token"];

  async authedHandler(qParams: Params) {
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.router.navigate(["/providers/setup"], { queryParams: qParams });
  }

  async unauthedHandler(qParams: Params) {
    // Empty
  }

  login() {
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.router.navigate(["/login"], { queryParams: { email: this.email } });
  }
}
