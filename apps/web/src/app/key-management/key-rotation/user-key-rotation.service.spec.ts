import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { OrganizationUserResetPasswordWithIdRequest } from "@bitwarden/admin-console/common";
import { Account } from "@bitwarden/common/auth/abstractions/account.service";
import { WebauthnRotateCredentialRequest } from "@bitwarden/common/auth/models/request/webauthn-rotate-credential.request";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { CryptoFunctionService } from "@bitwarden/common/key-management/crypto/abstractions/crypto-function.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import {
  EncryptedString,
  EncString,
} from "@bitwarden/common/key-management/crypto/models/enc-string";
import { DeviceTrustServiceAbstraction } from "@bitwarden/common/key-management/device-trust/abstractions/device-trust.service.abstraction";
import { SecurityStateService } from "@bitwarden/common/key-management/security-state/abstractions/security-state.service";
import {
  SignedPublicKey,
  SignedSecurityState,
  UnsignedPublicKey,
  VerifyingKey,
  WrappedPrivateKey,
  WrappedSigningKey,
} from "@bitwarden/common/key-management/types";
import { VaultTimeoutService } from "@bitwarden/common/key-management/vault-timeout";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { SdkClientFactory } from "@bitwarden/common/platform/abstractions/sdk/sdk-client-factory";
import { SdkLoadService } from "@bitwarden/common/platform/abstractions/sdk/sdk-load.service";
import { HashPurpose } from "@bitwarden/common/platform/enums";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { SendWithIdRequest } from "@bitwarden/common/tools/send/models/request/send-with-id.request";
import { SendService } from "@bitwarden/common/tools/send/services/send.service.abstraction";
import { UserId } from "@bitwarden/common/types/guid";
import { MasterKey, UserKey, UserPrivateKey, UserPublicKey } from "@bitwarden/common/types/key";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherWithIdRequest } from "@bitwarden/common/vault/models/request/cipher-with-id.request";
import { FolderWithIdRequest } from "@bitwarden/common/vault/models/request/folder-with-id.request";
import { DialogService, ToastService } from "@bitwarden/components";
import {
  KeyService,
  PBKDF2KdfConfig,
  KdfConfigService,
  KdfConfig,
  KdfType,
} from "@bitwarden/key-management";
import {
  AccountRecoveryTrustComponent,
  EmergencyAccessTrustComponent,
  KeyRotationTrustInfoComponent,
} from "@bitwarden/key-management-ui";
import { BitwardenClient, PureCrypto } from "@bitwarden/sdk-internal";

import { OrganizationUserResetPasswordService } from "../../admin-console/organizations/members/services/organization-user-reset-password/organization-user-reset-password.service";
import { WebauthnLoginAdminService } from "../../auth";
import { EmergencyAccessService } from "../../auth/emergency-access";
import { EmergencyAccessStatusType } from "../../auth/emergency-access/enums/emergency-access-status-type";
import { EmergencyAccessType } from "../../auth/emergency-access/enums/emergency-access-type";
import { EmergencyAccessWithIdRequest } from "../../auth/emergency-access/request/emergency-access-update.request";

import { AccountKeysRequest } from "./request/account-keys.request";
import { MasterPasswordUnlockDataRequest } from "./request/master-password-unlock-data.request";
import { UnlockDataRequest } from "./request/unlock-data.request";
import { UserDataRequest } from "./request/userdata.request";
import { V1UserCryptographicState } from "./types/v1-cryptographic-state";
import { V2UserCryptographicState } from "./types/v2-cryptographic-state";
import { UserKeyRotationApiService } from "./user-key-rotation-api.service";
import {
  UserKeyRotationService,
  V1CryptographicStateParameters,
  V2CryptographicStateParameters,
} from "./user-key-rotation.service";

const initialPromptedOpenTrue = jest.fn();
initialPromptedOpenTrue.mockReturnValue({ closed: new BehaviorSubject(true) });
const initialPromptedOpenFalse = jest.fn();
initialPromptedOpenFalse.mockReturnValue({ closed: new BehaviorSubject(false) });

const emergencyAccessTrustOpenTrusted = jest.fn();
emergencyAccessTrustOpenTrusted.mockReturnValue({
  closed: new BehaviorSubject(true),
});
const emergencyAccessTrustOpenUntrusted = jest.fn();
emergencyAccessTrustOpenUntrusted.mockReturnValue({
  closed: new BehaviorSubject(false),
});

const accountRecoveryTrustOpenTrusted = jest.fn();
accountRecoveryTrustOpenTrusted.mockReturnValue({
  closed: new BehaviorSubject(true),
});
const accountRecoveryTrustOpenUntrusted = jest.fn();
accountRecoveryTrustOpenUntrusted.mockReturnValue({
  closed: new BehaviorSubject(false),
});

function createMockFolder(id: string, name: string): FolderWithIdRequest {
  return {
    id: id,
    name: name,
  } as FolderWithIdRequest;
}

function createMockCipher(id: string, name: string): CipherWithIdRequest {
  return {
    id: id,
    name: name,
    type: CipherType.Login,
  } as CipherWithIdRequest;
}

function createMockSend(id: string, name: string): SendWithIdRequest {
  return {
    id: id,
    name: name,
  } as SendWithIdRequest;
}

function createMockEmergencyAccess(id: string): EmergencyAccessWithIdRequest {
  return {
    id: id,
    type: 0,
    waitTimeDays: 5,
  } as EmergencyAccessWithIdRequest;
}

function createMockResetPassword(id: string): OrganizationUserResetPasswordWithIdRequest {
  return {
    organizationId: id,
    resetPasswordKey: "mockResetPasswordKey",
  } as OrganizationUserResetPasswordWithIdRequest;
}

function createMockWebauthn(id: string): any {
  return {
    id: id,
  } as WebauthnRotateCredentialRequest;
}

const TEST_VECTOR_USER_KEY_V1 = new SymmetricCryptoKey(new Uint8Array(64)) as UserKey;
const TEST_VECTOR_PRIVATE_KEY_V1 =
  "2.AAAw2vTUePO+CCyokcIfVw==|DTBNlJ5yVsV2Bsk3UU3H6Q==|YvFBff5gxWqM+UsFB6BKimKxhC32AtjF3IStpU1Ijwg=" as WrappedPrivateKey;
const TEST_VECTOR_PUBLIC_KEY_V1 = Utils.fromBufferToB64(new Uint8Array(400));
const TEST_VECTOR_PRIVATE_KEY_V1_ROTATED =
  "2.AAAw2vTUePO+CCyokcIfVw==|DTBNlJ5yVsV2Bsk3UU3H6Q==|AAAAff5gxWqM+UsFB6BKimKxhC32AtjF3IStpU1Ijwg=" as WrappedPrivateKey;

const TEST_VECTOR_USER_KEY_V2 = new SymmetricCryptoKey(new Uint8Array(70)) as UserKey;
const TEST_VECTOR_PRIVATE_KEY_V2 = "7.AAAw2vTUePO+CCyokcIfVw==" as WrappedPrivateKey;
const TEST_VECTOR_SIGNING_KEY_V2 = "7.AAAw2vTUePO+CCyokcIfVw==" as WrappedSigningKey;
const TEST_VECTOR_VERIFYING_KEY_V2 = "AAAw2vTUePO+CCyokcIfVw==" as VerifyingKey;
const TEST_VECTOR_SECURITY_STATE_V2 = "AAAw2vTUePO+CCyokcIfVw==" as SignedSecurityState;
const TEST_VECTOR_PUBLIC_KEY_V2 = Utils.fromBufferToB64(new Uint8Array(400));
const TEST_VECTOR_SIGNED_PUBLIC_KEY_V2 = "AAAw2vTUePO+CCyokcIfVw==" as SignedPublicKey;

class TestUserKeyRotationService extends UserKeyRotationService {
  override rotateUserKeyMasterPasswordAndEncryptedData(
    currentMasterPassword: string,
    newMasterPassword: string,
    user: Account,
    newMasterPasswordHint?: string,
  ): Promise<void> {
    return super.rotateUserKeyMasterPasswordAndEncryptedData(
      currentMasterPassword,
      newMasterPassword,
      user,
      newMasterPasswordHint,
    );
  }
  override ensureIsAllowedToRotateUserKey(): Promise<void> {
    return super.ensureIsAllowedToRotateUserKey();
  }
  override getNewAccountKeysV1(
    cryptographicStateParameters: V1CryptographicStateParameters,
  ): Promise<V1UserCryptographicState> {
    return super.getNewAccountKeysV1(cryptographicStateParameters);
  }
  override getNewAccountKeysV2(
    userId: UserId,
    kdfConfig: KdfConfig,
    email: string,
    cryptographicStateParameters: V1CryptographicStateParameters | V2CryptographicStateParameters,
  ): Promise<V2UserCryptographicState> {
    return super.getNewAccountKeysV2(userId, kdfConfig, email, cryptographicStateParameters);
  }
  override createMasterPasswordUnlockDataRequest(
    userKey: UserKey,
    newUnlockData: {
      masterPassword: string;
      masterKeySalt: string;
      masterKeyKdfConfig: KdfConfig;
      masterPasswordHint: string;
    },
  ): Promise<MasterPasswordUnlockDataRequest> {
    return super.createMasterPasswordUnlockDataRequest(userKey, newUnlockData);
  }
  override getAccountUnlockDataRequest(
    userId: UserId,
    currentUserKey: UserKey,
    newUserKey: UserKey,
    masterPasswordAuthenticationAndUnlockData: {
      masterPassword: string;
      masterKeySalt: string;
      masterKeyKdfConfig: KdfConfig;
      masterPasswordHint: string;
    },
    trustedEmergencyAccessGranteesPublicKeys: UnsignedPublicKey[],
    trustedOrganizationPublicKeys: UnsignedPublicKey[],
  ): Promise<UnlockDataRequest> {
    return super.getAccountUnlockDataRequest(
      userId,
      currentUserKey,
      newUserKey,
      masterPasswordAuthenticationAndUnlockData,
      trustedEmergencyAccessGranteesPublicKeys,
      trustedOrganizationPublicKeys,
    );
  }
  override verifyTrust(user: Account): Promise<{
    wasTrustDenied: boolean;
    trustedOrganizationPublicKeys: UnsignedPublicKey[];
    trustedEmergencyAccessUserPublicKeys: UnsignedPublicKey[];
  }> {
    return super.verifyTrust(user);
  }
  override getAccountDataRequest(
    originalUserKey: UserKey,
    newUnencryptedUserKey: UserKey,
    user: Account,
  ): Promise<UserDataRequest> {
    return super.getAccountDataRequest(originalUserKey, newUnencryptedUserKey, user);
  }
  override isV1User(userKey: UserKey): boolean {
    return super.isV1User(userKey);
  }
  override isUserWithMasterPassword(id: UserId): boolean {
    return super.isUserWithMasterPassword(id);
  }
  override makeServerMasterKeyAuthenticationHash(
    masterPassword: string,
    masterKeyKdfConfig: KdfConfig,
    masterKeySalt: string,
  ): Promise<string> {
    return super.makeServerMasterKeyAuthenticationHash(
      masterPassword,
      masterKeyKdfConfig,
      masterKeySalt,
    );
  }
  override getCryptographicStateForUser(user: Account): Promise<{
    masterKeyKdfConfig: KdfConfig;
    masterKeySalt: string;
    cryptographicStateParameters: V1CryptographicStateParameters | V2CryptographicStateParameters;
  }> {
    return super.getCryptographicStateForUser(user);
  }
}

describe("KeyRotationService", () => {
  let keyRotationService: TestUserKeyRotationService;

  let mockApiService: MockProxy<UserKeyRotationApiService>;
  let mockCipherService: MockProxy<CipherService>;
  let mockFolderService: MockProxy<FolderService>;
  let mockSendService: MockProxy<SendService>;
  let mockEmergencyAccessService: MockProxy<EmergencyAccessService>;
  let mockResetPasswordService: MockProxy<OrganizationUserResetPasswordService>;
  let mockDeviceTrustService: MockProxy<DeviceTrustServiceAbstraction>;
  let mockKeyService: MockProxy<KeyService>;
  let mockEncryptService: MockProxy<EncryptService>;
  let mockConfigService: MockProxy<ConfigService>;
  let mockSyncService: MockProxy<SyncService>;
  let mockWebauthnLoginAdminService: MockProxy<WebauthnLoginAdminService>;
  let mockLogService: MockProxy<LogService>;
  let mockVaultTimeoutService: MockProxy<VaultTimeoutService>;
  let mockDialogService: MockProxy<DialogService>;
  let mockToastService: MockProxy<ToastService>;
  let mockI18nService: MockProxy<I18nService>;
  let mockCryptoFunctionService: MockProxy<CryptoFunctionService>;
  let mockKdfConfigService: MockProxy<KdfConfigService>;
  let mockSdkClientFactory: MockProxy<SdkClientFactory>;
  let mockSecurityStateService: MockProxy<SecurityStateService>;

  const mockUser = {
    id: "mockUserId" as UserId,
    email: "mockEmail",
    emailVerified: true,
    name: "mockName",
  };

  const mockTrustedPublicKeys = [Utils.fromUtf8ToArray("test-public-key")];

  const mockMakeKeysForUserCryptoV2 = jest.fn();
  const mockGetV2RotatedAccountKeys = jest.fn();

  beforeAll(() => {
    mockApiService = mock<UserKeyRotationApiService>();
    mockCipherService = mock<CipherService>();
    mockFolderService = mock<FolderService>();
    mockSendService = mock<SendService>();
    mockEmergencyAccessService = mock<EmergencyAccessService>();
    mockEmergencyAccessService.getPublicKeys.mockResolvedValue(
      mockTrustedPublicKeys.map((key) => {
        return {
          publicKey: key,
          id: "00000000-0000-0000-0000-000000000000" as UserId,
          granteeId: "mockGranteeId",
          name: "mockName",
          email: "mockEmail",
          type: EmergencyAccessType.Takeover,
          status: EmergencyAccessStatusType.Accepted,
          waitTimeDays: 5,
          creationDate: "mockCreationDate",
          avatarColor: "mockAvatarColor",
        };
      }),
    );
    mockResetPasswordService = mock<OrganizationUserResetPasswordService>();
    mockResetPasswordService.getPublicKeys.mockResolvedValue(
      mockTrustedPublicKeys.map((key) => {
        return {
          publicKey: key,
          orgId: "mockOrgId",
          orgName: "mockOrgName",
        };
      }),
    );
    mockDeviceTrustService = mock<DeviceTrustServiceAbstraction>();
    mockKeyService = mock<KeyService>();
    mockEncryptService = mock<EncryptService>();
    mockConfigService = mock<ConfigService>();
    mockSyncService = mock<SyncService>();
    mockWebauthnLoginAdminService = mock<WebauthnLoginAdminService>();
    mockLogService = mock<LogService>();
    mockVaultTimeoutService = mock<VaultTimeoutService>();
    mockToastService = mock<ToastService>();
    mockI18nService = mock<I18nService>();
    mockDialogService = mock<DialogService>();
    mockCryptoFunctionService = mock<CryptoFunctionService>();
    mockKdfConfigService = mock<KdfConfigService>();
    mockSdkClientFactory = mock<SdkClientFactory>();
    mockSdkClientFactory.createSdkClient.mockResolvedValue({
      crypto: () => {
        return {
          initialize_user_crypto: jest.fn(),
          make_keys_for_user_crypto_v2: mockMakeKeysForUserCryptoV2,
          get_v2_rotated_account_keys: mockGetV2RotatedAccountKeys,
        } as any;
      },
    } as BitwardenClient);
    mockSecurityStateService = mock<SecurityStateService>();

    keyRotationService = new TestUserKeyRotationService(
      mockApiService,
      mockCipherService,
      mockFolderService,
      mockSendService,
      mockEmergencyAccessService,
      mockResetPasswordService,
      mockDeviceTrustService,
      mockKeyService,
      mockEncryptService,
      mockSyncService,
      mockWebauthnLoginAdminService,
      mockLogService,
      mockVaultTimeoutService,
      mockToastService,
      mockI18nService,
      mockDialogService,
      mockConfigService,
      mockCryptoFunctionService,
      mockKdfConfigService,
      mockSdkClientFactory,
      mockSecurityStateService,
    );
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mock("@bitwarden/key-management-ui");
    jest.spyOn(PureCrypto, "make_user_key_aes256_cbc_hmac").mockReturnValue(new Uint8Array(64));
    jest
      .spyOn(PureCrypto, "encrypt_user_key_with_master_password")
      .mockReturnValue("mockNewUserKey");
    Object.defineProperty(SdkLoadService, "Ready", {
      value: Promise.resolve(),
      configurable: true,
    });
  });

  describe("rotateUserKeyMasterPasswordAndEncryptedData", () => {
    let privateKey: BehaviorSubject<UserPrivateKey | null>;
    let keyPair: BehaviorSubject<{ privateKey: UserPrivateKey; publicKey: UserPublicKey }>;

    beforeEach(() => {
      mockSyncService.getLastSync.mockResolvedValue(new Date());
      mockKeyService.makeUserKey.mockResolvedValue([
        new SymmetricCryptoKey(new Uint8Array(64)) as UserKey,
        {
          encryptedString: "mockNewUserKey",
        } as any,
      ]);
      mockKeyService.hashMasterKey.mockResolvedValue("mockMasterPasswordHash");
      mockConfigService.getFeatureFlag.mockResolvedValue(false);

      mockEncryptService.wrapSymmetricKey.mockResolvedValue({
        encryptedString: "mockEncryptedData",
      } as any);
      mockEncryptService.wrapDecapsulationKey.mockResolvedValue({
        encryptedString: "mockEncryptedData",
      } as any);

      // Mock user key
      mockKeyService.userKey$.mockReturnValue(new BehaviorSubject("mockOriginalUserKey" as any));

      mockKeyService.getFingerprint.mockResolvedValue(["a", "b"]);

      // Mock private key
      privateKey = new BehaviorSubject("mockPrivateKey" as any);
      mockKeyService.userPrivateKeyWithLegacySupport$.mockReturnValue(privateKey);

      keyPair = new BehaviorSubject({
        privateKey: "mockPrivateKey",
        publicKey: "mockPublicKey",
      } as any);
      mockKeyService.userEncryptionKeyPair$.mockReturnValue(keyPair);

      // Mock ciphers
      const mockCiphers = [createMockCipher("1", "Cipher 1"), createMockCipher("2", "Cipher 2")];
      mockCipherService.getRotatedData.mockResolvedValue(mockCiphers);

      // Mock folders
      const mockFolders = [createMockFolder("1", "Folder 1"), createMockFolder("2", "Folder 2")];
      mockFolderService.getRotatedData.mockResolvedValue(mockFolders);

      // Mock sends
      const mockSends = [createMockSend("1", "Send 1"), createMockSend("2", "Send 2")];
      mockSendService.getRotatedData.mockResolvedValue(mockSends);

      // Mock emergency access
      const emergencyAccess = [createMockEmergencyAccess("13")];
      mockEmergencyAccessService.getRotatedData.mockResolvedValue(emergencyAccess);

      // Mock reset password
      const resetPassword = [createMockResetPassword("12")];
      mockResetPasswordService.getRotatedData.mockResolvedValue(resetPassword);

      // Mock Webauthn
      const webauthn = [createMockWebauthn("13"), createMockWebauthn("14")];
      mockWebauthnLoginAdminService.getRotatedData.mockResolvedValue(webauthn);

      KeyRotationTrustInfoComponent.open = initialPromptedOpenTrue;
      EmergencyAccessTrustComponent.open = emergencyAccessTrustOpenTrusted;
      AccountRecoveryTrustComponent.open = accountRecoveryTrustOpenTrusted;
    });

    it("rotates the userkey and encrypted data and changes master password", async () => {
      KeyRotationTrustInfoComponent.open = initialPromptedOpenTrue;
      AccountRecoveryTrustComponent.open = initialPromptedOpenTrue;
      EmergencyAccessTrustComponent.open = emergencyAccessTrustOpenTrusted;
      mockKdfConfigService.getKdfConfig$.mockReturnValue(
        new BehaviorSubject(new PBKDF2KdfConfig(100000)),
      );
      mockKeyService.userKey$.mockReturnValue(
        new BehaviorSubject(new SymmetricCryptoKey(new Uint8Array(64)) as UserKey),
      );
      mockKeyService.hashMasterKey.mockResolvedValue("mockMasterPasswordHash");
      mockKeyService.userEncryptedPrivateKey$.mockReturnValue(
        new BehaviorSubject(
          "2.eh465OrUcluL9UpnCOUTAg==|2HXNXwrLwAjUfZ/U75c92rZEltt1eHxjMkp/ADAmx346oT1+GaQvaL1QIV/9Om0T72m8AnlO92iUfWdhbA/ifHZ+lhFoUVeyw1M88CMzktbVcq42rFoK7SGHSAGdTL3ccUWKI8yCCQJhpt2X6a/5+T7ey5k2CqvylKyOtkiCnVeLmYqETn5BM9Rl3tEgJW1yDLuSJ+L+Qh9xnk/Z3zJUV5HAs+YwjKwuSNrd00SXjDyx8rBEstD9MKI+lrk7to/q90vqKqCucAj/dzUpVtHe88al2AAlBVwQ13HUPdNFOyti6niUgCAWx+DzRqlhkFvl/z/rtxtQsyqq/3Eh/EL54ylxKzAya0ev9EaIOm/dD1aBmI58p4Bs0eMOCIKJjtw+Cmdql+RhCtKtumgFShqyXv+LfD/FgUsdTVNExk3YNhgwPR4jOaMa/j9LCrBMCLKxdAhQyBe7T3qoX1fBBirvY6t77ifMu1YEQ6DfmFphVSwDH5C9xGeTSh5IELSf0tGVtlWUe9RffDDzccD0L1lR8U+dqzoSTYCuXvhEhQptdIW6fpH/47u0M5MiI97/d35A7Et2I1gjHp7WF3qsY20ellBueu7ZL5P1BmqPXl58yaBBXJaCutYHDfIucspqdZmfBGEbdRT4wmuZRON0J8zLmUejM0VR/2MOmpfyYQXnJhTfrvnZ1bOg1aMhUxJ2vhDNPXUFm5b+vwsho4GEvcLAKq9WwbvOJ/sK7sEVfTfEO2IG+0X6wkWm7RpR6Wq9FGKSrv2PSjMAYnb+z3ETeWiaaiD+tVFxa2AaqsbOuX092/86GySpHES7cFWhQ/YMOgj6egUi8mEC0CqMXYsx0TTJDsn16oP+XB3a2WoRqzE0YBozp2aMXxhVf/jMZ03BmEmRQu5B+Sq1gMEZwtIfJ+srkZLMYlLjvVw92FRoFy+N6ytPiyf6RMHMUnJ3vEZSBogaElYoQAtFJ5kK811CUzb78zEHH8xWtPrCZn9zZfvf/zaWxo7fpV8VwAwUeHXHcQMraZum5QeO+5tLRUYrLm85JNelGfmUA3BjfNyFbfb32PhkWWd0CbDaPME48uIriVK32pNEtvtR/+I/f3YgA/jP9kSlDvbzG/OAg/AFBIpNwKUzsu4+va8mI+O5FDufw5D74WwdGJ9DeyEb2CHtWMR1VwtFKL0ZZsqltNf8EkBeJ5RtTNtAMM8ie4dDZaKC96ymQHKrdB4hjkAr0F1XFsU4XdOa9Nbkdcm/7KoNc6bE6oJtG9lqE8h+1CysfcbfJ7am+hvDFzT0IPmp3GDSMAk+e6xySgFQw0C/SZ7LQsxPa1s6hc+BOtTn0oClZnU7Mowxv+z+xURJj4Yp3Cy6tAoia1jEQSs6lSMNKPf9bi3xFKtPl4143hwhpvTAzJUcski9OVGd7Du+VyxwIrvLqp5Ct/oNrESVJpf1EDCs9xT1EW+PiSkRmHXoZ1t5MOLFEiMAZL2+bNe3A2661oJeMtps8zrfCVc251OUE1WvqWePlTOs5TDVqdwDH88J6rHLsbaf33Mxh5DP8gMfZQxE44Nsp6H0/Szfkss5UmFwBEpHjl1GJMWDnB3u2d+l1CSkLoB6C+diAUlY6wL/VwJBeMPHZTf6amQIS2B/lo/CnvV/E3k=|uuoY4b7xwMYBNIZi85KBsaHmNqtJl5FrKxZI9ugeNwc=" as EncryptedString,
        ),
      );
      await keyRotationService.rotateUserKeyMasterPasswordAndEncryptedData(
        "mockMasterPassword",
        "mockMasterPassword1",
        mockUser,
        "masterPasswordHint",
      );
      const arg = mockApiService.postUserKeyUpdate.mock.calls[0][0];
      expect(arg.oldMasterKeyAuthenticationHash).toBe("mockMasterPasswordHash");
      expect(arg.accountData.ciphers.length).toBe(2);
      expect(arg.accountData.folders.length).toBe(2);
      expect(arg.accountData.sends.length).toBe(2);
      expect(arg.accountUnlockData.emergencyAccessUnlockData.length).toBe(1);
      expect(arg.accountUnlockData.organizationAccountRecoveryUnlockData.length).toBe(1);
      expect(arg.accountUnlockData.passkeyUnlockData.length).toBe(2);
    });

    it("passes the EnrollAeadOnKeyRotation feature flag to getRotatedAccountKeysFlagged", async () => {
      KeyRotationTrustInfoComponent.open = initialPromptedOpenTrue;
      AccountRecoveryTrustComponent.open = accountRecoveryTrustOpenTrusted;
      EmergencyAccessTrustComponent.open = emergencyAccessTrustOpenTrusted;
      mockKdfConfigService.getKdfConfig$.mockReturnValue(
        new BehaviorSubject(new PBKDF2KdfConfig(100000)),
      );
      mockKeyService.userKey$.mockReturnValue(
        new BehaviorSubject(new SymmetricCryptoKey(new Uint8Array(64)) as UserKey),
      );
      mockKeyService.userEncryptedPrivateKey$.mockReturnValue(
        new BehaviorSubject(TEST_VECTOR_PRIVATE_KEY_V1 as string as EncryptedString),
      );
      mockKeyService.userSigningKey$.mockReturnValue(new BehaviorSubject(null));
      mockSecurityStateService.accountSecurityState$.mockReturnValue(new BehaviorSubject(null));
      mockConfigService.getFeatureFlag.mockResolvedValue(true);

      const spy = jest.spyOn(keyRotationService, "getRotatedAccountKeysFlagged").mockResolvedValue({
        userKey: TEST_VECTOR_USER_KEY_V2,
        accountKeysRequest: {
          userKeyEncryptedAccountPrivateKey: TEST_VECTOR_PRIVATE_KEY_V2,
          accountPublicKey: TEST_VECTOR_PUBLIC_KEY_V2,
          publicKeyEncryptionKeyPair: {
            wrappedPrivateKey: TEST_VECTOR_PRIVATE_KEY_V2,
            publicKey: TEST_VECTOR_PUBLIC_KEY_V2,
            signedPublicKey: TEST_VECTOR_SIGNED_PUBLIC_KEY_V2,
          },
          signatureKeyPair: {
            wrappedSigningKey: TEST_VECTOR_SIGNING_KEY_V2,
            verifyingKey: TEST_VECTOR_VERIFYING_KEY_V2,
            signatureAlgorithm: "ed25519",
          },
          securityState: {
            securityState: TEST_VECTOR_SECURITY_STATE_V2,
            securityVersion: 2,
          },
        },
      });

      await keyRotationService.rotateUserKeyMasterPasswordAndEncryptedData(
        "mockMasterPassword",
        "mockMasterPassword1",
        mockUser,
        "masterPasswordHint",
      );

      expect(mockConfigService.getFeatureFlag).toHaveBeenCalledWith(
        FeatureFlag.EnrollAeadOnKeyRotation,
      );
      expect(spy).toHaveBeenCalledWith(
        mockUser.id,
        expect.any(PBKDF2KdfConfig),
        mockUser.email,
        expect.objectContaining({ version: 1 }),
        true,
      );
    });

    it("throws if kdf config is null", async () => {
      KeyRotationTrustInfoComponent.open = initialPromptedOpenTrue;
      AccountRecoveryTrustComponent.open = accountRecoveryTrustOpenTrusted;
      EmergencyAccessTrustComponent.open = emergencyAccessTrustOpenTrusted;
      mockKdfConfigService.getKdfConfig$.mockReturnValue(new BehaviorSubject(null));
      await expect(
        keyRotationService.rotateUserKeyMasterPasswordAndEncryptedData(
          "mockMasterPassword",
          "mockMasterPassword1",
          mockUser,
        ),
      ).rejects.toThrow();
    });

    it("returns early when emergency access trust warning dialog is declined", async () => {
      KeyRotationTrustInfoComponent.open = initialPromptedOpenTrue;
      EmergencyAccessTrustComponent.open = emergencyAccessTrustOpenUntrusted;
      AccountRecoveryTrustComponent.open = accountRecoveryTrustOpenTrusted;
      await keyRotationService.rotateUserKeyMasterPasswordAndEncryptedData(
        "mockMasterPassword",
        "newMasterPassword",
        mockUser,
      );
      expect(mockApiService.postUserKeyUpdate).not.toHaveBeenCalled();
    });

    it("returns early when account recovery trust warning dialog is declined", async () => {
      KeyRotationTrustInfoComponent.open = initialPromptedOpenTrue;
      EmergencyAccessTrustComponent.open = emergencyAccessTrustOpenTrusted;
      AccountRecoveryTrustComponent.open = accountRecoveryTrustOpenUntrusted;
      await keyRotationService.rotateUserKeyMasterPasswordAndEncryptedData(
        "mockMasterPassword",
        "newMasterPassword",
        mockUser,
      );
      expect(mockApiService.postUserKeyUpdate).not.toHaveBeenCalled();
    });

    it("throws if master password provided is falsey", async () => {
      await expect(
        keyRotationService.rotateUserKeyMasterPasswordAndEncryptedData("", "", mockUser),
      ).rejects.toThrow();
    });

    it("throws if no private key is found", async () => {
      keyPair.next(null);

      await expect(
        keyRotationService.rotateUserKeyMasterPasswordAndEncryptedData(
          "mockMasterPassword",
          "mockMasterPassword1",
          mockUser,
        ),
      ).rejects.toThrow();
    });

    it("throws if server rotation fails", async () => {
      KeyRotationTrustInfoComponent.open = initialPromptedOpenTrue;
      EmergencyAccessTrustComponent.open = emergencyAccessTrustOpenTrusted;
      AccountRecoveryTrustComponent.open = accountRecoveryTrustOpenTrusted;
      mockApiService.postUserKeyUpdate.mockRejectedValueOnce(new Error("mockError"));

      await expect(
        keyRotationService.rotateUserKeyMasterPasswordAndEncryptedData(
          "mockMasterPassword",
          "mockMasterPassword1",
          mockUser,
        ),
      ).rejects.toThrow();
    });
  });

  describe("getNewAccountKeysV1", () => {
    const currentUserKey = TEST_VECTOR_USER_KEY_V1;
    const mockEncryptedPrivateKey = TEST_VECTOR_PRIVATE_KEY_V1 as WrappedPrivateKey;
    const mockNewEncryptedPrivateKey = TEST_VECTOR_PRIVATE_KEY_V1_ROTATED as WrappedPrivateKey;
    beforeAll(() => {
      mockEncryptService.unwrapDecapsulationKey.mockResolvedValue(new Uint8Array(200));
      mockEncryptService.wrapDecapsulationKey.mockResolvedValue(
        new EncString(mockNewEncryptedPrivateKey),
      );
      mockCryptoFunctionService.rsaExtractPublicKey.mockResolvedValue(
        new Uint8Array(400) as UnsignedPublicKey,
      );
    });

    afterAll(() => {
      jest.restoreAllMocks();
    });

    it("returns new account keys", async () => {
      const result = await keyRotationService.getNewAccountKeysV1({
        version: 1,
        userKey: currentUserKey,
        publicKeyEncryptionKeyPair: {
          wrappedPrivateKey: mockEncryptedPrivateKey,
          publicKey: Utils.fromB64ToArray(TEST_VECTOR_PUBLIC_KEY_V1) as UnsignedPublicKey,
        },
      });
      expect(result).toEqual({
        userKey: expect.any(SymmetricCryptoKey),
        publicKeyEncryptionKeyPair: {
          wrappedPrivateKey: mockNewEncryptedPrivateKey,
          publicKey: new Uint8Array(400) as UserPublicKey,
        },
      });
    });
  });

  describe("getNewAccountKeysV2", () => {
    it("rotates a v2 user", async () => {
      mockGetV2RotatedAccountKeys.mockReturnValue({
        userKey: TEST_VECTOR_USER_KEY_V2.toBase64(),
        privateKey: TEST_VECTOR_PRIVATE_KEY_V2,
        publicKey: TEST_VECTOR_PUBLIC_KEY_V2,
        signedPublicKey: TEST_VECTOR_SIGNED_PUBLIC_KEY_V2,
        signingKey: TEST_VECTOR_SIGNING_KEY_V2,
        verifyingKey: TEST_VECTOR_VERIFYING_KEY_V2,
        securityState: TEST_VECTOR_SECURITY_STATE_V2,
        securityVersion: 2,
      });
      const result = await keyRotationService.getNewAccountKeysV2(
        "00000000-0000-0000-0000-000000000000" as UserId,
        new PBKDF2KdfConfig(600_000),
        "mockuseremail",
        {
          version: 2 as const,
          userKey: TEST_VECTOR_USER_KEY_V2,
          publicKeyEncryptionKeyPair: {
            wrappedPrivateKey: TEST_VECTOR_PRIVATE_KEY_V2,
            publicKey: Utils.fromB64ToArray(TEST_VECTOR_PUBLIC_KEY_V2) as UnsignedPublicKey,
          },
          signingKey: TEST_VECTOR_SIGNING_KEY_V2 as WrappedSigningKey,
          securityState: TEST_VECTOR_SECURITY_STATE_V2 as SignedSecurityState,
        },
      );
      expect(mockGetV2RotatedAccountKeys).toHaveBeenCalled();
      expect(result).toEqual({
        userKey: TEST_VECTOR_USER_KEY_V2,
        publicKeyEncryptionKeyPair: {
          wrappedPrivateKey: TEST_VECTOR_PRIVATE_KEY_V2,
          publicKey: Utils.fromB64ToArray(TEST_VECTOR_PUBLIC_KEY_V2) as UnsignedPublicKey,
          signedPublicKey: TEST_VECTOR_SIGNED_PUBLIC_KEY_V2,
        },
        signatureKeyPair: {
          wrappedSigningKey: TEST_VECTOR_SIGNING_KEY_V2 as WrappedSigningKey,
          verifyingKey: TEST_VECTOR_VERIFYING_KEY_V2 as VerifyingKey,
        },
        securityState: {
          securityState: TEST_VECTOR_SECURITY_STATE_V2 as SignedSecurityState,
          securityStateVersion: 2,
        },
      });
    });
    it("upgrades v1 user to v2 user", async () => {
      mockMakeKeysForUserCryptoV2.mockReturnValue({
        userKey: TEST_VECTOR_USER_KEY_V2.toBase64(),
        privateKey: TEST_VECTOR_PRIVATE_KEY_V2,
        publicKey: Utils.fromB64ToArray(TEST_VECTOR_PUBLIC_KEY_V2) as UnsignedPublicKey,
        signedPublicKey: TEST_VECTOR_SIGNED_PUBLIC_KEY_V2,
        signingKey: TEST_VECTOR_SIGNING_KEY_V2,
        verifyingKey: TEST_VECTOR_VERIFYING_KEY_V2,
        securityState: TEST_VECTOR_SECURITY_STATE_V2,
        securityVersion: 2,
      });
      const result = await keyRotationService.getNewAccountKeysV2(
        "00000000-0000-0000-0000-000000000000" as UserId,
        new PBKDF2KdfConfig(600_000),
        "mockuseremail",
        {
          version: 1,
          userKey: TEST_VECTOR_USER_KEY_V1,
          publicKeyEncryptionKeyPair: {
            wrappedPrivateKey: TEST_VECTOR_PRIVATE_KEY_V1 as WrappedPrivateKey,
            publicKey: Utils.fromB64ToArray(TEST_VECTOR_PUBLIC_KEY_V1) as UnsignedPublicKey,
          },
        },
      );
      expect(mockMakeKeysForUserCryptoV2).toHaveBeenCalled();
      expect(result).toEqual({
        userKey: TEST_VECTOR_USER_KEY_V2,
        publicKeyEncryptionKeyPair: {
          wrappedPrivateKey: TEST_VECTOR_PRIVATE_KEY_V2,
          publicKey: Utils.fromB64ToArray(TEST_VECTOR_PUBLIC_KEY_V2),
          signedPublicKey: TEST_VECTOR_SIGNED_PUBLIC_KEY_V2,
        },
        signatureKeyPair: {
          wrappedSigningKey: TEST_VECTOR_SIGNING_KEY_V2 as WrappedSigningKey,
          verifyingKey: TEST_VECTOR_VERIFYING_KEY_V2 as VerifyingKey,
        },
        securityState: {
          securityState: TEST_VECTOR_SECURITY_STATE_V2 as SignedSecurityState,
          securityStateVersion: 2,
        },
      });
    });
  });

  describe("createMasterPasswordUnlockData", () => {
    it("returns the master password unlock data", async () => {
      mockKeyService.makeMasterKey.mockResolvedValue(
        new SymmetricCryptoKey(new Uint8Array(32)) as MasterKey,
      );
      mockKeyService.hashMasterKey.mockResolvedValue("mockMasterPasswordHash");
      const newKey = TEST_VECTOR_USER_KEY_V1;
      const userAccount = mockUser;
      const masterPasswordUnlockData =
        await keyRotationService.createMasterPasswordUnlockDataRequest(newKey, {
          masterPassword: "mockMasterPassword",
          masterKeySalt: userAccount.email,
          masterKeyKdfConfig: new PBKDF2KdfConfig(600_000),
          masterPasswordHint: "mockMasterPasswordHint",
        });
      expect(masterPasswordUnlockData).toEqual({
        masterKeyEncryptedUserKey: "mockNewUserKey",
        email: "mockEmail",
        kdfType: KdfType.PBKDF2_SHA256,
        kdfIterations: 600_000,
        masterKeyAuthenticationHash: "mockMasterPasswordHash",
        masterPasswordHint: "mockMasterPasswordHint",
      });
      expect(PureCrypto.encrypt_user_key_with_master_password).toHaveBeenCalledWith(
        TEST_VECTOR_USER_KEY_V1.toEncoded(),
        "mockMasterPassword",
        userAccount.email,
        new PBKDF2KdfConfig(600_000).toSdkConfig(),
      );
    });
  });

  describe("getAccountUnlockDataRequest", () => {
    it("returns the account unlock data request", async () => {
      mockWebauthnLoginAdminService.getRotatedData.mockResolvedValue([
        {
          id: "mockId",
          encryptedPublicKey: "mockEncryptedPublicKey" as any,
          encryptedUserKey: "mockEncryptedUserKey" as any,
        },
      ]);
      mockDeviceTrustService.getRotatedData.mockResolvedValue([
        {
          deviceId: "mockId",
          encryptedPublicKey: "mockEncryptedPublicKey",
          encryptedUserKey: "mockEncryptedUserKey",
        },
      ]);
      mockEmergencyAccessService.getRotatedData.mockResolvedValue([
        {
          waitTimeDays: 5,
          keyEncrypted: "mockEncryptedUserKey",
          id: "mockId",
          type: EmergencyAccessType.Takeover,
        },
      ]);
      mockResetPasswordService.getRotatedData.mockResolvedValue([
        {
          organizationId: "mockOrgId",
          resetPasswordKey: "mockEncryptedUserKey",
          masterPasswordHash: "omitted",
          otp: undefined,
          authRequestAccessCode: undefined,
        },
      ]);
      mockKeyService.makeMasterKey.mockResolvedValue(
        new SymmetricCryptoKey(new Uint8Array(32)) as MasterKey,
      );
      mockKeyService.hashMasterKey.mockResolvedValue("mockMasterPasswordHash");

      const initialKey = new SymmetricCryptoKey(new Uint8Array(64)) as UserKey;
      const newKey = new SymmetricCryptoKey(new Uint8Array(64)) as UserKey;
      const userAccount = mockUser;
      const accountUnlockDataRequest = await keyRotationService.getAccountUnlockDataRequest(
        userAccount.id,
        initialKey,
        newKey,
        {
          masterPassword: "mockMasterPassword",
          masterKeySalt: userAccount.email,
          masterKeyKdfConfig: new PBKDF2KdfConfig(600_000),
          masterPasswordHint: "mockMasterPasswordHint",
        },
        [new Uint8Array(1) as UnsignedPublicKey], // emergency access public key
        [new Uint8Array(2) as UnsignedPublicKey], // account recovery public key
      );
      expect(accountUnlockDataRequest.passkeyUnlockData).toEqual([
        {
          encryptedPublicKey: "mockEncryptedPublicKey",
          encryptedUserKey: "mockEncryptedUserKey",
          id: "mockId",
        },
      ]);
      expect(accountUnlockDataRequest.deviceKeyUnlockData).toEqual([
        {
          encryptedPublicKey: "mockEncryptedPublicKey",
          encryptedUserKey: "mockEncryptedUserKey",
          deviceId: "mockId",
        },
      ]);
      expect(accountUnlockDataRequest.masterPasswordUnlockData).toEqual({
        masterKeyEncryptedUserKey: "mockNewUserKey",
        email: "mockEmail",
        kdfType: 0,
        kdfIterations: 600_000,
        masterKeyAuthenticationHash: "mockMasterPasswordHash",
        masterPasswordHint: "mockMasterPasswordHint",
      });
      expect(accountUnlockDataRequest.emergencyAccessUnlockData).toEqual([
        {
          keyEncrypted: "mockEncryptedUserKey",
          id: "mockId",
          type: EmergencyAccessType.Takeover,
          waitTimeDays: 5,
        },
      ]);
      expect(accountUnlockDataRequest.organizationAccountRecoveryUnlockData).toEqual([
        {
          organizationId: "mockOrgId",
          resetPasswordKey: "mockEncryptedUserKey",
          masterPasswordHash: "omitted",
          otp: undefined,
          authRequestAccessCode: undefined,
        },
      ]);
    });
  });

  describe("verifyTrust", () => {
    const mockGranteeEmergencyAccessWithPublicKey = {
      publicKey: new Uint8Array(123),
      id: "mockId",
      granteeId: "mockGranteeId",
      name: "mockName",
      email: "mockEmail",
      type: EmergencyAccessType.Takeover,
      status: EmergencyAccessStatusType.Accepted,
      waitTimeDays: 5,
      creationDate: "mockCreationDate",
      avatarColor: "mockAvatarColor",
    };
    const mockOrganizationUserResetPasswordEntry = {
      publicKey: new Uint8Array(123),
      orgId: "mockOrgId",
      orgName: "mockOrgName",
    };

    it("returns empty arrays if initial dialog is closed", async () => {
      KeyRotationTrustInfoComponent.open = initialPromptedOpenFalse;
      mockEmergencyAccessService.getPublicKeys.mockResolvedValue([
        mockGranteeEmergencyAccessWithPublicKey,
      ]);
      mockResetPasswordService.getPublicKeys.mockResolvedValue([
        mockOrganizationUserResetPasswordEntry,
      ]);
      const {
        wasTrustDenied,
        trustedOrganizationPublicKeys: trustedOrgs,
        trustedEmergencyAccessUserPublicKeys: trustedEmergencyAccessUsers,
      } = await keyRotationService.verifyTrust(mockUser);
      expect(trustedEmergencyAccessUsers).toEqual([]);
      expect(trustedOrgs).toEqual([]);
      expect(wasTrustDenied).toBe(true);
    });

    it("returns empty arrays if emergency access dialog is closed", async () => {
      KeyRotationTrustInfoComponent.open = initialPromptedOpenTrue;
      AccountRecoveryTrustComponent.open = initialPromptedOpenFalse;
      mockEmergencyAccessService.getPublicKeys.mockResolvedValue([
        mockGranteeEmergencyAccessWithPublicKey,
      ]);
      mockResetPasswordService.getPublicKeys.mockResolvedValue([
        mockOrganizationUserResetPasswordEntry,
      ]);
      const {
        wasTrustDenied,
        trustedOrganizationPublicKeys: trustedOrgs,
        trustedEmergencyAccessUserPublicKeys: trustedEmergencyAccessUsers,
      } = await keyRotationService.verifyTrust(mockUser);
      expect(trustedEmergencyAccessUsers).toEqual([]);
      expect(trustedOrgs).toEqual([]);
      expect(wasTrustDenied).toBe(true);
    });

    it("returns empty arrays if account recovery dialog is closed", async () => {
      KeyRotationTrustInfoComponent.open = initialPromptedOpenTrue;
      AccountRecoveryTrustComponent.open = initialPromptedOpenTrue;
      EmergencyAccessTrustComponent.open = initialPromptedOpenFalse;
      mockEmergencyAccessService.getPublicKeys.mockResolvedValue([
        mockGranteeEmergencyAccessWithPublicKey,
      ]);
      mockResetPasswordService.getPublicKeys.mockResolvedValue([
        mockOrganizationUserResetPasswordEntry,
      ]);
      const {
        wasTrustDenied,
        trustedOrganizationPublicKeys: trustedOrgs,
        trustedEmergencyAccessUserPublicKeys: trustedEmergencyAccessUsers,
      } = await keyRotationService.verifyTrust(mockUser);
      expect(trustedEmergencyAccessUsers).toEqual([]);
      expect(trustedOrgs).toEqual([]);
      expect(wasTrustDenied).toBe(true);
    });

    test.each([
      [[mockGranteeEmergencyAccessWithPublicKey], []],
      [[], [mockOrganizationUserResetPasswordEntry]],
      [[], []],
      [[mockGranteeEmergencyAccessWithPublicKey], [mockOrganizationUserResetPasswordEntry]],
    ])(
      "returns trusted keys when dialogs are open and public keys are provided",
      async (emUsers, orgs) => {
        KeyRotationTrustInfoComponent.open = initialPromptedOpenTrue;
        EmergencyAccessTrustComponent.open = emergencyAccessTrustOpenTrusted;
        AccountRecoveryTrustComponent.open = accountRecoveryTrustOpenTrusted;
        mockEmergencyAccessService.getPublicKeys.mockResolvedValue(emUsers);
        mockResetPasswordService.getPublicKeys.mockResolvedValue(orgs);
        const {
          wasTrustDenied,
          trustedOrganizationPublicKeys: trustedOrgs,
          trustedEmergencyAccessUserPublicKeys: trustedEmergencyAccessUsers,
        } = await keyRotationService.verifyTrust(mockUser);
        expect(wasTrustDenied).toBe(false);
        expect(trustedEmergencyAccessUsers).toEqual(emUsers.map((e) => e.publicKey));
        expect(trustedOrgs).toEqual(orgs.map((o) => o.publicKey));
      },
    );
  });

  describe("getAccountDataRequest", () => {
    const mockCiphers = [createMockCipher("1", "Cipher 1"), createMockCipher("2", "Cipher 2")];
    const mockFolders = [createMockFolder("1", "Folder 1"), createMockFolder("2", "Folder 2")];
    const mockSends = [createMockSend("1", "Send 1"), createMockSend("2", "Send 2")];

    it("returns the account data request", async () => {
      const initialKey = new SymmetricCryptoKey(new Uint8Array(64)) as UserKey;
      const newKey = new SymmetricCryptoKey(new Uint8Array(64)) as UserKey;
      const userAccount = mockUser;

      mockCipherService.getRotatedData.mockResolvedValue(mockCiphers);
      mockFolderService.getRotatedData.mockResolvedValue(mockFolders);
      mockSendService.getRotatedData.mockResolvedValue(mockSends);

      const accountDataRequest = await keyRotationService.getAccountDataRequest(
        initialKey,
        newKey,
        userAccount,
      );
      expect(accountDataRequest).toEqual({
        ciphers: mockCiphers,
        folders: mockFolders,
        sends: mockSends,
      });
    });

    it("throws if rotated ciphers are null", async () => {
      const initialKey = new SymmetricCryptoKey(new Uint8Array(64)) as UserKey;
      const newKey = new SymmetricCryptoKey(new Uint8Array(64)) as UserKey;
      const userAccount = mockUser;

      mockCipherService.getRotatedData.mockResolvedValue(null);
      mockFolderService.getRotatedData.mockResolvedValue(mockFolders);
      mockSendService.getRotatedData.mockResolvedValue(mockSends);

      await expect(
        keyRotationService.getAccountDataRequest(initialKey, newKey, userAccount),
      ).rejects.toThrow();
    });

    it("throws if rotated folders are null", async () => {
      const initialKey = new SymmetricCryptoKey(new Uint8Array(64)) as UserKey;
      const newKey = new SymmetricCryptoKey(new Uint8Array(64)) as UserKey;
      const userAccount = mockUser;

      mockCipherService.getRotatedData.mockResolvedValue(mockCiphers);
      mockFolderService.getRotatedData.mockResolvedValue(null);
      mockSendService.getRotatedData.mockResolvedValue(mockSends);

      await expect(
        keyRotationService.getAccountDataRequest(initialKey, newKey, userAccount),
      ).rejects.toThrow();
    });

    it("throws if rotated sends are null", async () => {
      const initialKey = new SymmetricCryptoKey(new Uint8Array(64)) as UserKey;
      const newKey = new SymmetricCryptoKey(new Uint8Array(64)) as UserKey;
      const userAccount = mockUser;

      mockCipherService.getRotatedData.mockResolvedValue(mockCiphers);
      mockFolderService.getRotatedData.mockResolvedValue(mockFolders);
      mockSendService.getRotatedData.mockResolvedValue(null);

      await expect(
        keyRotationService.getAccountDataRequest(initialKey, newKey, userAccount),
      ).rejects.toThrow();
    });
  });

  describe("isV1UserKey", () => {
    const aes256CbcHmacV1UserKey = new SymmetricCryptoKey(new Uint8Array(64));
    const coseV2UserKey = new SymmetricCryptoKey(new Uint8Array(70));
    it("returns true for v1 key", () => {
      expect(keyRotationService.isV1User(aes256CbcHmacV1UserKey as UserKey)).toBe(true);
    });
    it("returns false for v2 key", () => {
      expect(keyRotationService.isV1User(coseV2UserKey as UserKey)).toBe(false);
    });
    it("returns false for 32 byte AES256-CBC key", () => {
      const aes256CbcKey = new SymmetricCryptoKey(new Uint8Array(32)) as UserKey;
      expect(keyRotationService.isV1User(aes256CbcKey)).toBe(false);
    });
  });

  describe("makeServerMasterKeyAuthenticationHash", () => {
    it("returns the master key authentication hash", async () => {
      mockKeyService.makeMasterKey.mockResolvedValue(
        new SymmetricCryptoKey(new Uint8Array(32)) as MasterKey,
      );
      mockKeyService.hashMasterKey.mockResolvedValue("mockMasterPasswordHash");
      const masterKeyAuthenticationHash =
        await keyRotationService.makeServerMasterKeyAuthenticationHash(
          "mockMasterPassword",
          new PBKDF2KdfConfig(600_000),
          "mockEmail",
        );
      expect(masterKeyAuthenticationHash).toBe("mockMasterPasswordHash");
      expect(mockKeyService.makeMasterKey).toHaveBeenCalledWith(
        "mockMasterPassword",
        "mockEmail",
        new PBKDF2KdfConfig(600_000),
      );
      expect(mockKeyService.hashMasterKey).toHaveBeenCalledWith(
        "mockMasterPassword",
        new SymmetricCryptoKey(new Uint8Array(32)) as MasterKey,
        HashPurpose.ServerAuthorization,
      );
    });
  });

  describe("getCryptographicStateForUser", () => {
    beforeEach(() => {
      mockKdfConfigService.getKdfConfig$.mockReturnValue(
        new BehaviorSubject(new PBKDF2KdfConfig(100000)),
      );
      mockKeyService.userKey$.mockReturnValue(new BehaviorSubject(TEST_VECTOR_USER_KEY_V2));
      mockKeyService.userEncryptedPrivateKey$.mockReturnValue(
        new BehaviorSubject(TEST_VECTOR_PRIVATE_KEY_V2 as string as EncryptedString),
      );
      mockKeyService.userSigningKey$.mockReturnValue(
        new BehaviorSubject(TEST_VECTOR_SIGNING_KEY_V2 as WrappedSigningKey),
      );
      mockSecurityStateService.accountSecurityState$.mockReturnValue(
        new BehaviorSubject(TEST_VECTOR_SECURITY_STATE_V2 as SignedSecurityState),
      );
      mockCryptoFunctionService.rsaExtractPublicKey.mockResolvedValue(
        new Uint8Array(400) as UnsignedPublicKey,
      );
    });

    it("returns the cryptographic state for v1 user", async () => {
      mockKeyService.userKey$.mockReturnValue(
        new BehaviorSubject(new SymmetricCryptoKey(new Uint8Array(64)) as UserKey),
      );
      mockKeyService.userEncryptedPrivateKey$.mockReturnValue(
        new BehaviorSubject(TEST_VECTOR_PRIVATE_KEY_V1 as string as EncryptedString),
      );
      mockKeyService.userSigningKey$.mockReturnValue(new BehaviorSubject(null));
      mockSecurityStateService.accountSecurityState$.mockReturnValue(new BehaviorSubject(null));

      const cryptographicState = await keyRotationService.getCryptographicStateForUser(mockUser);
      expect(cryptographicState).toEqual({
        masterKeyKdfConfig: new PBKDF2KdfConfig(100000),
        masterKeySalt: "mockemail", // the email is lowercased to become the salt
        cryptographicStateParameters: {
          version: 1,
          userKey: TEST_VECTOR_USER_KEY_V1,
          publicKeyEncryptionKeyPair: {
            wrappedPrivateKey: TEST_VECTOR_PRIVATE_KEY_V1,
            publicKey: Utils.fromB64ToArray(TEST_VECTOR_PUBLIC_KEY_V1),
          },
        },
      });
    });

    it("returns the cryptographic state for v2 user", async () => {
      const cryptographicState = await keyRotationService.getCryptographicStateForUser(mockUser);
      expect(cryptographicState).toEqual({
        masterKeyKdfConfig: new PBKDF2KdfConfig(100000),
        masterKeySalt: "mockemail", // the email is lowercased to become the salt
        cryptographicStateParameters: {
          version: 2,
          userKey: TEST_VECTOR_USER_KEY_V2,
          publicKeyEncryptionKeyPair: {
            wrappedPrivateKey: TEST_VECTOR_PRIVATE_KEY_V2,
            publicKey: Utils.fromB64ToArray(TEST_VECTOR_PUBLIC_KEY_V2) as UnsignedPublicKey,
          },
          signingKey: TEST_VECTOR_SIGNING_KEY_V2 as WrappedSigningKey,
          securityState: TEST_VECTOR_SECURITY_STATE_V2 as SignedSecurityState,
        },
      });
    });

    it("throws if no kdf config is found", async () => {
      mockKdfConfigService.getKdfConfig$.mockReturnValue(new BehaviorSubject(null));
      await expect(keyRotationService.getCryptographicStateForUser(mockUser)).rejects.toThrow(
        "Failed to get KDF config",
      );
    });

    it("throws if current user key is not found", async () => {
      mockKeyService.userKey$.mockReturnValue(new BehaviorSubject(null));
      await expect(keyRotationService.getCryptographicStateForUser(mockUser)).rejects.toThrow(
        "Failed to get User key",
      );
    });

    it("throws if private key is not found", async () => {
      mockKeyService.userEncryptedPrivateKey$.mockReturnValue(new BehaviorSubject(null));
      await expect(keyRotationService.getCryptographicStateForUser(mockUser)).rejects.toThrow(
        "Failed to get Private key",
      );
    });

    it("throws if user key is not AES256-CBC-HMAC or COSE", async () => {
      const invalidKey = new SymmetricCryptoKey(new Uint8Array(32)) as UserKey;
      mockKeyService.userKey$.mockReturnValue(new BehaviorSubject(invalidKey));
      await expect(keyRotationService.getCryptographicStateForUser(mockUser)).rejects.toThrow(
        "Unsupported user key type",
      );
    });
  });

  describe("getRotatedAccountKeysFlagged", () => {
    const userId = "mockUserId" as UserId;
    const kdfConfig = new PBKDF2KdfConfig(100000);
    const masterKeySalt = "mockSalt";
    const v1Params = {
      version: 1,
      userKey: TEST_VECTOR_USER_KEY_V1,
      publicKeyEncryptionKeyPair: {
        wrappedPrivateKey: TEST_VECTOR_PRIVATE_KEY_V1,
        publicKey: Utils.fromB64ToArray(TEST_VECTOR_PUBLIC_KEY_V1) as UnsignedPublicKey,
      },
    } as V1CryptographicStateParameters;
    const v2Params = {
      version: 2,
      userKey: TEST_VECTOR_USER_KEY_V2,
      publicKeyEncryptionKeyPair: {
        wrappedPrivateKey: TEST_VECTOR_PRIVATE_KEY_V2,
        publicKey: Utils.fromB64ToArray(TEST_VECTOR_PUBLIC_KEY_V2) as UnsignedPublicKey,
      },
      signingKey: TEST_VECTOR_SIGNING_KEY_V2,
      securityState: TEST_VECTOR_SECURITY_STATE_V2,
    } as V2CryptographicStateParameters;

    beforeEach(() => {
      jest.spyOn(keyRotationService, "getNewAccountKeysV1").mockResolvedValue({
        userKey: TEST_VECTOR_USER_KEY_V1,
        publicKeyEncryptionKeyPair: {
          wrappedPrivateKey: TEST_VECTOR_PRIVATE_KEY_V1_ROTATED,
          publicKey: Utils.fromB64ToArray(TEST_VECTOR_PUBLIC_KEY_V1) as UnsignedPublicKey,
        },
      });
      jest.spyOn(keyRotationService, "getNewAccountKeysV2").mockResolvedValue({
        userKey: TEST_VECTOR_USER_KEY_V2,
        publicKeyEncryptionKeyPair: {
          wrappedPrivateKey: TEST_VECTOR_PRIVATE_KEY_V2,
          publicKey: Utils.fromB64ToArray(TEST_VECTOR_PUBLIC_KEY_V2) as UnsignedPublicKey,
          signedPublicKey: TEST_VECTOR_SIGNED_PUBLIC_KEY_V2,
        },
        signatureKeyPair: {
          wrappedSigningKey: TEST_VECTOR_SIGNING_KEY_V2 as WrappedSigningKey,
          verifyingKey: TEST_VECTOR_VERIFYING_KEY_V2 as VerifyingKey,
        },
        securityState: {
          securityState: TEST_VECTOR_SECURITY_STATE_V2 as SignedSecurityState,
          securityStateVersion: 2,
        },
      });
      jest
        .spyOn(AccountKeysRequest, "fromV1CryptographicState")
        .mockReturnValue("v1Request" as any);
      jest
        .spyOn(AccountKeysRequest, "fromV2CryptographicState")
        .mockResolvedValue("v2Request" as any);
    });

    it("returns v2 keys and request if v2UpgradeEnabled is true", async () => {
      const result = await keyRotationService.getRotatedAccountKeysFlagged(
        userId,
        kdfConfig,
        masterKeySalt,
        v1Params,
        true,
      );
      expect(keyRotationService.getNewAccountKeysV2).toHaveBeenCalledWith(
        userId,
        kdfConfig,
        masterKeySalt,
        v1Params,
      );
      expect(result).toEqual({
        userKey: TEST_VECTOR_USER_KEY_V2,
        accountKeysRequest: "v2Request",
      });
    });

    it("returns v2 keys and request if params.version is 2", async () => {
      const result = await keyRotationService.getRotatedAccountKeysFlagged(
        userId,
        kdfConfig,
        masterKeySalt,
        v2Params,
        false,
      );
      expect(keyRotationService.getNewAccountKeysV2).toHaveBeenCalledWith(
        userId,
        kdfConfig,
        masterKeySalt,
        v2Params,
      );
      expect(result).toEqual({
        userKey: TEST_VECTOR_USER_KEY_V2,
        accountKeysRequest: "v2Request",
      });
    });

    it("returns v1 keys and request if v2UpgradeEnabled is false and params.version is 1", async () => {
      const result = await keyRotationService.getRotatedAccountKeysFlagged(
        userId,
        kdfConfig,
        masterKeySalt,
        v1Params,
        false,
      );
      expect(keyRotationService.getNewAccountKeysV1).toHaveBeenCalledWith(v1Params);
      expect(result).toEqual({
        userKey: TEST_VECTOR_USER_KEY_V1,
        accountKeysRequest: "v1Request",
      });
    });
  });

  describe("ensureIsAllowedToRotateUserKey", () => {
    it("resolves if last sync exists", async () => {
      mockSyncService.getLastSync.mockResolvedValue(new Date());
      await expect(keyRotationService.ensureIsAllowedToRotateUserKey()).resolves.toBeUndefined();
    });

    it("throws if last sync is null", async () => {
      mockSyncService.getLastSync.mockResolvedValue(null);
      await expect(keyRotationService.ensureIsAllowedToRotateUserKey()).rejects.toThrow(
        /de-synced|log out and log back in/i,
      );
      expect(mockLogService.info).toHaveBeenCalledWith(
        "[Userkey rotation] Client was never synced. Aborting!",
      );
    });
  });
});
