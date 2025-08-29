// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { firstValueFrom, map, timeout } from "rxjs";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { BiometricStateService } from "@bitwarden/key-management";

import { AccountService } from "../../auth/abstractions/account.service";
import { AuthService } from "../../auth/abstractions/auth.service";
import { AuthenticationStatus } from "../../auth/enums/authentication-status";
import {
  VaultTimeoutAction,
  VaultTimeoutSettingsService,
} from "../../key-management/vault-timeout";
import { LogService } from "../../platform/abstractions/log.service";
import { MessagingService } from "../../platform/abstractions/messaging.service";
import { UserId } from "../../types/guid";
import { ProcessReloadServiceAbstraction } from "../abstractions/process-reload.service";
import { PinServiceAbstraction } from "../pin/pin.service.abstraction";

export class DefaultProcessReloadService implements ProcessReloadServiceAbstraction {
  private reloadInterval: any = null;

  constructor(
    private pinService: PinServiceAbstraction,
    private messagingService: MessagingService,
    private reloadCallback: () => Promise<void> = null,
    private vaultTimeoutSettingsService: VaultTimeoutSettingsService,
    private biometricStateService: BiometricStateService,
    private accountService: AccountService,
    private logService: LogService,
  ) { }

  async startProcessReload(authService: AuthService): Promise<void> {
    const accounts = await firstValueFrom(this.accountService.accounts$);
    if (accounts != null) {
      const keys = Object.keys(accounts);
      if (keys.length > 0) {
        for (const userId of keys) {
          let status = await firstValueFrom(authService.authStatusFor$(userId as UserId));
          status = await authService.getAuthStatus(userId);
          if (status === AuthenticationStatus.Unlocked) {
            this.logService.info(
              "[Process Reload Service] User unlocked, preventing process reload",
            );
            return;
          }
        }
      }
    }

    // A reloadInterval has already been set and is executing
    if (this.reloadInterval != null) {
      return;
    }

    // If there is an active user, check if they have a pinKeyEncryptedUserKeyEphemeral. If so, prevent process reload upon lock.
    const userId = (await firstValueFrom(this.accountService.activeAccount$))?.id;
    if (userId != null) {
      if ((await this.pinService.getPinLockType(userId)) === "EPHEMERAL") {
        this.logService.info(
          "[Process Reload Service] Ephemeral pin active, preventing process reload",
        );
        return;
      }
    }

    this.cancelProcessReload();
    await this.executeProcessReload();
  }

  private async executeProcessReload() {
    const biometricLockedFingerprintValidated = await firstValueFrom(
      this.biometricStateService.fingerprintValidated$,
    );
    if (!biometricLockedFingerprintValidated) {
      clearInterval(this.reloadInterval);
      this.reloadInterval = null;

      const activeUserId = await firstValueFrom(
        this.accountService.activeAccount$.pipe(
          map((a) => a?.id),
          timeout(500),
        ),
      );
      // Replace current active user if they will be logged out on reload
      if (activeUserId != null) {
        const timeoutAction = await firstValueFrom(
          this.vaultTimeoutSettingsService
            .getVaultTimeoutActionByUserId$(activeUserId)
            .pipe(timeout(500)), // safety feature to avoid this call hanging and stopping process reload from clearing memory
        );
        if (timeoutAction === VaultTimeoutAction.LogOut) {
          const nextUser = await firstValueFrom(
            this.accountService.nextUpAccount$.pipe(map((account) => account?.id ?? null)),
          );
          await this.accountService.switchAccount(nextUser);
        }
      }

      this.messagingService.send("reloadProcess");
      if (this.reloadCallback != null) {
        await this.reloadCallback();
      }
      return;
    } else {
      this.logService.info(
        "[Process Reload Service] Desktop ipc fingerprint validated, preventing process reload",
      );
    }

    if (this.reloadInterval == null) {
      this.reloadInterval = setInterval(async () => await this.executeProcessReload(), 1000);
    }
  }

  cancelProcessReload(): void {
    if (this.reloadInterval != null) {
      clearInterval(this.reloadInterval);
      this.reloadInterval = null;
    }
  }
}
