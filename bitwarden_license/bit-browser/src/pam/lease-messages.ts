import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getOptionalUserId } from "@bitwarden/common/auth/services/account.service";
import { CommandDefinition, MessageSender } from "@bitwarden/common/platform/messaging";
import { UserId } from "@bitwarden/common/types/guid";

/** Asks the background to re-read the user's leases, since the popup receives no pushes. */
export const PAM_REFRESH_LEASES = new CommandDefinition<{ userId: UserId }>("pamRefreshLeases");

export async function requestLeaseRefresh(
  accountService: AccountService,
  messageSender: MessageSender,
): Promise<void> {
  const userId = await firstValueFrom(accountService.activeAccount$.pipe(getOptionalUserId));
  if (userId != null) {
    messageSender.send(PAM_REFRESH_LEASES, { userId });
  }
}
