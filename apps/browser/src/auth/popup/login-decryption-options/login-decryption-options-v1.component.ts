import { Component } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { BaseLoginDecryptionOptionsComponentV1 } from "@bitwarden/angular/auth/components/base-login-decryption-options-v1.component";

import { postLogoutMessageListener$ } from "../utils/post-logout-message-listener";

@Component({
  selector: "browser-login-decryption-options",
  templateUrl: "login-decryption-options-v1.component.html",
})
export class LoginDecryptionOptionsComponentV1 extends BaseLoginDecryptionOptionsComponentV1 {
  override async createUser(): Promise<void> {
    try {
      await super.createUser();
      await this.router.navigate(["/tabs/vault"]);
    } catch (error) {
      this.validationService.showError(error);
    }
  }

  override async logOut(): Promise<void> {
    // start listening for "switchAccountFinish" or "doneLoggingOut"
    const messagePromise = firstValueFrom(postLogoutMessageListener$);
    super.logOut();
    // wait for messages
    const command = await messagePromise;

    // We should be routed/routing very soon but just in case, turn loading back off.
    this.loading = false;

    // doneLoggingOut already has a message handler that will navigate us
    if (command === "switchAccountFinish") {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.router.navigate(["/"]);
    }
  }
}
