// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Observable, firstValueFrom } from "rxjs";
import { Jsonify } from "type-fest";

import {
  ActiveUserState,
  StateProvider,
  UserKeyDefinition,
  VAULT_BROWSER_MEMORY,
} from "@bitwarden/common/platform/state";

import { BrowserComponentState } from "../../models/browserComponentState";
import { BrowserGroupingsComponentState } from "../../models/browserGroupingsComponentState";

export const VAULT_BROWSER_GROUPINGS_COMPONENT =
  new UserKeyDefinition<BrowserGroupingsComponentState>(
    VAULT_BROWSER_MEMORY,
    "vault_browser_groupings_component",
    {
      deserializer: (obj: Jsonify<BrowserGroupingsComponentState>) =>
        BrowserGroupingsComponentState.fromJSON(obj),
      clearOn: ["logout", "lock"],
    },
  );

export const VAULT_BROWSER_COMPONENT = new UserKeyDefinition<BrowserComponentState>(
  VAULT_BROWSER_MEMORY,
  "vault_browser_component",
  {
    deserializer: (obj: Jsonify<BrowserComponentState>) => BrowserComponentState.fromJSON(obj),
    clearOn: ["logout", "lock"],
  },
);

export class VaultBrowserStateService {
  vaultBrowserGroupingsComponentState$: Observable<BrowserGroupingsComponentState>;
  vaultBrowserComponentState$: Observable<BrowserComponentState>;

  private activeUserVaultBrowserGroupingsComponentState: ActiveUserState<BrowserGroupingsComponentState>;
  private activeUserVaultBrowserComponentState: ActiveUserState<BrowserComponentState>;

  constructor(protected stateProvider: StateProvider) {
    this.activeUserVaultBrowserGroupingsComponentState = this.stateProvider.getActive(
      VAULT_BROWSER_GROUPINGS_COMPONENT,
    );
    this.activeUserVaultBrowserComponentState =
      this.stateProvider.getActive(VAULT_BROWSER_COMPONENT);

    this.vaultBrowserGroupingsComponentState$ =
      this.activeUserVaultBrowserGroupingsComponentState.state$;
    this.vaultBrowserComponentState$ = this.activeUserVaultBrowserComponentState.state$;
  }

  async getBrowserGroupingsComponentState(): Promise<BrowserGroupingsComponentState> {
    return await firstValueFrom(this.vaultBrowserGroupingsComponentState$);
  }

  async setBrowserGroupingsComponentState(value: BrowserGroupingsComponentState): Promise<void> {
    await this.activeUserVaultBrowserGroupingsComponentState.update(() => value, {
      shouldUpdate: (current) => !(current == null && value == null),
    });
  }

  async getBrowserVaultItemsComponentState(): Promise<BrowserComponentState> {
    return await firstValueFrom(this.vaultBrowserComponentState$);
  }

  async setBrowserVaultItemsComponentState(value: BrowserComponentState): Promise<void> {
    await this.activeUserVaultBrowserComponentState.update(() => value, {
      shouldUpdate: (current) => !(current == null && value == null),
    });
  }
}
