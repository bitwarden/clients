import { Observable, Subject, firstValueFrom, map } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { assertNonNullish } from "@bitwarden/common/auth/utils";
import { AccountCryptographicStateService } from "@bitwarden/common/key-management/account-cryptography/account-cryptographic-state.service";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { V2UpgradeTokenStateService } from "@bitwarden/common/key-management/upgrade-token/abstractions/v2-upgrade-token-state.service.abstraction";
import { RegisterSdkService } from "@bitwarden/common/platform/abstractions/sdk/register-sdk.service";
import {
  asUuid,
  SdkService,
  SdkUnlockRequest,
} from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { Ref } from "@bitwarden/common/platform/misc/reference-counting/rc";
import { USER_EVER_HAD_USER_KEY } from "@bitwarden/common/platform/services/key-state/user-key.state";
import { UserKey } from "@bitwarden/common/types/key";
import {
  BiometricsService,
  BiometricStateService,
  KdfConfigService,
  KeyService,
  SdkUnlockData,
} from "@bitwarden/key-management";
// eslint-disable-next-line no-restricted-imports
import { KdfConfig, SymmetricCryptoKey } from "@bitwarden/legacy-crypto";
import { LogService, measured, PerfTrackGroup } from "@bitwarden/logging";
import {
  EncString,
  InitUserCryptoMethod,
  Kdf,
  MasterPasswordUnlockData,
  PasswordManagerClient,
  V2UpgradeToken,
  WrappedAccountCryptographicState,
} from "@bitwarden/sdk-internal";
import { StateProvider } from "@bitwarden/state";
import { UserId } from "@bitwarden/user-core";

import { AutoUnlockService } from "./auto-unlock.service";
import { UnlockMethod } from "./unlock-method.enum";
import { UnlockEvent, UnlockService } from "./unlock.service";

export type KeyConnectorUnlockData = {
  /**
   * The URL of the key connector. This should be verified by the user manually before being used to unlock.
   */
  url: string;
  /**
   * The user-key wrapped by the key-connector-key
   */
  keyConnectorKeyWrappedUserKey: EncString;
};

const PERF_TRACK_GROUP = PerfTrackGroup.Unlock;
const PERF_TRACK = "Unlock Service";

export class DefaultUnlockService implements UnlockService {
  private onUnlockActions: Array<
    (userId: UserId, userKey: SymmetricCryptoKey, method: UnlockMethod) => Promise<void>
  > = [];
  private _unlocked$ = new Subject<UnlockEvent>();
  readonly unlocked$: Observable<UnlockEvent> = this._unlocked$.asObservable();

  constructor(
    private registerSdkService: RegisterSdkService,
    private accountCryptographicStateService: AccountCryptographicStateService,
    private kdfService: KdfConfigService,
    private accountService: AccountService,
    private masterPasswordService: InternalMasterPasswordServiceAbstraction,
    private stateProvider: StateProvider,
    protected logService: LogService,
    protected biometricsService: BiometricsService,
    private biometricStateService: BiometricStateService,
    private v2UpgradeTokenStateService: V2UpgradeTokenStateService,
    private keyService: KeyService,
    private sdkService: SdkService,
    private autoUnlockService: AutoUnlockService,
  ) {}

  registerOnUnlockAction(
    action: (userId: UserId, userKey: SymmetricCryptoKey, method: UnlockMethod) => Promise<void>,
  ): void {
    this.onUnlockActions.push(action);
  }

  @measured(PERF_TRACK_GROUP, PERF_TRACK)
  async unlockWithPin(userId: UserId, pin: string): Promise<void> {
    await this.unlockWithMethod(
      userId,
      {
        pinState: {
          pin,
        },
      },
      UnlockMethod.Pin,
    );
  }

  @measured(PERF_TRACK_GROUP, PERF_TRACK)
  async unlockWithMasterPassword(userId: UserId, masterPassword: string): Promise<void> {
    await this.unlockWithMethod(
      userId,
      {
        masterPasswordUnlock: {
          password: masterPassword,
          master_password_unlock: await this.getMasterPasswordUnlockData(userId),
        },
      },
      UnlockMethod.MasterPassword,
    );
  }

  @measured(PERF_TRACK_GROUP, PERF_TRACK)
  async unlockWithBiometrics(userId: UserId): Promise<void> {
    // First, get the biometrics-protected user key. This will prompt the user to authenticate with biometrics.
    const userKey = await this.biometricsService.unlockWithBiometricsForUser(userId);
    if (!userKey) {
      throw new Error("Failed to unlock with biometrics");
    }

    // Now that we have the biometrics-protected user key, we can initialize the SDK with it to complete the unlock process.
    await this.unlockWithMethod(
      userId,
      {
        decryptedKey: {
          decrypted_user_key: userKey.toSdk(),
        },
      },
      UnlockMethod.Biometrics,
    );
  }

  @measured(PERF_TRACK_GROUP, PERF_TRACK)
  async unlockWithKeyConnector(
    userId: UserId,
    keyConnectorUnlockData: KeyConnectorUnlockData,
  ): Promise<void> {
    // The SDK is responsible for fetching the key-connector-key from the key-connector using the
    // key-connector-unlock-data. It will unwrap the provided key and set it to state, unlocking
    // the vault.
    await this.unlockWithMethod(
      userId,
      {
        keyConnectorUrl: {
          url: keyConnectorUnlockData.url,
          key_connector_key_wrapped_user_key: keyConnectorUnlockData.keyConnectorKeyWrappedUserKey,
        },
      },
      UnlockMethod.KeyConnector,
    );
  }

  @measured(PERF_TRACK_GROUP, PERF_TRACK)
  async unlockWithDecryptedUserKey(
    userId: UserId,
    userKey: SymmetricCryptoKey,
    method: UnlockMethod = UnlockMethod.DecryptedUserKey,
  ): Promise<void> {
    await this.unlockWithMethod(
      userId,
      {
        decryptedKey: {
          decrypted_user_key: userKey.toSdk(),
        },
      },
      method,
    );
  }

  @measured(PERF_TRACK_GROUP, PERF_TRACK)
  async unlockFromSharedUnlock(userId: UserId, userKey: SymmetricCryptoKey): Promise<void> {
    await this.unlockWithMethod(
      userId,
      {
        decryptedKey: {
          decrypted_user_key: userKey.toSdk(),
        },
      },
      UnlockMethod.SharedUnlock,
    );
  }

  @measured(PERF_TRACK_GROUP, PERF_TRACK)
  async unlockWithAutoUnlockKey(userId: UserId): Promise<boolean> {
    if (userId == null) {
      return false;
    }

    const userKey = await this.autoUnlockService.getAutoUnlockKey(userId);
    if (userKey == null) {
      return false;
    }

    await this.unlockWithMethod(
      userId,
      {
        decryptedKey: {
          decrypted_user_key: userKey.toSdk(),
        },
      },
      UnlockMethod.AutoKey,
    );
    return true;
  }

  @measured(PERF_TRACK_GROUP, PERF_TRACK)
  private async unlockWithMethod(
    userId: UserId,
    initMethod: InitUserCryptoMethod,
    unlockMethod: UnlockMethod,
  ): Promise<void> {
    const request: SdkUnlockRequest = {
      userId: asUuid(userId),
      accountCryptographicState: await this.getAccountCryptographicState(userId),
      method: initMethod,
    };

    // A user's live SDK client unlocks directly and returns the user key. Organization keys can
    // only be built once that key exists, so they follow in the unlock side effects.
    const userKey = await this.sdkService.unlock(userId, request);
    if (userKey != null) {
      await this.runOnUnlockSideEffects(userId, userKey, unlockMethod);
      return;
    }

    await firstValueFrom(
      this.registerSdkService.registerClient$(userId).pipe(
        map(async (sdk) => {
          if (!sdk) {
            throw new Error("SDK not available");
          }

          using ref = sdk.take();

          await this.initializeUserCrypto(userId, ref, request);
          const registeredUserKey = SymmetricCryptoKey.fromString(
            await ref.value.crypto().get_user_encryption_key(),
          );
          await this.runOnUnlockSideEffects(userId, registeredUserKey, unlockMethod);
        }),
      ),
    );
  }

  // Includes key derivation for master password and PIN unlocks
  @measured(PERF_TRACK_GROUP, PERF_TRACK)
  private async initializeUserCrypto(
    userId: UserId,
    client: Ref<PasswordManagerClient>,
    request: SdkUnlockRequest,
  ): Promise<void> {
    await client.value.crypto().initialize_user_crypto({
      ...request,
      kdfParams: await this.getKdfParams(userId),
      email: await this.getEmail(userId),
      upgradeToken: await this.getV2UpgradeToken(userId),
    });
  }

  private async getAccountCryptographicState(
    userId: UserId,
  ): Promise<WrappedAccountCryptographicState> {
    const accountCryptographicState = await firstValueFrom(
      this.accountCryptographicStateService.accountCryptographicState$(userId),
    );
    assertNonNullish(accountCryptographicState, "Account cryptographic state is required");
    return accountCryptographicState!;
  }

  private async getKdfParams(userId: UserId): Promise<Kdf> {
    const kdfParams = await firstValueFrom(
      this.kdfService.getKdfConfig$(userId).pipe(
        map((config: KdfConfig | null) => {
          return config?.toSdkConfig();
        }),
      ),
    );
    assertNonNullish(kdfParams, "KDF parameters are required");
    return kdfParams!;
  }

  private async getEmail(userId: UserId): Promise<string> {
    const accounts = await firstValueFrom(this.accountService.accounts$);
    const email = accounts[userId].email;
    assertNonNullish(email, "Email is required");
    return email;
  }

  private async getMasterPasswordUnlockData(userId: UserId): Promise<MasterPasswordUnlockData> {
    const unlockData = await firstValueFrom(
      this.masterPasswordService.masterPasswordUnlockData$(userId),
    );
    assertNonNullish(unlockData, "Master password unlock data is required");
    return unlockData.toSdk();
  }

  private async getV2UpgradeToken(userId: UserId): Promise<V2UpgradeToken | undefined> {
    return (
      (await firstValueFrom(this.v2UpgradeTokenStateService.v2UpgradeToken$(userId))) ?? undefined
    );
  }

  // When unlocking, certain side-effects must be run, such as setting the never-lock key and the biometrics key.
  // Currently this does not happen from within the SDK but form here instead.
  @measured(PERF_TRACK_GROUP, PERF_TRACK)
  private async runOnUnlockSideEffects(
    userId: UserId,
    userKey: SymmetricCryptoKey,
    method: UnlockMethod,
  ): Promise<void> {
    try {
      if (await firstValueFrom(this.biometricStateService.biometricUnlockEnabled$(userId))) {
        await this.biometricsService.setBiometricProtectedUnlockKeyForUser(userId, userKey);
      }
      await this.autoUnlockService.setAutoUnlockKey(userId, userKey);
      await this.pushOrgKeys(userId, userKey as UserKey);
      // A lock that lands during the side effects leaves the client locked, and applying the
      // organization keys to a locked client does nothing. The unlock must fail rather than
      // carry on as if it had succeeded.
      if (!(await firstValueFrom(this.sdkService.cryptoReady$(userId)))) {
        throw new Error(`The SDK client of user (${userId}) was locked during unlock`);
      }
    } catch (e) {
      // Until the organization keys are applied, the user's live SDK client holds keys that the
      // rest of the client never got to use. A failed unlock must not leave them there while the
      // user is reported locked. Once they are applied, the client is ready and consistent with
      // state, so later failures leave the user unlocked. `lock` never rejects.
      await this.sdkService.lock(userId);
      throw e;
    }
    await this.stateProvider.setUserState(USER_EVER_HAD_USER_KEY, true, userId);

    await this.runOnUnlockActions(userId, userKey, method);
    await this.runUnlockActionInOtherProcess(userId, userKey, method);
  }

  /**
   * Gives the user's SDK client the organization keys. The push happens even when the keys
   * cannot be built, so the client always receives a set of organization keys after an unlock.
   * Building them must not fail the unlock.
   */
  private async pushOrgKeys(userId: UserId, userKey: UserKey): Promise<void> {
    let unlockData: SdkUnlockData | null = null;
    try {
      unlockData = await this.keyService.buildSdkUnlockData(userId, userKey);
      if (unlockData == null) {
        this.logService.warning(`Could not build the SDK unlock payload for user (${userId}).`);
      }
    } catch (e) {
      this.logService.error(`Failed to build the SDK unlock payload for user (${userId}).`, e);
    }
    await this.sdkService.setOrgKeys(userId, unlockData?.orgKeys ?? {});
  }

  /**
   * Hook for the unlocks this service performed itself, as opposed to the ones it was handed
   * through {@link runOnUnlockActions}.
   *
   * Clients that have to propagate an unlock to another context of the same client override this.
   * Propagating from {@link registerOnUnlockAction} instead would bounce every unlock back and
   * forth between the two contexts forever.
   */
  protected async runUnlockActionInOtherProcess(
    userId: UserId,
    userKey: SymmetricCryptoKey,
    method: UnlockMethod,
  ): Promise<void> {}

  @measured(PERF_TRACK_GROUP, PERF_TRACK)
  async runOnUnlockActions(
    userId: UserId,
    userKey: SymmetricCryptoKey,
    method: UnlockMethod,
  ): Promise<void> {
    for (const action of this.onUnlockActions) {
      await action(userId, userKey, method);
    }

    this._unlocked$.next({ userId, method });
  }
}
