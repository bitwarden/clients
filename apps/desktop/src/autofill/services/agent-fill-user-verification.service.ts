import { inject, Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { UserDecryptionOptionsServiceAbstraction } from "@bitwarden/auth/common";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { VerificationType } from "@bitwarden/common/auth/enums/verification-type";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { BiometricsStatus } from "@bitwarden/key-management";

import { DesktopBiometricsService } from "../../key-management/biometrics/desktop.biometrics.service";

export const AgentFillVerificationResult = Object.freeze({
  /** The user proved who they are. */
  Verified: "verified",
  /** Touch ID did not pass or is unavailable; ask for the master password and call again. */
  NeedsMasterPassword: "needs_master_password",
  /** The attempt did not pass: Touch ID was cancelled or failed with no password to fall back to, or the master password was wrong. */
  Failed: "failed",
  /** Neither Touch ID nor a master password can verify this account. */
  Unavailable: "unavailable",
} as const);
export type AgentFillVerificationResult =
  (typeof AgentFillVerificationResult)[keyof typeof AgentFillVerificationResult];

/**
 * Fresh user verification for agent fill: Touch ID, falling back to the master password. Nothing is
 * remembered between calls, so each approval and each new connection verifies the user again.
 *
 * `PasswordRepromptService.showPasswordPrompt()` is deliberately not used: it reports success when
 * re-prompt is unavailable, which would let an approval through without any verification.
 */
@Injectable({ providedIn: "root" })
export class AgentFillUserVerificationService {
  private readonly biometricsService = inject(DesktopBiometricsService);
  private readonly userVerificationService = inject(UserVerificationService);
  private readonly userDecryptionOptionsService = inject(UserDecryptionOptionsServiceAbstraction);
  private readonly accountService = inject(AccountService);
  private readonly logService = inject(LogService);

  /**
   * Verifies the active user. Without a master password it tries Touch ID; with one it checks that
   * password. Never throws.
   */
  async verify(masterPassword?: string): Promise<AgentFillVerificationResult> {
    try {
      if (masterPassword != null) {
        return (await this.verifyMasterPassword(masterPassword))
          ? AgentFillVerificationResult.Verified
          : AgentFillVerificationResult.Failed;
      }

      const biometricsAvailable = await this.biometricsAvailable();
      if (biometricsAvailable && (await this.biometricsService.authenticateWithBiometrics())) {
        return AgentFillVerificationResult.Verified;
      }

      if (await this.hasMasterPassword()) {
        return AgentFillVerificationResult.NeedsMasterPassword;
      }
      return biometricsAvailable
        ? AgentFillVerificationResult.Failed
        : AgentFillVerificationResult.Unavailable;
    } catch (e) {
      this.logService.error("[AgentFill] User verification failed", e);
      return AgentFillVerificationResult.Failed;
    }
  }

  private async biometricsAvailable(): Promise<boolean> {
    try {
      return (await this.biometricsService.getBiometricsStatus()) === BiometricsStatus.Available;
    } catch {
      return false;
    }
  }

  private async hasMasterPassword(): Promise<boolean> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    return await firstValueFrom(this.userDecryptionOptionsService.hasMasterPasswordById$(userId));
  }

  private async verifyMasterPassword(masterPassword: string): Promise<boolean> {
    if (masterPassword.length === 0) {
      return false;
    }
    try {
      // Throws when the master password is wrong.
      return await this.userVerificationService.verifyUser({
        type: VerificationType.MasterPassword,
        secret: masterPassword,
      });
    } catch {
      return false;
    }
  }
}
