import { filter, firstValueFrom, timeout } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { SystemService } from "@bitwarden/common/platform/abstractions/system.service";
import { SyncService } from "@bitwarden/common/platform/sync";
import { UserId } from "@bitwarden/common/types/guid";

import { PopupViewCacheBackgroundService } from "../../platform/services/popup-view-cache-background.service";

import { BackgroundRefresher } from "./background-refresher";

/**
 * Switches the active account from the extension background, and tells the popup which
 * view to show for the new account.
 */
export class BackgroundAccountSwitchService {
  constructor(
    private readonly accountService: AccountService,
    private readonly authService: AuthService,
    private readonly messagingService: MessagingService,
    private readonly popupViewCacheBackgroundService: PopupViewCacheBackgroundService,
    private readonly systemService: SystemService,
    private readonly syncService: SyncService,
    private readonly backgroundRefresher: BackgroundRefresher,
  ) {}

  /**
   * Makes the given user the active account.
   * @param userId The user to switch to. `null` or `undefined` leaves no active account.
   */
  async switchAccount(userId: UserId | null | undefined): Promise<void> {
    let nextAccountStatus: AuthenticationStatus | undefined;
    try {
      // HACK to ensure account is switched before proceeding
      const switchPromise = firstValueFrom(
        this.accountService.activeAccount$.pipe(
          filter((account) => (account?.id ?? null) === (userId ?? null)),
          timeout({
            first: 1_000,
            with: () => {
              throw new Error(
                "The account switch process did not complete in a reasonable amount of time.",
              );
            },
          }),
        ),
      );
      await this.popupViewCacheBackgroundService.clearState();
      await this.accountService.switchAccount(userId ?? null);
      await switchPromise;

      if (userId == null) {
        await this.backgroundRefresher.refreshMenu();
        await this.backgroundRefresher.updateOverlayCiphers();
        this.messagingService.send("goHome");
        return;
      }

      nextAccountStatus = await this.authService.getAuthStatus(userId);

      await this.systemService.clearPendingClipboard();

      if (nextAccountStatus === AuthenticationStatus.LoggedOut) {
        this.messagingService.send("goHome");
      } else if (nextAccountStatus === AuthenticationStatus.Locked) {
        this.messagingService.send("locked", { userId: userId });
      } else {
        this.messagingService.send("unlocked", { userId: userId });
        await this.backgroundRefresher.refreshMenu();
        await this.backgroundRefresher.updateOverlayCiphers();
        await this.syncService.fullSync(false);
      }
    } finally {
      this.messagingService.send("switchAccountFinish", {
        userId: userId,
        status: nextAccountStatus,
      });
    }
  }
}
