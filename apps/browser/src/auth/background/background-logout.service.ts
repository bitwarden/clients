import { filter, firstValueFrom, map, timeout } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { TokenService } from "@bitwarden/common/auth/abstractions/token.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { LogoutReason, LogoutService, NewActiveUser } from "@bitwarden/common/auth/logout";
import { EventUploadService } from "@bitwarden/common/dirt/event-logs";
import { PinServiceAbstraction } from "@bitwarden/common/key-management/pin/pin.service.abstraction";
import { ProcessReloadServiceAbstraction } from "@bitwarden/common/key-management/process-reload";
import {
  VaultTimeoutSettingsService,
  VaultTimeoutStringType,
} from "@bitwarden/common/key-management/vault-timeout";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { SystemService } from "@bitwarden/common/platform/abstractions/system.service";
import { StateEventRunnerService } from "@bitwarden/common/platform/state";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { InternalFolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { BiometricStateService, KeyService } from "@bitwarden/key-management";
import { LogService } from "@bitwarden/logging";

import { BrowserApi } from "../../platform/browser/browser-api";
import { PopupViewCacheBackgroundService } from "../../platform/services/popup-view-cache-background.service";

import { BackgroundAccountSwitchService } from "./background-account-switch.service";
import { BackgroundRefresher } from "./background-refresher";

/**
 * Extension background implementation of {@link LogoutService}. Switches to the next account
 * when the active account logs out, clears the user's data, and reloads the background process
 * to wipe secrets held in memory.
 */
export class BackgroundLogoutService implements LogoutService {
  constructor(
    private readonly logService: LogService,
    private readonly accountService: AccountService,
    private readonly accountSwitchService: BackgroundAccountSwitchService,
    private readonly authService: AuthService,
    private readonly eventUploadService: EventUploadService,
    private readonly cipherService: CipherService,
    private readonly folderService: InternalFolderService,
    private readonly biometricStateService: BiometricStateService,
    private readonly popupViewCacheBackgroundService: PopupViewCacheBackgroundService,
    private readonly pinService: PinServiceAbstraction,
    private readonly keyService: KeyService,
    private readonly vaultTimeoutSettingsService: VaultTimeoutSettingsService,
    private readonly stateService: StateService,
    private readonly tokenService: TokenService,
    private readonly stateEventRunnerService: StateEventRunnerService,
    private readonly messagingService: MessagingService,
    private readonly systemService: SystemService,
    private readonly processReloadService: ProcessReloadServiceAbstraction,
    private readonly backgroundRefresher: BackgroundRefresher,
  ) {}

  async logout(userId: UserId, logoutReason: LogoutReason): Promise<NewActiveUser | undefined> {
    this.logService.info("Logging out user %s for reason: %s", userId, logoutReason);

    const activeUserId = await firstValueFrom(
      this.accountService.activeAccount$.pipe(
        map((a) => a?.id),
        timeout({
          first: 2000,
          with: () => {
            throw new Error("No active account found to logout");
          },
        }),
      ),
    );

    await this.eventUploadService.uploadEvents(userId);

    // TODO: PM-44635 - Use AccountSwitcherService.nextSwitchableAccount$ from
    // @bitwarden/common/auth/account-switcher, which never picks a logged-out account.
    const newActiveUser =
      userId === activeUserId
        ? await firstValueFrom(this.accountService.nextUpAccount$.pipe(map((a) => a?.id)))
        : null;

    await this.accountSwitchService.switchAccount(newActiveUser);

    // HACK: We shouldn't wait for the authentication status to change but instead subscribe to the
    // authentication status to do various actions.
    const logoutPromise = firstValueFrom(
      this.authService.authStatusFor$(userId).pipe(
        filter((authenticationStatus) => authenticationStatus === AuthenticationStatus.LoggedOut),
        timeout({
          first: 5_000,
          with: () => {
            throw new Error("The logout process did not complete in a reasonable amount of time.");
          },
        }),
      ),
    );

    await Promise.all([
      this.cipherService.clear(userId),
      this.folderService.clear(userId),
      this.biometricStateService.logout(userId),
      this.popupViewCacheBackgroundService.clearState(),
      this.pinService.logout(userId),
      /* We intentionally do not clear:
       *  - autofillSettingsService
       *  - badgeSettingsService
       *  - userNotificationSettingsService
       */
    ]);

    await this.keyService.clearKeys(userId);

    //Needs to be checked before state is cleaned
    const needStorageReseed = await this.needsStorageReseed(userId);

    await this.stateService.clean({ userId: userId });
    await this.tokenService.clearTokens(userId);
    await this.accountService.clean(userId);

    await this.stateEventRunnerService.handleEvent("logout", userId);

    // HACK: Wait for the user logging outs authentication status to transition to LoggedOut
    await logoutPromise;

    this.messagingService.send("doneLoggingOut", {
      logoutReason: logoutReason,
      userId: userId,
    });

    if (needStorageReseed) {
      await this.backgroundRefresher.reseedStorage();
    }

    if (BrowserApi.isManifestVersion(3)) {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      BrowserApi.sendMessage("updateBadge");
    }
    await this.backgroundRefresher.refreshMenu(true);
    await this.systemService.clearPendingClipboard();
    await this.processReloadService.reloadProcess();

    return undefined;
  }

  private async needsStorageReseed(userId: UserId): Promise<boolean> {
    const currentVaultTimeout = await firstValueFrom(
      this.vaultTimeoutSettingsService.getVaultTimeoutByUserId$(userId),
    );
    return currentVaultTimeout == VaultTimeoutStringType.Never ? false : true;
  }
}
