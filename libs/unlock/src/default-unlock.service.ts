import { filter, firstValueFrom, map } from "rxjs";

import { ClientType } from "@bitwarden/client-type";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { assertNonNullish } from "@bitwarden/common/auth/utils";
import { AccountCryptographicStateService } from "@bitwarden/common/key-management/account-cryptography/account-cryptographic-state.service";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { MASTER_KEY } from "@bitwarden/common/key-management/master-password/services/master-password.service";
import { PinStateServiceAbstraction } from "@bitwarden/common/key-management/pin/pin-state.service.abstraction";
import {
  VAULT_TIMEOUT,
  VaultTimeoutStringType,
} from "@bitwarden/common/key-management/vault-timeout";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { RegisterSdkService } from "@bitwarden/common/platform/abstractions/sdk/register-sdk.service";
import { SdkLoadService } from "@bitwarden/common/platform/abstractions/sdk/sdk-load.service";
import { asUuid } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { Ref } from "@bitwarden/common/platform/misc/reference-counting/rc";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { USER_EVER_HAD_USER_KEY } from "@bitwarden/common/platform/services/key-state/user-key.state";
import { MasterKey } from "@bitwarden/common/types/key";
import {
  BiometricsService,
  BiometricStateService,
  KdfConfig,
  KdfConfigService,
} from "@bitwarden/key-management";
import { LogService } from "@bitwarden/logging";
import {
  EncString,
  Kdf,
  MasterPasswordUnlockData,
  PasswordManagerClient,
  PasswordProtectedKeyEnvelope,
  PureCrypto,
  WrappedAccountCryptographicState,
} from "@bitwarden/sdk-internal";
import { StateProvider, StateService } from "@bitwarden/state";
import { UserId } from "@bitwarden/user-core";

import { UnlockService } from "./unlock.service";

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

export class DefaultUnlockService implements UnlockService {
  constructor(
    private registerSdkService: RegisterSdkService,
    private accountCryptographicStateService: AccountCryptographicStateService,
    private pinStateService: PinStateServiceAbstraction,
    private kdfService: KdfConfigService,
    private accountService: AccountService,
    private masterPasswordService: InternalMasterPasswordServiceAbstraction,
    private stateProvider: StateProvider,
    private logService: LogService,
    private biometricsService: BiometricsService,
    private platformUtilsService: PlatformUtilsService,
    private stateService: StateService,
    private biometricStateService: BiometricStateService,
  ) {}

  async unlockWithPin(userId: UserId, pin: string): Promise<void> {
    const startTime = performance.now();
    await firstValueFrom(
      this.registerSdkService.registerClient$(userId).pipe(
        map(async (sdk) => {
          if (!sdk) {
            throw new Error("SDK not available");
          }
          using ref = sdk.take();
          await ref.value.crypto().initialize_user_crypto({
            userId: asUuid(userId),
            kdfParams: await this.getKdfParams(userId),
            email: await this.getEmail(userId)!,
            accountCryptographicState: await this.getAccountCryptographicState(userId),
            method: {
              pinEnvelope: {
                pin: pin,
                pin_protected_user_key_envelope: await this.getPinProtectedUserKeyEnvelope(userId),
              },
            },
          });
          await this.runOnUnlockSideEffects(userId, ref);
        }),
      ),
    );
    this.logService.measure(startTime, "Unlock", "DefaultUnlockService", "unlockWithPin");
  }

  async unlockWithMasterPassword(userId: UserId, masterPassword: string): Promise<void> {
    const startTime = performance.now();
    await firstValueFrom(
      this.registerSdkService.registerClient$(userId).pipe(
        map(async (sdk) => {
          if (!sdk) {
            throw new Error("SDK not available");
          }
          using ref = sdk.take();
          await ref.value.crypto().initialize_user_crypto({
            userId: asUuid(userId),
            kdfParams: await this.getKdfParams(userId),
            email: await this.getEmail(userId),
            accountCryptographicState: await this.getAccountCryptographicState(userId),
            method: {
              masterPasswordUnlock: {
                password: masterPassword,
                master_password_unlock: await this.getMasterPasswordUnlockData(userId),
              },
            },
          });
          await this.runOnUnlockSideEffects(userId, ref);
        }),
      ),
    );
    await this.setLegacyMasterKeyFromUnlockData(
      masterPassword,
      await this.getMasterPasswordUnlockData(userId),
      userId,
    );
    this.logService.measure(
      startTime,
      "Unlock",
      "DefaultUnlockService",
      "unlockWithMasterPassword",
    );
  }

  async unlockWithBiometrics(userId: UserId): Promise<void> {
    // First, get the biometrics-protected user key. This will prompt the user to authenticate with biometrics.
    const userKey = await this.biometricsService.unlockWithBiometricsForUser(userId);
    if (!userKey) {
      throw new Error("Failed to unlock with biometrics");
    }

    // Now that we have the biometrics-protected user key, we can initialize the SDK with it to complete the unlock process.
    const startTime = performance.now();
    await firstValueFrom(
      this.registerSdkService.registerClient$(userId).pipe(
        map(async (sdk) => {
          if (!sdk) {
            throw new Error("SDK not available");
          }
          using ref = sdk.take();
          await ref.value.crypto().initialize_user_crypto({
            userId: asUuid(userId),
            kdfParams: await this.getKdfParams(userId),
            email: await this.getEmail(userId),
            accountCryptographicState: await this.getAccountCryptographicState(userId),
            method: {
              decryptedKey: {
                decrypted_user_key: userKey.toBase64(),
              },
            },
          });
          await this.runOnUnlockSideEffects(userId, ref);
        }),
      ),
    );
    this.logService.measure(startTime, "Unlock", "DefaultUnlockService", "unlockWithBiometrics");
  }

  async unlockWithKeyConnector(
    userId: UserId,
    keyConnectorUnlockData: KeyConnectorUnlockData,
  ): Promise<void> {
    // The SDK is responsible for fetching the key-connector-key from the key-connector using the
    // key-connector-unlock-data. It will unwrap the provided key and set it to state, unlocking
    // the vault.
    const startTime = performance.now();
    await firstValueFrom(
      this.registerSdkService.registerClient$(userId).pipe(
        map(async (sdk) => {
          if (!sdk) {
            throw new Error("SDK not available");
          }
          using ref = sdk.take();
          return ref.value.crypto().initialize_user_crypto({
            userId: asUuid(userId),
            kdfParams: await this.getKdfParams(userId),
            email: await this.getEmail(userId),
            accountCryptographicState: await this.getAccountCryptographicState(userId),
            method: {
              keyConnectorUrl: {
                url: keyConnectorUnlockData.url,
                key_connector_key_wrapped_user_key:
                  keyConnectorUnlockData.keyConnectorKeyWrappedUserKey,
              },
            },
          });
        }),
      ),
    );
    this.logService.measure(startTime, "Unlock", "DefaultUnlockService", "unlockWithKeyConnector");
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

  private async getPinProtectedUserKeyEnvelope(
    userId: UserId,
  ): Promise<PasswordProtectedKeyEnvelope> {
    const pinLockType = await this.pinStateService.getPinLockType(userId);
    const pinEnvelope = await this.pinStateService.getPinProtectedUserKeyEnvelope(
      userId,
      pinLockType,
    );
    assertNonNullish(pinEnvelope, "User is not enrolled in PIN unlock");
    return pinEnvelope!;
  }

  private async getMasterPasswordUnlockData(userId: UserId): Promise<MasterPasswordUnlockData> {
    const unlockData = await firstValueFrom(
      this.masterPasswordService.masterPasswordUnlockData$(userId),
    );
    assertNonNullish(unlockData, "Master password unlock data is required");
    return unlockData.toSdk();
  }

  private async setLegacyMasterKeyFromUnlockData(
    password: string,
    masterPasswordUnlockData: MasterPasswordUnlockData,
    userId: UserId,
  ): Promise<void> {
    assertNonNullish(password, "password");
    assertNonNullish(masterPasswordUnlockData, "masterPasswordUnlockData");
    assertNonNullish(userId, "userId");
    this.logService.info("[DefaultUnlockService] Setting legacy master key from unlock data");

    // NOTE: This entire section is deprecated and will be removed as soon as
    // the masterkey is dropped from state. It is very temporary.
    await SdkLoadService.Ready;

    const passwordBuffer = new TextEncoder().encode(password);
    const saltBuffer = new TextEncoder().encode(masterPasswordUnlockData.salt);
    const masterKey = PureCrypto.derive_kdf_material(
      passwordBuffer,
      saltBuffer,
      masterPasswordUnlockData.kdf,
    );
    await this.stateProvider
      .getUser(userId, MASTER_KEY)
      .update((_) => new SymmetricCryptoKey(masterKey) as MasterKey);
  }

  // When unlocking, certain side-effects must be run, such as setting the never-lock key and the biometrics key.
  // Currently this does not happen from within the SDK but form here instead.
  private async runOnUnlockSideEffects(
    userId: UserId,
    client: Ref<PasswordManagerClient>,
  ): Promise<void> {
    const userKey = SymmetricCryptoKey.fromString(
      await client.value.crypto().get_user_encryption_key(),
    );
    if (await firstValueFrom(this.biometricStateService.biometricUnlockEnabled$(userId))) {
      await this.biometricsService.setBiometricProtectedUnlockKeyForUser(userId, userKey);
    }
    if (await this.shouldStoreUserKeyAutoUnlock(userId)) {
      await this.stateService.setUserKeyAutoUnlock(userKey.toBase64(), { userId: userId });
    }
    await this.stateProvider.setUserState(USER_EVER_HAD_USER_KEY, true, userId);
  }

  private async shouldStoreUserKeyAutoUnlock(userId: UserId): Promise<boolean> {
    if (this.platformUtilsService.getClientType() === ClientType.Cli) {
      return true;
    }

    const vaultTimeout = await firstValueFrom(
      this.stateProvider
        .getUserState$(VAULT_TIMEOUT, userId)
        .pipe(filter((timeout) => timeout != null)),
    );

    return vaultTimeout == VaultTimeoutStringType.Never;
  }
}
