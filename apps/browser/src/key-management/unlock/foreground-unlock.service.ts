import { UserId } from "@bitwarden/common/types/guid";
import { CrossContextUnlockService } from "@bitwarden/unlock";

import { BACKGROUND_UNLOCK_COMPLETED, FOREGROUND_UNLOCK_COMPLETED } from "./unlock-messages";

/**
 * The popup's unlock service. Unlocks performed here — master password, PIN, PRF — are announced
 * to the background so its listeners run too.
 */
export class ForegroundUnlockService extends CrossContextUnlockService {
  protected readonly announces = FOREGROUND_UNLOCK_COMPLETED;
  protected readonly listensFor = BACKGROUND_UNLOCK_COMPLETED;

  /**
   * Biometrics is the one unlock the popup delegates entirely: retrieving the biometrics-protected
   * key runs in the background, which unlocks itself with it so the user stays unlocked even if the
   * popup dies while the OS prompt has focus. The popup is told through
   * {@link BACKGROUND_UNLOCK_COMPLETED} like any other unlock the background performs, and its SDK
   * client re-initializes off the user key the unlock wrote to state.
   *
   * Unlocking here as well would announce the unlock back to the background, running both contexts'
   * on-unlock actions twice for the one unlock.
   */
  override async unlockWithBiometrics(userId: UserId): Promise<void> {
    const userKey = await this.biometricsService.unlockWithBiometricsForUser(userId);
    if (!userKey) {
      throw new Error("Failed to unlock with biometrics");
    }
  }
}
