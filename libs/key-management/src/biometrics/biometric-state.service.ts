import { Observable, firstValueFrom, map, combineLatest } from "rxjs";

import { EncryptedString, EncString } from "@bitwarden/common/platform/models/domain/enc-string";
import { ActiveUserState, GlobalState, StateProvider } from "@bitwarden/common/platform/state";
import { UserId } from "@bitwarden/common/types/guid";

import {
  BIOMETRIC_UNLOCK_ENABLED,
  ENCRYPTED_CLIENT_KEY_HALF,
  REQUIRE_PASSWORD_ON_START,
  DISMISSED_REQUIRE_PASSWORD_ON_START_CALLOUT,
  PROMPT_AUTOMATICALLY,
  PROMPT_CANCELLED,
  FINGERPRINT_VALIDATED,
  LAST_PROCESS_RELOAD,
} from "./biometric.state";

export abstract class BiometricStateService {
  /**
   * `true` if the currently active user has elected to store a biometric key to unlock their vault.
   */
  abstract biometricUnlockEnabled$: Observable<boolean>; // used to be biometricUnlock
  /**
   * If the user has elected to require a password on first unlock of an application instance, this key will store the
   * encrypted client key half used to unlock the vault.
   *
   * Tracks the currently active user
   */
  abstract encryptedClientKeyHalf$: Observable<EncString | null>;
  /**
   * whether or not a password is required on first unlock after opening the application
   *
   * tracks the currently active user
   */
  abstract requirePasswordOnStart$: Observable<boolean>;
  /**
   * Indicates the user has been warned about the security implications of using biometrics and, depending on the OS,
   *
   * tracks the currently active user.
   */
  abstract dismissedRequirePasswordOnStartCallout$: Observable<boolean>;
  /**
   * Whether the user has cancelled the biometric prompt.
   *
   * tracks the currently active user
   */
  abstract promptCancelled$: Observable<boolean>;
  /**
   * Whether the user has elected to automatically prompt for biometrics.
   *
   * tracks the currently active user
   */
  abstract promptAutomatically$: Observable<boolean>;
  /**
   * Whether or not IPC fingerprint has been validated by the user this session.
   */
  abstract fingerprintValidated$: Observable<boolean>;

  /**
   * Updates the require password on start state for the currently active user.
   *
   * If false, the encrypted client key half will be removed.
   * @param value whether or not a password is required on first unlock after opening the application
   */
  abstract setRequirePasswordOnStart(value: boolean): Promise<void>;

  /**
   * Updates the biometric unlock enabled state for the currently active user.
   * @param enabled whether or not to store a biometric key to unlock the vault
   */
  abstract setBiometricUnlockEnabled(enabled: boolean): Promise<void>;

  /**
   * Gets the biometric unlock enabled state for the given user.
   * @param userId user Id to check
   */
  abstract getBiometricUnlockEnabled(userId: UserId): Promise<boolean>;

  abstract setEncryptedClientKeyHalf(encryptedKeyHalf: EncString, userId?: UserId): Promise<void>;

  abstract getEncryptedClientKeyHalf(userId: UserId): Promise<EncString | null>;

  abstract getRequirePasswordOnStart(userId: UserId): Promise<boolean>;

  abstract removeEncryptedClientKeyHalf(userId: UserId): Promise<void>;

  /**
   * Updates the active user's state to reflect that they've been warned about requiring password on start.
   */
  abstract setDismissedRequirePasswordOnStartCallout(): Promise<void>;

  /**
   * Updates the active user's state to reflect that they've cancelled the biometric prompt.
   */
  abstract setUserPromptCancelled(): Promise<void>;

  /**
   * Resets the given user's state to reflect that they haven't cancelled the biometric prompt.
   * @param userId the user to reset the prompt cancelled state for. If not provided, the currently active user will be used.
   */
  abstract resetUserPromptCancelled(userId?: UserId): Promise<void>;

  /**
   * Resets all user's state to reflect that they haven't cancelled the biometric prompt.
   */
  abstract resetAllPromptCancelled(): Promise<void>;

  /**
   * Updates the currently active user's setting for auto prompting for biometrics on application start and lock
   * @param prompt Whether or not to prompt for biometrics on application start.
   */
  abstract setPromptAutomatically(prompt: boolean): Promise<void>;

  /**
   * Updates whether or not IPC has been validated by the user this session
   * @param validated the value to save
   */
  abstract setFingerprintValidated(validated: boolean): Promise<void>;

  abstract updateLastProcessReload(): Promise<void>;

  abstract getLastProcessReload(): Promise<Date | null>;

  abstract logout(userId: UserId): Promise<void>;
}

export class DefaultBiometricStateService implements BiometricStateService {
  private biometricUnlockEnabledState: ActiveUserState<boolean>;
  private requirePasswordOnStartState: ActiveUserState<boolean>;
  private encryptedClientKeyHalfState: ActiveUserState<EncryptedString>;
  private dismissedRequirePasswordOnStartCalloutState: ActiveUserState<boolean>;
  private promptCancelledState: GlobalState<Record<UserId, boolean>>;
  private promptAutomaticallyState: ActiveUserState<boolean>;
  private fingerprintValidatedState: GlobalState<boolean>;
  private lastProcessReloadState: GlobalState<Date>;
  biometricUnlockEnabled$: Observable<boolean>;
  encryptedClientKeyHalf$: Observable<EncString | null>;
  requirePasswordOnStart$: Observable<boolean>;
  dismissedRequirePasswordOnStartCallout$: Observable<boolean>;
  promptCancelled$: Observable<boolean>;
  promptAutomatically$: Observable<boolean>;
  fingerprintValidated$: Observable<boolean>;
  lastProcessReload$: Observable<Date | null>;

  constructor(private stateProvider: StateProvider) {
    this.biometricUnlockEnabledState = this.stateProvider.getActive(BIOMETRIC_UNLOCK_ENABLED);
    this.biometricUnlockEnabled$ = this.biometricUnlockEnabledState.state$.pipe(map(Boolean));

    this.requirePasswordOnStartState = this.stateProvider.getActive(REQUIRE_PASSWORD_ON_START);
    this.requirePasswordOnStart$ = this.requirePasswordOnStartState.state$.pipe(
      map((value) => !!value),
    );

    this.encryptedClientKeyHalfState = this.stateProvider.getActive(ENCRYPTED_CLIENT_KEY_HALF);
    this.encryptedClientKeyHalf$ = this.encryptedClientKeyHalfState.state$.pipe(
      map(encryptedClientKeyHalfToEncString),
    );

    this.dismissedRequirePasswordOnStartCalloutState = this.stateProvider.getActive(
      DISMISSED_REQUIRE_PASSWORD_ON_START_CALLOUT,
    );
    this.dismissedRequirePasswordOnStartCallout$ =
      this.dismissedRequirePasswordOnStartCalloutState.state$.pipe(map(Boolean));

    this.promptCancelledState = this.stateProvider.getGlobal(PROMPT_CANCELLED);
    this.promptCancelled$ = combineLatest([
      this.stateProvider.activeUserId$,
      this.promptCancelledState.state$,
    ]).pipe(
      map(([userId, record]) => {
        return userId != null ? (record?.[userId] ?? false) : false;
      }),
    );
    this.promptAutomaticallyState = this.stateProvider.getActive(PROMPT_AUTOMATICALLY);
    this.promptAutomatically$ = this.promptAutomaticallyState.state$.pipe(map(Boolean));

    this.fingerprintValidatedState = this.stateProvider.getGlobal(FINGERPRINT_VALIDATED);
    this.fingerprintValidated$ = this.fingerprintValidatedState.state$.pipe(map(Boolean));

    this.lastProcessReloadState = this.stateProvider.getGlobal(LAST_PROCESS_RELOAD);
    this.lastProcessReload$ = this.lastProcessReloadState.state$;
  }

  async setBiometricUnlockEnabled(enabled: boolean): Promise<void> {
    await this.biometricUnlockEnabledState.update(() => enabled);
  }

  async getBiometricUnlockEnabled(userId: UserId): Promise<boolean> {
    return await firstValueFrom(
      this.stateProvider.getUser(userId, BIOMETRIC_UNLOCK_ENABLED).state$.pipe(map(Boolean)),
    );
  }

  async setRequirePasswordOnStart(value: boolean): Promise<void> {
    let currentActiveId: UserId | undefined = undefined;
    await this.requirePasswordOnStartState.update(
      (_, [userId]) => {
        currentActiveId = userId;
        return value;
      },
      {
        combineLatestWith: this.requirePasswordOnStartState.combinedState$,
      },
    );
    if (!value && currentActiveId) {
      await this.removeEncryptedClientKeyHalf(currentActiveId);
    }
  }

  async setEncryptedClientKeyHalf(encryptedKeyHalf: EncString, userId?: UserId): Promise<void> {
    const value = encryptedKeyHalf?.encryptedString ?? null;
    if (userId) {
      await this.stateProvider.getUser(userId, ENCRYPTED_CLIENT_KEY_HALF).update(() => value);
    } else {
      await this.encryptedClientKeyHalfState.update(() => value);
    }
  }

  async removeEncryptedClientKeyHalf(userId: UserId): Promise<void> {
    await this.stateProvider.getUser(userId, ENCRYPTED_CLIENT_KEY_HALF).update(() => null);
  }

  async getRequirePasswordOnStart(userId: UserId): Promise<boolean> {
    return !!(await firstValueFrom(
      this.stateProvider.getUser(userId, REQUIRE_PASSWORD_ON_START).state$,
    ));
  }

  async getEncryptedClientKeyHalf(userId: UserId): Promise<EncString | null> {
    return await firstValueFrom(
      this.stateProvider
        .getUser(userId, ENCRYPTED_CLIENT_KEY_HALF)
        .state$.pipe(map(encryptedClientKeyHalfToEncString)),
    );
  }

  async logout(userId: UserId): Promise<void> {
    await this.stateProvider.getUser(userId, ENCRYPTED_CLIENT_KEY_HALF).update(() => null);
    await this.resetUserPromptCancelled(userId);
    // Persist auto prompt setting through logout
    // Persist dismissed require password on start callout through logout
  }

  async setDismissedRequirePasswordOnStartCallout(): Promise<void> {
    await this.dismissedRequirePasswordOnStartCalloutState.update(() => true);
  }

  async resetUserPromptCancelled(userId: UserId): Promise<void> {
    await this.stateProvider.getGlobal(PROMPT_CANCELLED).update(
      (data, activeUserId) => {
        if (data != null) {
          delete data[userId ?? activeUserId];
        }
        return data;
      },
      {
        combineLatestWith: this.stateProvider.activeUserId$,
        shouldUpdate: (data, activeUserId) => data?.[userId ?? activeUserId] != null,
      },
    );
  }

  async setUserPromptCancelled(): Promise<void> {
    await this.promptCancelledState.update(
      (record, userId) => {
        if (userId != null) {
          record ??= {};
          record[userId] = true;
        }
        return record;
      },
      {
        combineLatestWith: this.stateProvider.activeUserId$,
        shouldUpdate: (_, userId) => {
          if (userId == null) {
            throw new Error(
              "Cannot update biometric prompt cancelled state without an active user",
            );
          }
          return true;
        },
      },
    );
  }

  async resetAllPromptCancelled(): Promise<void> {
    await this.promptCancelledState.update(() => null);
  }

  async setPromptAutomatically(prompt: boolean): Promise<void> {
    await this.promptAutomaticallyState.update(() => prompt);
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
