import { filter, firstValueFrom, map, race, timer } from "rxjs";

import { UserId } from "@bitwarden/common/types/guid";
import { CipherRecordMapper } from "@bitwarden/common/vault/models/domain/cipher-sdk-mapper";
import { Repository, StateClient } from "@bitwarden/sdk-internal";

import { EphemeralPinEnvelopeMapper } from "../../../key-management/ephemeral-pin-envelope-mapper";
import { LocalUserDataKeyRecordMapper } from "../../../key-management/local-user-data-key-mapper";
import { UserKeyRecordMapper } from "../../../key-management/user-key-mapper";
import { StateProvider, UserKeyDefinition } from "../../state";

export async function initializeClientManagedState(
  userId: UserId,
  stateClient: StateClient,
  stateProvider: StateProvider,
): Promise<void> {
  stateClient.register_client_managed_repositories({
    cipher: new RepositoryRecord(userId, stateProvider, new CipherRecordMapper(), true),
    folder: null,
    user_key_state: new RepositoryRecord(userId, stateProvider, new UserKeyRecordMapper()),
    local_user_data_key_state: new RepositoryRecord(
      userId,
      stateProvider,
      new LocalUserDataKeyRecordMapper(),
    ),
    ephemeral_pin_envelope_state: new RepositoryRecord(
      userId,
      stateProvider,
      new EphemeralPinEnvelopeMapper(),
    ),
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
    private optimisticWrite: boolean = false,
  ) {}

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
    const newValue = this.mapper.fromSdk(value);
    await this.getUserState().update((state) => ({
      ...(state ?? {}),
      [id]: newValue,
    }));
    await this.waitUntilChanged(id, newValue);
  }

  async setBulk(values: [string, SdkType][]): Promise<void> {
    const mapped = Object.fromEntries(
      values.map(([id, value]) => [id, this.mapper.fromSdk(value)]),
    );
    await this.getUserState().update((state) => ({
      ...(state ?? {}),
      ...mapped,
    }));
    for (const id in mapped) {
      await this.waitUntilChanged(id, mapped[id]);
    }
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
    await this.waitUntilChanged(id, null);
  }

  async removeBulk(keys: string[]): Promise<void> {
    const keysToRemove = new Set<string>();
    await this.getUserState().update((state) => {
      if (!state || !keys.some((key) => key in state)) {
        return state;
      }
      for (const key of keys) {
        keysToRemove.add(key);
      }
      return Object.fromEntries(Object.entries(state).filter(([key]) => !keysToRemove.has(key)));
    });
    for (const id of keysToRemove) {
      await this.waitUntilChanged(id, null);
    }
  }

  async removeAll(): Promise<void> {
    await this.getUserState().update(() => ({}));
    if (!this.optimisticWrite) {
      await firstValueFrom(
        race(
          this.getUserState().state$.pipe(
            filter((state) => state == null || Object.keys(state).length == 0),
          ),
          timer(1000),
        ),
      );
    }
  }

  private getUserState() {
    return this.stateProvider.getUser(this.userId, this.mapper.userKeyDefinition());
  }

  private async getRecord(): Promise<Record<string, ClientType>> {
    return await firstValueFrom(this.getUserState().state$.pipe(map((state) => state ?? {})));
  }

  /**
   * Waits until the underlying state observable reflects the change, for up to 1000ms.
   * @param id the id of the key
   * @param expectedValue the expected value after the change, or null if the key was removed.
   */
  private async waitUntilChanged(id: string, expectedValue: unknown): Promise<void> {
    if (this.optimisticWrite) {
      return;
    }
    await firstValueFrom(
      race(
        this.getUserState().state$.pipe(
          map((state) => state ?? {}),
          filter((state) => state[id] == expectedValue),
        ),
        timer(1000),
      ),
    );
  }
}
