import { firstValueFrom } from "rxjs";

import { AuthService } from "../../auth/abstractions/auth.service";
import { AuthenticationStatus } from "../../auth/enums/authentication-status";
import { MessagingService } from "../abstractions/messaging.service";
import { PlatformUtilsService } from "../abstractions/platform-utils.service";
import { StateService } from "../abstractions/state.service";
import { SystemService as SystemServiceAbstraction } from "../abstractions/system.service";
import { Utils } from "../misc/utils";

export class SystemService implements SystemServiceAbstraction {
  private reloadInterval: any = null;
  private clearClipboardTimeout: any = null;
  private clearClipboardTimeoutFunction: () => Promise<any> = null;

  constructor(
    private messagingService: MessagingService,
    private platformUtilsService: PlatformUtilsService,
    private reloadCallback: () => Promise<void> = null,
    private stateService: StateService
  ) {}

  async startProcessReload(authService: AuthService): Promise<void> {
    const accounts = await firstValueFrom(this.stateService.accounts$);
    if (accounts != null) {
      const keys = Object.keys(accounts);
      if (keys.length > 0) {
        for (const userId of keys) {
          if ((await authService.getAuthStatus(userId)) === AuthenticationStatus.Unlocked) {
            return;
          }
        }
      }
    }

    // A reloadInterval has already been set and is executing
    if (this.reloadInterval != null) {
      return;
    }

    // User has set a PIN, with ask for master password on restart, to protect their vault
    const ephemeralPin = await this.stateService.getPinKeyEncryptedUserKeyEphemeral();
    if (ephemeralPin != null) {
      return;
    }

    this.cancelProcessReload();
    await this.executeProcessReload();
  }

  private async executeProcessReload() {
    const biometricLockedFingerprintValidated =
      await this.stateService.getBiometricFingerprintValidated();
    if (!biometricLockedFingerprintValidated) {
      clearInterval(this.reloadInterval);
      this.reloadInterval = null;
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
    await this.stateService.getClearClipboard().then((clearSeconds) => {
      if (clearSeconds == null) {
        return;
      }
      if (timeoutMs == null) {
        timeoutMs = clearSeconds * 1000;
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
    });
  }

  async clearPendingClipboard() {
    if (this.clearClipboardTimeoutFunction != null) {
      await this.clearClipboardTimeoutFunction();
      this.clearClipboardTimeoutFunction = null;
    }
  }
}
