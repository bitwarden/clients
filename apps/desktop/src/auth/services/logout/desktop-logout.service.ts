import { Signal, signal } from "@angular/core";
import { Router } from "@angular/router";
import { filter, firstValueFrom, map, timeout } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { TokenService } from "@bitwarden/common/auth/abstractions/token.service";
import { AccountSwitcherService } from "@bitwarden/common/auth/account-switcher";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { LogoutReason, LogoutService, NewActiveUser } from "@bitwarden/common/auth/logout";
import { EventUploadService } from "@bitwarden/common/dirt/event-logs";
import { PinServiceAbstraction } from "@bitwarden/common/key-management/pin/pin.service.abstraction";
import { ProcessReloadServiceAbstraction } from "@bitwarden/common/key-management/process-reload";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { StateEventRunnerService } from "@bitwarden/common/platform/state";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { InternalFolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { DialogRef, DialogService, ToastOptions, ToastService } from "@bitwarden/components";
import { BiometricStateService, KeyService } from "@bitwarden/key-management";
import { LogService } from "@bitwarden/logging";

/**
 * Desktop implementation of {@link LogoutService}. Tells the user why they were logged out,
 * clears the user's data, switches to the next account (or to the login page when no account
 * is left), and reloads the renderer process to wipe secrets held in memory.
 */
export class DesktopLogoutService implements LogoutService {
  private readonly usersLoggingOut = new Set<UserId>();
  private readonly _activeUserLoggingOut = signal(false);
  private activeSimpleDialog: DialogRef<boolean> | null = null;

  /**
   * True while a logout of the active user runs.
   */
  readonly activeUserLoggingOut: Signal<boolean> = this._activeUserLoggingOut.asReadonly();

  constructor(
    private readonly logService: LogService,
    private readonly i18nService: I18nService,
    private readonly toastService: ToastService,
    private readonly dialogService: DialogService,
    private readonly accountService: AccountService,
    private readonly accountSwitcherService: AccountSwitcherService,
    private readonly authService: AuthService,
    private readonly eventUploadService: EventUploadService,
    private readonly cipherService: CipherService,
    private readonly folderService: InternalFolderService,
    private readonly biometricStateService: BiometricStateService,
    private readonly pinService: PinServiceAbstraction,
    private readonly keyService: KeyService,
    private readonly stateEventRunnerService: StateEventRunnerService,
    private readonly stateService: StateService,
    private readonly tokenService: TokenService,
    private readonly messagingService: MessagingService,
    private readonly router: Router,
    private readonly processReloadService: ProcessReloadServiceAbstraction,
    private readonly sdkService: SdkService,
  ) {}

  /**
   * True while the user's data is being cleared. The app menu skips these accounts, so that
   * it does not show an account that is about to be removed.
   */
  isLoggingOut(userId: UserId): boolean {
    return this.usersLoggingOut.has(userId);
  }

  async logout(userId: UserId, logoutReason: LogoutReason): Promise<NewActiveUser | undefined> {
    this.logService.info("Logging out user %s for reason: %s", userId, logoutReason);

    // Dispose the SDK client before clearing the user's keys and state, so nothing that
    // reacts to the logout can still use it.
    this.sdkService.logout(userId);

    const activeUserId = await firstValueFrom(
      this.accountService.activeAccount$.pipe(map((a) => a?.id)),
    );
    const isActiveUser = userId === activeUserId;

    if (isActiveUser) {
      this._activeUserLoggingOut.set(true);
    }

    try {
      await this.clearUserAndSwitchAccount(userId, logoutReason, isActiveUser);
    } finally {
      if (isActiveUser) {
        this._activeUserLoggingOut.set(false);
      }
    }

    return undefined;
  }

  private async clearUserAndSwitchAccount(
    userId: UserId,
    logoutReason: LogoutReason,
    isActiveUser: boolean,
  ): Promise<void> {
    await this.displayLogoutReason(logoutReason);

    this.usersLoggingOut.add(userId);

    const nextUpAccount = isActiveUser
      ? await firstValueFrom(this.accountSwitcherService.nextSwitchableAccount$)
      : null;

    try {
      // HACK: We shouldn't wait for authentication status to change here but instead subscribe to the
      // authentication status to do various actions.
      const logoutPromise = firstValueFrom(
        this.authService.authStatusFor$(userId).pipe(
          filter((authenticationStatus) => authenticationStatus === AuthenticationStatus.LoggedOut),
          timeout({
            first: 5_000,
            with: () => {
              throw new Error(
                "The logout process did not complete in a reasonable amount of time.",
              );
            },
          }),
        ),
      );

      await this.eventUploadService.uploadEvents(userId);

      await this.cipherService.clear(userId);
      await this.folderService.clear(userId);
      await this.biometricStateService.logout(userId);
      await this.pinService.logout(userId);

      await this.keyService.clearKeys(userId);

      await this.stateEventRunnerService.handleEvent("logout", userId);

      await this.stateService.clean({ userId: userId });
      await this.tokenService.clearTokens(userId);
      await this.accountService.clean(userId);

      // HACK: Wait for the user logging outs authentication status to transition to LoggedOut
      await logoutPromise;
    } finally {
      this.usersLoggingOut.delete(userId);
    }

    // The display changes only when the active account logs out. A background account
    // needs no change.
    if (isActiveUser) {
      if (nextUpAccount != null) {
        this.messagingService.send("switchAccount", { userId: nextUpAccount.id });
      } else {
        // No other account is available, so bring the user to the login page.
        await this.accountService.switchAccount(null);
        void this.router.navigate(["login"]);
      }
    }

    // This must come last otherwise the logout will prematurely trigger
    // a process reload before all the state service user data can be cleaned up
    this.authService.logOut(async () => {
      // Wipe the current process to clear active secrets in memory.
      await this.processReloadService.reloadProcess();
    }, userId);
  }

  private async displayLogoutReason(logoutReason: LogoutReason) {
    let toastOptions: ToastOptions | undefined;

    switch (logoutReason) {
      case "invalidSecurityStamp":
      case "sessionExpired": {
        toastOptions = {
          variant: "warning",
          title: this.i18nService.t("loggedOut"),
          message: this.i18nService.t("loginExpired"),
        };
        break;
      }
      // We don't expect these scenarios to be common, but we want the user to
      // understand why they are being logged out before a process reload.
      case "accessTokenUnableToBeDecrypted":
      case "refreshTokenSecureStorageRetrievalFailure": {
        // Don't create multiple dialogs if this fires multiple times
        if (this.activeSimpleDialog) {
          // Let the caller of this function listen for the dialog to close
          return firstValueFrom(this.activeSimpleDialog.closed);
        }

        this.activeSimpleDialog = this.dialogService.openSimpleDialogRef({
          title: { key: "loggedOut" },
          content: { key: logoutReason },
          acceptButtonText: { key: "ok" },
          cancelButtonText: null,
          type: "danger",
        });

        await firstValueFrom(this.activeSimpleDialog.closed);
        this.activeSimpleDialog = null;

        break;
      }
    }

    if (toastOptions) {
      this.toastService.showToast(toastOptions);
    }
  }
}
