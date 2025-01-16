// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { firstValueFrom, map } from "rxjs";

import { UserDecryptionOptionsServiceAbstraction } from "@bitwarden/auth/common";
import {
  BiometricsService,
  BiometricsStatus,
  KdfConfigService,
  KeyService,
} from "@bitwarden/key-management";

// FIXME: remove `src` and fix import
// eslint-disable-next-line no-restricted-imports
import { PinServiceAbstraction } from "../../../../../auth/src/common/abstractions/pin.service.abstraction";
import { I18nService } from "../../../platform/abstractions/i18n.service";
import { HashPurpose } from "../../../platform/enums";
import { UserId } from "../../../types/guid";
import { AccountService } from "../../abstractions/account.service";
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
    private keyService: KeyService,
    private accountService: AccountService,
    private masterPasswordService: InternalMasterPasswordServiceAbstraction,
    private i18nService: I18nService,
    private userVerificationApiService: UserVerificationApiServiceAbstraction,
    private userDecryptionOptionsService: UserDecryptionOptionsServiceAbstraction,
    private pinService: PinServiceAbstraction,
    private kdfConfigService: KdfConfigService,
    private biometricsService: BiometricsService,
  ) {}

  async getAvailableVerificationOptions(
    verificationType: keyof UserVerificationOptions,
  ): Promise<UserVerificationOptions> {
    const userId = (await firstValueFrom(this.accountService.activeAccount$))?.id;
    if (verificationType === "client") {
      const [userHasMasterPassword, isPinDecryptionAvailable, biometricsStatus] = await Promise.all(
        [
          this.hasMasterPasswordAndMasterKeyHash(userId),
          this.pinService.isPinDecryptionAvailable(userId),
          this.biometricsService.getBiometricsStatus(),
        ],
      );

      // note: we do not need to check this.platformUtilsService.supportsBiometric() because
      // we can just use the logic below which works for both desktop & the browser extension.

      return {
        client: {
          masterPassword: userHasMasterPassword,
          pin: isPinDecryptionAvailable,
          biometrics: biometricsStatus === BiometricsStatus.Available,
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
        masterKey = await this.keyService.makeMasterKey(
          verification.secret,
          email,
          await this.kdfConfigService.getKdfConfig(),
        );
      }
      request.masterPasswordHash = alreadyHashed
        ? verification.secret
        : await this.keyService.hashMasterKey(verification.secret, masterKey);
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
      // FIXME: Remove when updating file. Eslint update
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
      masterKey = await this.keyService.makeMasterKey(verification.secret, email, kdfConfig);
    }

    if (!masterKey) {
      throw new Error("Master key could not be created to verify the master password.");
    }

    let policyOptions: MasterPasswordPolicyResponse | null;
    // Client-side verification
    if (await this.hasMasterPasswordAndMasterKeyHash(userId)) {
      const passwordValid = await this.keyService.compareKeyHash(
        verification.secret,
        masterKey,
        userId,
      );
      if (!passwordValid) {
        throw new Error(this.i18nService.t("invalidMasterPassword"));
      }
      policyOptions = null;
    } else {
      // Server-side verification
      const request = new SecretVerificationRequest();
      const serverKeyHash = await this.keyService.hashMasterKey(
        verification.secret,
        masterKey,
        HashPurpose.ServerAuthorization,
      );
      request.masterPasswordHash = serverKeyHash;
      try {
        policyOptions = await this.userVerificationApiService.postAccountVerifyPassword(request);
        // FIXME: Remove when updating file. Eslint update
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (e) {
        throw new Error(this.i18nService.t("invalidMasterPassword"));
      }
    }

    const localKeyHash = await this.keyService.hashMasterKey(
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
    return this.biometricsService.authenticateWithBiometrics();
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
