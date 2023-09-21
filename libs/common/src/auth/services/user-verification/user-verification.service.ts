import { CryptoService } from "../../../platform/abstractions/crypto.service";
import { I18nService } from "../../../platform/abstractions/i18n.service";
import { StateService } from "../../../platform/abstractions/state.service";
import { Verification } from "../../../types/verification";
import { UserVerificationApiServiceAbstraction } from "../../abstractions/user-verification/user-verification-api.service.abstraction";
import { UserVerificationService as UserVerificationServiceAbstraction } from "../../abstractions/user-verification/user-verification.service.abstraction";
import { VerificationType } from "../../enums/verification-type";
import { SecretVerificationRequest } from "../../models/request/secret-verification.request";
import { VerifyOTPRequest } from "../../models/request/verify-otp.request";

/**
 * Used for general-purpose user verification throughout the app.
 * Use it to verify the input collected by UserVerificationComponent.
 */
export class UserVerificationService implements UserVerificationServiceAbstraction {
  constructor(
    private stateService: StateService,
    private cryptoService: CryptoService,
    private i18nService: I18nService,
    private userVerificationApiService: UserVerificationApiServiceAbstraction
  ) {}

  /**
   * Create a new request model to be used for server-side verification
   * @param verification User-supplied verification data (Master Password or OTP)
   * @param requestClass The request model to create
   * @param alreadyHashed Whether the master password is already hashed
   */
  async buildRequest<T extends SecretVerificationRequest>(
    verification: Verification,
    requestClass?: new () => T,
    alreadyHashed?: boolean
  ) {
    this.validateInput(verification);

    const request =
      requestClass != null ? new requestClass() : (new SecretVerificationRequest() as T);

    if (verification.type === VerificationType.OTP) {
      request.otp = verification.secret;
    } else {
      let masterKey = await this.cryptoService.getMasterKey();
      if (!masterKey && !alreadyHashed) {
        masterKey = await this.cryptoService.makeMasterKey(
          verification.secret,
          await this.stateService.getEmail(),
          await this.stateService.getKdfType(),
          await this.stateService.getKdfConfig()
        );
      }
      request.masterPasswordHash = alreadyHashed
        ? verification.secret
        : await this.cryptoService.hashMasterKey(verification.secret, masterKey);
    }

    return request;
  }

  /**
   * Used to verify the Master Password client-side, or send the OTP to the server for verification (with no other data)
   * Generally used for client-side verification only.
   * @param verification User-supplied verification data (Master Password or OTP)
   */
  async verifyUser(verification: Verification): Promise<boolean> {
    this.validateInput(verification);

    if (verification.type === VerificationType.OTP) {
      const request = new VerifyOTPRequest(verification.secret);
      try {
        await this.userVerificationApiService.postAccountVerifyOTP(request);
      } catch (e) {
        throw new Error(this.i18nService.t("invalidVerificationCode"));
      }
    } else {
      let masterKey = await this.cryptoService.getMasterKey();
      if (!masterKey) {
        masterKey = await this.cryptoService.makeMasterKey(
          verification.secret,
          await this.stateService.getEmail(),
          await this.stateService.getKdfType(),
          await this.stateService.getKdfConfig()
        );
      }
      const passwordValid = await this.cryptoService.compareAndUpdateKeyHash(
        verification.secret,
        masterKey
      );
      if (!passwordValid) {
        throw new Error(this.i18nService.t("invalidMasterPassword"));
      }
      this.cryptoService.setMasterKey(masterKey);
    }
    return true;
  }

  async requestOTP() {
    await this.userVerificationApiService.postAccountRequestOTP();
  }

  /**
   * Check if user has master password or can only use passwordless technologies to log in
   * Note: This only checks the server, not the local state
   * @param userId The user id to check. If not provided, the current user is used
   * @returns True if the user has a master password
   */
  async hasMasterPassword(userId?: string): Promise<boolean> {
    const decryptionOptions = await this.stateService.getAccountDecryptionOptions({ userId });

    if (decryptionOptions?.hasMasterPassword != undefined) {
      return decryptionOptions.hasMasterPassword;
    }

    // TODO: PM-3518 - Left for backwards compatibility, remove after 2023.12.0
    return !(await this.stateService.getUsesKeyConnector({ userId }));
  }

  async hasMasterPasswordAndMasterKeyHash(userId?: string): Promise<boolean> {
    return (
      (await this.hasMasterPassword(userId)) &&
      (await this.cryptoService.getMasterKeyHash()) != null
    );
  }

  private validateInput(verification: Verification) {
    if (verification?.secret == null || verification.secret === "") {
      if (verification.type === VerificationType.OTP) {
        throw new Error(this.i18nService.t("verificationCodeRequired"));
      } else {
        throw new Error(this.i18nService.t("masterPasswordRequired"));
      }
    }
  }
}
