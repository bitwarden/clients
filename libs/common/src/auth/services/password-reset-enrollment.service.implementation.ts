import { OrganizationUserService } from "../../abstractions/organization-user/organization-user.service";
import { OrganizationUserResetPasswordEnrollmentRequest } from "../../abstractions/organization-user/requests";
import { OrganizationApiServiceAbstraction } from "../../admin-console/abstractions/organization/organization-api.service.abstraction";
import { CryptoService } from "../../platform/abstractions/crypto.service";
import { I18nService } from "../../platform/abstractions/i18n.service";
import { StateService } from "../../platform/abstractions/state.service";
import { Utils } from "../../platform/misc/utils";
import { UserKey } from "../../platform/models/domain/symmetric-crypto-key";
import { PasswordResetEnrollmentServiceAbstraction } from "../abstractions/password-reset-enrollment.service.abstraction";

export class PasswordResetEnrollmentServiceImplementation
  implements PasswordResetEnrollmentServiceAbstraction
{
  constructor(
    protected organizationApiService: OrganizationApiServiceAbstraction,
    protected stateService: StateService,
    protected cryptoService: CryptoService,
    protected organizationUserService: OrganizationUserService,
    protected i18nService: I18nService
  ) {}

  async enrollIfRequired(organizationSsoIdentifier: string): Promise<void> {
    const orgAutoEnrollStatusResponse = await this.organizationApiService.getAutoEnrollStatus(
      organizationSsoIdentifier
    );

    if (!orgAutoEnrollStatusResponse.resetPasswordEnabled) {
      await this.enroll(orgAutoEnrollStatusResponse.id, null, null);
    }
  }

  async enroll(organizationId: string): Promise<void>;
  async enroll(organizationId: string, userId: string, userKey: UserKey): Promise<void>;
  async enroll(organizationId: string, userId?: string, userKey?: UserKey): Promise<void> {
    const orgKeyResponse = await this.organizationApiService.getKeys(organizationId);
    if (orgKeyResponse == null) {
      throw new Error(this.i18nService.t("resetPasswordOrgKeysError"));
    }

    const orgPublicKey = Utils.fromB64ToArray(orgKeyResponse.publicKey);

    userId = userId ?? (await this.stateService.getUserId());
    userKey = userKey ?? (await this.cryptoService.getUserKey(userId));
    // RSA Encrypt user's userKey.key with organization public key
    const encryptedKey = await this.cryptoService.rsaEncrypt(userKey.key, orgPublicKey);

    const resetRequest = new OrganizationUserResetPasswordEnrollmentRequest();
    resetRequest.resetPasswordKey = encryptedKey.encryptedString;

    await this.organizationUserService.putOrganizationUserResetPasswordEnrollment(
      organizationId,
      userId,
      resetRequest
    );
  }
}
