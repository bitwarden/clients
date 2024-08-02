import { firstValueFrom } from "rxjs";

import { InternalUserDecryptionOptionsServiceAbstraction } from "@bitwarden/auth/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { OrganizationUserService } from "@bitwarden/common/admin-console/abstractions/organization-user/organization-user.service";
import { OrganizationUserResetPasswordEnrollmentRequest } from "@bitwarden/common/admin-console/abstractions/organization-user/requests";
import { KdfConfigService } from "@bitwarden/common/auth/abstractions/kdf-config.service";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/auth/abstractions/master-password.service.abstraction";
import { ForceSetPasswordReason } from "@bitwarden/common/auth/models/domain/force-set-password-reason";
import { PBKDF2KdfConfig } from "@bitwarden/common/auth/models/domain/kdf-config";
import { SetPasswordRequest } from "@bitwarden/common/auth/models/request/set-password.request";
import { KeysRequest } from "@bitwarden/common/models/request/keys.request";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";
import { UserId } from "@bitwarden/common/types/guid";
import { MasterKey, UserKey } from "@bitwarden/common/types/key";

import {
  SetPasswordCredentials,
  SetPasswordJitService,
} from "./set-password-jit.service.abstraction";

export class DefaultSetPasswordJitService implements SetPasswordJitService {
  constructor(
    protected apiService: ApiService,
    protected cryptoService: CryptoService,
    protected i18nService: I18nService,
    protected kdfConfigService: KdfConfigService,
    protected masterPasswordService: InternalMasterPasswordServiceAbstraction,
    protected organizationApiService: OrganizationApiServiceAbstraction,
    protected organizationUserService: OrganizationUserService,
    protected userDecryptionOptionsService: InternalUserDecryptionOptionsServiceAbstraction,
  ) {}

  async setPassword(credentials: SetPasswordCredentials): Promise<void> {
    const {
      masterKey,
      masterKeyHash,
      localMasterKeyHash,
      hint,
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

    const protectedUserKey = await this.makeProtectedUserKey(masterKey, userId);
    if (protectedUserKey == null) {
      throw new Error("protectedUserKey not found. Could not set password.");
    }

    // Since this is an existing JIT provisioned user in a MP encryption org setting first password,
    // they will not already have a user asymmetric key pair so we must create it for them.
    const [keyPair, keysRequest] = await this.makeKeyPairAndRequest(protectedUserKey);

    const request = new SetPasswordRequest(
      masterKeyHash,
      protectedUserKey[1].encryptedString,
      hint,
      orgSsoIdentifier,
      keysRequest,
      kdfConfig.kdfType, // kdfConfig is always DEFAULT_KDF_CONFIG (see InputPasswordComponent)
      kdfConfig.iterations,
    );

    await this.apiService.setPassword(request);

    // Clear force set password reason to allow navigation back to vault.
    await this.masterPasswordService.setForceSetPasswordReason(ForceSetPasswordReason.None, userId);

    // User now has a password so update account decryption options in state
    await this.updateAccountDecryptionProperties(masterKey, kdfConfig, protectedUserKey, userId);

    await this.cryptoService.setPrivateKey(keyPair[1].encryptedString, userId);

    await this.masterPasswordService.setMasterKeyHash(localMasterKeyHash, userId);

    if (resetPasswordAutoEnroll) {
      await this.handleResetPasswordAutoEnroll(masterKeyHash, orgId, userId);
    }
  }

  private async makeProtectedUserKey(
    masterKey: MasterKey,
    userId: UserId,
  ): Promise<[UserKey, EncString]> {
    let protectedUserKey: [UserKey, EncString] = null;

    const userKey = await firstValueFrom(this.cryptoService.userKey$(userId));

    if (userKey == null) {
      protectedUserKey = await this.cryptoService.makeUserKey(masterKey);
    } else {
      protectedUserKey = await this.cryptoService.encryptUserKeyWithMasterKey(masterKey);
    }

    return protectedUserKey;
  }

  private async makeKeyPairAndRequest(
    protectedUserKey: [UserKey, EncString],
  ): Promise<[[string, EncString], KeysRequest]> {
    const keyPair = await this.cryptoService.makeKeyPair(protectedUserKey[0]);
    if (keyPair == null) {
      throw new Error("keyPair not found. Could not set password.");
    }
    const keysRequest = new KeysRequest(keyPair[0], keyPair[1].encryptedString);

    return [keyPair, keysRequest];
  }

  private async updateAccountDecryptionProperties(
    masterKey: MasterKey,
    kdfConfig: PBKDF2KdfConfig,
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
    await this.cryptoService.setUserKey(protectedUserKey[0], userId);
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
    const userKey = await firstValueFrom(this.cryptoService.userKey$(userId));

    if (userKey == null) {
      throw new Error("userKey not found. Could not handle reset password auto enroll.");
    }

    const encryptedUserKey = await this.cryptoService.rsaEncrypt(userKey.key, publicKey);

    const resetRequest = new OrganizationUserResetPasswordEnrollmentRequest();
    resetRequest.masterPasswordHash = masterKeyHash;
    resetRequest.resetPasswordKey = encryptedUserKey.encryptedString;

    await this.organizationUserService.putOrganizationUserResetPasswordEnrollment(
      orgId,
      userId,
      resetRequest,
    );
  }
}
