import { Observable } from "rxjs";

import { UserId } from "../../../types/guid";
import { VaultTimeoutAction } from "../enums/vault-timeout-action.enum";
import { VaultTimeout } from "../types/vault-timeout.type";

export abstract class VaultTimeoutSettingsService {
  /**
   * Set the vault timeout options for the user
   * @param vaultTimeout The vault timeout in minutes
   * @param vaultTimeoutAction The vault timeout action
   * @param userId The user id to set the data for.
   */
  abstract setVaultTimeoutOptions(
    userId: UserId,
    vaultTimeout: VaultTimeout,
    vaultTimeoutAction: VaultTimeoutAction,
  ): Promise<void>;

  /**
   * Get the available vault timeout actions for the current user
   *
   * **NOTE:** This observable is not yet connected to the state service, so it will not update when the state changes
   * @param userId The user id to check. If not provided, the current user is used
   */
  abstract availableVaultTimeoutActions$(userId?: string): Observable<VaultTimeoutAction[]>;

  /**
   * Evaluates the user's available vault timeout actions and returns a boolean representing
   * if the user can lock or not
   */
  abstract canLock(userId: string): Promise<boolean>;

  /**
   * Gets the vault timeout action for the given user id. The returned value is
   * calculated based on the current state, if a max vault timeout policy applies to the user,
   * and what the user's available unlock methods are.
   *
   * A new action will be emitted if the current state changes or if the user's policy changes and the new policy affects the action.
   * @param userId - the user id to get the vault timeout action for
   */
  abstract getVaultTimeoutActionByUserId$(userId: string): Observable<VaultTimeoutAction>;

  /**
   * Get the vault timeout for the given user id. The returned value is calculated based on the current state
   * and if a max vault timeout policy applies to the user.
   *
   * A new timeout will be emitted if the current state changes or if the user's policy changes and the new policy affects the timeout.
   * @param userId The user id to get the vault timeout for
   */
  abstract getVaultTimeoutByUserId$(userId: string): Observable<VaultTimeout>;

  /**
   * Has the user enabled unlock with Biometric.
   * @param userId The user id to check. If not provided, the current user is used
   * @returns boolean true if biometric lock is set
   */
  abstract isBiometricLockSet(userId?: string): Promise<boolean>;
}
