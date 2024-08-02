import { Observable, concatMap, distinctUntilChanged, firstValueFrom, share } from "rxjs";

import { AppIdService as AppIdServiceAbstraction } from "../abstractions/app-id.service";
import { Utils } from "../misc/utils";
import { APPLICATION_ID_DISK, GlobalStateProvider, KeyDefinition } from "../state";

export const APP_ID_KEY = new KeyDefinition(APPLICATION_ID_DISK, "appId", {
  deserializer: (value: string) => value,
  cleanupDelayMs: 0,
  debug: {
    enableRetrievalLogging: true,
    enableUpdateLogging: true,
  },
});
export const ANONYMOUS_APP_ID_KEY = new KeyDefinition(APPLICATION_ID_DISK, "anonymousAppId", {
  deserializer: (value: string) => value,
});

export class AppIdService implements AppIdServiceAbstraction {
  appId$: Observable<string>;
  anonymousAppId$: Observable<string>;

  constructor(globalStateProvider: GlobalStateProvider) {
    const appIdState = globalStateProvider.get(APP_ID_KEY);
    const anonymousAppIdState = globalStateProvider.get(ANONYMOUS_APP_ID_KEY);
    this.appId$ = appIdState.state$.pipe(
      concatMap(async (appId) => {
        if (!appId) {
          return await appIdState.update(() => Utils.newGuid(), {
            shouldUpdate: (v) => v == null,
          });
        }
        return appId;
      }),
      distinctUntilChanged(),
      share(),
    );
    this.anonymousAppId$ = anonymousAppIdState.state$.pipe(
      concatMap(async (appId) => {
        if (!appId) {
          return await anonymousAppIdState.update(() => Utils.newGuid(), {
            shouldUpdate: (v) => v == null,
          });
        }
        return appId;
      }),
      distinctUntilChanged(),
      share(),
    );
  }

  async getAppId(): Promise<string> {
    return await firstValueFrom(this.appId$);
  }

  async getAnonymousAppId(): Promise<string> {
    return await firstValueFrom(this.anonymousAppId$);
  }
}
