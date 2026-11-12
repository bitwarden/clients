import { concatMap, firstValueFrom } from "rxjs";

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
import { assertNonNullish, assertTruthy } from "@bitwarden/common/auth/utils";
import { AccountCryptographicStateService } from "@bitwarden/common/key-management/account-cryptography/account-cryptographic-state.service";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import {
  MasterPasswordAuthenticationData,
  MasterPasswordUnlockData,
} from "@bitwarden/common/key-management/master-password/types/master-password.types";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { RegisterSdkService } from "@bitwarden/common/platform/abstractions/sdk/register-sdk.service";
import { asUuid } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { UserId } from "@bitwarden/common/types/guid";
import { UserKey } from "@bitwarden/common/types/key";
import { KdfConfigService, KeyService } from "@bitwarden/key-management";
// eslint-disable-next-line no-restricted-imports
import {
  EncryptService,
  fromSdkKdfConfig,
  KdfConfig,
  LegacyCompatKeyService,
  SymmetricCryptoKey,
} from "@bitwarden/legacy-crypto";
import { OrganizationId as SdkOrganizationId, UserId as SdkUserId } from "@bitwarden/sdk-internal";
import { UnlockService } from "@bitwarden/unlock";

import {
  InitializeJitPasswordCredentials,
  SetInitialPasswordService,
  SetInitialPasswordTdeOffboardingCredentials,
  SetInitialPasswordTdeUserWithPermissionCredentials,
} from "./set-initial-password.service.abstraction";

export class DefaultSetInitialPasswordService implements SetInitialPasswordService {
  constructor(
    protected apiService: ApiService,
    protected encryptService: EncryptService,
    protected i18nService: I18nService,
    protected kdfConfigService: KdfConfigService,
    protected keyService: KeyService,
    protected legacyCompatKeyService: LegacyCompatKeyService,
    protected masterPasswordApiService: MasterPasswordApiService,
    protected masterPasswordService: InternalMasterPasswordServiceAbstraction,
    protected organizationApiService: OrganizationApiServiceAbstraction,
    protected organizationUserApiService: OrganizationUserApiService,
    protected userDecryptionOptionsService: InternalUserDecryptionOptionsServiceAbstraction,
    protected accountCryptographicStateService: AccountCryptographicStateService,
    protected registerSdkService: RegisterSdkService,
    protected unlockService: UnlockService,
  ) {}

  async setInitialPasswordTdeOffboarding(
    credentials: SetInitialPasswordTdeOffboardingCredentials,
    userId: UserId,
  ) {
    const ctx = "Could not set initial password.";
    assertTruthy(credentials.newPassword, "newPassword", ctx);
    assertTruthy(credentials.salt, "salt", ctx);
    assertNonNullish(credentials.kdfConfig, "kdfConfig", ctx);
    assertNonNullish(credentials.newPasswordHint, "newPasswordHint", ctx);

    if (userId == null) {
      throw new Error("userId not found. Could not set password.");
    }

    const { newPassword, salt, kdfConfig, newPasswordHint } = credentials;

    const userKey = await firstValueFrom(this.keyService.userKey$(userId));
    if (userKey == null) {
      throw new Error("userKey not found. Could not set password.");
    }

    const authenticationData: MasterPasswordAuthenticationData =
      await this.masterPasswordService.makeMasterPasswordAuthenticationData(
        newPassword,
        kdfConfig,
        salt,
      );

    const unlockData: MasterPasswordUnlockData =
      await this.masterPasswordService.makeMasterPasswordUnlockData(
        newPassword,
        kdfConfig,
        salt,
        userKey,
      );

    const request = new UpdateTdeOffboardingPasswordRequest(
      authenticationData,
      unlockData,
      newPasswordHint,
    );

    await this.masterPasswordApiService.putUpdateTdeOffboardingPassword(request);

    // TODO: investigate removing this call to clear forceSetPasswordReason in https://bitwarden.atlassian.net/browse/PM-32660
    // Clear force set password reason to allow navigation back to vault.
    await this.masterPasswordService.setForceSetPasswordReason(ForceSetPasswordReason.None, userId);
  }

  async initializePasswordJitPasswordUserV2Encryption(
    credentials: InitializeJitPasswordCredentials,
    userId: UserId,
  ): Promise<void> {
    if (userId == null) {
      throw new Error("User ID is required.");
    }

    for (const [key, value] of Object.entries(credentials)) {
      if (value == null) {
        throw new Error(`${key} is required.`);
      }
    }

    const { newPasswordHint, orgSsoIdentifier, orgId, resetPasswordAutoEnroll, newPassword, salt } =
      credentials;

    const organizationKeys = await this.organizationApiService.getKeys(orgId);
    if (organizationKeys == null) {
      throw new Error("Organization keys response is null.");
    }

    const registerResult = await firstValueFrom(
      this.registerSdkService.registerClient$(userId).pipe(
        concatMap(async (sdk) => {
          if (!sdk) {
            throw new Error("SDK not available");
          }

          using ref = sdk.take();
          return await ref.value
            .auth()
            .registration()
            .post_keys_for_jit_password_registration({
              org_id: asUuid<SdkOrganizationId>(orgId),
              org_public_key: organizationKeys.publicKey,
              master_password: newPassword,
              master_password_hint: newPasswordHint,
              salt: salt,
              organization_sso_identifier: orgSsoIdentifier,
              user_id: asUuid<SdkUserId>(userId),
              reset_password_enroll: resetPasswordAutoEnroll,
            });
        }),
      ),
    );

    if (!("V2" in registerResult.account_cryptographic_state)) {
      throw new Error("Unexpected V2 account cryptographic state");
    }

    // Note: When SDK state management matures, the state writes and the unlock below should all be
    // moved into post_keys_for_jit_password_registration
    // Set account cryptography state
    await this.accountCryptographicStateService.setAccountCryptographicState(
      registerResult.account_cryptographic_state,
      userId,
    );

    // Clear force set password reason to allow navigation back to vault.
    await this.masterPasswordService.setForceSetPasswordReason(ForceSetPasswordReason.None, userId);

    const masterPasswordUnlockData = MasterPasswordUnlockData.fromSdk(
      registerResult.master_password_unlock,
    );
    await this.masterPasswordService.setMasterPasswordUnlockData(masterPasswordUnlockData, userId);

    await this.updateLegacyState(
      fromSdkKdfConfig(registerResult.master_password_unlock.kdf),
      userId,
    );

    // Unlocking initializes the SDK from state, so it has to run after the state written above -
    // in particular the new KDF config - has been persisted.
    await this.unlockService.unlockWithDecryptedUserKey(
      userId,
      SymmetricCryptoKey.fromString(registerResult.user_key),
    );
  }

  async setInitialPasswordTdeUserWithPermission(
    credentials: SetInitialPasswordTdeUserWithPermissionCredentials,
    userId: UserId,
  ): Promise<void> {
    const ctx =
      "Could not set initial password for TDE user with Manage Account Recovery permission.";

    assertTruthy(credentials.newPassword, "newPassword", ctx);
    assertTruthy(credentials.salt, "salt", ctx);
    assertNonNullish(credentials.kdfConfig, "kdfConfig", ctx);
    assertNonNullish(credentials.newPasswordHint, "newPasswordHint", ctx); // can have an empty string as a valid value, so check non-nullish
    assertTruthy(credentials.orgSsoIdentifier, "orgSsoIdentifier", ctx);
    assertTruthy(credentials.orgId, "orgId", ctx);
    assertNonNullish(credentials.resetPasswordAutoEnroll, "resetPasswordAutoEnroll", ctx); // can have `false` as a valid value, so check non-nullish
    assertTruthy(userId, "userId", ctx);

    const {
      newPassword,
      salt,
      kdfConfig,
      newPasswordHint,
      orgSsoIdentifier,
      orgId,
      resetPasswordAutoEnroll,
    } = credentials;

    const userKey = await firstValueFrom(this.keyService.userKey$(userId));

    if (!userKey) {
      throw new Error("userKey not found.");
    }

    const authenticationData: MasterPasswordAuthenticationData =
      await this.masterPasswordService.makeMasterPasswordAuthenticationData(
        newPassword,
        kdfConfig,
        salt,
      );

    const unlockData: MasterPasswordUnlockData =
      await this.masterPasswordService.makeMasterPasswordUnlockData(
        newPassword,
        kdfConfig,
        salt,
        userKey,
      );

    // ============================================================
    // PM-42990 — ROLLBACK NOTE
    // ============================================================
    // This method already builds authentication data and unlock data.
    // The method newConstructor() converts that data into the old request shape.
    //
    // It converts to the old shape because the endpoint needs it for 3
    // releases, to stay compatible with self hosted servers.
    //
    // BUILD: Replace this call with a direct call to the new request
    // constructor. No other change is needed here.
    //
    // DELETE: Nothing to delete at this call site. See
    // https://github.com/bitwarden/clients/pull/20643 for initial pass at this
    // refactor.
    // ============================================================
    const request = SetPasswordRequest.newConstructor(
      authenticationData,
      unlockData,
      newPasswordHint,
      orgSsoIdentifier,
      null, // no KeysRequest for TDE user because they already have a key pair
    );

    await this.masterPasswordApiService.setPassword(request);

    // Clear force set password reason to allow navigation back to vault.
    await this.masterPasswordService.setForceSetPasswordReason(ForceSetPasswordReason.None, userId);

    // User now has a password so update decryption state
    await this.masterPasswordService.setMasterPasswordUnlockData(unlockData, userId);
    await this.updateLegacyState(unlockData.kdf, userId);

    if (resetPasswordAutoEnroll) {
      await this.handleResetPasswordAutoEnroll(
        authenticationData.masterPasswordAuthenticationHash,
        orgId,
        userId,
        userKey,
      );
    }
  }

  // Deprecated legacy support - to be removed in future
  private async updateLegacyState(kdfConfig: KdfConfig, userId: UserId) {
    // TODO Remove HasMasterPassword from UserDecryptionOptions https://bitwarden.atlassian.net/browse/PM-23475
    const userDecryptionOpts = await firstValueFrom(
      this.userDecryptionOptionsService.userDecryptionOptionsById$(userId),
    );
    userDecryptionOpts.hasMasterPassword = true;
    await this.userDecryptionOptionsService.setUserDecryptionOptionsById(
      userId,
      userDecryptionOpts,
    );

    // TODO Remove KDF state https://bitwarden.atlassian.net/browse/PM-30661
    await this.kdfConfigService.setKdfConfig(userId, kdfConfig);
  }

  private async handleResetPasswordAutoEnroll(
    masterKeyHash: string,
    orgId: string,
    userId: UserId,
    userKey: UserKey,
  ) {
    const organizationKeys = await this.organizationApiService.getKeys(orgId);

    if (organizationKeys == null) {
      throw new Error(
        "Organization keys response is null. Could not handle reset password auto enroll.",
      );
    }

    const orgPublicKey = Utils.fromB64ToArray(organizationKeys.publicKey);

    // RSA encrypt user key with organization public key
    const orgPublicKeyEncryptedUserKey = await this.encryptService.encapsulateKeyUnsigned(
      userKey,
      orgPublicKey,
    );

    if (orgPublicKeyEncryptedUserKey == null || !orgPublicKeyEncryptedUserKey.encryptedString) {
      throw new Error(
        "orgPublicKeyEncryptedUserKey not found. Could not handle reset password auto enroll.",
      );
    }

    const enrollmentRequest = new OrganizationUserResetPasswordEnrollmentRequest();
    enrollmentRequest.masterPasswordHash = masterKeyHash;
    enrollmentRequest.resetPasswordKey = orgPublicKeyEncryptedUserKey.encryptedString;

    await this.organizationUserApiService.putOrganizationUserResetPasswordEnrollment(
      orgId,
      userId,
      enrollmentRequest,
    );
  }
}
