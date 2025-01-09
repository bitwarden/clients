import { inject } from "@angular/core";

import {
  DefaultSetPasswordJitService,
  SetPasswordCredentials,
  SetPasswordJitService,
} from "@bitwarden/auth/angular";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";

export class DesktopSetPasswordJitService
  extends DefaultSetPasswordJitService
  implements SetPasswordJitService
{
  messagingService = inject(MessagingService);

  override async setPassword(credentials: SetPasswordCredentials) {
    await super.setPassword(credentials);

    this.messagingService.send("redrawMenu");
  }
}
