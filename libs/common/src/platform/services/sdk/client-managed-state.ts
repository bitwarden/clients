import { firstValueFrom, map } from "rxjs";

import { UserId } from "@bitwarden/common/types/guid";
import { CipherRecordMapper } from "@bitwarden/common/vault/models/domain/cipher-sdk-mapper";
import { StateClient, Repository } from "@bitwarden/sdk-internal";

import { UserKeyRecordMapper } from "../../../key-management/user-key-mapper";
import { StateProvider, UserKeyDefinition } from "../../state";

export async function initializeState(
  userId: UserId,
  stateClient: StateClient,
  stateProvider: StateProvider,
): Promise<void> {
  stateClient.register_client_managed_repositories({
    cipher: new RepositoryRecord(userId, stateProvider, new CipherRecordMapper()),
    folder: null,
    user_key_state: new RepositoryRecord(userId, stateProvider, new UserKeyRecordMapper()),
  });
}

export interface SdkRecordMapper<ClientType, SdkType> {
  userKeyDefinition(): UserKeyDefinition<Record<string, ClientType>>;
  toSdk(value: ClientType): SdkType;
  fromSdk(value: SdkType): ClientType;
}

export class RepositoryRecord<ClientType, SdkType> implements Repository<SdkType> {
  constructor(
    private userId: UserId,
    private stateProvider: StateProvider,
    private mapper: SdkRecordMapper<ClientType, SdkType>,
  ) {}

  private getUserState() {
    return this.stateProvider.getUser(this.userId, this.mapper.userKeyDefinition());
  }

  private async getRecord(): Promise<Record<string, ClientType>> {
    return await firstValueFrom(this.getUserState().state$.pipe(map((state) => state ?? {})));
  }

  async get(id: string): Promise<SdkType | null> {
    const record = await this.getRecord();
    const element = record[id];
    return element ? this.mapper.toSdk(element) : null;
  }

  async list(): Promise<SdkType[]> {
    const record = await this.getRecord();
    return Object.values(record).map((element) => this.mapper.toSdk(element));
  }

  async set(id: string, value: SdkType): Promise<void> {
    await this.getUserState().update((state) => ({
      ...(state ?? {}),
      [id]: this.mapper.fromSdk(value),
    }));
  }

  async setBulk(values: [string, SdkType][]): Promise<void> {
    const mapped = Object.fromEntries(
      values.map(([id, value]) => [id, this.mapper.fromSdk(value)]),
    );
    await this.getUserState().update((state) => ({
      ...(state ?? {}),
      ...mapped,
    }));
  }

  async remove(id: string): Promise<void> {
    await this.getUserState().update((state) => {
      if (!state || !(id in state)) {
        return state;
      }
      // Rest sibling
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [id]: _unused, ...rest } = state;
      return rest;
    });
  }

  async removeBulk(keys: string[]): Promise<void> {
    await this.getUserState().update((state) => {
      if (!state || !keys.some((key) => key in state)) {
        return state;
      }
      const keysToRemove = new Set(keys);
      return Object.fromEntries(Object.entries(state).filter(([key]) => !keysToRemove.has(key)));
    });
  }

  async removeAll(): Promise<void> {
    await this.getUserState().update(() => ({}));
  }
}
