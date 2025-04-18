import { inject } from "@angular/core";

import {
  DefaultSetInitialPasswordService,
  SetInitialPasswordCredentials,
  SetInitialPasswordService,
} from "@bitwarden/auth/angular";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";

export class DesktopSetInitialPasswordService
  extends DefaultSetInitialPasswordService
  implements SetInitialPasswordService
{
  messagingService = inject(MessagingService);

  override async setInitialPassword(credentials: SetInitialPasswordCredentials) {
    await super.setInitialPassword(credentials);

    this.messagingService.send("redrawMenu");
  }
}
