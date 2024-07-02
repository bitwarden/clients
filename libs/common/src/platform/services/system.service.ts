import { firstValueFrom, map, timeout } from "rxjs";

import { PinServiceAbstraction } from "../../../../auth/src/common/abstractions";
import { VaultTimeoutSettingsService } from "../../abstractions/vault-timeout/vault-timeout-settings.service";
import { AccountService } from "../../auth/abstractions/account.service";
import { AuthService } from "../../auth/abstractions/auth.service";
import { AuthenticationStatus } from "../../auth/enums/authentication-status";
import { AutofillSettingsServiceAbstraction } from "../../autofill/services/autofill-settings.service";
import { VaultTimeoutAction } from "../../enums/vault-timeout-action.enum";
import { UserId } from "../../types/guid";
import { MessagingService } from "../abstractions/messaging.service";
import { PlatformUtilsService } from "../abstractions/platform-utils.service";
import { SystemService as SystemServiceAbstraction } from "../abstractions/system.service";
import { BiometricStateService } from "../biometrics/biometric-state.service";
import { Utils } from "../misc/utils";

export class SystemService implements SystemServiceAbstraction {
  private reloadInterval: any = null;
  private clearClipboardTimeout: any = null;
  private clearClipboardTimeoutFunction: () => Promise<any> = null;

  constructor(
    private pinService: PinServiceAbstraction,
    private messagingService: MessagingService,
    private platformUtilsService: PlatformUtilsService,
    private reloadCallback: () => Promise<void> = null,
    private autofillSettingsService: AutofillSettingsServiceAbstraction,
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

  async clearClipboard(clipboardValue: string, timeoutMs: number = null): Promise<void> {
    if (this.clearClipboardTimeout != null) {
      clearTimeout(this.clearClipboardTimeout);
      this.clearClipboardTimeout = null;
    }

    if (Utils.isNullOrWhitespace(clipboardValue)) {
      return;
    }

    const clearClipboardDelay = await firstValueFrom(
      this.autofillSettingsService.clearClipboardDelay$,
    );

    if (clearClipboardDelay == null) {
      return;
    }

    if (timeoutMs == null) {
      timeoutMs = clearClipboardDelay * 1000;
    }

    this.clearClipboardTimeoutFunction = async () => {
      const clipboardValueNow = await this.platformUtilsService.readFromClipboard();
      if (clipboardValue === clipboardValueNow) {
        this.platformUtilsService.copyToClipboard("", { clearing: true });
      }
    };

    this.clearClipboardTimeout = setTimeout(async () => {
      await this.clearPendingClipboard();
    }, timeoutMs);
  }

  async clearPendingClipboard() {
    if (this.clearClipboardTimeoutFunction != null) {
      await this.clearClipboardTimeoutFunction();
      this.clearClipboardTimeoutFunction = null;
    }
  }
}
