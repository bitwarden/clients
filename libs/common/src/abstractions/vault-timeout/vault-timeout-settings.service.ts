import { Observable } from "rxjs";

import { VaultTimeoutAction } from "../../enums/vault-timeout-action.enum";
import { PinLockType } from "../../services/vault-timeout/vault-timeout-settings.service";

export abstract class VaultTimeoutSettingsService {
  /**
   * Set the vault timeout options for the user
   * @param vaultTimeout The vault timeout in minutes
   * @param vaultTimeoutAction The vault timeout action
   * @param userId The user id to set. If not provided, the current user is used
   */
  setVaultTimeoutOptions: (
    vaultTimeout: number,
    vaultTimeoutAction: VaultTimeoutAction
  ) => Promise<void>;

  /**
   * Get the available vault timeout actions for the current user
   *
   * **NOTE:** This observable is not yet connected to the state service, so it will not update when the state changes
   * @param userId The user id to check. If not provided, the current user is used
   */
  availableVaultTimeoutActions$: (userId?: string) => Observable<VaultTimeoutAction[]>;

  /**
   * Get the current vault timeout action for the user. This is not the same as the current state, it is
   * calculated based on the current state, the user's policy, and the user's available unlock methods.
   */
  getVaultTimeout: (userId?: string) => Promise<number>;

  /**
   * Observe the vault timeout action for the user. This is calculated based on users preferred lock action saved in the state,
   * the user's policy, and the user's available unlock methods.
   *
   * **NOTE:** This observable is not yet connected to the state service, so it will not update when the state changes
   * @param userId The user id to check. If not provided, the current user is used
   */
  vaultTimeoutAction$: (userId?: string) => Observable<VaultTimeoutAction>;

  /**
   * Has the user enabled unlock with Pin.
   * @param userId The user id to check. If not provided, the current user is used
   * @returns PinLockType
   */
  isPinLockSet: (userId?: string) => Promise<PinLockType>;

  /**
   * Has the user enabled unlock with Biometric.
   * @param userId The user id to check. If not provided, the current user is used
   * @returns boolean true if biometric lock is set
   */
  isBiometricLockSet: (userId?: string) => Promise<boolean>;

  clear: (userId?: string) => Promise<void>;
}
