import { firstValueFrom, map } from "rxjs";

import { UserId } from "@bitwarden/common/types/guid";
import { CipherRecordMapper } from "@bitwarden/common/vault/models/domain/cipher-sdk-mapper";
import { Repository, StateClient, UserKeyState, Value } from "@bitwarden/sdk-internal";

import { LocalUserDataKeyRecordMapper } from "../../../key-management/local-user-data-key-mapper";
import { StateProvider, UserKeyDefinition } from "../../state";
import { PIN_PROTECTED_USER_KEY_ENVELOPE_EPHEMERAL } from "@bitwarden/common/key-management/pin/pin.state";
import { USER_KEY } from "../key-state/user-key.state";
import { UserKey } from "@bitwarden/common/types/key";
import { SymmetricCryptoKey } from "../../models/domain/symmetric-crypto-key";

export async function initializeClientManagedState(
  userId: UserId,
  stateClient: StateClient,
  stateProvider: StateProvider,
): Promise<void> {
  stateClient.register_client_managed_repositories({
    cipher: new RepositoryRecord(userId, stateProvider, new CipherRecordMapper()),
    folder: null,
    local_user_data_key_state: new RepositoryRecord(
      userId,
      stateProvider,
      new LocalUserDataKeyRecordMapper(),
    ),
    organization_shared_key: null,
  });
  stateClient.register_client_managed_values({
    ephemeral_pin_envelope_state: new ValueRecord(userId, stateProvider, PIN_PROTECTED_USER_KEY_ENVELOPE_EPHEMERAL),
    user_key_state: new MappedValueRecord<UserKey, UserKeyState>(userId, stateProvider, USER_KEY, (key) => { return { decrypted_user_key: key.keyB64 }; }, (state) => { return SymmetricCryptoKey.fromString(state.decrypted_user_key) as UserKey; }),
  });
}

/**
 * A value record directly stores the SDK type to state
 */
export class ValueRecord<T> implements Value<T> {
  constructor(private userId: UserId, private stateProvider: StateProvider, private keyDefinition: UserKeyDefinition<T>) {}
  
  async get(): Promise<T | null> {
    const state = await firstValueFrom(this.stateProvider.getUser(this.userId, this.keyDefinition).state$);
    return state ?? null;
  }

  async set(value: T): Promise<void> {
    await this.stateProvider.getUser(this.userId, this.keyDefinition).update(() => value);
  }

  async remove(): Promise<void> {
    await this.stateProvider.getUser(this.userId, this.keyDefinition).update((): any => null);
  }
}

/**
 * A mapped value record has a different SDK type from the client type
 */
export class MappedValueRecord<ClientType, SdkType> implements Value<SdkType> {
  constructor(
    private userId: UserId,
    private stateProvider: StateProvider,
    private keyDefinition: UserKeyDefinition<ClientType>,
    private toSdk: (value: ClientType) => SdkType,
    private fromSdk: (value: SdkType) => ClientType,
  ) {}

  async get(): Promise<SdkType | null> {
    const state = await firstValueFrom(this.stateProvider.getUser(this.userId, this.keyDefinition).state$);
    return state ? this.toSdk(state) : null;
  }

  async set(value: SdkType): Promise<void> {
    await this.stateProvider.getUser(this.userId, this.keyDefinition).update(() => this.fromSdk(value));
  }

  async remove(): Promise<void> {
    await this.stateProvider.getUser(this.userId, this.keyDefinition).update((): any => null);
  }
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

  private getUserState() {
    return this.stateProvider.getUser(this.userId, this.mapper.userKeyDefinition());
  }

  private async getRecord(): Promise<Record<string, ClientType>> {
    return await firstValueFrom(this.getUserState().state$.pipe(map((state) => state ?? {})));
  }
}
