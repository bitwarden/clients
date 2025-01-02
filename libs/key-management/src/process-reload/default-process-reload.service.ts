// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { firstValueFrom, map, timeout } from "rxjs";

import { VaultTimeoutSettingsService } from "@bitwarden/common/abstractions/vault-timeout/vault-timeout-settings.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { VaultTimeoutAction } from "@bitwarden/common/enums/vault-timeout-action.enum";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { UserId } from "@bitwarden/common/types/guid";

import { BiometricStateService } from "..";
import { PinServiceAbstraction } from "../../../auth/src/common/abstractions";

import { ProcessReloadServiceAbstraction } from "./process-reload.service";

export class DefaultProcessReloadService implements ProcessReloadServiceAbstraction {
  private reloadInterval: any = null;

  constructor(
    private pinService: PinServiceAbstraction,
    private messagingService: MessagingService,
    private reloadCallback: () => Promise<void> = null,
    private vaultTimeoutSettingsService: VaultTimeoutSettingsService,
    private biometricStateService: BiometricStateService,
    private accountService: AccountService,
  ) {}

  async startProcessReload(authService: AuthService): Promise<void> {
    const accounts = await firstValueFrom(this.accountService.accounts$);
    if (accounts != null) {
      const keys = Object.keys(accounts);
      if (keys.length > 0) {
        for (const userId of keys) {
          let status = await firstValueFrom(authService.authStatusFor$(userId as UserId));
          status = await authService.getAuthStatus(userId);
          if (status === AuthenticationStatus.Unlocked) {
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
      const ephemeralPin = await this.pinService.getPinKeyEncryptedUserKeyEphemeral(userId);
      if (ephemeralPin != null) {
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
