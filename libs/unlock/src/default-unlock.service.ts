import { Observable, Subject, firstValueFrom, map } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { assertNonNullish } from "@bitwarden/common/auth/utils";
import { AccountCryptographicStateService } from "@bitwarden/common/key-management/account-cryptography/account-cryptographic-state.service";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { V2UpgradeTokenStateService } from "@bitwarden/common/key-management/upgrade-token/abstractions/v2-upgrade-token-state.service.abstraction";
import { RegisterSdkService } from "@bitwarden/common/platform/abstractions/sdk/register-sdk.service";
import { asUuid } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { Ref } from "@bitwarden/common/platform/misc/reference-counting/rc";
import { USER_EVER_HAD_USER_KEY } from "@bitwarden/common/platform/services/key-state/user-key.state";
import {
  BiometricsService,
  BiometricStateService,
  KdfConfigService,
} from "@bitwarden/key-management";
// eslint-disable-next-line no-restricted-imports
import { KdfConfig, SymmetricCryptoKey } from "@bitwarden/legacy-crypto";
import { LogService } from "@bitwarden/logging";
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

const PERF_TRACK_GROUP = "Unlock";
const PERF_TOTAL = "unlock";

/** DevTools track per unlock method, e.g. "Unlock with MasterPassword". */
function unlockTrack(method: UnlockMethod): string {
  return `Unlock with ${method.charAt(0).toUpperCase()}${method.slice(1)}`;
}

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
    private autoUnlockService: AutoUnlockService,
  ) {}

  registerOnUnlockAction(
    action: (userId: UserId, userKey: SymmetricCryptoKey, method: UnlockMethod) => Promise<void>,
  ): void {
    this.onUnlockActions.push(action);
  }

  async unlockWithPin(userId: UserId, pin: string): Promise<void> {
    const measurement = this.logService.startMeasurement(
      PERF_TRACK_GROUP,
      unlockTrack(UnlockMethod.Pin),
      PERF_TOTAL,
    );
    await this.unlockWithMethod(
      userId,
      {
        pinState: {
          pin,
        },
      },
      UnlockMethod.Pin,
    );
    measurement.finish();
  }

  async unlockWithMasterPassword(userId: UserId, masterPassword: string): Promise<void> {
    const measurement = this.logService.startMeasurement(
      PERF_TRACK_GROUP,
      unlockTrack(UnlockMethod.MasterPassword),
      PERF_TOTAL,
    );
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
    measurement.finish();
  }

  async unlockWithBiometrics(userId: UserId): Promise<void> {
    // First, get the biometrics-protected user key. This will prompt the user to authenticate with biometrics.
    const promptMeasurement = this.logService.startMeasurement(
      PERF_TRACK_GROUP,
      unlockTrack(UnlockMethod.Biometrics),
      "biometricPrompt",
    );
    const userKey = await this.biometricsService.unlockWithBiometricsForUser(userId);
    promptMeasurement.finish();
    if (!userKey) {
      throw new Error("Failed to unlock with biometrics");
    }

    // Now that we have the biometrics-protected user key, we can initialize the SDK with it to complete the unlock process.
    const measurement = this.logService.startMeasurement(
      PERF_TRACK_GROUP,
      unlockTrack(UnlockMethod.Biometrics),
      PERF_TOTAL,
    );
    await this.unlockWithMethod(
      userId,
      {
        decryptedKey: {
          decrypted_user_key: userKey.toSdk(),
        },
      },
      UnlockMethod.Biometrics,
    );
    measurement.finish();
  }

  async unlockWithKeyConnector(
    userId: UserId,
    keyConnectorUnlockData: KeyConnectorUnlockData,
  ): Promise<void> {
    // The SDK is responsible for fetching the key-connector-key from the key-connector using the
    // key-connector-unlock-data. It will unwrap the provided key and set it to state, unlocking
    // the vault.
    const measurement = this.logService.startMeasurement(
      PERF_TRACK_GROUP,
      unlockTrack(UnlockMethod.KeyConnector),
      PERF_TOTAL,
    );
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
    measurement.finish();
  }

  async unlockWithDecryptedUserKey(
    userId: UserId,
    userKey: SymmetricCryptoKey,
    method: UnlockMethod = UnlockMethod.DecryptedUserKey,
  ): Promise<void> {
    const measurement = this.logService.startMeasurement(
      PERF_TRACK_GROUP,
      unlockTrack(method),
      PERF_TOTAL,
    );
    await this.unlockWithMethod(
      userId,
      {
        decryptedKey: {
          decrypted_user_key: userKey.toSdk(),
        },
      },
      method,
    );
    measurement.finish();
  }

  async unlockFromSharedUnlock(userId: UserId, userKey: SymmetricCryptoKey): Promise<void> {
    const measurement = this.logService.startMeasurement(
      PERF_TRACK_GROUP,
      unlockTrack(UnlockMethod.SharedUnlock),
      PERF_TOTAL,
    );
    await this.unlockWithMethod(
      userId,
      {
        decryptedKey: {
          decrypted_user_key: userKey.toSdk(),
        },
      },
      UnlockMethod.SharedUnlock,
    );
    measurement.finish();
  }

  async unlockWithAutoUnlockKey(userId: UserId): Promise<boolean> {
    if (userId == null) {
      return false;
    }

    const userKey = await this.autoUnlockService.getAutoUnlockKey(userId);
    if (userKey == null) {
      return false;
    }

    const measurement = this.logService.startMeasurement(
      PERF_TRACK_GROUP,
      unlockTrack(UnlockMethod.AutoKey),
      PERF_TOTAL,
    );
    await this.unlockWithMethod(
      userId,
      {
        decryptedKey: {
          decrypted_user_key: userKey.toSdk(),
        },
      },
      UnlockMethod.AutoKey,
    );
    measurement.finish();
    return true;
  }

  private async unlockWithMethod(
    userId: UserId,
    initMethod: InitUserCryptoMethod,
    unlockMethod: UnlockMethod,
  ): Promise<void> {
    const registerMeasurement = this.logService.startMeasurement(
      PERF_TRACK_GROUP,
      unlockTrack(unlockMethod),
      "registerClient",
    );
    await firstValueFrom(
      this.registerSdkService.registerClient$(userId).pipe(
        map(async (sdk) => {
          registerMeasurement.finish();
          if (!sdk) {
            throw new Error("SDK not available");
          }

          using ref = sdk.take();

          const paramsMeasurement = this.logService.startMeasurement(
            PERF_TRACK_GROUP,
            unlockTrack(unlockMethod),
            "gatherParams",
          );
          const params = {
            kdfParams: await this.getKdfParams(userId),
            email: await this.getEmail(userId),
            accountCryptographicState: await this.getAccountCryptographicState(userId),
            upgradeToken: await this.getV2UpgradeToken(userId),
          };
          paramsMeasurement.finish();

          // Includes key derivation for master password and PIN unlocks
          const cryptoMeasurement = this.logService.startMeasurement(
            PERF_TRACK_GROUP,
            unlockTrack(unlockMethod),
            "initializeUserCrypto",
          );
          await ref.value.crypto().initialize_user_crypto({
            userId: asUuid(userId),
            ...params,
            method: initMethod,
          });
          cryptoMeasurement.finish();

          const sideEffectsMeasurement = this.logService.startMeasurement(
            PERF_TRACK_GROUP,
            unlockTrack(unlockMethod),
            "sideEffects",
          );
          await this.runOnUnlockSideEffects(userId, ref, unlockMethod);
          sideEffectsMeasurement.finish();
        }),
      ),
    );
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
  private async runOnUnlockSideEffects(
    userId: UserId,
    client: Ref<PasswordManagerClient>,
    method: UnlockMethod,
  ): Promise<void> {
    const userKey = SymmetricCryptoKey.fromString(
      await client.value.crypto().get_user_encryption_key(),
    );
    const biometricsMeasurement = this.logService.startMeasurement(
      PERF_TRACK_GROUP,
      unlockTrack(method),
      "setBiometricKey",
    );
    if (await firstValueFrom(this.biometricStateService.biometricUnlockEnabled$(userId))) {
      await this.biometricsService.setBiometricProtectedUnlockKeyForUser(userId, userKey);
    }
    biometricsMeasurement.finish();

    const autoUnlockMeasurement = this.logService.startMeasurement(
      PERF_TRACK_GROUP,
      unlockTrack(method),
      "setAutoUnlockKey",
    );
    await this.autoUnlockService.setAutoUnlockKey(userId, userKey);
    autoUnlockMeasurement.finish();

    await this.stateProvider.setUserState(USER_EVER_HAD_USER_KEY, true, userId);

    const actionsMeasurement = this.logService.startMeasurement(
      PERF_TRACK_GROUP,
      unlockTrack(method),
      "onUnlockActions",
    );
    await this.runOnUnlockActions(userId, userKey, method);
    actionsMeasurement.finish();
    await this.runUnlockActionInOtherProcess(userId, userKey, method);
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
