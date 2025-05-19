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
import { DialogService, ToastService } from "@bitwarden/components";
import { KeyService, DEFAULT_KDF_CONFIG } from "@bitwarden/key-management";
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
  let mockDialogService: MockProxy<DialogService>;
  let mockToastService: MockProxy<ToastService>;
  let mockI18nService: MockProxy<I18nService>;

  const mockUser = {
    id: "mockUserId" as UserId,
    email: "mockEmail",
    emailVerified: true,
    name: "mockName",
  };

  const mockTrustedPublicKeys = [Utils.fromUtf8ToArray("test-public-key")];

  beforeAll(() => {
    jest.spyOn(PureCrypto, "make_user_key_aes256_cbc_hmac").mockReturnValue(new Uint8Array(64));
    jest.spyOn(PureCrypto, "make_user_key_xchacha20_poly1305").mockReturnValue(new Uint8Array(70));
    jest
      .spyOn(PureCrypto, "encrypt_user_key_with_master_password")
      .mockReturnValue("mockNewUserKey");
    mockUserVerificationService = mock<UserVerificationService>();
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
      mockDialogService,
      mockConfigService,
    );
  });

  beforeEach(() => {
    jest.mock("@bitwarden/key-management-ui");
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
      mockConfigService.getFeatureFlag.mockResolvedValue(false);

      mockEncryptService.wrapSymmetricKey.mockResolvedValue({
        encryptedString: "mockEncryptedData",
      } as any);
      mockEncryptService.wrapDecapsulationKey.mockResolvedValue({
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

    it("rotates the userkey and encrypted data and changes master password", async () => {
      KeyRotationTrustInfoComponent.open = initialPromptedOpenTrue;
      EmergencyAccessTrustComponent.open = emergencyAccessTrustOpenTrusted;
      AccountRecoveryTrustComponent.open = accountRecoveryTrustOpenTrusted;
      await keyRotationService.rotateUserKeyMasterPasswordAndEncryptedData(
        "mockMasterPassword",
        "newMasterPassword",
        mockUser,
      );

      expect(mockApiService.postUserKeyUpdateV2).toHaveBeenCalled();
      const arg = mockApiService.postUserKeyUpdateV2.mock.calls[0][0];
      expect(arg.accountUnlockData.masterPasswordUnlockData.masterKeyEncryptedUserKey).toBe(
        "mockNewUserKey",
      );
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
      expect(arg.accountUnlockData.emergencyAccessUnlockData.length).toBe(1);
      expect(arg.accountUnlockData.organizationAccountRecoveryUnlockData.length).toBe(1);
      expect(arg.accountUnlockData.passkeyUnlockData.length).toBe(2);
      expect(PureCrypto.make_user_key_aes256_cbc_hmac).toHaveBeenCalled();
      expect(PureCrypto.encrypt_user_key_with_master_password).toHaveBeenCalledWith(
        new Uint8Array(64),
        "newMasterPassword",
        mockUser.email,
        DEFAULT_KDF_CONFIG.toSdkConfig(),
      );
      expect(PureCrypto.make_user_key_xchacha20_poly1305).not.toHaveBeenCalled();
    });

    it("rotates the userkey to xchacha20poly1305 and encrypted data and changes master password when featureflag is active", async () => {
      mockConfigService.getFeatureFlag.mockResolvedValue(true);

      KeyRotationTrustInfoComponent.open = initialPromptedOpenTrue;
      EmergencyAccessTrustComponent.open = emergencyAccessTrustOpenTrusted;
      AccountRecoveryTrustComponent.open = accountRecoveryTrustOpenTrusted;
      await keyRotationService.rotateUserKeyMasterPasswordAndEncryptedData(
        "mockMasterPassword",
        "newMasterPassword",
        mockUser,
      );

      expect(mockApiService.postUserKeyUpdateV2).toHaveBeenCalled();
      const arg = mockApiService.postUserKeyUpdateV2.mock.calls[0][0];
      expect(arg.accountUnlockData.masterPasswordUnlockData.masterKeyEncryptedUserKey).toBe(
        "mockNewUserKey",
      );
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
      expect(arg.accountUnlockData.emergencyAccessUnlockData.length).toBe(1);
      expect(arg.accountUnlockData.organizationAccountRecoveryUnlockData.length).toBe(1);
      expect(arg.accountUnlockData.passkeyUnlockData.length).toBe(2);
      expect(PureCrypto.make_user_key_aes256_cbc_hmac).not.toHaveBeenCalled();
      expect(PureCrypto.encrypt_user_key_with_master_password).toHaveBeenCalledWith(
        new Uint8Array(70),
        "newMasterPassword",
        mockUser.email,
        DEFAULT_KDF_CONFIG.toSdkConfig(),
      );
      expect(PureCrypto.make_user_key_xchacha20_poly1305).toHaveBeenCalled();
    });

    it("returns early when first trust warning dialog is declined", async () => {
      KeyRotationTrustInfoComponent.open = initialPromptedOpenFalse;
      EmergencyAccessTrustComponent.open = emergencyAccessTrustOpenTrusted;
      AccountRecoveryTrustComponent.open = accountRecoveryTrustOpenTrusted;
      await keyRotationService.rotateUserKeyMasterPasswordAndEncryptedData(
        "mockMasterPassword",
        "newMasterPassword",
        mockUser,
      );
      expect(mockApiService.postUserKeyUpdateV2).not.toHaveBeenCalled();
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
      expect(mockApiService.postUserKeyUpdateV2).not.toHaveBeenCalled();
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
      expect(mockApiService.postUserKeyUpdateV2).not.toHaveBeenCalled();
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
      KeyRotationTrustInfoComponent.open = initialPromptedOpenTrue;
      EmergencyAccessTrustComponent.open = emergencyAccessTrustOpenTrusted;
      AccountRecoveryTrustComponent.open = accountRecoveryTrustOpenTrusted;
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
