import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { OrganizationUserResetPasswordWithIdRequest } from "@bitwarden/admin-console/common";
import { Account } from "@bitwarden/common/auth/abstractions/account.service";
import { WebauthnRotateCredentialRequest } from "@bitwarden/common/auth/models/request/webauthn-rotate-credential.request";
import { CryptoFunctionService } from "@bitwarden/common/key-management/crypto/abstractions/crypto-function.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import {
  EncryptedString,
  EncString,
} from "@bitwarden/common/key-management/crypto/models/enc-string";
import { DeviceTrustServiceAbstraction } from "@bitwarden/common/key-management/device-trust/abstractions/device-trust.service.abstraction";
import { VaultTimeoutService } from "@bitwarden/common/key-management/vault-timeout";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
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
} from "@bitwarden/key-management";
import {
  AccountRecoveryTrustComponent,
  EmergencyAccessTrustComponent,
  KeyRotationTrustInfoComponent,
} from "@bitwarden/key-management-ui";
import { PureCrypto } from "@bitwarden/sdk-internal";

import { OrganizationUserResetPasswordService } from "../../admin-console/organizations/members/services/organization-user-reset-password/organization-user-reset-password.service";
import { WebauthnLoginAdminService } from "../../auth";
import { EmergencyAccessService } from "../../auth/emergency-access";
import { EmergencyAccessStatusType } from "../../auth/emergency-access/enums/emergency-access-status-type";
import { EmergencyAccessType } from "../../auth/emergency-access/enums/emergency-access-type";
import { EmergencyAccessWithIdRequest } from "../../auth/emergency-access/request/emergency-access-update.request";

import { MasterPasswordUnlockDataRequest } from "./request/master-password-unlock-data.request";
import { UnlockDataRequest } from "./request/unlock-data.request";
import { UserDataRequest } from "./request/userdata.request";
import { UserKeyRotationApiService } from "./user-key-rotation-api.service";
import { UserKeyRotationService } from "./user-key-rotation.service";

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
    currentUserKey: UserKey,
    currentUserKeyWrappedPrivateKey: EncString,
  ): Promise<{
    userKey: UserKey;
    asymmetricEncryptionKeys: { wrappedPrivateKey: EncString; publicKey: string };
  }> {
    return super.getNewAccountKeysV1(currentUserKey, currentUserKeyWrappedPrivateKey);
  }
  override getNewAccountKeysV2(
    currentUserKey: UserKey,
    currentUserKeyWrappedPrivateKey: EncString,
  ): Promise<{
    userKey: UserKey;
    asymmetricEncryptionKeys: { wrappedPrivateKey: EncString; publicKey: string };
  }> {
    return super.getNewAccountKeysV2(currentUserKey, currentUserKeyWrappedPrivateKey);
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
    trustedEmergencyAccessGranteesPublicKeys: Uint8Array[],
    trustedOrganizationPublicKeys: Uint8Array[],
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
    trustedOrganizationPublicKeys: Uint8Array[];
    trustedEmergencyAccessUserPublicKeys: Uint8Array[];
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
  override makeNewUserKeyV1(oldUserKey: UserKey): Promise<UserKey> {
    return super.makeNewUserKeyV1(oldUserKey);
  }
  override makeNewUserKeyV2(
    oldUserKey: UserKey,
  ): Promise<{ isUpgrading: boolean; newUserKey: UserKey }> {
    return super.makeNewUserKeyV2(oldUserKey);
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

  const mockUser = {
    id: "mockUserId" as UserId,
    email: "mockEmail",
    emailVerified: true,
    name: "mockName",
  };

  const mockTrustedPublicKeys = [Utils.fromUtf8ToArray("test-public-key")];

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
    );
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mock("@bitwarden/key-management-ui");
    jest.spyOn(PureCrypto, "make_user_key_aes256_cbc_hmac").mockReturnValue(new Uint8Array(64));
    jest.spyOn(PureCrypto, "make_user_key_xchacha20_poly1305").mockReturnValue(new Uint8Array(70));
    jest
      .spyOn(PureCrypto, "encrypt_user_key_with_master_password")
      .mockReturnValue("mockNewUserKey");
  });

  describe("rotateUserKeyAndEncryptedData", () => {
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
    const currentUserKey = new SymmetricCryptoKey(new Uint8Array(64)) as UserKey;
    const mockEncryptedPrivateKey = new EncString(
      "2.eh465OrUcluL9UpnCOUTAg==|2HXNXwrLwAjUfZ/U75c92rZEltt1eHxjMkp/ADAmx346oT1+GaQvaL1QIV/9Om0T72m8AnlO92iUfWdhbA/ifHZ+lhFoUVeyw1M88CMzktbVcq42rFoK7SGHSAGdTL3ccUWKI8yCCQJhpt2X6a/5+T7ey5k2CqvylKyOtkiCnVeLmYqETn5BM9Rl3tEgJW1yDLuSJ+L+Qh9xnk/Z3zJUV5HAs+YwjKwuSNrd00SXjDyx8rBEstD9MKI+lrk7to/q90vqKqCucAj/dzUpVtHe88al2AAlBVwQ13HUPdNFOyti6niUgCAWx+DzRqlhkFvl/z/rtxtQsyqq/3Eh/EL54ylxKzAya0ev9EaIOm/dD1aBmI58p4Bs0eMOCIKJjtw+Cmdql+RhCtKtumgFShqyXv+LfD/FgUsdTVNExk3YNhgwPR4jOaMa/j9LCrBMCLKxdAhQyBe7T3qoX1fBBirvY6t77ifMu1YEQ6DfmFphVSwDH5C9xGeTSh5IELSf0tGVtlWUe9RffDDzccD0L1lR8U+dqzoSTYCuXvhEhQptdIW6fpH/47u0M5MiI97/d35A7Et2I1gjHp7WF3qsY20ellBueu7ZL5P1BmqPXl58yaBBXJaCutYHDfIucspqdZmfBGEbdRT4wmuZRON0J8zLmUejM0VR/2MOmpfyYQXnJhTfrvnZ1bOg1aMhUxJ2vhDNPXUFm5b+vwsho4GEvcLAKq9WwbvOJ/sK7sEVfTfEO2IG+0X6wkWm7RpR6Wq9FGKSrv2PSjMAYnb+z3ETeWiaaiD+tVFxa2AaqsbOuX092/86GySpHES7cFWhQ/YMOgj6egUi8mEC0CqMXYsx0TTJDsn16oP+XB3a2WoRqzE0YBozp2aMXxhVf/jMZ03BmEmRQu5B+Sq1gMEZwtIfJ+srkZLMYlLjvVw92FRoFy+N6ytPiyf6RMHMUnJ3vEZSBogaElYoQAtFJ5kK811CUzb78zEHH8xWtPrCZn9zZfvf/zaWxo7fpV8VwAwUeHXHcQMraZum5QeO+5tLRUYrLm85JNelGfmUA3BjfNyFbfb32PhkWWd0CbDaPME48uIriVK32pNEtvtR/+I/f3YgA/jP9kSlDvbzG/OAg/AFBIpNwKUzsu4+va8mI+O5FDufw5D74WwdGJ9DeyEb2CHtWMR1VwtFKL0ZZsqltNf8EkBeJ5RtTNtAMM8ie4dDZaKC96ymQHKrdB4hjkAr0F1XFsU4XdOa9Nbkdcm/7KoNc6bE6oJtG9lqE8h+1CysfcbfJ7am+hvDFzT0IPmp3GDSMAk+e6xySgFQw0C/SZ7LQsxPa1s6hc+BOtTn0oClZnU7Mowxv+z+xURJj4Yp3Cy6tAoia1jEQSs6lSMNKPf9bi3xFKtPl4143hwhpvTAzJUcski9OVGd7Du+VyxwIrvLqp5Ct/oNrESVJpf1EDCs9xT1EW+PiSkRmHXoZ1t5MOLFEiMAZL2+bNe3A2661oJeMtps8zrfCVc251OUE1WvqWePlTOs5TDVqdwDH88J6rHLsbaf33Mxh5DP8gMfZQxE44Nsp6H0/Szfkss5UmFwBEpHjl1GJMWDnB3u2d+l1CSkLoB6C+diAUlY6wL/VwJBeMPHZTf6amQIS2B/lo/CnvV/E3k=|uuoY4b7xwMYBNIZi85KBsaHmNqtJl5FrKxZI9ugeNwc=",
    );
    const mockNewEncryptedPrivateKey = new EncString(
      "2.ab465OrUcluL9UpnCOUTAg==|4HXNXwrLwAjUfZ/U75c92rZEltt1eHxjMkp/ADAmx346oT1+GaQvaL1QIV/9Om0T72m8AnlO92iUfWdhbA/ifHZ+lhFoUVeyw1M88CMzktbVcq42rFoK7SGHSAGdTL3ccUWKI8yCCQJhpt2X6a/5+T7ey5k2CqvylKyOtkiCnVeLmYqETn5BM9Rl3tEgJW1yDLuSJ+L+Qh9xnk/Z3zJUV5HAs+YwjKwuSNrd00SXjDyx8rBEstD9MKI+lrk7to/q90vqKqCucAj/dzUpVtHe88al2AAlBVwQ13HUPdNFOyti6niUgCAWx+DzRqlhkFvl/z/rtxtQsyqq/3Eh/EL54ylxKzAya0ev9EaIOm/dD1aBmI58p4Bs0eMOCIKJjtw+Cmdql+RhCtKtumgFShqyXv+LfD/FgUsdTVNExk3YNhgwPR4jOaMa/j9LCrBMCLKxdAhQyBe7T3qoX1fBBirvY6t77ifMu1YEQ6DfmFphVSwDH5C9xGeTSh5IELSf0tGVtlWUe9RffDDzccD0L1lR8U+dqzoSTYCuXvhEhQptdIW6fpH/47u0M5MiI97/d35A7Et2I1gjHp7WF3qsY20ellBueu7ZL5P1BmqPXl58yaBBXJaCutYHDfIucspqdZmfBGEbdRT4wmuZRON0J8zLmUejM0VR/2MOmpfyYQXnJhTfrvnZ1bOg1aMhUxJ2vhDNPXUFm5b+vwsho4GEvcLAKq9WwbvOJ/sK7sEVfTfEO2IG+0X6wkWm7RpR6Wq9FGKSrv2PSjMAYnb+z3ETeWiaaiD+tVFxa2AaqsbOuX092/86GySpHES7cFWhQ/YMOgj6egUi8mEC0CqMXYsx0TTJDsn16oP+XB3a2WoRqzE0YBozp2aMXxhVf/jMZ03BmEmRQu5B+Sq1gMEZwtIfJ+srkZLMYlLjvVw92FRoFy+N6ytPiyf6RMHMUnJ3vEZSBogaElYoQAtFJ5kK811CUzb78zEHH8xWtPrCZn9zZfvf/zaWxo7fpV8VwAwUeHXHcQMraZum5QeO+5tLRUYrLm85JNelGfmUA3BjfNyFbfb32PhkWWd0CbDaPME48uIriVK32pNEtvtR/+I/f3YgA/jP9kSlDvbzG/OAg/AFBIpNwKUzsu4+va8mI+O5FDufw5D74WwdGJ9DeyEb2CHtWMR1VwtFKL0ZZsqltNf8EkBeJ5RtTNtAMM8ie4dDZaKC96ymQHKrdB4hjkAr0F1XFsU4XdOa9Nbkdcm/7KoNc6bE6oJtG9lqE8h+1CysfcbfJ7am+hvDFzT0IPmp3GDSMAk+e6xySgFQw0C/SZ7LQsxPa1s6hc+BOtTn0oClZnU7Mowxv+z+xURJj4Yp3Cy6tAoia1jEQSs6lSMNKPf9bi3xFKtPl4143hwhpvTAzJUcski9OVGd7Du+VyxwIrvLqp5Ct/oNrESVJpf1EDCs9xT1EW+PiSkRmHXoZ1t5MOLFEiMAZL2+bNe3A2661oJeMtps8zrfCVc251OUE1WvqWePlTOs5TDVqdwDH88J6rHLsbaf33Mxh5DP8gMfZQxE44Nsp6H0/Szfkss5UmFwBEpHjl1GJMWDnB3u2d+l1CSkLoB6C+diAUlY6wL/VwJBeMPHZTf6amQIS2B/lo/CnvV/E3k=|uuoY4b7xwMYBNIZi85KBsaHmNqtJl5FrKxZI9ugeNwc=",
    );
    beforeAll(() => {
      mockEncryptService.unwrapDecapsulationKey.mockResolvedValue(new Uint8Array(200));
      mockEncryptService.wrapDecapsulationKey.mockResolvedValue(mockNewEncryptedPrivateKey);
      mockCryptoFunctionService.rsaExtractPublicKey.mockResolvedValue(new Uint8Array(400));
    });

    afterAll(() => {
      jest.restoreAllMocks();
    });

    it("returns new account keys", async () => {
      const result = await keyRotationService.getNewAccountKeysV1(
        currentUserKey,
        mockEncryptedPrivateKey,
      );
      expect(result).toEqual({
        userKey: expect.any(SymmetricCryptoKey),
        asymmetricEncryptionKeys: {
          wrappedPrivateKey: mockNewEncryptedPrivateKey,
          publicKey: Utils.fromBufferToB64(new Uint8Array(400)),
        },
      });
    });
  });

  describe("getNewAccountKeysV2", () => {
    it("throws not supported", async () => {
      await expect(
        keyRotationService.getNewAccountKeysV2(
          new SymmetricCryptoKey(new Uint8Array(64)) as UserKey,
          null,
        ),
      ).rejects.toThrow("User encryption v2 upgrade is not supported yet");
    });
  });

  describe("createMasterPasswordUnlockData", () => {
    it("returns the master password unlock data", async () => {
      mockKeyService.makeMasterKey.mockResolvedValue(
        new SymmetricCryptoKey(new Uint8Array(32)) as MasterKey,
      );
      mockKeyService.hashMasterKey.mockResolvedValue("mockMasterPasswordHash");
      const newKey = new SymmetricCryptoKey(new Uint8Array(64)) as UserKey;
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
        kdfType: 0,
        kdfIterations: 600_000,
        masterKeyAuthenticationHash: "mockMasterPasswordHash",
        masterPasswordHint: "mockMasterPasswordHint",
      });
      expect(PureCrypto.encrypt_user_key_with_master_password).toHaveBeenCalledWith(
        new SymmetricCryptoKey(new Uint8Array(64)).toEncoded(),
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
        [new Uint8Array(1)], // emergency access public key
        [new Uint8Array(2)], // account recovery public key
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

    it("returns trusted keys if all dialogs are accepted", async () => {
      KeyRotationTrustInfoComponent.open = initialPromptedOpenTrue;
      EmergencyAccessTrustComponent.open = emergencyAccessTrustOpenTrusted;
      AccountRecoveryTrustComponent.open = accountRecoveryTrustOpenTrusted;
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
      expect(wasTrustDenied).toBe(false);
      expect(trustedEmergencyAccessUsers).toEqual([
        mockGranteeEmergencyAccessWithPublicKey.publicKey,
      ]);
      expect(trustedOrgs).toEqual([mockOrganizationUserResetPasswordEntry.publicKey]);
    });
  });

  describe("makeNewUserKeyV1", () => {
    it("throws if old keys is xchacha20poly1305 key", async () => {
      await expect(
        keyRotationService.makeNewUserKeyV1(new SymmetricCryptoKey(new Uint8Array(70)) as UserKey),
      ).rejects.toThrow(
        "User account crypto format is v2, but the feature flag is disabled. User key rotation cannot proceed.",
      );
    });
    it("returns new user key", async () => {
      const oldKey = new SymmetricCryptoKey(new Uint8Array(64)) as UserKey;
      const newKey = await keyRotationService.makeNewUserKeyV1(oldKey);
      expect(newKey).toEqual(new SymmetricCryptoKey(new Uint8Array(64)));
    });
  });

  describe("makeNewUserKeyV2", () => {
    it("returns xchacha20poly1305 key", async () => {
      const oldKey = new SymmetricCryptoKey(new Uint8Array(70)) as UserKey;
      const { newUserKey } = await keyRotationService.makeNewUserKeyV2(oldKey);
      expect(newUserKey).toEqual(new SymmetricCryptoKey(new Uint8Array(70)));
    });
    it("returns isUpgrading true if old key is v1", async () => {
      const oldKey = new SymmetricCryptoKey(new Uint8Array(64)) as UserKey;
      const newKey = await keyRotationService.makeNewUserKeyV2(oldKey);
      expect(newKey).toEqual({
        newUserKey: new SymmetricCryptoKey(new Uint8Array(70)),
        isUpgrading: true,
      });
    });
    it("returns isUpgrading false if old key is v2", async () => {
      const oldKey = new SymmetricCryptoKey(new Uint8Array(70)) as UserKey;
      const newKey = await keyRotationService.makeNewUserKeyV2(oldKey);
      expect(newKey).toEqual({
        newUserKey: new SymmetricCryptoKey(new Uint8Array(70)),
        isUpgrading: false,
      });
    });
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
    const v1Key = new SymmetricCryptoKey(new Uint8Array(64));
    const v2Key = new SymmetricCryptoKey(new Uint8Array(70));
    it("returns true for v1 key", () => {
      expect(keyRotationService.isV1User(v1Key as UserKey)).toBe(true);
    });
    it("returns false for v2 key", () => {
      expect(keyRotationService.isV1User(v2Key as UserKey)).toBe(false);
    });
  });
});
