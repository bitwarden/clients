import { concatMap, firstValueFrom } from "rxjs";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { InternalUserDecryptionOptionsServiceAbstraction } from "@bitwarden/auth/common";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { ForceSetPasswordReason } from "@bitwarden/common/auth/models/domain/force-set-password-reason";
import { AccountCryptographicStateService } from "@bitwarden/common/key-management/account-cryptography/account-cryptographic-state.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { MasterPasswordUnlockData } from "@bitwarden/common/key-management/master-password/types/master-password.types";
import { RegisterSdkService } from "@bitwarden/common/platform/abstractions/sdk/register-sdk.service";
import { asUuid } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { HashPurpose } from "@bitwarden/common/platform/enums";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { MasterKey, UserKey } from "@bitwarden/common/types/key";
import {
  fromSdkKdfConfig,
  KdfConfig,
  KdfConfigService,
  KeyService,
} from "@bitwarden/key-management";
import { OrganizationId as SdkOrganizationId, UserId as SdkUserId } from "@bitwarden/sdk-internal";
import { UserId } from "@bitwarden/user-core";

import {
  InitializeJitPasswordCredentials,
  InitializeJitPasswordUserService,
} from "./initialize-jit-password-user.service.abstraction";

export class DefaultInitializeJitPasswordUserService implements InitializeJitPasswordUserService {
  constructor(
    private readonly kdfConfigService: KdfConfigService,
    private readonly keyService: KeyService,
    private readonly masterPasswordService: InternalMasterPasswordServiceAbstraction,
    private readonly organizationApiService: OrganizationApiServiceAbstraction,
    private readonly userDecryptionOptionsService: InternalUserDecryptionOptionsServiceAbstraction,
    private readonly accountCryptographicStateService: AccountCryptographicStateService,
    private readonly registerSdkService: RegisterSdkService,
  ) {}

  async initializeUser(
    credentials: InitializeJitPasswordCredentials,
    userId: UserId,
  ): Promise<void> {
    const { newPasswordHint, orgSsoIdentifier, orgId, resetPasswordAutoEnroll, newPassword, salt } =
      credentials;

    if (orgSsoIdentifier == null) {
      throw new Error("Organization SSO identifier is required.");
    }
    if (orgId == null) {
      throw new Error("Organization id is required.");
    }
    if (newPassword == null) {
      throw new Error("New password is required.");
    }
    if (salt == null) {
      throw new Error("Salt is required.");
    }
    if (userId == null) {
      throw new Error("User ID is required.");
    }

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

    // Note: When SDK state management matures, these should be moved into post_keys_for_tde_registration
    // Set account cryptography state
    await this.accountCryptographicStateService.setAccountCryptographicState(
      registerResult.account_cryptographic_state,
      userId,
    );

    // Clear force set password reason to allow navigation back to vault.
    await this.masterPasswordService.setForceSetPasswordReason(ForceSetPasswordReason.None, userId);

    await this.masterPasswordService.setMasterPasswordUnlockData(
      MasterPasswordUnlockData.fromSdk(registerResult.master_password_unlock),
      userId,
    );

    await this.keyService.setUserKey(
      SymmetricCryptoKey.fromString(registerResult.user_key) as UserKey,
      userId,
    );

    const masterKey = SymmetricCryptoKey.fromString(registerResult.master_key) as MasterKey;

    await this.updateLegacyState(
      newPassword,
      masterKey,
      fromSdkKdfConfig(registerResult.master_password_unlock.kdf),
      new EncString(registerResult.master_password_unlock.masterKeyWrappedUserKey),
      userId,
    );
  }

  // Deprecated legacy support - to be removed in future
  private async updateLegacyState(
    newPassword: string,
    masterKey: MasterKey,
    kdfConfig: KdfConfig,
    masterKeyWrappedUserKey: EncString,
    userId: UserId,
  ) {
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
    // TODO Remove master key memory state https://bitwarden.atlassian.net/browse/PM-23477
    await this.masterPasswordService.setMasterKey(masterKey, userId);
    // TODO Remove master key memory state https://bitwarden.atlassian.net/browse/PM-23477
    await this.masterPasswordService.setMasterKeyEncryptedUserKey(masterKeyWrappedUserKey, userId);

    // TODO Remove "LocalAuthorization" master key hash https://bitwarden.atlassian.net/browse/PM-23476
    const newLocalMasterKeyHash = await this.keyService.hashMasterKey(
      newPassword,
      masterKey,
      HashPurpose.LocalAuthorization,
    );
    await this.masterPasswordService.setMasterKeyHash(newLocalMasterKeyHash, userId);
  }
}
