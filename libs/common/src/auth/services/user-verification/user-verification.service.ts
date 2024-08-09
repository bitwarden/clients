import { firstValueFrom, map } from "rxjs";

import { UserDecryptionOptionsServiceAbstraction } from "@bitwarden/auth/common";

import { PinServiceAbstraction } from "../../../../../auth/src/common/abstractions/pin.service.abstraction";
import { VaultTimeoutSettingsService as VaultTimeoutSettingsServiceAbstraction } from "../../../abstractions/vault-timeout/vault-timeout-settings.service";
import { CryptoService } from "../../../platform/abstractions/crypto.service";
import { I18nService } from "../../../platform/abstractions/i18n.service";
import { LogService } from "../../../platform/abstractions/log.service";
import { PlatformUtilsService } from "../../../platform/abstractions/platform-utils.service";
import { HashPurpose } from "../../../platform/enums";
import { KeySuffixOptions } from "../../../platform/enums/key-suffix-options.enum";
import { UserId } from "../../../types/guid";
import { UserKey } from "../../../types/key";
import { AccountService } from "../../abstractions/account.service";
import { KdfConfigService } from "../../abstractions/kdf-config.service";
import { InternalMasterPasswordServiceAbstraction } from "../../abstractions/master-password.service.abstraction";
import { UserVerificationApiServiceAbstraction } from "../../abstractions/user-verification/user-verification-api.service.abstraction";
import { UserVerificationService as UserVerificationServiceAbstraction } from "../../abstractions/user-verification/user-verification.service.abstraction";
import { VerificationType } from "../../enums/verification-type";
import { SecretVerificationRequest } from "../../models/request/secret-verification.request";
import { VerifyOTPRequest } from "../../models/request/verify-otp.request";
import { MasterPasswordPolicyResponse } from "../../models/response/master-password-policy.response";
import { UserVerificationOptions } from "../../types/user-verification-options";
import {
  MasterPasswordVerification,
  MasterPasswordVerificationResponse,
  OtpVerification,
  PinVerification,
  ServerSideVerification,
  Verification,
  VerificationWithSecret,
  verificationHasSecret,
} from "../../types/verification";

/**
 * Used for general-purpose user verification throughout the app.
 * Use it to verify the input collected by UserVerificationComponent.
 */
export class UserVerificationService implements UserVerificationServiceAbstraction {
  constructor(
    private cryptoService: CryptoService,
    private accountService: AccountService,
    private masterPasswordService: InternalMasterPasswordServiceAbstraction,
    private i18nService: I18nService,
    private userVerificationApiService: UserVerificationApiServiceAbstraction,
    private userDecryptionOptionsService: UserDecryptionOptionsServiceAbstraction,
    private pinService: PinServiceAbstraction,
    private logService: LogService,
    private vaultTimeoutSettingsService: VaultTimeoutSettingsServiceAbstraction,
    private platformUtilsService: PlatformUtilsService,
    private kdfConfigService: KdfConfigService,
  ) {}

  async getAvailableVerificationOptions(
    verificationType: keyof UserVerificationOptions,
  ): Promise<UserVerificationOptions> {
    const userId = (await firstValueFrom(this.accountService.activeAccount$))?.id;
    if (verificationType === "client") {
      const [
        userHasMasterPassword,
        isPinDecryptionAvailable,
        biometricsLockSet,
        biometricsUserKeyStored,
      ] = await Promise.all([
        this.hasMasterPasswordAndMasterKeyHash(userId),
        this.pinService.isPinDecryptionAvailable(userId),
        this.vaultTimeoutSettingsService.isBiometricLockSet(userId),
        this.cryptoService.hasUserKeyStored(KeySuffixOptions.Biometric, userId),
      ]);

      // note: we do not need to check this.platformUtilsService.supportsBiometric() because
      // we can just use the logic below which works for both desktop & the browser extension.

      return {
        client: {
          masterPassword: userHasMasterPassword,
          pin: isPinDecryptionAvailable,
          biometrics:
            biometricsLockSet &&
            (biometricsUserKeyStored || !this.platformUtilsService.supportsSecureStorage()),
        },
        server: {
          masterPassword: false,
          otp: false,
        },
      };
    } else {
      // server
      // Don't check if have MP hash locally, because we are going to send the secret to the server to be verified.
      const userHasMasterPassword = await this.hasMasterPassword(userId);

      return {
        client: {
          masterPassword: false,
          pin: false,
          biometrics: false,
        },
        server: { masterPassword: userHasMasterPassword, otp: !userHasMasterPassword },
      };
    }
  }

  async buildRequest<T extends SecretVerificationRequest>(
    verification: ServerSideVerification,
    requestClass?: new () => T,
    alreadyHashed?: boolean,
  ) {
    this.validateSecretInput(verification);

    const request =
      requestClass != null ? new requestClass() : (new SecretVerificationRequest() as T);

    if (verification.type === VerificationType.OTP) {
      request.otp = verification.secret;
    } else {
      const [userId, email] = await firstValueFrom(
        this.accountService.activeAccount$.pipe(map((a) => [a?.id, a?.email])),
      );
      let masterKey = await firstValueFrom(this.masterPasswordService.masterKey$(userId));
      if (!masterKey && !alreadyHashed) {
        masterKey = await this.cryptoService.makeMasterKey(
          verification.secret,
          email,
          await this.kdfConfigService.getKdfConfig(),
        );
      }
      request.masterPasswordHash = alreadyHashed
        ? verification.secret
        : await this.cryptoService.hashMasterKey(verification.secret, masterKey);
    }

    return request;
  }

  async verifyUser(verification: Verification): Promise<boolean> {
    if (verification == null) {
      throw new Error("Verification is required.");
    }

    const [userId, email] = await firstValueFrom(
      this.accountService.activeAccount$.pipe(map((a) => [a?.id, a?.email])),
    );

    if (verificationHasSecret(verification)) {
      this.validateSecretInput(verification);
    }

    switch (verification.type) {
      case VerificationType.OTP:
        return this.verifyUserByOTP(verification);
      case VerificationType.MasterPassword:
        await this.verifyUserByMasterPassword(verification, userId, email);
        return true;
      case VerificationType.PIN:
        return this.verifyUserByPIN(verification, userId);
      case VerificationType.Biometrics:
        return this.verifyUserByBiometrics();
      default: {
        // Compile-time check for exhaustive switch
        const _exhaustiveCheck: never = verification;
        return _exhaustiveCheck;
      }
    }
  }

  private async verifyUserByOTP(verification: OtpVerification): Promise<boolean> {
    const request = new VerifyOTPRequest(verification.secret);
    try {
      await this.userVerificationApiService.postAccountVerifyOTP(request);
    } catch (e) {
      throw new Error(this.i18nService.t("invalidVerificationCode"));
    }
    return true;
  }

  async verifyUserByMasterPassword(
    verification: MasterPasswordVerification,
    userId: UserId,
    email: string,
  ): Promise<MasterPasswordVerificationResponse> {
    if (!verification.secret) {
      throw new Error("Master Password is required. Cannot verify user without a master password.");
    }
    if (!userId) {
      throw new Error("User ID is required. Cannot verify user by master password.");
    }
    if (!email) {
      throw new Error("Email is required. Cannot verify user by master password.");
    }

    const kdfConfig = await this.kdfConfigService.getKdfConfig();
    if (!kdfConfig) {
      throw new Error("KDF config is required. Cannot verify user by master password.");
    }

    let masterKey = await firstValueFrom(this.masterPasswordService.masterKey$(userId));
    if (!masterKey) {
      masterKey = await this.cryptoService.makeMasterKey(verification.secret, email, kdfConfig);
    }

    if (!masterKey) {
      throw new Error("Master key could not be created to verify the master password.");
    }

    let policyOptions: MasterPasswordPolicyResponse | null;
    // Client-side verification
    if (await this.hasMasterPasswordAndMasterKeyHash(userId)) {
      const passwordValid = await this.cryptoService.compareAndUpdateKeyHash(
        verification.secret,
        masterKey,
      );
      if (!passwordValid) {
        throw new Error(this.i18nService.t("invalidMasterPassword"));
      }
      policyOptions = null;
    } else {
      // Server-side verification
      const request = new SecretVerificationRequest();
      const serverKeyHash = await this.cryptoService.hashMasterKey(
        verification.secret,
        masterKey,
        HashPurpose.ServerAuthorization,
      );
      request.masterPasswordHash = serverKeyHash;
      try {
        policyOptions = await this.userVerificationApiService.postAccountVerifyPassword(request);
      } catch (e) {
        throw new Error(this.i18nService.t("invalidMasterPassword"));
      }
    }

    const localKeyHash = await this.cryptoService.hashMasterKey(
      verification.secret,
      masterKey,
      HashPurpose.LocalAuthorization,
    );
    await this.masterPasswordService.setMasterKeyHash(localKeyHash, userId);
    await this.masterPasswordService.setMasterKey(masterKey, userId);
    return { policyOptions, masterKey };
  }

  private async verifyUserByPIN(verification: PinVerification, userId: UserId): Promise<boolean> {
    if (!userId) {
      throw new Error("User ID is required. Cannot verify user by PIN.");
    }

    const userKey = await this.pinService.decryptUserKeyWithPin(verification.secret, userId);

    return userKey != null;
  }

  private async verifyUserByBiometrics(): Promise<boolean> {
    let userKey: UserKey;
    // Biometrics crashes and doesn't return a value if the user cancels the prompt
    try {
      userKey = await this.cryptoService.getUserKeyFromStorage(KeySuffixOptions.Biometric);
    } catch (e) {
      this.logService.error(`Biometrics User Verification failed: ${e.message}`);
      // So, any failures should be treated as a failed verification
      return false;
    }

    return userKey != null;
  }

  async requestOTP() {
    await this.userVerificationApiService.postAccountRequestOTP();
  }

  async hasMasterPassword(userId?: string): Promise<boolean> {
    if (userId) {
      const decryptionOptions = await firstValueFrom(
        this.userDecryptionOptionsService.userDecryptionOptionsById$(userId),
      );

      if (decryptionOptions?.hasMasterPassword != undefined) {
        return decryptionOptions.hasMasterPassword;
      }
    }
    return await firstValueFrom(this.userDecryptionOptionsService.hasMasterPassword$);
  }

  async hasMasterPasswordAndMasterKeyHash(userId?: string): Promise<boolean> {
    userId ??= (await firstValueFrom(this.accountService.activeAccount$))?.id;
    return (
      (await this.hasMasterPassword(userId)) &&
      (await firstValueFrom(this.masterPasswordService.masterKeyHash$(userId as UserId))) != null
    );
  }

  private validateSecretInput(verification: VerificationWithSecret) {
    if (verification?.secret == null || verification.secret === "") {
      switch (verification.type) {
        case VerificationType.OTP:
          throw new Error(this.i18nService.t("verificationCodeRequired"));
        case VerificationType.MasterPassword:
          throw new Error(this.i18nService.t("masterPasswordRequired"));
        case VerificationType.PIN:
          throw new Error(this.i18nService.t("pinRequired"));
      }
    }
  }
}
