import { MockProxy, mock } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { OrganizationUserApiService } from "@bitwarden/admin-console/common";
import {
  SetInitialPasswordCredentials,
  SetInitialPasswordService,
  SetInitialPasswordUser,
  SetInitialPasswordUserType,
} from "@bitwarden/auth/angular";
import {
  FakeUserDecryptionOptions as UserDecryptionOptions,
  InternalUserDecryptionOptionsServiceAbstraction,
} from "@bitwarden/auth/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { MasterPasswordApiService } from "@bitwarden/common/auth/abstractions/master-password-api.service.abstraction";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { CsprngArray } from "@bitwarden/common/types/csprng";
import { UserId } from "@bitwarden/common/types/guid";
import { MasterKey, UserKey } from "@bitwarden/common/types/key";
import { DEFAULT_KDF_CONFIG, KdfConfigService, KeyService } from "@bitwarden/key-management";

import { DesktopSetInitialPasswordService } from "./desktop-set-initial-password.service";

describe("DesktopSetInitialPasswordService", () => {
  let sut: SetInitialPasswordService;

  let apiService: MockProxy<ApiService>;
  let masterPasswordApiService: MockProxy<MasterPasswordApiService>;
  let keyService: MockProxy<KeyService>;
  let encryptService: MockProxy<EncryptService>;
  let i18nService: MockProxy<I18nService>;
  let kdfConfigService: MockProxy<KdfConfigService>;
  let masterPasswordService: MockProxy<InternalMasterPasswordServiceAbstraction>;
  let organizationApiService: MockProxy<OrganizationApiServiceAbstraction>;
  let organizationUserApiService: MockProxy<OrganizationUserApiService>;
  let userDecryptionOptionsService: MockProxy<InternalUserDecryptionOptionsServiceAbstraction>;
  let messagingService: MockProxy<MessagingService>;

  beforeEach(() => {
    apiService = mock<ApiService>();
    masterPasswordApiService = mock<MasterPasswordApiService>();
    keyService = mock<KeyService>();
    encryptService = mock<EncryptService>();
    i18nService = mock<I18nService>();
    kdfConfigService = mock<KdfConfigService>();
    masterPasswordService = mock<InternalMasterPasswordServiceAbstraction>();
    organizationApiService = mock<OrganizationApiServiceAbstraction>();
    organizationUserApiService = mock<OrganizationUserApiService>();
    userDecryptionOptionsService = mock<InternalUserDecryptionOptionsServiceAbstraction>();
    messagingService = mock<MessagingService>();

    sut = new DesktopSetInitialPasswordService(
      apiService,
      masterPasswordApiService,
      keyService,
      encryptService,
      i18nService,
      kdfConfigService,
      masterPasswordService,
      organizationApiService,
      organizationUserApiService,
      userDecryptionOptionsService,
      messagingService,
    );
  });

  it("should instantiate", () => {
    expect(sut).not.toBeFalsy();
  });

  describe("setInitialPassword()", () => {
    let userId: UserId;
    let userType: SetInitialPasswordUserType;
    let credentials: SetInitialPasswordCredentials;
    let userKey: UserKey;
    let userKeyEncString: EncString;
    let protectedUserKey: [UserKey, EncString];
    let keyPair: [string, EncString];

    let userDecryptionOptionsSubject: BehaviorSubject<UserDecryptionOptions>;

    beforeEach(() => {
      userId = "userId" as UserId;
      userType = SetInitialPasswordUser.JIT_PROVISIONED_MP_ORG_USER;
      userKey = new SymmetricCryptoKey(new Uint8Array(64).buffer as CsprngArray) as UserKey;
      userKeyEncString = new EncString("userKeyEncrypted");
      protectedUserKey = [userKey, userKeyEncString];
      keyPair = ["publicKey", new EncString("privateKey")];

      userDecryptionOptionsSubject = new BehaviorSubject(null);
      userDecryptionOptionsService.userDecryptionOptions$ = userDecryptionOptionsSubject;

      credentials = {
        newMasterKey: new SymmetricCryptoKey(new Uint8Array(64).buffer as CsprngArray) as MasterKey,
        newServerMasterKeyHash: "newServerMasterKeyHash",
        newLocalMasterKeyHash: "newLocalMasterKeyHash",
        newPasswordHint: "newPasswordHint",
        kdfConfig: DEFAULT_KDF_CONFIG,
        orgSsoIdentifier: "orgSsoIdentifier",
        orgId: "orgId",
        resetPasswordAutoEnroll: false,
      };
    });

    function setupSetPasswordMocks() {
      keyService.userPrivateKey$.mockReturnValue(of(null));
      keyService.userPublicKey$.mockReturnValue(of(null));

      keyService.userKey$.mockReturnValue(of(userKey));
      keyService.encryptUserKeyWithMasterKey.mockResolvedValue(protectedUserKey);

      keyService.makeKeyPair.mockResolvedValue(keyPair);

      masterPasswordApiService.setPassword.mockResolvedValue(undefined);
      masterPasswordService.setForceSetPasswordReason.mockResolvedValue(undefined);

      userDecryptionOptionsSubject.next(new UserDecryptionOptions({ hasMasterPassword: true }));
      userDecryptionOptionsService.setUserDecryptionOptions.mockResolvedValue(undefined);
      kdfConfigService.setKdfConfig.mockResolvedValue(undefined);
      keyService.setUserKey.mockResolvedValue(undefined);

      keyService.setPrivateKey.mockResolvedValue(undefined);

      masterPasswordService.setMasterKeyHash.mockResolvedValue(undefined);
    }

    it("should send a 'redrawMenu' message", async () => {
      // Arrange
      setupSetPasswordMocks();

      // Act
      await sut.setInitialPassword(credentials, userType, userId);

      // Assert
      expect(messagingService.send).toHaveBeenCalledTimes(1);
      expect(messagingService.send).toHaveBeenCalledWith("redrawMenu");
    });
  });
});
