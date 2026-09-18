import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import {
  PIN_PROTECTED_USER_KEY_ENVELOPE_EPHEMERAL,
  USER_KEY,
} from "@bitwarden/common/key-management/state-definitions";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { StateProvider } from "@bitwarden/common/platform/state";
import { BiometricsService } from "@bitwarden/key-management";

import { AutomationCapability } from "../automation-capability";

/**
 * Puts the client into after-first-unlock (AFU) state without restarting it, so tests can exercise
 * the "require master password on restart" behaviour.
 *
 * An app restart drops everything that only ever lived in memory. This drops the same three
 * things:
 *
 *   ephemeral PIN envelope  — PIN enrolled with "lock with master password on restart"
 *   ephemeral biometric key — biometric unlock key that was never written to the OS keychain
 *   user key                — what keeps the vault unlocked
 *
 * Persistent unlock material (a `BeforeFirstUnlock` PIN envelope, a persistent biometric key) is
 * left alone, exactly as a restart would.
 */
export class AfuModeCapability extends AutomationCapability {
  readonly automationName = "afuMode";

  constructor(
    private accountService: AccountService,
    private stateProvider: StateProvider,
    private biometricsService: BiometricsService,
    private messagingService: MessagingService,
  ) {
    super();
  }

  /** Drops the active user's in-memory unlock material, as a restart does. */
  async enter(): Promise<void> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));

    await this.stateProvider
      .getUser(userId, PIN_PROTECTED_USER_KEY_ENVELOPE_EPHEMERAL)
      .update(() => null);
    await this.biometricsService.deleteBiometricUnlockKeyForUser(userId);
    await this.stateProvider.getUser(userId, USER_KEY).update(() => null);

    // Dropping the user key does not move the UI; a restart lands on the lock screen.
    this.messagingService.send("locked", { userId });
  }
}
