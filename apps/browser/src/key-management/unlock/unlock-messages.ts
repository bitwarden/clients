import { CommandDefinition } from "@bitwarden/common/platform/messaging";
import { UnlockCompletedMessage } from "@bitwarden/unlock";

/**
 * Sent by the popup after it unlocked a user, so the background can run the on-unlock actions
 * registered against its own unlock service. Listeners such as the shared unlock peer only exist
 * in the background.
 */
export const FOREGROUND_UNLOCK_COMPLETED = new CommandDefinition<UnlockCompletedMessage>(
  "foregroundUnlockCompleted",
);

/**
 * The same announcement in the other direction, for the unlocks the background performs itself —
 * biometrics, or another device unlocking us over shared unlock.
 */
export const BACKGROUND_UNLOCK_COMPLETED = new CommandDefinition<UnlockCompletedMessage>(
  "backgroundUnlockCompleted",
);
