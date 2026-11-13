import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getOptionalUserId } from "@bitwarden/common/auth/services/account.service";
import { CommandDefinition, MessageSender } from "@bitwarden/common/platform/messaging";
import { CipherId, UserId } from "@bitwarden/common/types/guid";

/**
 * Asks the background to re-read the user's leases, since the popup receives no pushes. With
 * `cipherId`, it also re-fetches that cipher's copy (after a save) or fetches it if it is new.
 */
export const PAM_REFRESH_LEASES = new CommandDefinition<{ userId: UserId; cipherId?: CipherId }>(
  "pamRefreshLeases",
);

export async function requestLeaseRefresh(
  accountService: AccountService,
  messageSender: MessageSender,
): Promise<void> {
  const userId = await firstValueFrom(accountService.activeAccount$.pipe(getOptionalUserId));
  if (userId != null) {
    messageSender.send(PAM_REFRESH_LEASES, { userId });
  }
}
