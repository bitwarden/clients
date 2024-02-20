import { Observable } from "rxjs";

import { VaultTimeoutAction } from "../../enums/vault-timeout-action.enum";
import { PinLockType } from "../../services/vault-timeout/vault-timeout-settings.service";
import { UserId } from "../../types/guid";

export abstract class VaultTimeoutSettingsService {
  /**
   * Set the vault timeout options for the user
   * @param vaultTimeout The vault timeout in minutes
   * @param vaultTimeoutAction The vault timeout action
   * @param userId The user id to set. If not provided, the current user is used
   */
  setVaultTimeoutOptions: (
    vaultTimeout: number,
    vaultTimeoutAction: VaultTimeoutAction,
  ) => Promise<void>;

  /**
   * Get the available vault timeout actions for the current user
   *
   * **NOTE:** This observable is not yet connected to the state service, so it will not update when the state changes
   * @param userId The user id to check. If not provided, the current user is used
   */
  availableVaultTimeoutActions$: (userId?: string) => Observable<VaultTimeoutAction[]>;

  /**
   * Returns the currently configured vault timeout, a policy compliant vault timeout if applicable, or null for the active user.
   */
  vaultTimeout$: Observable<number | null>;

  /**
   * Returns the currently configured vault timeout, a policy compliant vault timeout if applicable, or null for the given user id.
   */
  getVaultTimeoutByUserId$: (userId: string) => Observable<number | null>;

  /**
   * Returns the currently configured vault timeout action, a policy compliant vault timeout action if applicable, or null for the active user.
   */
  vaultTimeoutAction$: Observable<VaultTimeoutAction>;

  /**
   * Returns the currently configured vault timeout action, a policy compliant vault timeout action if applicable, or null for the given user id.
   */

  getVaultTimeoutActionByUserId$: (userId: string) => Observable<VaultTimeoutAction>;

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

  clear: (userId?: UserId) => Promise<void>;
}
