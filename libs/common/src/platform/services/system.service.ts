import { firstValueFrom, map, Subscription, timeout } from "rxjs";

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
import { StateService } from "../abstractions/state.service";
import { SystemService as SystemServiceAbstraction } from "../abstractions/system.service";
import { BiometricStateService } from "../biometrics/biometric-state.service";
import { Utils } from "../misc/utils";
import { ScheduledTaskNames } from "../scheduling/scheduled-task-name.enum";
import { TaskSchedulerService } from "../scheduling/task-scheduler.service";

export class SystemService implements SystemServiceAbstraction {
  private reloadInterval: any = null;
  private clearClipboardTimeoutSubscription: Subscription;
  private clearClipboardTimeoutFunction: () => Promise<any> = null;

  constructor(
    private pinService: PinServiceAbstraction,
    private messagingService: MessagingService,
    private platformUtilsService: PlatformUtilsService,
    private reloadCallback: () => Promise<void> = null,
    private stateService: StateService,
    private autofillSettingsService: AutofillSettingsServiceAbstraction,
    private vaultTimeoutSettingsService: VaultTimeoutSettingsService,
    private biometricStateService: BiometricStateService,
    private accountService: AccountService,
    private taskSchedulerService: TaskSchedulerService,
  ) {
    this.taskSchedulerService.registerTaskHandler(
      ScheduledTaskNames.systemClearClipboardTimeout,
      () => this.clearPendingClipboard(),
    );
  }

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
          // Can be removed once we migrate password generation history to state providers
          await this.stateService.clearDecryptedData(activeUserId);
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
    this.clearClipboardTimeoutSubscription?.unsubscribe();

    if (Utils.isNullOrWhitespace(clipboardValue)) {
      return;
    }

    let taskTimeoutInMs = timeoutMs;
    if (!taskTimeoutInMs) {
      const clearClipboardDelayInSeconds = await firstValueFrom(
        this.autofillSettingsService.clearClipboardDelay$,
      );
      taskTimeoutInMs = clearClipboardDelayInSeconds ? clearClipboardDelayInSeconds * 1000 : null;
    }

    if (!taskTimeoutInMs) {
      return;
    }

    this.clearClipboardTimeoutFunction = async () => {
      const clipboardValueNow = await this.platformUtilsService.readFromClipboard();
      if (clipboardValue === clipboardValueNow) {
        this.platformUtilsService.copyToClipboard("", { clearing: true });
      }
    };

    this.clearClipboardTimeoutSubscription = this.taskSchedulerService.setTimeout(
      ScheduledTaskNames.systemClearClipboardTimeout,
      taskTimeoutInMs,
    );
  }

  async clearPendingClipboard() {
    if (this.clearClipboardTimeoutFunction != null) {
      await this.clearClipboardTimeoutFunction();
      this.clearClipboardTimeoutFunction = null;
    }
  }
}
