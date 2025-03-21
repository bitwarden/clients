import { Observable, combineLatestWith, map, mergeMap, of } from "rxjs";

// eslint-disable-next-line no-restricted-imports -- TODO this will need to move
import { KeyService } from "../../../../key-management/src/abstractions/key.service";
import { EncryptService } from "../../key-management/crypto/abstractions/encrypt.service";
import { EncString } from "../../platform/models/domain/enc-string";
import { SymmetricCryptoKey } from "../../platform/models/domain/symmetric-crypto-key";
import {
  SingleUserState,
  SingleUserStateProvider,
  UserKeyDefinition,
  VAULT_SETTINGS_DISK,
} from "../../platform/state";
import { OrganizationId, UserId } from "../../types/guid";

export abstract class SearchHistoryService {
  abstract searchHistory(userId: UserId, orgId?: OrganizationId | undefined): SearchHistory;
}

export class SearchHistory {
  history$: Observable<string[]>;
  private readonly userHistoryIndexer: UserId | OrganizationId;
  constructor(
    readonly userId: UserId,
    readonly orgId: OrganizationId | undefined,
    readonly historyLength: number,
    private readonly userHistory$: Observable<DecryptedSearchHistory>,
    private readonly updateCallback: (newSearch: string) => Promise<void>,
  ) {
    this.userHistoryIndexer = orgId ?? userId;
    this.history$ = of([]);
  }

  async push(newSearch: string) {
    await this.updateCallback(newSearch);
  }
}

type UserSearchHistory = Record<UserId | OrganizationId, EncString[]>;
type DecryptedSearchHistory = Record<UserId | OrganizationId, string[]>;

const SearchHistoryStateDefinition = new UserKeyDefinition<UserSearchHistory>(
  VAULT_SETTINGS_DISK,
  "searchHistory",
  {
    deserializer: (value) => {
      if (value == null) {
        return {};
      }

      const result: Record<UserId | OrganizationId, EncString[]> = {};
      for (const [k, v] of Object.entries(value)) {
        const key = k as UserId | OrganizationId;
        const value = v as string[];
        result[key] = value?.map((v) => new EncString(v)) ?? [];
      }
      return result;
    },
    clearOn: ["logout"],
  },
);

export class DefaultSearchHistoryService implements SearchHistoryService {
  private readonly historyLength = 3;

  constructor(
    private readonly stateProvider: SingleUserStateProvider,
    private readonly encryptService: EncryptService,
    private readonly keyService: KeyService,
  ) {}

  searchHistory(userId: UserId, orgId?: OrganizationId): SearchHistory {
    const state = this.stateProvider.get(userId, SearchHistoryStateDefinition);
    const decryptedState = state.state$.pipe(
      combineLatestWith(this.keyService.userKey$(userId)),
      mergeMap(async ([state, userKey]) => {
        if (userKey == null || state == null) {
          return {};
        }
        return await this.decryptHistory(state, userKey);
      }),
    );

    return new SearchHistory(userId, orgId, this.historyLength, decryptedState, (newSearch) =>
      this.updateHistory(userId, orgId, newSearch, state),
    );
  }

  private async decryptHistory(
    history: UserSearchHistory | null,
    userKey: SymmetricCryptoKey | null,
  ): Promise<DecryptedSearchHistory> {
    const decrypted: DecryptedSearchHistory = {};
    if (history == null || userKey == null) {
      return decrypted;
    }

    for (const [k, v] of Object.entries(history)) {
      const key = k as UserId | OrganizationId;
      decrypted[key] = [];
      for (const item of v) {
        decrypted[key].push(await this.encryptService.decryptToUtf8(item, userKey));
      }
    }
    return decrypted;
  }

  private async encryptHistory(
    history: DecryptedSearchHistory | null,
    userKey: SymmetricCryptoKey | null,
  ) {
    if (history == null || userKey == null) {
      return null;
    }

    const encrypted: UserSearchHistory = {};
    for (const [k, v] of Object.entries(history)) {
      const key = k as UserId | OrganizationId;
      encrypted[key] = [];
      for (const item of v) {
        encrypted[key].push(await this.encryptService.encrypt(item, userKey));
      }
    }
    return encrypted;
  }

  private async updateHistory(
    userId: UserId,
    orgId: OrganizationId | undefined,
    newSearch: string,
    state: SingleUserState<UserSearchHistory>,
  ): Promise<void> {
    const userHistoryIndexer = orgId ?? userId;
    await state.update((_, newState) => newState, {
      combineLatestWith: state.state$.pipe(
        combineLatestWith(this.keyService.userKey$(userId)),
        mergeMap(async ([encrypted, userKey]) => {
          return [await this.decryptHistory(encrypted, userKey), userKey] as const;
        }),
        map(([userHistory, userKey]) => {
          userHistory ??= {};
          const history = userHistory[userHistoryIndexer] ?? [];
          // Use combineLatestWith to update to the latest state
          if (newSearch == null || newSearch === "") {
            userHistory[userHistoryIndexer] = history;
            return [userHistory, userKey] as const;
          }

          if (history == null) {
            userHistory[userHistoryIndexer] = [newSearch];
            return [userHistory, userKey] as const;
          }

          const existing = history.findIndex((prev) => prev === newSearch);
          const newHistory = [...history];
          if (existing > -1) {
            newHistory.splice(existing, 1);
            newHistory.splice(0, 0, newSearch);
          } else {
            newHistory.splice(0, 0, newSearch);
            if (newHistory.length > this.historyLength) {
              newHistory.splice(this.historyLength, newHistory.length - this.historyLength);
            }
          }
          userHistory[userHistoryIndexer] = newHistory;
          return [userHistory, userKey] as const;
        }),
        mergeMap(async ([decrypted, userKey]) => {
          return await this.encryptHistory(decrypted, userKey);
        }),
      ),
      shouldUpdate: (oldHistory, newHistory) => !recordsEqual(oldHistory, newHistory),
    });
  }
}

function stringArraysEqual(
  a: (string | undefined)[] | null,
  b: (string | undefined)[] | null,
): boolean {
  if (a == null && b == null) {
    return true;
  }
  if (a == null || b == null) {
    return false;
  }
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}

function recordsEqual(
  a: Record<string, EncString[]> | null,
  b: Record<string, EncString[]> | null,
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
    if (
      !stringArraysEqual(
        a[k].map((e) => e.encryptedString),
        b[k].map((e) => e.encryptedString),
      )
    ) {
      return false;
    }
  }
  return true;
}
