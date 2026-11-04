import { Signal, signal } from "@angular/core";
import { Router } from "@angular/router";
import { filter, firstValueFrom, timeout } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { TokenService } from "@bitwarden/common/auth/abstractions/token.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { LogoutReason, LogoutService, NewActiveUser } from "@bitwarden/common/auth/logout";
import { EventUploadService } from "@bitwarden/common/dirt/event-logs";
import { ProcessReloadServiceAbstraction } from "@bitwarden/common/key-management/process-reload";
import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { StateEventRunnerService } from "@bitwarden/common/platform/state";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { InternalFolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { BiometricStateService, KeyService } from "@bitwarden/key-management";
import { LogService } from "@bitwarden/logging";

/**
 * Web implementation of {@link LogoutService}. Clears the user's data, navigates to the root
 * route, and reloads the page to wipe secrets held in memory. Web holds one account at a time,
 * so a logout never switches to another account.
 */
export class WebLogoutService implements LogoutService {
  private readonly _loggingOut = signal(false);

  /**
   * True from the start of a logout until the page reloads. The reload resets it.
   */
  readonly loggingOut: Signal<boolean> = this._loggingOut.asReadonly();

  constructor(
    private readonly logService: LogService,
    private readonly eventUploadService: EventUploadService,
    private readonly authService: AuthService,
    private readonly keyService: KeyService,
    private readonly cipherService: CipherService,
    private readonly folderService: InternalFolderService,
    private readonly biometricStateService: BiometricStateService,
    private readonly stateEventRunnerService: StateEventRunnerService,
    private readonly stateService: StateService,
    private readonly tokenService: TokenService,
    private readonly accountService: AccountService,
    private readonly router: Router,
    private readonly processReloadService: ProcessReloadServiceAbstraction,
    private readonly sdkService: SdkService,
  ) {}

  async logout(userId: UserId, logoutReason: LogoutReason): Promise<NewActiveUser | undefined> {
    this.logService.info("Logging out user %s for reason: %s", userId, logoutReason);

    // Dispose the SDK client before clearing the user's keys and state, so nothing that
    // reacts to the logout can still use it.
    this.sdkService.logout(userId);

    // The reason is not shown to the user, because the page reload clears any toast before
    // it can be read.
    this._loggingOut.set(true);

    await this.eventUploadService.uploadEvents(userId);

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
      this.keyService.clearKeys(userId),
      this.cipherService.clear(userId),
      this.folderService.clear(userId),
      this.biometricStateService.logout(userId),
    ]);

    await this.stateEventRunnerService.handleEvent("logout", userId);

    this.authService.logOut(async () => {
      await this.stateService.clean({ userId: userId });
      await this.tokenService.clearTokens(userId);
      await this.accountService.clean(userId);
      await this.accountService.switchAccount(null);

      await logoutPromise;

      await this.router.navigate(["/"]);

      // Wipe the current process to clear active secrets in memory.
      await this.processReloadService.reloadProcess();
    }, userId);

    return undefined;
  }
}
