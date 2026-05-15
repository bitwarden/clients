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
    organization_shared_key: null,
  });
}

export interface SdkRecordMapper<ClientType, SdkType> {
  userKeyDefinition(): UserKeyDefinition<Record<string, ClientType>>;
  toSdk(value: ClientType): SdkType;
  fromSdk(value: SdkType): ClientType;
}

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
    await firstValueFrom(
      race(
        this.getUserState().state$.pipe(
          map((state) => state ?? {}),
          filter(predicate),
        ),
        timer(1000),
      ),
    );
  }
}
