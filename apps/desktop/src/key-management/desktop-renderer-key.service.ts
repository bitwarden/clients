import { BehaviorSubject, distinctUntilChanged, firstValueFrom, map, Observable } from "rxjs";

import { AccountCryptographicStateService } from "@bitwarden/common/key-management/account-cryptography/account-cryptographic-state.service";
import { USER_KEY } from "@bitwarden/common/key-management/state-definitions";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { StateProvider } from "@bitwarden/common/platform/state";
import { UserId } from "@bitwarden/common/types/guid";
import { UserKey } from "@bitwarden/common/types/key";
import { BiometricsService, DefaultKeyService } from "@bitwarden/key-management";
// eslint-disable-next-line no-restricted-imports
import {
  CryptoFunctionService,
  EncryptService,
  SymmetricCryptoKey,
} from "@bitwarden/legacy-crypto";

import { UnlockSessionsResponse } from "./unlock/unlock-ipc.types";

/** The renderer's copy of the keys main holds. */
class UserKeyStore {
  private readonly keys$ = new BehaviorSubject<Record<UserId, UserKey | null>>({});
  /**
   * Serialises applications so they land in arrival order.
   *
   * Main pushes over IPC and the listener cannot await, so a second push can start while the
   * first is still writing. See {@link replaceAll}.
   */
  private applying: Promise<void> = Promise.resolve();

  constructor(private readonly stateProvider: StateProvider) {}

  get$(userId: UserId): Observable<UserKey | null> {
    return this.keys$.pipe(
      map((keys) => keys[userId] ?? null),
      // Rewriting the same key must not make consumers, e.g. vault decryption, start over.
      distinctUntilChanged((a, b) => a?.keyB64 === b?.keyB64),
    );
  }

  async has(userId: UserId): Promise<boolean> {
    return (await firstValueFrom(this.get$(userId))) != null;
  }

  /**
   * Replaces everything held with the set main reported.
   *
   * Applications are chained because each awaits a state write per key, and an empty set awaits
   * none. Interleaved, a lock carrying no keys can finish before an unlock that arrived earlier,
   * leaving the renderer holding a key main has already dropped.
   */
  async replaceAll(keys: Record<UserId, UserKey>): Promise<void> {
    this.applying = this.applying.then(() => this.apply(keys));
    await this.applying;
  }

  private async apply(keys: Record<UserId, UserKey>): Promise<void> {
    for (const [userId, key] of Object.entries(keys)) {
      await this.stateProvider.setUserState(USER_KEY, key, userId as UserId);
    }

    // A key main no longer holds has to leave state too, not just the cache: the SDK's bridge
    // reads it from there, so leaving it behind keeps a locked account's key usable.
    for (const userId of Object.keys(this.keys$.value) as UserId[]) {
      if (keys[userId] == null) {
        await this.stateProvider.setUserState(USER_KEY, null, userId);
      }
    }

    this.keys$.next(keys);
  }
}

/** The renderer's {@link KeyService}. Reads the user key from main over IPC. */
export class DesktopRendererKeyService extends DefaultKeyService {
  private readonly userKeys: UserKeyStore;

  constructor(
    cryptoFunctionService: CryptoFunctionService,
    encryptService: EncryptService,
    platformUtilService: PlatformUtilsService,
    logService: LogService,
    stateService: StateService,
    stateProvider: StateProvider,
    accountCryptographyStateService: AccountCryptographicStateService,
    biometricsService: BiometricsService,
    sdkService: SdkService,
  ) {
    super(
      cryptoFunctionService,
      encryptService,
      platformUtilService,
      logService,
      stateService,
      stateProvider,
      accountCryptographyStateService,
      biometricsService,
      sdkService,
    );

    this.userKeys = new UserKeyStore(stateProvider);

    // Main pushes the whole set whenever it changes, so there is nothing to infer from lock,
    // logout and unlock announcements. The pull covers the window before the first push.
    ipc.keyManagement.unlock.onUnlockSessionsChanged(
      ({ unlocked }) => void this.applyUnlockSessions(unlocked),
    );
    void this.loadInitialUserKeys();
  }

  override userKey$(userId: UserId): Observable<UserKey | null> {
    return this.userKeys.get$(userId);
  }

  override async hasUserKey(userId: UserId): Promise<boolean> {
    if (userId == null) {
      return false;
    }

    return await this.userKeys.has(userId);
  }

  private async loadInitialUserKeys(): Promise<void> {
    const { unlocked } = await ipc.keyManagement.unlock.getUnlockSessions();
    await this.applyUnlockSessions(unlocked);
  }

  private async applyUnlockSessions(unlocked: UnlockSessionsResponse["unlocked"]): Promise<void> {
    const keys: Record<UserId, UserKey> = {};
    for (const [userId, session] of Object.entries(unlocked)) {
      keys[userId as UserId] = SymmetricCryptoKey.fromString(session.userKeyB64) as UserKey;
    }
    await this.userKeys.replaceAll(keys);
  }
}
