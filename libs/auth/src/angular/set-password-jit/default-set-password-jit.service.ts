// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { firstValueFrom } from "rxjs";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import {
  OrganizationUserApiService,
  OrganizationUserResetPasswordEnrollmentRequest,
} from "@bitwarden/admin-console/common";
import { InternalUserDecryptionOptionsServiceAbstraction } from "@bitwarden/auth/common";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { MasterPasswordApiService } from "@bitwarden/common/auth/abstractions/master-password-api.service.abstraction";
import { ForceSetPasswordReason } from "@bitwarden/common/auth/models/domain/force-set-password-reason";
import { SetPasswordRequest } from "@bitwarden/common/auth/models/request/set-password.request";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { KeysRequest } from "@bitwarden/common/models/request/keys.request";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { UserId } from "@bitwarden/common/types/guid";
import { MasterKey, UserKey } from "@bitwarden/common/types/key";
import { KdfConfigService, KeyService, KdfConfig } from "@bitwarden/key-management";

import {
  SetPasswordCredentials,
  SetPasswordJitService,
} from "./set-password-jit.service.abstraction";

export class DefaultSetPasswordJitService implements SetPasswordJitService {
  constructor(
    protected encryptService: EncryptService,
    protected i18nService: I18nService,
    protected kdfConfigService: KdfConfigService,
    protected keyService: KeyService,
    protected masterPasswordApiService: MasterPasswordApiService,
    protected masterPasswordService: InternalMasterPasswordServiceAbstraction,
    protected organizationApiService: OrganizationApiServiceAbstraction,
    protected organizationUserApiService: OrganizationUserApiService,
    protected userDecryptionOptionsService: InternalUserDecryptionOptionsServiceAbstraction,
  ) {}

  async setPassword(credentials: SetPasswordCredentials): Promise<void> {
    const {
      newMasterKey,
      newServerMasterKeyHash,
      newLocalMasterKeyHash,
      newPasswordHint,
      kdfConfig,
      orgSsoIdentifier,
      orgId,
      resetPasswordAutoEnroll,
      userId,
    } = credentials;

    for (const [key, value] of Object.entries(credentials)) {
      if (value == null) {
        throw new Error(`${key} not found. Could not set password.`);
      }
    }

    const protectedUserKey = await this.makeProtectedUserKey(newMasterKey, userId);
    if (protectedUserKey == null) {
      throw new Error("protectedUserKey not found. Could not set password.");
    }

    // Since this is an existing JIT provisioned user in a MP encryption org setting first password,
    // they will not already have a user asymmetric key pair so we must create it for them.
    const [keyPair, keysRequest] = await this.makeKeyPairAndRequest(protectedUserKey);

    const request = new SetPasswordRequest(
      newServerMasterKeyHash,
      protectedUserKey[1].encryptedString,
      newPasswordHint,
      orgSsoIdentifier,
      keysRequest,
      kdfConfig.kdfType,
      kdfConfig.iterations,
    );

    await this.masterPasswordApiService.setPassword(request);

    // Clear force set password reason to allow navigation back to vault.
    await this.masterPasswordService.setForceSetPasswordReason(ForceSetPasswordReason.None, userId);

    // User now has a password so update account decryption options in state
    await this.updateAccountDecryptionProperties(newMasterKey, kdfConfig, protectedUserKey, userId);

    await this.keyService.setPrivateKey(keyPair[1].encryptedString, userId);

    await this.masterPasswordService.setMasterKeyHash(newLocalMasterKeyHash, userId);

    if (resetPasswordAutoEnroll) {
      await this.handleResetPasswordAutoEnroll(newServerMasterKeyHash, orgId, userId);
    }
  }

  private async makeProtectedUserKey(
    masterKey: MasterKey,
    userId: UserId,
  ): Promise<[UserKey, EncString]> {
    let protectedUserKey: [UserKey, EncString] = null;

    const userKey = await firstValueFrom(this.keyService.userKey$(userId));

    if (userKey == null) {
      protectedUserKey = await this.keyService.makeUserKey(masterKey);
    } else {
      protectedUserKey = await this.keyService.encryptUserKeyWithMasterKey(masterKey);
    }

    return protectedUserKey;
  }

  private async makeKeyPairAndRequest(
    protectedUserKey: [UserKey, EncString],
  ): Promise<[[string, EncString], KeysRequest]> {
    const keyPair = await this.keyService.makeKeyPair(protectedUserKey[0]);
    if (keyPair == null) {
      throw new Error("keyPair not found. Could not set password.");
    }
    const keysRequest = new KeysRequest(keyPair[0], keyPair[1].encryptedString);

    return [keyPair, keysRequest];
  }

  private async updateAccountDecryptionProperties(
    masterKey: MasterKey,
    kdfConfig: KdfConfig,
    protectedUserKey: [UserKey, EncString],
    userId: UserId,
  ) {
    const userDecryptionOpts = await firstValueFrom(
      this.userDecryptionOptionsService.userDecryptionOptions$,
    );
    userDecryptionOpts.hasMasterPassword = true;
    await this.userDecryptionOptionsService.setUserDecryptionOptions(userDecryptionOpts);
    await this.kdfConfigService.setKdfConfig(userId, kdfConfig);
    await this.masterPasswordService.setMasterKey(masterKey, userId);
    await this.keyService.setUserKey(protectedUserKey[0], userId);
  }

  private async handleResetPasswordAutoEnroll(
    masterKeyHash: string,
    orgId: string,
    userId: UserId,
  ) {
    const organizationKeys = await this.organizationApiService.getKeys(orgId);

    if (organizationKeys == null) {
      throw new Error(this.i18nService.t("resetPasswordOrgKeysError"));
    }

    const publicKey = Utils.fromB64ToArray(organizationKeys.publicKey);

    // RSA Encrypt user key with organization public key
    const userKey = await firstValueFrom(this.keyService.userKey$(userId));

    if (userKey == null) {
      throw new Error("userKey not found. Could not handle reset password auto enroll.");
    }

    const encryptedUserKey = await this.encryptService.encapsulateKeyUnsigned(userKey, publicKey);

    const resetRequest = new OrganizationUserResetPasswordEnrollmentRequest();
    resetRequest.masterPasswordHash = masterKeyHash;
    resetRequest.resetPasswordKey = encryptedUserKey.encryptedString;

    await this.organizationUserApiService.putOrganizationUserResetPasswordEnrollment(
      orgId,
      userId,
      resetRequest,
    );
  }
}
