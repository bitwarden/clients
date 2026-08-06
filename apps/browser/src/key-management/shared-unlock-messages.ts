import { CommandDefinition } from "@bitwarden/common/platform/messaging";
import { UserId } from "@bitwarden/common/types/guid";
import { UnlockSource } from "@bitwarden/unlock";

export const SHARED_UNLOCK_EXTERNAL = new CommandDefinition<{ userId: UserId }>(
  "sharedUnlockExternal",
);

/**
 * Reports an unlock that happened in the popup to the background, where the shared unlock leader and
 * follower live. The popup resolves its own {@link UnlockService}, so its on-unlock actions never
 * reach the background instance.
 *
 * The user key is deliberately not part of the payload; the background reads it from state itself.
 */
export const SHARED_UNLOCK_LOCAL_UNLOCK = new CommandDefinition<{
  userId: UserId;
  source: UnlockSource;
}>("sharedUnlockLocalUnlock");
