import { Observable, combineLatest, map } from "rxjs";

import { ActiveUserState, GlobalState, StateProvider } from "../../../platform/state";
import { VaultSettingsService as VaultSettingsServiceAbstraction } from "../../abstractions/vault-settings/vault-settings.service";
import { CipherType } from "../../enums";
import {
  SHOW_CARDS_CURRENT_TAB,
  SHOW_IDENTITIES_CURRENT_TAB,
  USER_ENABLE_PASSKEYS,
} from "../key-state/vault-settings.state";
import { RestrictedItemTypesService } from "../restricted-item-types.service";

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
  readonly showCardsCurrentTab$: Observable<boolean> = combineLatest([
    this.showCardsCurrentTabState.state$.pipe(map((x) => x ?? true)),
    this.restrictedItemTypesService.restricted$,
  ]).pipe(
    map(
      ([enabled, restrictions]) =>
        // If enabled, show cards tab unless card type is restricted
        enabled && !restrictions.some((r) => r.cipherType === CipherType.Card),
    ),
  );

  private showIdentitiesCurrentTabState: ActiveUserState<boolean> = this.stateProvider.getActive(
    SHOW_IDENTITIES_CURRENT_TAB,
  );
  /**
   * {@link VaultSettingsServiceAbstraction.showIdentitiesCurrentTab$}
   */
  readonly showIdentitiesCurrentTab$: Observable<boolean> =
    this.showIdentitiesCurrentTabState.state$.pipe(map((x) => x ?? true));

  constructor(
    private stateProvider: StateProvider,
    private restrictedItemTypesService: RestrictedItemTypesService,
  ) {}

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
   * {@link VaultSettingsServiceAbstraction.setEnablePasskeys}
   */
  async setEnablePasskeys(value: boolean): Promise<void> {
    await this.enablePasskeysState.update(() => value);
  }
}
