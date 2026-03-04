import { firstValueFrom, map } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { assertNonNullish } from "@bitwarden/common/auth/utils";
import { AccountCryptographicStateService } from "@bitwarden/common/key-management/account-cryptography/account-cryptographic-state.service";
import { CryptoFunctionService } from "@bitwarden/common/key-management/crypto/abstractions/crypto-function.service";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import {
  MASTER_KEY,
  MASTER_KEY_HASH,
} from "@bitwarden/common/key-management/master-password/services/master-password.service";
import { PinStateServiceAbstraction } from "@bitwarden/common/key-management/pin/pin-state.service.abstraction";
import { RegisterSdkService } from "@bitwarden/common/platform/abstractions/sdk/register-sdk.service";
import { SdkLoadService } from "@bitwarden/common/platform/abstractions/sdk/sdk-load.service";
import { asUuid } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { MasterKey } from "@bitwarden/common/types/key";
import { BiometricsService, KdfConfig, KdfConfigService } from "@bitwarden/key-management";
import { LogService } from "@bitwarden/logging";
import {
  Kdf,
  MasterPasswordUnlockData,
  PasswordProtectedKeyEnvelope,
  PureCrypto,
  WrappedAccountCryptographicState,
} from "@bitwarden/sdk-internal";
import { StateProvider } from "@bitwarden/state";
import { UserId } from "@bitwarden/user-core";

import { UnlockService } from "./unlock.service";

export class DefaultUnlockService implements UnlockService {
  constructor(
    private registerSdkService: RegisterSdkService,
    private accountCryptographicStateService: AccountCryptographicStateService,
    private pinStateService: PinStateServiceAbstraction,
    private kdfService: KdfConfigService,
    private accountService: AccountService,
    private masterPasswordService: InternalMasterPasswordServiceAbstraction,
    private cryptoFunctionService: CryptoFunctionService,
    private stateProvider: StateProvider,
    private logService: LogService,
    private biometricsService: BiometricsService,
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
          return ref.value.crypto().initialize_user_crypto({
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
          return ref.value.crypto().initialize_user_crypto({
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
          return ref.value.crypto().initialize_user_crypto({
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
        }),
      ),
    );
    this.logService.measure(startTime, "Unlock", "DefaultUnlockService", "unlockWithBiometrics");
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
    const hash = await this.cryptoFunctionService.pbkdf2(
      masterKey,
      password,
      "sha256",
      2, // HashPurpose.LocalAuthorization
    );
    await this.stateProvider
      .getUser(userId, MASTER_KEY)
      .update((_) => new SymmetricCryptoKey(masterKey) as MasterKey);
    await this.stateProvider
      .getUser(userId, MASTER_KEY_HASH)
      .update((_) => Utils.fromBufferToB64(hash));
  }
}
