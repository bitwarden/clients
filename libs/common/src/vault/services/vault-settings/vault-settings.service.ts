import { Observable, map } from "rxjs";

import { ActiveUserState, GlobalState, StateProvider } from "../../../platform/state";
import { VaultSettingsService as VaultSettingsServiceAbstraction } from "../../abstractions/vault-settings/vault-settings.service";
import {
  SHOW_CARDS_CURRENT_TAB,
  SHOW_IDENTITIES_CURRENT_TAB,
  USER_ENABLE_PASSKEYS,
  CLICK_ITEMS_AUTOFILL_VAULT_VIEW,
} from "../key-state/vault-settings.state";

/**
 * {@link VaultSettingsServiceAbstraction}
 */
export class VaultSettingsService implements VaultSettingsServiceAbstraction {
  private enablePasskeysState: GlobalState<boolean> =
    this.stateProvider.getGlobal(USER_ENABLE_PASSKEYS);
  /**
   * {@link VaultSettingsServiceAbstraction.enablePasskeys$}
   */
  readonly enablePasskeys$: Observable<boolean> = this.enablePasskeysState.state$.pipe(
    map((x) => x ?? true),
  );

  private showCardsCurrentTabState: ActiveUserState<boolean> =
    this.stateProvider.getActive(SHOW_CARDS_CURRENT_TAB);
  /**
   * {@link VaultSettingsServiceAbstraction.showCardsCurrentTab$}
   */
  readonly showCardsCurrentTab$: Observable<boolean> = this.showCardsCurrentTabState.state$.pipe(
    map((x) => x ?? true),
  );

  private showIdentitiesCurrentTabState: ActiveUserState<boolean> = this.stateProvider.getActive(
    SHOW_IDENTITIES_CURRENT_TAB,
  );
  /**
   * {@link VaultSettingsServiceAbstraction.showIdentitiesCurrentTab$}
   */
  readonly showIdentitiesCurrentTab$: Observable<boolean> =
    this.showIdentitiesCurrentTabState.state$.pipe(map((x) => x ?? true));

  private clickItemsToAutofillVaultViewState: ActiveUserState<boolean> =
    this.stateProvider.getActive(CLICK_ITEMS_AUTOFILL_VAULT_VIEW);
  /**
   * {@link VaultSettingsServiceAbstraction.clickItemsToAutofillVaultView$$}
   */
  readonly clickItemsToAutofillVaultView$: Observable<boolean> =
    this.clickItemsToAutofillVaultViewState.state$.pipe(map((x) => x ?? false));

  constructor(private stateProvider: StateProvider) {}

  /**
   * {@link VaultSettingsServiceAbstraction.setShowCardsCurrentTab}
   */
  async setShowCardsCurrentTab(value: boolean): Promise<void> {
    await this.showCardsCurrentTabState.update(() => value);
  }

  /**
   * {@link VaultSettingsServiceAbstraction.setDontShowIdentitiesCurrentTab}
   */
  async setShowIdentitiesCurrentTab(value: boolean): Promise<void> {
    await this.showIdentitiesCurrentTabState.update(() => value);
  }

  /**
   * {@link VaultSettingsServiceAbstraction.setClickItemsToAutofillVaultView}
   */
  async setClickItemsToAutofillVaultView(value: boolean): Promise<void> {
    await this.clickItemsToAutofillVaultViewState.update(() => value);
  }

  /**
   * {@link VaultSettingsServiceAbstraction.setEnablePasskeys}
   */
  async setEnablePasskeys(value: boolean): Promise<void> {
    await this.enablePasskeysState.update(() => value);
  }
}
