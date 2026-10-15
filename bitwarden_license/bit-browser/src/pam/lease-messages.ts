import { CommandDefinition } from "@bitwarden/common/platform/messaging";
import { UserId } from "@bitwarden/common/types/guid";

/** Asks the background to re-read the user's leases, since the popup receives no pushes. */
export const PAM_REFRESH_LEASES = new CommandDefinition<{ userId: UserId }>("pamRefreshLeases");
