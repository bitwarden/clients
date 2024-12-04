import { firstValueFrom, map, timeout } from "rxjs";

import { PinServiceAbstraction } from "@bitwarden/auth/common";
import { ClientType } from "@bitwarden/common/enums";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { BiometricStateService } from "@bitwarden/key-management";

import { VaultTimeoutSettingsService } from "../../abstractions/vault-timeout/vault-timeout-settings.service";
import { AccountService } from "../../auth/abstractions/account.service";
import { AuthService } from "../../auth/abstractions/auth.service";
import { AuthenticationStatus } from "../../auth/enums/authentication-status";
import { VaultTimeoutAction } from "../../enums/vault-timeout-action.enum";
import { UserId } from "../../types/guid";
import { ProcessReloadServiceAbstraction } from "../abstractions/process-reload.service";

export class DefaultProcessReloadService implements ProcessReloadServiceAbstraction {
  private reloadInterval: any = null;

  constructor(
    private messagingService: MessagingService,
    private reloadCallback: () => Promise<void> = null,
    private vaultTimeoutSettingsService: VaultTimeoutSettingsService,
    private biometricStateService: BiometricStateService,
    private accountService: AccountService,
    private logService: LogService,
    private platformUtilsService: PlatformUtilsService,
    private pinService: PinServiceAbstraction,
  ) {}

  async startProcessReload(authService: AuthService): Promise<void> {
    this.logService.info("[ProcessReloadService] Starting process reload");
    const accounts = await firstValueFrom(this.accountService.accounts$);
    if (accounts != null) {
      const keys = Object.keys(accounts);
      if (keys.length > 0) {
        for (const userId of keys) {
          let status = await firstValueFrom(authService.authStatusFor$(userId as UserId));
          status = await authService.getAuthStatus(userId);
          if (status === AuthenticationStatus.Unlocked) {
            this.logService.info(
              `[ProcessReloadService] User ${userId} is unlocked, skipping process reload`,
            );
            return;
          }
        }
      }
    }

    // A reloadInterval has already been set and is executing
    if (this.reloadInterval != null) {
      this.logService.info(`[ProcessReloadService] Process reload already in progress`);
      return;
    }

    if (this.platformUtilsService.getClientType() !== ClientType.Desktop) {
      // If there is an active user, check if they have a pinKeyEncryptedUserKeyEphemeral. If so, prevent process reload upon lock.
      const userId = (await firstValueFrom(this.accountService.activeAccount$))?.id;
      if (userId != null) {
        const ephemeralPin = await this.pinService.getPinKeyEncryptedUserKeyEphemeral(userId);
        if (ephemeralPin != null) {
          this.logService.info(
            `[ProcessReloadService] User ${userId} has ephemeral pin, skipping process reload`,
          );
          return;
        }
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

      this.logService.info("[ProcessReloadService] Sending message to os reload implementation");
      this.messagingService.send("reloadProcess");
      if (this.reloadCallback != null) {
        await this.reloadCallback();
      }
      return;
    }
    if (this.reloadInterval == null) {
      this.logService.info("[ProcessReloadService] Setting reload interval");
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
