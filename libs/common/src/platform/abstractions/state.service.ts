import { BiometricKey } from "../../auth/types/biometric-key";
import { Account } from "../models/domain/account";
import { StorageOptions } from "../models/domain/storage-options";

/**
 * Options for customizing the initiation behavior.
 */
export type InitOptions = {
  /**
   * Whether or not to run state migrations as part of the init process. Defaults to true.
   *
   * If false, the init method will instead wait for migrations to complete before doing its
   * other init operations. Make sure migrations have either already completed, or will complete
   * before calling {@link StateService.init} with `runMigrations: false`.
   */
  runMigrations?: boolean;
};

export abstract class StateService<T extends Account = Account> {
  abstract addAccount(account: T): Promise<void>;
  abstract clean(options?: StorageOptions): Promise<void>;
  abstract init(initOptions?: InitOptions): Promise<void>;

  /**
   * Gets the user's auto key
   */
  abstract getUserKeyAutoUnlock(options?: StorageOptions): Promise<string>;
  /**
   * Sets the user's auto key
   */
  abstract setUserKeyAutoUnlock(value: string | null, options?: StorageOptions): Promise<void>;
  /**
   * Gets the user's biometric key
   */
  abstract getUserKeyBiometric(options?: StorageOptions): Promise<string>;
  /**
   * Checks if the user has a biometric key available
   */
  abstract hasUserKeyBiometric(options?: StorageOptions): Promise<boolean>;
  /**
   * Sets the user's biometric key
   */
  abstract setUserKeyBiometric(value: BiometricKey, options?: StorageOptions): Promise<void>;
  /**
   * @deprecated For backwards compatible purposes only, use DesktopAutofillSettingsService
   */
  abstract setEnableDuckDuckGoBrowserIntegration(
    value: boolean,
    options?: StorageOptions,
  ): Promise<void>;
  abstract getDuckDuckGoSharedKey(options?: StorageOptions): Promise<string>;
  abstract setDuckDuckGoSharedKey(value: string, options?: StorageOptions): Promise<void>;

  /**
   * @deprecated Use `TokenService.hasAccessToken$()` or `AuthService.authStatusFor$` instead.
   */
  abstract getIsAuthenticated(options?: StorageOptions): Promise<boolean>;

  /**
   * @deprecated Use `AccountService.activeAccount$` instead.
   */
  abstract getUserId(options?: StorageOptions): Promise<string>;
}
