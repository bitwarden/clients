import { CommandDefinition } from "@bitwarden/common/platform/messaging";
import { UserId } from "@bitwarden/common/types/guid";

export const SHARED_UNLOCK_EXTERNAL = new CommandDefinition<{ userId: UserId }>(
  "sharedUnlockExternal",
);
