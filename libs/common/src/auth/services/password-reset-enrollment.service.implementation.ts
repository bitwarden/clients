import { firstValueFrom, map } from "rxjs";

import {
  OrganizationUserApiService,
  OrganizationUserResetPasswordEnrollmentRequest,
} from "@bitwarden/admin-console/common";
import { EncryptService } from "@bitwarden/common/platform/abstractions/encrypt.service";

import { KeyService } from "../../../../key-management/src/abstractions/key.service";
import { OrganizationApiServiceAbstraction } from "../../admin-console/abstractions/organization/organization-api.service.abstraction";
import { I18nService } from "../../platform/abstractions/i18n.service";
import { Utils } from "../../platform/misc/utils";
import { UserKey } from "../../types/key";
import { AccountService } from "../abstractions/account.service";
import { PasswordResetEnrollmentServiceAbstraction } from "../abstractions/password-reset-enrollment.service.abstraction";

export class PasswordResetEnrollmentServiceImplementation
  implements PasswordResetEnrollmentServiceAbstraction
{
  constructor(
    protected organizationApiService: OrganizationApiServiceAbstraction,
    protected accountService: AccountService,
    protected keyService: KeyService,
    protected encryptService: EncryptService,
    protected organizationUserApiService: OrganizationUserApiService,
    protected i18nService: I18nService,
  ) {}

  async enrollIfRequired(organizationSsoIdentifier: string): Promise<void> {
    const orgAutoEnrollStatusResponse =
      await this.organizationApiService.getAutoEnrollStatus(organizationSsoIdentifier);

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

    userId =
      userId ?? (await firstValueFrom(this.accountService.activeAccount$.pipe(map((a) => a?.id))));
    userKey = userKey ?? (await this.keyService.getUserKey(userId));
    // RSA Encrypt user's userKey.key with organization public key
    const encryptedKey = await this.encryptService.rsaEncrypt(userKey.key, orgPublicKey);

    const resetRequest = new OrganizationUserResetPasswordEnrollmentRequest();
    resetRequest.resetPasswordKey = encryptedKey.encryptedString;

    await this.organizationUserApiService.putOrganizationUserResetPasswordEnrollment(
      organizationId,
      userId,
      resetRequest,
    );
  }
}
