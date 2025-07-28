import { firstValueFrom } from "rxjs";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import {
  OrganizationUserApiService,
  OrganizationUserResetPasswordEnrollmentRequest,
} from "@bitwarden/admin-console/common";
// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { InternalUserDecryptionOptionsServiceAbstraction } from "@bitwarden/auth/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { MasterPasswordApiService } from "@bitwarden/common/auth/abstractions/master-password-api.service.abstraction";
import { ForceSetPasswordReason } from "@bitwarden/common/auth/models/domain/force-set-password-reason";
import { SetPasswordRequest } from "@bitwarden/common/auth/models/request/set-password.request";
import { UpdateTdeOffboardingPasswordRequest } from "@bitwarden/common/auth/models/request/update-tde-offboarding-password.request";
import { assertNonNullish } from "@bitwarden/common/auth/utils";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import {
  EncString,
  UnsignedSharedKey,
} from "@bitwarden/common/key-management/crypto/models/enc-string";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { MasterPasswordAuthenticationData } from "@bitwarden/common/key-management/master-password/types/master-password.types";
import { firstValueFromOrThrow } from "@bitwarden/common/key-management/utils";
import { KeysRequest } from "@bitwarden/common/models/request/keys.request";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { UserKey } from "@bitwarden/common/types/key";
import { KdfConfigService, KeyService, KdfConfig } from "@bitwarden/key-management";

import {
  SetInitialPasswordService,
  SetInitialPasswordCredentials,
  SetInitialPasswordUserType,
  SetInitialPasswordTdeOffboardingCredentials,
} from "./set-initial-password.service.abstraction";

export class DefaultSetInitialPasswordService implements SetInitialPasswordService {
  constructor(
    protected apiService: ApiService,
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

  async setInitialPassword(
    credentials: SetInitialPasswordCredentials,
    userType: SetInitialPasswordUserType,
    userId: UserId,
  ): Promise<void> {
    const {
      newPassword,
      newPasswordHint,
      kdfConfig,
      salt,
      orgSsoIdentifier,
      orgId,
      resetPasswordAutoEnroll,
    } = credentials;

    for (const [key, value] of Object.entries(credentials)) {
      if (value == null) {
        throw new Error(`${key} not found. Could not set password.`);
      }
    }
    assertNonNullish(userId, "userId", "setInitialPassword");
    assertNonNullish(userType, "userType", "setInitialPassword");
    const userKey = await this.keyService.makeUserKeyV1();
    const authenticationData =
      await this.masterPasswordService.makeMasterPasswordAuthenticationData(
        newPassword,
        kdfConfig,
        salt,
      );
    const unlockData = await this.masterPasswordService.makeMasterPasswordUnlockData(
      newPassword,
      kdfConfig,
      salt,
      userKey,
    );

    let keyPair: [string, EncString] | null = null;
    let keysRequest: KeysRequest | null = null;

    if (userType === SetInitialPasswordUserType.JIT_PROVISIONED_MP_ORG_USER) {
      /**
       * A user being JIT provisioned into a MP encryption org does not yet have a user
       * asymmetric key pair, so we create it for them here.
       *
       * Sidenote:
       *   In the case of a TDE user whose permissions require that they have a MP - that user
       *   will already have a user asymmetric key pair by this point, so we skip this if-block
       *   so that we don't create a new key pair for them.
       */

      // Extra safety check (see description on https://github.com/bitwarden/clients/pull/10180):
      //   In case we have have a local private key and are not sure whether it has been posted to the server,
      //   we post the local private key instead of generating a new one
      const existingUserPrivateKey = (await firstValueFrom(
        this.keyService.userPrivateKey$(userId),
      )) as Uint8Array;

      const existingUserPublicKey = await firstValueFrom(this.keyService.userPublicKey$(userId));

      if (existingUserPrivateKey != null && existingUserPublicKey != null) {
        const existingUserPublicKeyB64 = Utils.fromBufferToB64(existingUserPublicKey);

        // Existing key pair
        keyPair = [
          existingUserPublicKeyB64,
          await this.encryptService.wrapDecapsulationKey(existingUserPrivateKey, userKey),
        ];
      } else {
        // New key pair
        keyPair = await this.keyService.makeKeyPair(userKey);
      }

      if (keyPair == null) {
        throw new Error("keyPair not found. Could not set password.");
      }
      if (!keyPair[1].encryptedString) {
        throw new Error("encrypted private key not found. Could not set password.");
      }

      keysRequest = new KeysRequest(keyPair[0], keyPair[1].encryptedString);
    }

    const request = SetPasswordRequest.newConstructor(
      authenticationData,
      unlockData,
      newPasswordHint,
      orgSsoIdentifier,
      keysRequest,
    );

    await this.masterPasswordApiService.setPassword(request);

    // Clear force set password reason to allow navigation back to vault.
    await this.masterPasswordService.setForceSetPasswordReason(ForceSetPasswordReason.None, userId);

    // User now has a password so update account decryption options in state
    await this.updateAccountDecryptionProperties(kdfConfig, userKey, userId);

    /**
     * Set the private key only for new JIT provisioned users in MP encryption orgs.
     * (Existing TDE users will have their private key set on sync or on login.)
     */
    if (keyPair != null && userType === SetInitialPasswordUserType.JIT_PROVISIONED_MP_ORG_USER) {
      if (!keyPair[1].encryptedString) {
        throw new Error("encrypted private key not found. Could not set private key in state.");
      }
      await this.keyService.setPrivateKey(keyPair[1].encryptedString, userId);
    }

    if (resetPasswordAutoEnroll) {
      await this.handleResetPasswordAutoEnroll(authenticationData, orgId as OrganizationId, userId);
    }
  }

  private async updateAccountDecryptionProperties(
    kdfConfig: KdfConfig,
    userKey: UserKey,
    userId: UserId,
  ) {
    const userDecryptionOpts = await firstValueFrom(
      this.userDecryptionOptionsService.userDecryptionOptions$,
    );
    userDecryptionOpts.hasMasterPassword = true;
    await this.userDecryptionOptionsService.setUserDecryptionOptions(userDecryptionOpts);
    await this.kdfConfigService.setKdfConfig(userId, kdfConfig);
    await this.keyService.setUserKey(userKey, userId);
  }

  private async handleResetPasswordAutoEnroll(
    authenticationData: MasterPasswordAuthenticationData,
    orgId: OrganizationId,
    userId: UserId,
  ) {
    const organizationKeys = await this.organizationApiService.getKeys(orgId);

    if (organizationKeys == null) {
      throw new Error(
        "Organization keys response is null. Could not handle reset password auto enroll.",
      );
    }

    const orgPublicKey = Utils.fromB64ToArray(organizationKeys.publicKey);
    const userKey = await firstValueFromOrThrow(this.keyService.userKey$(userId), "userKey");

    // RSA encrypt user key with organization public key
    const orgPublicKeyEncryptedUserKey: UnsignedSharedKey = (
      await this.encryptService.encapsulateKeyUnsigned(userKey, orgPublicKey)
    )?.toUnsignedSharedKey();

    if (orgPublicKeyEncryptedUserKey == null || !orgPublicKeyEncryptedUserKey) {
      throw new Error(
        "orgPublicKeyEncryptedUserKey not found. Could not handle reset password auto enroll.",
      );
    }

    const enrollmentRequest = new OrganizationUserResetPasswordEnrollmentRequest(
      orgPublicKeyEncryptedUserKey,
    );
    enrollmentRequest.authenticateWith(authenticationData);

    await this.organizationUserApiService.putOrganizationUserResetPasswordEnrollment(
      orgId,
      userId,
      enrollmentRequest,
    );
  }

  async setInitialPasswordTdeOffboarding(
    credentials: SetInitialPasswordTdeOffboardingCredentials,
    userId: UserId,
  ) {
    const { newMasterKey, newServerMasterKeyHash, newPasswordHint } = credentials;
    for (const [key, value] of Object.entries(credentials)) {
      if (value == null) {
        throw new Error(`${key} not found. Could not set password.`);
      }
    }

    if (userId == null) {
      throw new Error("userId not found. Could not set password.");
    }

    const userKey = await firstValueFrom(this.keyService.userKey$(userId));
    if (userKey == null) {
      throw new Error("userKey not found. Could not set password.");
    }

    const newMasterKeyEncryptedUserKey = await this.keyService.encryptUserKeyWithMasterKey(
      newMasterKey,
      userKey,
    );

    if (!newMasterKeyEncryptedUserKey[1].encryptedString) {
      throw new Error("newMasterKeyEncryptedUserKey not found. Could not set password.");
    }

    const request = new UpdateTdeOffboardingPasswordRequest();
    request.key = newMasterKeyEncryptedUserKey[1].encryptedString;
    request.newMasterPasswordHash = newServerMasterKeyHash;
    request.masterPasswordHint = newPasswordHint;

    await this.masterPasswordApiService.putUpdateTdeOffboardingPassword(request);

    // Clear force set password reason to allow navigation back to vault.
    await this.masterPasswordService.setForceSetPasswordReason(ForceSetPasswordReason.None, userId);
  }
}
