// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { firstValueFrom, map, Observable, of, switchMap, take } from "rxjs";

import { PROVIDERS_DISK, StateProvider, UserKeyDefinition } from "../../platform/state";
import { UserId } from "../../types/guid";
import { ProviderService as ProviderServiceAbstraction } from "../abstractions/provider.service";
import { ProviderData } from "../models/data/provider.data";
import { Provider } from "../models/domain/provider";

export const PROVIDERS = UserKeyDefinition.record<ProviderData>(PROVIDERS_DISK, "providers", {
  deserializer: (obj: ProviderData) => obj,
  clearOn: ["logout"],
});

function mapToSingleProvider(providerId: string) {
  return map<Provider[], Provider>((providers) => providers?.find((p) => p.id === providerId));
}

export class ProviderService implements ProviderServiceAbstraction {
  constructor(private stateProvider: StateProvider) {}

  private providers$(userId?: UserId): Observable<Provider[] | undefined> {
    // FIXME: Can be replaced with `getUserStateOrDefault$` if we weren't trying to pick this.
    return (
      userId != null
        ? this.stateProvider.getUser(userId, PROVIDERS).state$
        : this.stateProvider.activeUserId$.pipe(
            take(1),
            switchMap((userId) =>
              userId != null ? this.stateProvider.getUser(userId, PROVIDERS).state$ : of(null),
            ),
          )
    ).pipe(this.mapProviderRecordToArray());
  }

  private mapProviderRecordToArray() {
    return map<Record<string, ProviderData>, Provider[]>((providers) =>
      Object.values(providers ?? {})?.map((o) => new Provider(o)),
    );
  }

  get$(id: string): Observable<Provider> {
    return this.providers$().pipe(mapToSingleProvider(id));
  }

  async get(id: string): Promise<Provider> {
    return await firstValueFrom(this.providers$().pipe(mapToSingleProvider(id)));
  }

  async getAll(): Promise<Provider[]> {
    return await firstValueFrom(this.providers$());
  }

  async save(providers: { [id: string]: ProviderData }, userId?: UserId) {
    await this.stateProvider.setUserState(PROVIDERS, providers, userId);
  }
}
