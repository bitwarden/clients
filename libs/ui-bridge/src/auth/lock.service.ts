import { inject, Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { LockService } from "@bitwarden/auth/common";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { DeviceTrustServiceAbstraction } from "@bitwarden/common/key-management/device-trust/abstractions/device-trust.service.abstraction";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import {
  BiometricsService,
  BiometricsStatus,
  BiometricStateService,
  KeyService,
} from "@bitwarden/key-management";
import { UnlockService } from "@bitwarden/unlock";

/**
 * Bridge for lock/unlock of the active account. All crypto/auth work is
 * delegated to the existing core services — this is plumbing only, so the
 * redesigned UI (and the Quick Access spotlight) can lock and biometric-unlock
 * the vault without importing core directly.
 */
@Injectable({ providedIn: "root" })
export class LockBridgeService {
  private readonly lockService = inject(LockService);
  private readonly accountService = inject(AccountService);
  private readonly authService = inject(AuthService);
  private readonly biometricsService = inject(BiometricsService);
  private readonly biometricStateService = inject(BiometricStateService);
  private readonly unlockService = inject(UnlockService);
  private readonly keyService = inject(KeyService);
  private readonly deviceTrustService = inject(DeviceTrustServiceAbstraction);
  private readonly messagingService = inject(MessagingService);
  private readonly logService = inject(LogService);

  private readonly activeUserId$ = this.accountService.activeAccount$.pipe(getUserId);

  async lock(): Promise<void> {
    const userId = await firstValueFrom(this.activeUserId$);
    await this.lockService.lock(userId);
  }

  /** True when there is an active account whose vault is currently locked. */
  async isLocked(): Promise<boolean> {
    const status = await firstValueFrom(this.authService.activeAccountStatus$);
    return status === AuthenticationStatus.Locked;
  }

  /**
   * Whether the active account can be unlocked with biometrics right now
   * (biometric unlock is enabled for the user and the platform reports it
   * available).
   */
  async canUnlockWithBiometrics(): Promise<boolean> {
    const userId = await firstValueFrom(this.activeUserId$);
    if (userId == null) {
      return false;
    }
    const enabled = await firstValueFrom(
      this.biometricStateService.biometricUnlockEnabled$(userId),
    );
    if (!enabled) {
      return false;
    }
    const status = await this.biometricsService.getBiometricsStatusForUser(userId);
    return status === BiometricsStatus.Available;
  }

  /**
   * Unlock the active account using its biometrics-protected key (triggers the
   * OS prompt, e.g. Windows Hello). Mirrors the lock screen's proven sequence:
   * unlock → read the freshly decrypted user key → set it → establish device
   * trust if required → notify the app. Returns true on success, false if the
   * user cancelled or no key was produced.
   */
  async unlockWithBiometrics(): Promise<boolean> {
    const userId = await firstValueFrom(this.activeUserId$);
    if (userId == null) {
      return false;
    }

    try {
      // Prevent the lock screen's auto-prompt from racing this one.
      await this.biometricStateService.setUserPromptCancelled();

      await this.unlockService.unlockWithBiometrics(userId);
      const userKey = await firstValueFrom(this.keyService.userKey$(userId));

      // userKey is falsy when the user cancelled the biometric prompt.
      if (userKey == null) {
        return false;
      }

      await this.keyService.setUserKey(userKey, userId);
      await this.deviceTrustService.trustDeviceIfRequired(userId);
      await this.biometricStateService.resetUserPromptCancelled();
      this.messagingService.send("unlocked");
      return true;
    } catch (e) {
      // Cancelling the OS prompt is a normal outcome, not an error.
      if (e instanceof Error && e.message === "canceled") {
        return false;
      }
      this.logService.error("[QuickAccess] Failed to unlock via biometrics.", e);
      return false;
    }
  }
}
