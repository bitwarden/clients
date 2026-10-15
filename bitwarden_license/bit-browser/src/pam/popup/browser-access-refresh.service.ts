import { firstValueFrom } from "rxjs";

import { AccessEventService, DefaultAccessRefreshService } from "@bitwarden/bit-common/pam";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getOptionalUserId } from "@bitwarden/common/auth/services/account.service";
import { MessageSender } from "@bitwarden/common/platform/messaging";

import { PAM_REFRESH_LEASES } from "../lease-messages";

/**
 * Also asks the background to re-read leases after a popup action, so it fetches or drops the
 * leased copy the item view swaps in without waiting for the push.
 */
export class BrowserAccessRefreshService extends DefaultAccessRefreshService {
  constructor(
    accessEventService: AccessEventService,
    private readonly accountService: AccountService,
    private readonly messageSender: MessageSender,
  ) {
    super(accessEventService);
  }

  override notifyAccessChanged(cipherId?: string): void {
    super.notifyAccessChanged(cipherId);
    void this.refreshLeases();
  }

  private async refreshLeases(): Promise<void> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getOptionalUserId));
    if (userId != null) {
      this.messageSender.send(PAM_REFRESH_LEASES, { userId });
    }
  }
}
