import { CrossContextUnlockService } from "@bitwarden/unlock";

import { BACKGROUND_UNLOCK_COMPLETED, FOREGROUND_UNLOCK_COMPLETED } from "./unlock-messages";

/**
 * The background's unlock service. Unlocks performed here — biometrics, and another device
 * unlocking us over shared unlock — are announced to the popup so its listeners run too.
 */
export class BackgroundUnlockService extends CrossContextUnlockService {
  protected readonly announces = BACKGROUND_UNLOCK_COMPLETED;
  protected readonly listensFor = FOREGROUND_UNLOCK_COMPLETED;
}
