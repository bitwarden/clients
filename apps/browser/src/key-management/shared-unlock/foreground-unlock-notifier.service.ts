import { MessageSender } from "@bitwarden/common/platform/messaging";
import { UnlockService } from "@bitwarden/unlock";

import { SHARED_UNLOCK_LOCAL_UNLOCK } from "../shared-unlock-messages";

/**
 * Forwards unlocks performed in the popup to the background, where the shared unlock leader and
 * follower live.
 *
 * The popup resolves its own {@link UnlockService} instance, so unlocks it performs — master
 * password, PIN, and PRF — never reach the on-unlock actions the background registered. Unlocks
 * driven from the background, such as biometrics and never-lock, already do.
 */
export class ForegroundUnlockNotifierService {
  constructor(
    private readonly unlockService: UnlockService,
    private readonly messageSender: MessageSender,
  ) {}

  init(): void {
    this.unlockService.registerOnUnlockAction(async (userId, _userKey, source) => {
      this.messageSender.send(SHARED_UNLOCK_LOCAL_UNLOCK, { userId, source });
    });
  }
}
