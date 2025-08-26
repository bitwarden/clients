import { firstValueFrom, map } from "rxjs";

import { UserId } from "@bitwarden/common/types/guid";
import { CipherRecordMapper } from "@bitwarden/common/vault/models/domain/cipher-sdk-mapper";
import { StateClient, Repository } from "@bitwarden/sdk-internal";

import { StateProvider, UserKeyDefinition } from "../../state";

export async function initializeState(
  userId: UserId,
  stateClient: StateClient,
  stateProvider: StateProvider,
): Promise<void> {
  await stateClient.register_cipher_repository(
    new RepositoryRecord(userId, stateProvider, new CipherRecordMapper()),
  );
}

export interface SdkRecordMapper<ClientType, SdkType> {
  userKeyDefinition(): UserKeyDefinition<Record<string, ClientType>>;
  toSdk(value: ClientType): SdkType;
  fromSdk(value: SdkType): ClientType;
}

class RepositoryRecord<ClientType, SdkType> implements Repository<SdkType> {
  constructor(
    private userId: UserId,
    private stateProvider: StateProvider,
    private mapper: SdkRecordMapper<ClientType, SdkType>,
  ) {}

  async get(id: string): Promise<SdkType | null> {
    const prov = this.stateProvider.getUser(this.userId, this.mapper.userKeyDefinition());
    const data = await firstValueFrom(prov.state$.pipe(map((data) => data ?? {})));
    const element = data[id];
    if (!element) {
      return null;
    }
    return this.mapper.toSdk(element);
  }

  async list(): Promise<SdkType[]> {
    const prov = this.stateProvider.getUser(this.userId, this.mapper.userKeyDefinition());
    const elements = await firstValueFrom(prov.state$.pipe(map((data) => data ?? {})));
    return Object.values(elements).map((element) => this.mapper.toSdk(element));
  }

  async set(id: string, value: SdkType): Promise<void> {
    const prov = this.stateProvider.getUser(this.userId, this.mapper.userKeyDefinition());
    const elements = await firstValueFrom(prov.state$.pipe(map((data) => data ?? {})));
    elements[id] = this.mapper.fromSdk(value);
    await prov.update(() => elements);
  }

  async remove(id: string): Promise<void> {
    const prov = this.stateProvider.getUser(this.userId, this.mapper.userKeyDefinition());
    const elements = await firstValueFrom(prov.state$.pipe(map((data) => data ?? {})));
    if (!elements[id]) {
      return;
    }
    delete elements[id];
    await prov.update(() => elements);
  }
}
