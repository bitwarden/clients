// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Observable, firstValueFrom } from "rxjs";

import { ActiveUserState, CombinedState, StateProvider } from "../../../platform/state";
import { UserId } from "../../../types/guid";
import { ConnectedAppData } from "../models/data/connected-app.data";

import { ConnectedAppStateProvider as ConnectedAppStateProviderAbstraction } from "./connected-app-state.provider.abstraction";
import { CONNECTED_APP_USER_ENCRYPTED } from "./key-definitions";

/** State provider for agent connections. */
export class ConnectedAppStateProvider implements ConnectedAppStateProviderAbstraction {
  encryptedState$: Observable<CombinedState<Record<string, ConnectedAppData>>>;

  private activeUserEncryptedState: ActiveUserState<Record<string, ConnectedAppData>>;

  constructor(protected stateProvider: StateProvider) {
    this.activeUserEncryptedState = this.stateProvider.getActive(CONNECTED_APP_USER_ENCRYPTED);
    this.encryptedState$ = this.activeUserEncryptedState.combinedState$;
  }

  async getEncryptedConnectedApps(): Promise<CombinedState<Record<string, ConnectedAppData>>> {
    return await firstValueFrom(this.encryptedState$);
  }

  async setEncryptedConnectedApps(
    value: Record<string, ConnectedAppData>,
    userId: UserId,
  ): Promise<void> {
    await this.stateProvider.getUser(userId, CONNECTED_APP_USER_ENCRYPTED).update(() => value);
  }
}
