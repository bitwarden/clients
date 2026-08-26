import { CrossContextUnlockService } from "@bitwarden/unlock";

import { BACKGROUND_UNLOCK_COMPLETED, FOREGROUND_UNLOCK_COMPLETED } from "./unlock-messages";

/**
 * The popup's unlock service. Unlocks performed here — master password, PIN, PRF — are announced
 * to the background so its listeners run too.
 */
export class ForegroundUnlockService extends CrossContextUnlockService {
  protected readonly announces = FOREGROUND_UNLOCK_COMPLETED;
  protected readonly listensFor = BACKGROUND_UNLOCK_COMPLETED;
}
