import { Observable, firstValueFrom, map } from "rxjs";

import { assertNonNullish } from "@bitwarden/common/auth/utils";
import {
  EncryptedString,
  EncString,
} from "@bitwarden/common/key-management/crypto/models/enc-string";
import { GlobalState, StateProvider } from "@bitwarden/common/platform/state";
import { UserId } from "@bitwarden/common/types/guid";

import {
  BIOMETRIC_UNLOCK_ENABLED,
  BIOMETRIC_ENROLLED_KEY_ID,
  ENCRYPTED_CLIENT_KEY_HALF,
  PROMPT_AUTOMATICALLY,
  PROMPT_CANCELLED,
  FINGERPRINT_VALIDATED,
  LAST_PROCESS_RELOAD,
} from "./biometric.state";

export abstract class BiometricStateService {
  /**
   * Returns whether biometric unlock is enabled for a user.
   * @param userId The user id to check.
   * @returns An observable that emits `true` if the user has elected to store a biometric key to unlock their vault.
   */
  abstract biometricUnlockEnabled$(userId: UserId): Observable<boolean>;
  /**
   * If the user has elected to require a password on first unlock of an application instance, this key will store the
   * encrypted client key half used to unlock the vault.
   * @param userId The user id to check.
   */
  abstract encryptedClientKeyHalf$(userId: UserId): Observable<EncString | null>;
  /**
   * Whether the user has cancelled the biometric prompt.
   * @param userId The user id to check.
   */
  abstract promptCancelled$(userId: UserId): Observable<boolean>;
  /**
   * Whether the user has elected to automatically prompt for biometrics.
   * @param userId The user id to check.
   */
  abstract promptAutomatically$(userId: UserId): Observable<boolean>;
  /**
   * Whether or not IPC fingerprint has been validated by the user this session.
   */
  abstract fingerprintValidated$: Observable<boolean>;

  /**
   * Updates the biometric unlock enabled state for the given user.
   * @param enabled whether or not to store a biometric key to unlock the vault
   * @param userId the user to update
   */
  abstract setBiometricUnlockEnabled(enabled: boolean, userId: UserId): Promise<void>;

  /**
   * Gets the biometric unlock enabled state for the given user.
   * @deprecated Use {@link biometricUnlockEnabled$} instead
   * @param userId user Id to check
   */
  abstract getBiometricUnlockEnabled(userId: UserId): Promise<boolean>;

  abstract setEncryptedClientKeyHalf(encryptedKeyHalf: EncString, userId: UserId): Promise<void>;

  abstract getEncryptedClientKeyHalf(userId: UserId): Promise<EncString | null>;

  /**
   * Updates the given user's state to reflect that they've cancelled the biometric prompt.
   * @param userId the user to update
   */
  abstract setUserPromptCancelled(userId: UserId): Promise<void>;

  /**
   * Resets the given user's state to reflect that they haven't cancelled the biometric prompt.
   * @param userId the user to reset the prompt cancelled state for.
   */
  abstract resetUserPromptCancelled(userId: UserId): Promise<void>;

  /**
   * Resets all user's state to reflect that they haven't cancelled the biometric prompt.
   */
  abstract resetAllPromptCancelled(): Promise<void>;

  /**
   * Updates the given user's setting for auto prompting for biometrics on application start and lock
   * @param prompt Whether or not to prompt for biometrics on application start.
   * @param userId the user to update
   */
  abstract setPromptAutomatically(prompt: boolean, userId: UserId): Promise<void>;

  /**
   * Updates whether or not IPC has been validated by the user this session
   * @param validated the value to save
   */
  abstract setFingerprintValidated(validated: boolean): Promise<void>;

  abstract updateLastProcessReload(): Promise<void>;

  abstract getLastProcessReload(): Promise<Date | null>;

  /**
   * Gets the key ID of the user key that was last enrolled in the biometric system.
   * @param userId the user to check
   * @returns the key ID as a base64 string, or null if not set
   */
  abstract getBiometricEnrolledKeyId(userId: UserId): Promise<string | null>;

  /**
   * Sets the key ID of the user key that was last enrolled in the biometric system.
   * @param userId the user to update
   * @param keyId the key ID as a base64 string, or null to clear
   */
  abstract setBiometricEnrolledKeyId(userId: UserId, keyId: string | null): Promise<void>;

  abstract logout(userId: UserId): Promise<void>;
}

export class DefaultBiometricStateService implements BiometricStateService {
  private promptCancelledState: GlobalState<Record<UserId, boolean>>;
  private fingerprintValidatedState: GlobalState<boolean>;
  private lastProcessReloadState: GlobalState<Date>;
  fingerprintValidated$: Observable<boolean>;
  private lastProcessReload$: Observable<Date | null>;

  constructor(private stateProvider: StateProvider) {
    this.promptCancelledState = this.stateProvider.getGlobal(PROMPT_CANCELLED);

    this.fingerprintValidatedState = this.stateProvider.getGlobal(FINGERPRINT_VALIDATED);
    this.fingerprintValidated$ = this.fingerprintValidatedState.state$.pipe(map(Boolean));

    this.lastProcessReloadState = this.stateProvider.getGlobal(LAST_PROCESS_RELOAD);
    this.lastProcessReload$ = this.lastProcessReloadState.state$;
  }

  async setBiometricUnlockEnabled(enabled: boolean, userId: UserId): Promise<void> {
    assertNonNullish(userId, "userId");
    await this.stateProvider.getUser(userId, BIOMETRIC_UNLOCK_ENABLED).update(() => enabled);
  }

  biometricUnlockEnabled$(userId: UserId): Observable<boolean> {
    assertNonNullish(userId, "userId");
    return this.stateProvider.getUser(userId, BIOMETRIC_UNLOCK_ENABLED).state$.pipe(map(Boolean));
  }

  async getBiometricUnlockEnabled(userId: UserId): Promise<boolean> {
    return await firstValueFrom(this.biometricUnlockEnabled$(userId));
  }

  async setEncryptedClientKeyHalf(encryptedKeyHalf: EncString, userId: UserId): Promise<void> {
    assertNonNullish(userId, "userId");
    const value = encryptedKeyHalf?.encryptedString ?? null;
    await this.stateProvider.getUser(userId, ENCRYPTED_CLIENT_KEY_HALF).update(() => value);
  }

  encryptedClientKeyHalf$(userId: UserId): Observable<EncString | null> {
    assertNonNullish(userId, "userId");
    return this.stateProvider
      .getUser(userId, ENCRYPTED_CLIENT_KEY_HALF)
      .state$.pipe(map(encryptedClientKeyHalfToEncString));
  }

  async getEncryptedClientKeyHalf(userId: UserId): Promise<EncString | null> {
    return await firstValueFrom(this.encryptedClientKeyHalf$(userId));
  }

  async getBiometricEnrolledKeyId(userId: UserId): Promise<string | null> {
    assertNonNullish(userId, "userId");
    return await firstValueFrom(
      this.stateProvider
        .getUser(userId, BIOMETRIC_ENROLLED_KEY_ID)
        .state$.pipe(map((val) => val ?? null)),
    );
  }

  async setBiometricEnrolledKeyId(userId: UserId, keyId: string | null): Promise<void> {
    assertNonNullish(userId, "userId");
    await this.stateProvider.getUser(userId, BIOMETRIC_ENROLLED_KEY_ID).update(() => keyId);
  }

  async logout(userId: UserId): Promise<void> {
    assertNonNullish(userId, "userId");
    await this.stateProvider.getUser(userId, ENCRYPTED_CLIENT_KEY_HALF).update(() => null);
    await this.resetUserPromptCancelled(userId);
  }

  promptCancelled$(userId: UserId): Observable<boolean> {
    assertNonNullish(userId, "userId");
    return this.promptCancelledState.state$.pipe(map((record) => record?.[userId] ?? false));
  }

  async resetUserPromptCancelled(userId: UserId): Promise<void> {
    assertNonNullish(userId, "userId");
    await this.promptCancelledState.update(
      (data) => {
        if (data != null) {
          delete data[userId];
        }
        return data;
      },
      {
        shouldUpdate: (data) => data?.[userId] != null,
      },
    );
  }

  async setUserPromptCancelled(userId: UserId): Promise<void> {
    assertNonNullish(userId, "userId");
    await this.promptCancelledState.update((record) => {
      record ??= {};
      record[userId] = true;
      return record;
    });
  }

  async resetAllPromptCancelled(): Promise<void> {
    await this.promptCancelledState.update(() => null);
  }

  promptAutomatically$(userId: UserId): Observable<boolean> {
    assertNonNullish(userId, "userId");
    return this.stateProvider.getUser(userId, PROMPT_AUTOMATICALLY).state$.pipe(map(Boolean));
  }

  async setPromptAutomatically(prompt: boolean, userId: UserId): Promise<void> {
    assertNonNullish(userId, "userId");
    await this.stateProvider.getUser(userId, PROMPT_AUTOMATICALLY).update(() => prompt);
  }

  async setFingerprintValidated(validated: boolean): Promise<void> {
    await this.fingerprintValidatedState.update(() => validated);
  }

  async updateLastProcessReload(): Promise<void> {
    await this.lastProcessReloadState.update(() => new Date());
  }

  async getLastProcessReload(): Promise<Date | null> {
    return await firstValueFrom(this.lastProcessReload$);
  }
}

function encryptedClientKeyHalfToEncString(
  encryptedKeyHalf: EncryptedString | null | undefined,
): EncString | null {
  return encryptedKeyHalf == null ? null : new EncString(encryptedKeyHalf);
}
