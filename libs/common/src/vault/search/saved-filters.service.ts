import { Observable, combineLatestWith, map, mergeMap } from "rxjs";
import { Tagged } from "type-fest/source/opaque";

// eslint-disable-next-line no-restricted-imports --- TODO move this outside of common
import { KeyService } from "../../../../key-management/src/abstractions/key.service";
import { EncryptService } from "../../key-management/crypto/abstractions/encrypt.service";
import { EncString, EncryptedString } from "../../platform/models/domain/enc-string";
import { SymmetricCryptoKey } from "../../platform/models/domain/symmetric-crypto-key";
import {
  SingleUserStateProvider,
  UserKeyDefinition,
  VAULT_SETTINGS_DISK,
} from "../../platform/state";
import { OrganizationId, UserId } from "../../types/guid";

export abstract class SavedFiltersService {
  abstract filtersFor$(userId: UserId): Observable<Record<FilterName, FilterString>>;
  abstract saveFilter(userId: UserId, name: FilterName, filter: FilterString): Promise<void>;
  abstract deleteFilter(userId: UserId, name: FilterName): Promise<void>;
}

export type FilterName = string & Tagged<"FilterName">;
export type FilterString = string & Tagged<"FilterString">;

type UserSearchFilters = Record<EncryptedString, EncString>;
type DecryptedSearchFilters = Record<FilterName, FilterString>;

const SavedFiltersStateDefinition = new UserKeyDefinition<UserSearchFilters>(
  VAULT_SETTINGS_DISK,
  "SavedFilters",
  {
    deserializer: (value) => {
      if (value == null) {
        return {};
      }

      const result: Record<EncryptedString, EncString> = {};
      for (const [k, v] of Object.entries(value)) {
        const key = k as EncryptedString;
        result[key] = EncString.fromJSON(v);
      }
      return result;
    },
    clearOn: ["logout"],
  },
);

export class DefaultSavedFiltersService implements SavedFiltersService {
  constructor(
    private readonly stateProvider: SingleUserStateProvider,
    private readonly encryptService: EncryptService,
    private readonly keyService: KeyService,
  ) {}

  filtersFor$(userId: UserId, orgId?: OrganizationId): Observable<DecryptedSearchFilters> {
    const state = this.stateProvider.get(userId, SavedFiltersStateDefinition);
    const decryptedState = state.state$.pipe(
      combineLatestWith(this.keyService.userKey$(userId)),
      mergeMap(async ([state, userKey]) => {
        if (userKey == null || state == null) {
          return {};
        }
        return await this.decryptFilters(state, userKey);
      }),
    );

    return decryptedState;
  }

  async saveFilter(userId: UserId, name: FilterName, filter: FilterString): Promise<void> {
    const state = this.stateProvider.get(userId, SavedFiltersStateDefinition);
    await state.update((_, newState) => newState, {
      combineLatestWith: state.state$.pipe(
        combineLatestWith(this.keyService.userKey$(userId)),
        mergeMap(async ([encrypted, userKey]) => {
          return [await this.decryptFilters(encrypted, userKey), userKey] as const;
        }),
        map(([oldState, userKey]) => {
          oldState ??= {};
          oldState[name] = filter;
          return [oldState, userKey] as const;
        }),
        mergeMap(async ([newState, userKey]) => {
          return await this.encryptFilters(newState, userKey);
        }),
      ),
      shouldUpdate: (oldEncrypted, newEncrypted) => !recordsEqual(oldEncrypted, newEncrypted),
    });
  }

  async deleteFilter(userId: UserId, name: FilterName): Promise<void> {
    const state = this.stateProvider.get(userId, SavedFiltersStateDefinition);
    await state.update((_, newState) => newState, {
      combineLatestWith: state.state$.pipe(
        combineLatestWith(this.keyService.userKey$(userId)),
        mergeMap(async ([encrypted, userKey]) => {
          return [await this.decryptFilters(encrypted, userKey), userKey] as const;
        }),
        map(([oldState, userKey]) => {
          oldState ??= {};
          delete oldState[name];
          return [oldState, userKey] as const;
        }),
        mergeMap(async ([newState, userKey]) => {
          return await this.encryptFilters(newState, userKey);
        }),
      ),
      shouldUpdate: (oldEncrypted, newEncrypted) => !recordsEqual(oldEncrypted, newEncrypted),
    });
  }

  private async decryptFilters(
    filters: UserSearchFilters | null,
    userKey: SymmetricCryptoKey | null,
  ): Promise<DecryptedSearchFilters> {
    const decrypted: DecryptedSearchFilters = {};
    if (filters == null || userKey == null) {
      return decrypted;
    }

    for (const [k, v] of Object.entries(filters)) {
      const encryptedKey = new EncString(k as EncryptedString);
      const key = (await encryptedKey.decryptWithKey(userKey, this.encryptService)) as FilterName;
      decrypted[key] = (await v.decryptWithKey(userKey, this.encryptService)) as FilterString;
    }
    return decrypted;
  }

  private async encryptFilters(
    filters: DecryptedSearchFilters | null,
    userKey: SymmetricCryptoKey | null,
  ) {
    if (filters == null || userKey == null) {
      return null;
    }

    const encrypted: UserSearchFilters = {};
    for (const [k, v] of Object.entries(filters)) {
      const DecryptedKey = k as FilterName;
      const key = (await this.encryptService.encrypt(DecryptedKey, userKey)).encryptedString!;
      encrypted[key] = await this.encryptService.encrypt(v, userKey);
    }
    return encrypted;
  }
}

function recordsEqual(
  a: Record<string, EncString> | null,
  b: Record<string, EncString> | null,
): boolean {
  if (a == null && b == null) {
    return true;
  }
  if (a == null || b == null) {
    return false;
  }
  if (Object.keys(a).length !== Object.keys(b).length) {
    return false;
  }
  for (const k of Object.keys(a)) {
    if (a[k].encryptedString !== b[k].encryptedString) {
      return false;
    }
  }
  return true;
}
