// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Observable } from "rxjs";
/**
 * Service for managing vault settings.
 */
export abstract class VaultSettingsService {
  /**
   * An observable monitoring the state of the enable passkeys setting.
   * The observable updates when the setting changes.
   */
  enablePasskeys$: Observable<boolean>;
  /**
   * An observable monitoring the state of the show cards on the current tab.
   */
  showCardsCurrentTab$: Observable<boolean>;
  /**
   * An observable monitoring the state of the show identities on the current tab.
   */
  showIdentitiesCurrentTab$: Observable<boolean>;
  /**
  /**
   * An observable monitoring the state of the click items on the Vault view
   * for Autofill suggestions.
   */
  clickItemsToAutofillVaultView$: Observable<boolean>;
  /**

  /**
   * Saves the enable passkeys setting to disk.
   * @param value The new value for the passkeys setting.
   */
  setEnablePasskeys: (value: boolean) => Promise<void>;
  /**
   * Saves the show cards on tab page setting to disk.
   * @param value The new value for the show cards on tab page setting.
   */
  setShowCardsCurrentTab: (value: boolean) => Promise<void>;
  /**
   * Saves the show identities on tab page setting to disk.
   * @param value The new value for the show identities on tab page setting.
   */
  setShowIdentitiesCurrentTab: (value: boolean) => Promise<void>;
  /**
   * Saves the click items on vault View for Autofill suggestions to disk.
   * @param value The new value for the click items on vault View for
   * Autofill suggestions setting.
   */
  setClickItemsToAutofillVaultView: (value: boolean) => Promise<void>;
}
