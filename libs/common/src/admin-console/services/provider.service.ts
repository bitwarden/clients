import { firstValueFrom, map, Observable } from "rxjs";

import { getById } from "../../platform/misc";
import { PROVIDERS_DISK, StateProvider, UserKeyDefinition } from "../../platform/state";
import { UserId } from "../../types/guid";
import { ProviderService as ProviderServiceAbstraction } from "../abstractions/provider.service";
import { ProviderData } from "../models/data/provider.data";
import { Provider } from "../models/domain/provider";

export const PROVIDERS = UserKeyDefinition.record<ProviderData>(PROVIDERS_DISK, "providers", {
  deserializer: (obj: ProviderData) => obj,
  clearOn: ["logout"],
});

export class ProviderService implements ProviderServiceAbstraction {
  constructor(private stateProvider: StateProvider) {}

  private providers$(userId: UserId): Observable<Provider[]> {
    return this.stateProvider
      .getUser(userId, PROVIDERS)
      .state$.pipe(this.mapProviderRecordToArray());
  }

  private mapProviderRecordToArray() {
    return map<Record<string, ProviderData> | null, Provider[]>((providers) =>
      Object.values(providers ?? {}).map((o) => new Provider(o)),
    );
  }

  get$(id: string, userId: UserId): Observable<Provider | undefined> {
    return this.providers$(userId).pipe(getById(id));
  }

  async get(id: string, userId: UserId): Promise<Provider | undefined> {
    return await firstValueFrom(this.providers$(userId).pipe(getById(id)));
  }

  async getAll(userId: UserId): Promise<Provider[]> {
    return await firstValueFrom(this.providers$(userId));
  }

  async save(providers: { [id: string]: ProviderData }, userId: UserId) {
    await this.stateProvider.setUserState(PROVIDERS, providers, userId);
  }
}
