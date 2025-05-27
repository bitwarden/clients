import { Component } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { UpdateTempPasswordComponent as BaseUpdateTempPasswordComponent } from "@bitwarden/angular/auth/components/update-temp-password.component";

import { postLogoutMessageListener$ } from "./utils/post-logout-message-listener";

@Component({
  selector: "app-update-temp-password",
  templateUrl: "update-temp-password.component.html",
  standalone: false,
})
export class UpdateTempPasswordComponent extends BaseUpdateTempPasswordComponent {
  onSuccessfulChangePassword: () => Promise<void> = this.doOnSuccessfulChangePassword.bind(this);

  private async doOnSuccessfulChangePassword() {
    // start listening for "switchAccountFinish" or "doneLoggingOut"
    const messagePromise = firstValueFrom(postLogoutMessageListener$);
    this.messagingService.send("logout");
    // wait for messages
    const command = await messagePromise;

    // doneLoggingOut already has a message handler that will navigate us
    if (command === "switchAccountFinish") {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.router.navigate(["/"]);
    }
  }
}
