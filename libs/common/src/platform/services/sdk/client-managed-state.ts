import { filter, firstValueFrom, map, Observable, race, timer } from "rxjs";

import { PersistedValue, Repository, StateClient } from "@bitwarden/sdk-internal";

import { OrganizationRecordMapper } from "../../../admin-console/models/domain/organization-sdk-mapper";
import { PolicyRecordMapper } from "../../../admin-console/models/domain/policy-sdk-mapper";
import { LocalUserDataKeyRecordMapper } from "../../../key-management/local-user-data-key-mapper";
import { SendRecordMapper } from "../../../tools/send/models/domain/send-sdk-mapper";
import { UserId } from "../../../types/guid";
import { CipherRecordMapper } from "../../../vault/models/domain/cipher-sdk-mapper";
import { StateProvider, UserKeyDefinition } from "../../state";

/**
 * Registers the client's storage for the SDK's client-managed repositories and persisted values.
 *
 * The SDK defines one field per repository or value it lets clients manage. Set a field to `null`
 * to leave that state in SDK-managed storage.
 */
export async function initializeClientManagedState(
  userId: UserId,
  stateClient: StateClient,
  stateProvider: StateProvider,
): Promise<void> {
  const repository = <ClientType, SdkType>(
    Mapper: new () => SdkRecordMapper<ClientType, SdkType>,
    optimisticWrite = false,
  ) => new RepositoryRecord(userId, stateProvider, new Mapper(), optimisticWrite);
  // Uncomment this helper when the first persisted value is added.
  // const value = <ClientType, SdkType>(Mapper: new () => SdkValueMapper<ClientType, SdkType>) =>
  //   new PersistedValueState(userId, stateProvider, new Mapper());

  // Register repositories here. Implement an `SdkRecordMapper` in the owning team's folder, then
  // pass its class to `repository(...)`. Its state must be a `Record<string, ClientType>` keyed
  // by id.
  stateClient.register_client_managed_repositories({
    cipher: repository(CipherRecordMapper, true),
    folder: null,
    local_user_data_key_state: repository(LocalUserDataKeyRecordMapper),
    organization: repository(OrganizationRecordMapper),
    organization_shared_key: null,
    policy: repository(PolicyRecordMapper),
    send: repository(SendRecordMapper, true),
  });

  // Register persisted values here. Implement an `SdkValueMapper` in the owning team's folder, then
  // pass its class to `value(...)`.
  stateClient.register_client_managed_values({
    last_sync: null,
  });
}

/**
 * Converts between client and SDK representations of a value, and names the user-scoped state the
 * client stores it in. `StateType` is what that state holds, when it differs from `ClientType`.
 */
export interface SdkValueMapper<ClientType, SdkType, StateType = ClientType> {
  userKeyDefinition(): UserKeyDefinition<StateType>;
  toSdk(value: ClientType): SdkType;
  fromSdk(value: SdkType): ClientType;
}

/** A mapper for records stored as a `Record<string, ClientType>`, mapping each element. */
export type SdkRecordMapper<ClientType, SdkType> = SdkValueMapper<
  ClientType,
  SdkType,
  Record<string, ClientType>
>;

/**
 * SDK Repository implementation backed by the client's state provider.
 *
 * Maps between SDK and client types via {@link SdkRecordMapper}, storing records
 * as a `Record<string, ClientType>` in user-scoped state.
 */
export class RepositoryRecord<ClientType, SdkType> implements Repository<SdkType> {
  /**
   * @param userId The user whose state this repository manages.
   * @param stateProvider The state provider used to read and write user-scoped state.
   * @param mapper Converts between client and SDK representations of the stored records.
   * @param optimisticWrite When `false` (default), writes are atomic — each mutation waits
   * (up to 1000ms) for the `state$` observable to reflect the change before returning.
   * This prevents race conditions where a subsequent `get` reads stale data.
   * Set to `true` to skip this wait (e.g. for high-throughput state like ciphers
   * where eventual consistency is acceptable).
   */
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
    const expected = JSON.stringify(newValue);
    await this.waitUntilChanged((state) => JSON.stringify(state[id]) === expected);
  }

  async setBulk(values: [string, SdkType][]): Promise<void> {
    const mapped = Object.fromEntries(
      values.map(([id, value]) => [id, this.mapper.fromSdk(value)]),
    );
    await this.getUserState().update((state) => ({
      ...(state ?? {}),
      ...mapped,
    }));
    const expectedEntries = Object.entries(mapped).map(([k, v]) => [k, JSON.stringify(v)] as const);
    await this.waitUntilChanged((state) =>
      expectedEntries.every(([k, v]) => JSON.stringify(state[k]) === v),
    );
  }

  async remove(id: string): Promise<void> {
    await this.getUserState().update((state) => {
      if (!state || !(id in state)) {
        return state;
      }
      return Object.fromEntries(Object.entries(state).filter(([key]) => key !== id));
    });
    await this.waitUntilChanged((state) => !(id in state));
  }

  async removeBulk(keys: string[]): Promise<void> {
    const keysToRemove = new Set(keys);
    await this.getUserState().update((state) => {
      if (!state || !keys.some((key) => key in state)) {
        return state;
      }
      return Object.fromEntries(Object.entries(state).filter(([key]) => !keysToRemove.has(key)));
    });
    await this.waitUntilChanged((state) => keys.every((key) => !(key in state)));
  }

  async removeAll(): Promise<void> {
    await this.getUserState().update(() => ({}));
    await this.waitUntilChanged((state) => Object.keys(state).length === 0);
  }

  private getUserState() {
    return this.stateProvider.getUser(this.userId, this.mapper.userKeyDefinition());
  }

  private async getRecord(): Promise<Record<string, ClientType>> {
    return await firstValueFrom(this.getUserState().state$.pipe(map((state) => state ?? {})));
  }

  /**
   * Waits until the underlying state observable matches the predicate, for up to 1000ms.
   * @param predicate a check against the current state, returning true when the expected change is reflected.
   */
  private async waitUntilChanged(
    predicate: (state: Record<string, ClientType>) => boolean,
  ): Promise<void> {
    if (this.optimisticWrite) {
      return;
    }
    await waitUntil(this.getUserState().state$.pipe(map((state) => state ?? {})), predicate);
  }
}

/**
 * SDK PersistedValue implementation backed by the client's state provider.
 *
 * Maps between SDK and client types via {@link SdkValueMapper}, storing the value in user-scoped
 * state. Writes wait (up to 1000ms) for the `state$` observable to reflect the change, so a
 * subsequent `get` doesn't read stale data.
 */
export class PersistedValueState<ClientType, SdkType> implements PersistedValue<SdkType> {
  /**
   * @param userId The user whose state this value belongs to.
   * @param stateProvider The state provider used to read and write user-scoped state.
   * @param mapper Converts between client and SDK representations of the value.
   */
  constructor(
    private userId: UserId,
    private stateProvider: StateProvider,
    private mapper: SdkValueMapper<ClientType, SdkType>,
  ) {}

  async get(): Promise<SdkType | null> {
    const value = await firstValueFrom(this.getUserState().state$);
    return value != null ? this.mapper.toSdk(value) : null;
  }

  async set(value: SdkType): Promise<void> {
    const newValue = this.mapper.fromSdk(value);
    await this.getUserState().update(() => newValue);
    const expected = JSON.stringify(newValue);
    await waitUntil(this.getUserState().state$, (state) => JSON.stringify(state) === expected);
  }

  async remove(): Promise<void> {
    await this.getUserState().update((): ClientType | null => null);
    await waitUntil(this.getUserState().state$, (state) => state == null);
  }

  private getUserState() {
    return this.stateProvider.getUser(this.userId, this.mapper.userKeyDefinition());
  }
}

/**
 * Waits until `state$` emits a value matching the predicate, for up to 1000ms.
 * @param predicate a check against the current state, returning true when the expected change is reflected.
 */
async function waitUntil<T>(
  state$: Observable<T>,
  predicate: (state: T) => boolean,
): Promise<void> {
  await firstValueFrom(race(state$.pipe(filter(predicate)), timer(1000)));
}
