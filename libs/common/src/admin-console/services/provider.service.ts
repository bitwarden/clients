import { Observable, map, firstValueFrom } from "rxjs";

import { KeyDefinition, PROVIDERS_DISK, StateProvider } from "../../platform/state";
import { UserId } from "../../types/guid";
import { ProviderService as ProviderServiceAbstraction } from "../abstractions/provider.service";
import { ProviderData } from "../models/data/provider.data";
import { Provider } from "../models/domain/provider";

export const PROVIDERS = KeyDefinition.record<ProviderData>(PROVIDERS_DISK, "providers", {
  deserializer: (obj: ProviderData) => obj,
});

function mapToSingleProvider(providerId: string) {
  return map<Provider[], Provider>((providers) => providers?.find((p) => p.id === providerId));
}

export class ProviderService implements ProviderServiceAbstraction {
  constructor(private stateProvider: StateProvider) {}

  private providers$(userId?: UserId): Observable<Provider[] | undefined> {
    return this.stateProvider
      .getUserState$(PROVIDERS, userId)
      .pipe(this.mapProviderRecordToArray());
  }

  private mapProviderRecordToArray() {
    return map<Record<string, ProviderData>, Provider[]>((providers) =>
      Object.values(providers ?? {})?.map((o) => new Provider(o)),
    );
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
