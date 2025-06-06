import { Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import {
  DefaultLoginDecryptionOptionsService,
  LoginDecryptionOptionsService,
} from "@bitwarden/auth/angular";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";

import { postLogoutMessageListener$ } from "../utils/post-logout-message-listener";

export class ExtensionLoginDecryptionOptionsService
  extends DefaultLoginDecryptionOptionsService
  implements LoginDecryptionOptionsService
{
  constructor(
    protected messagingService: MessagingService,
    private router: Router,
  ) {
    super(messagingService);
  }

  override async logOut(): Promise<void> {
    // start listening for "switchAccountFinish" or "doneLoggingOut"
    const messagePromise = firstValueFrom(postLogoutMessageListener$);

    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    super.logOut();

    // wait for messages
    const command = await messagePromise;

    // doneLoggingOut already has a message handler that will navigate us
    if (command === "switchAccountFinish") {
      await this.router.navigate(["/"]);
    }
  }
}
