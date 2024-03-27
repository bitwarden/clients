import { firstValueFrom } from "rxjs";

import { UserDecryptionOptionsServiceAbstraction } from "@bitwarden/auth/common";

import { PinCryptoServiceAbstraction } from "../../../../../auth/src/common/abstractions/pin-crypto.service.abstraction";
import { VaultTimeoutSettingsService as VaultTimeoutSettingsServiceAbstraction } from "../../../abstractions/vault-timeout/vault-timeout-settings.service";
import { CryptoService } from "../../../platform/abstractions/crypto.service";
import { I18nService } from "../../../platform/abstractions/i18n.service";
import { LogService } from "../../../platform/abstractions/log.service";
import { PlatformUtilsService } from "../../../platform/abstractions/platform-utils.service";
import { StateService } from "../../../platform/abstractions/state.service";
import { KeySuffixOptions } from "../../../platform/enums/key-suffix-options.enum";
import { UserId } from "../../../types/guid";
import { UserKey } from "../../../types/key";
import { AccountService } from "../../abstractions/account.service";
import { InternalMasterPasswordServiceAbstraction } from "../../abstractions/master-password.service.abstraction";
import { UserVerificationApiServiceAbstraction } from "../../abstractions/user-verification/user-verification-api.service.abstraction";
import { UserVerificationService as UserVerificationServiceAbstraction } from "../../abstractions/user-verification/user-verification.service.abstraction";
import { VerificationType } from "../../enums/verification-type";
import { SecretVerificationRequest } from "../../models/request/secret-verification.request";
import { VerifyOTPRequest } from "../../models/request/verify-otp.request";
import { UserVerificationOptions } from "../../types/user-verification-options";
import {
  MasterPasswordVerification,
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
    private stateService: StateService,
    private cryptoService: CryptoService,
    private accountService: AccountService,
    private masterPasswordService: InternalMasterPasswordServiceAbstraction,
    private i18nService: I18nService,
    private userVerificationApiService: UserVerificationApiServiceAbstraction,
    private userDecryptionOptionsService: UserDecryptionOptionsServiceAbstraction,
    private pinCryptoService: PinCryptoServiceAbstraction,
    private logService: LogService,
    private vaultTimeoutSettingsService: VaultTimeoutSettingsServiceAbstraction,
    private platformUtilsService: PlatformUtilsService,
  ) {}

  async getAvailableVerificationOptions(
    verificationType: keyof UserVerificationOptions,
  ): Promise<UserVerificationOptions> {
    if (verificationType === "client") {
      const [userHasMasterPassword, pinLockType, biometricsLockSet, biometricsUserKeyStored] =
        await Promise.all([
          this.hasMasterPasswordAndMasterKeyHash(),
          this.vaultTimeoutSettingsService.isPinLockSet(),
          this.vaultTimeoutSettingsService.isBiometricLockSet(),
          this.cryptoService.hasUserKeyStored(KeySuffixOptions.Biometric),
        ]);

      // note: we do not need to check this.platformUtilsService.supportsBiometric() because
      // we can just use the logic below which works for both desktop & the browser extension.

      return {
        client: {
          masterPassword: userHasMasterPassword,
          pin: pinLockType !== "DISABLED",
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
      const userHasMasterPassword = await this.hasMasterPassword();

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

  /**
   * Create a new request model to be used for server-side verification
   * @param verification User-supplied verification data (Master Password or OTP)
   * @param requestClass The request model to create
   * @param alreadyHashed Whether the master password is already hashed
   */
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
      const userId = (await firstValueFrom(this.accountService.activeAccount$))?.id;
      let masterKey = await firstValueFrom(this.masterPasswordService.masterKey$(userId));
      if (!masterKey && !alreadyHashed) {
        masterKey = await this.cryptoService.makeMasterKey(
          verification.secret,
          await this.stateService.getEmail(),
          await this.stateService.getKdfType(),
          await this.stateService.getKdfConfig(),
        );
      }
      request.masterPasswordHash = alreadyHashed
        ? verification.secret
        : await this.cryptoService.hashMasterKey(verification.secret, masterKey);
    }

    return request;
  }

  /**
   * Used to verify Master Password, PIN, or biometrics client-side, or send the OTP to the server for verification (with no other data)
   * Generally used for client-side verification only.
   * @param verification User-supplied verification data (OTP, MP, PIN, or biometrics)
   */
  async verifyUser(verification: Verification): Promise<boolean> {
    if (verificationHasSecret(verification)) {
      this.validateSecretInput(verification);
    }

    switch (verification.type) {
      case VerificationType.OTP:
        return this.verifyUserByOTP(verification);
      case VerificationType.MasterPassword:
        return this.verifyUserByMasterPassword(verification);
      case VerificationType.PIN:
        return this.verifyUserByPIN(verification);
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

  private async verifyUserByMasterPassword(
    verification: MasterPasswordVerification,
  ): Promise<boolean> {
    const userId = (await firstValueFrom(this.accountService.activeAccount$))?.id;
    let masterKey = await firstValueFrom(this.masterPasswordService.masterKey$(userId));
    if (!masterKey) {
      masterKey = await this.cryptoService.makeMasterKey(
        verification.secret,
        await this.stateService.getEmail(),
        await this.stateService.getKdfType(),
        await this.stateService.getKdfConfig(),
      );
    }
    const passwordValid = await this.cryptoService.compareAndUpdateKeyHash(
      verification.secret,
      masterKey,
    );
    if (!passwordValid) {
      throw new Error(this.i18nService.t("invalidMasterPassword"));
    }
    // TODO: we should re-evaluate later on if user verification should have the side effect of modifying state. Probably not.
    await this.masterPasswordService.setMasterKey(masterKey, userId);
    return true;
  }

  private async verifyUserByPIN(verification: PinVerification): Promise<boolean> {
    const userKey = await this.pinCryptoService.decryptUserKeyWithPin(verification.secret);

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

  /**
   * Check if user has master password or can only use passwordless technologies to log in
   * Note: This only checks the server, not the local state
   * @param userId The user id to check. If not provided, the current user is used
   * @returns True if the user has a master password
   * @deprecated Use UserDecryptionOptionsService.hasMasterPassword$ instead
   */
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
