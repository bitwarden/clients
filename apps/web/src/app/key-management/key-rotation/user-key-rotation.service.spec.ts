import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { OrganizationUserResetPasswordWithIdRequest } from "@bitwarden/admin-console/common";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { WebauthnRotateCredentialRequest } from "@bitwarden/common/auth/models/request/webauthn-rotate-credential.request";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { DeviceTrustServiceAbstraction } from "@bitwarden/common/key-management/device-trust/abstractions/device-trust.service.abstraction";
import { VaultTimeoutService } from "@bitwarden/common/key-management/vault-timeout";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { SendWithIdRequest } from "@bitwarden/common/tools/send/models/request/send-with-id.request";
import { SendService } from "@bitwarden/common/tools/send/services/send.service.abstraction";
import { UserId } from "@bitwarden/common/types/guid";
import { UserKey, UserPrivateKey, UserPublicKey } from "@bitwarden/common/types/key";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherWithIdRequest } from "@bitwarden/common/vault/models/request/cipher-with-id.request";
import { FolderWithIdRequest } from "@bitwarden/common/vault/models/request/folder-with-id.request";
import { ToastService } from "@bitwarden/components";
import { DEFAULT_KDF_CONFIG, KeyService } from "@bitwarden/key-management";

import { OrganizationUserResetPasswordService } from "../../admin-console/organizations/members/services/organization-user-reset-password/organization-user-reset-password.service";
import { WebauthnLoginAdminService } from "../../auth/core";
import { EmergencyAccessService } from "../../auth/emergency-access";
import { EmergencyAccessWithIdRequest } from "../../auth/emergency-access/request/emergency-access-update.request";

import { UserKeyRotationApiService } from "./user-key-rotation-api.service";
import { UserKeyRotationService } from "./user-key-rotation.service";

describe("KeyRotationService", () => {
  let keyRotationService: UserKeyRotationService;

  let mockUserVerificationService: MockProxy<UserVerificationService>;
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
  let mockToastService: MockProxy<ToastService>;
  let mockI18nService: MockProxy<I18nService>;

  const mockUser = {
    id: "mockUserId" as UserId,
    email: "mockEmail",
    emailVerified: true,
    name: "mockName",
  };

  beforeAll(() => {
    mockUserVerificationService = mock<UserVerificationService>();
    mockApiService = mock<UserKeyRotationApiService>();
    mockCipherService = mock<CipherService>();
    mockFolderService = mock<FolderService>();
    mockSendService = mock<SendService>();
    mockEmergencyAccessService = mock<EmergencyAccessService>();
    mockResetPasswordService = mock<OrganizationUserResetPasswordService>();
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

    keyRotationService = new UserKeyRotationService(
      mockUserVerificationService,
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
    );
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("rotateUserKeyAndEncryptedData", () => {
    let privateKey: BehaviorSubject<UserPrivateKey | null>;
    let keyPair: BehaviorSubject<{ privateKey: UserPrivateKey; publicKey: UserPublicKey }>;

    beforeEach(() => {
      mockKeyService.makeUserKey.mockResolvedValue([
        new SymmetricCryptoKey(new Uint8Array(64)) as UserKey,
        {
          encryptedString: "mockNewUserKey",
        } as any,
      ]);
      mockKeyService.hashMasterKey.mockResolvedValue("mockMasterPasswordHash");
      mockConfigService.getFeatureFlag.mockResolvedValue(true);

      mockEncryptService.encrypt.mockResolvedValue({
        encryptedString: "mockEncryptedData",
      } as any);

      // Mock user verification
      mockUserVerificationService.verifyUserByMasterPassword.mockResolvedValue({
        masterKey: "mockMasterKey" as any,
        kdfConfig: DEFAULT_KDF_CONFIG,
        email: "mockEmail",
        policyOptions: null,
      });

      // Mock user key
      mockKeyService.userKey$.mockReturnValue(new BehaviorSubject("mockOriginalUserKey" as any));

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
    });

    it("rotates the user key and encrypted data legacy", async () => {
      await keyRotationService.rotateUserKeyAndEncryptedDataLegacy("mockMasterPassword", mockUser);

      expect(mockApiService.postUserKeyUpdate).toHaveBeenCalled();
      const arg = mockApiService.postUserKeyUpdate.mock.calls[0][0];
      expect(arg.key).toBe("mockNewUserKey");
      expect(arg.privateKey).toBe("mockEncryptedData");
      expect(arg.ciphers.length).toBe(2);
      expect(arg.folders.length).toBe(2);
      expect(arg.sends.length).toBe(2);
      expect(arg.emergencyAccessKeys.length).toBe(1);
      expect(arg.resetPasswordKeys.length).toBe(1);
      expect(arg.webauthnKeys.length).toBe(2);
    });

    it("rotates the user key and encrypted data", async () => {
      await keyRotationService.rotateUserKeyMasterPasswordAndEncryptedData(
        "mockMasterPassword",
        "mockNewMasterPassword",
        mockUser,
      );

      expect(mockApiService.postUserKeyUpdateV2).toHaveBeenCalled();
      const arg = mockApiService.postUserKeyUpdateV2.mock.calls[0][0];
      expect(arg.oldMasterKeyAuthenticationHash).toBe("mockMasterPasswordHash");
      expect(arg.accountUnlockData.masterPasswordUnlockData.email).toBe("mockEmail");
      expect(arg.accountUnlockData.masterPasswordUnlockData.kdfType).toBe(
        DEFAULT_KDF_CONFIG.kdfType,
      );
      expect(arg.accountUnlockData.masterPasswordUnlockData.kdfIterations).toBe(
        DEFAULT_KDF_CONFIG.iterations,
      );
      expect(arg.accountKeys.accountPublicKey).toBe(Utils.fromUtf8ToB64("mockPublicKey"));
      expect(arg.accountKeys.userKeyEncryptedAccountPrivateKey).toBe("mockEncryptedData");
      expect(arg.accountData.ciphers.length).toBe(2);
      expect(arg.accountData.folders.length).toBe(2);
      expect(arg.accountData.sends.length).toBe(2);
    });

    it("legacy throws if master password provided is falsey", async () => {
      await expect(
        keyRotationService.rotateUserKeyAndEncryptedDataLegacy("", mockUser),
      ).rejects.toThrow();
    });

    it("throws if master password provided is falsey", async () => {
      await expect(
        keyRotationService.rotateUserKeyMasterPasswordAndEncryptedData("", "", mockUser),
      ).rejects.toThrow();
    });

    it("legacy throws if user key creation fails", async () => {
      mockKeyService.makeUserKey.mockResolvedValueOnce([null, null]);

      await expect(
        keyRotationService.rotateUserKeyAndEncryptedDataLegacy("mockMasterPassword", mockUser),
      ).rejects.toThrow();
    });

    it("throws if user key creation fails", async () => {
      mockKeyService.makeUserKey.mockResolvedValueOnce([
        null as unknown as UserKey,
        null as unknown as EncString,
      ]);

      await expect(
        keyRotationService.rotateUserKeyMasterPasswordAndEncryptedData(
          "mockMasterPassword",
          "mockMasterPassword1",
          mockUser,
        ),
      ).rejects.toThrow();
    });

    it("legacy throws if no private key is found", async () => {
      privateKey.next(null);

      await expect(
        keyRotationService.rotateUserKeyAndEncryptedDataLegacy("mockMasterPassword", mockUser),
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

    it("legacy throws if master password is incorrect", async () => {
      mockUserVerificationService.verifyUserByMasterPassword.mockRejectedValueOnce(
        new Error("Invalid master password"),
      );

      await expect(
        keyRotationService.rotateUserKeyAndEncryptedDataLegacy("mockMasterPassword", mockUser),
      ).rejects.toThrow();
    });

    it("throws if master password is incorrect", async () => {
      mockUserVerificationService.verifyUserByMasterPassword.mockRejectedValueOnce(
        new Error("Invalid master password"),
      );

      await expect(
        keyRotationService.rotateUserKeyMasterPasswordAndEncryptedData(
          "mockMasterPassword",
          "mockMasterPassword1",
          mockUser,
        ),
      ).rejects.toThrow();
    });

    it("legacy throws if server rotation fails", async () => {
      mockApiService.postUserKeyUpdate.mockRejectedValueOnce(new Error("mockError"));

      await expect(
        keyRotationService.rotateUserKeyAndEncryptedDataLegacy("mockMasterPassword", mockUser),
      ).rejects.toThrow();
    });

    it("throws if server rotation fails", async () => {
      mockApiService.postUserKeyUpdateV2.mockRejectedValueOnce(new Error("mockError"));

      await expect(
        keyRotationService.rotateUserKeyMasterPasswordAndEncryptedData(
          "mockMasterPassword",
          "mockMasterPassword1",
          mockUser,
        ),
      ).rejects.toThrow();
    });
  });
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
