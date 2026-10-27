import { AccessEventService } from "@bitwarden/bit-common/pam/abstractions/access-event.service";
import { DefaultAccessRefreshService } from "@bitwarden/bit-common/pam/services/default-access-refresh.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { MessageSender } from "@bitwarden/common/platform/messaging";

import { requestLeaseRefresh } from "../lease-messages";

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
    void requestLeaseRefresh(this.accountService, this.messageSender);
  }
}
