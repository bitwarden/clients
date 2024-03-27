import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { DeviceTrustCryptoServiceAbstraction } from "@bitwarden/common/auth/abstractions/device-trust-crypto.service.abstraction";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { EncryptService } from "@bitwarden/common/platform/abstractions/encrypt.service";
import { EncryptionType } from "@bitwarden/common/platform/enums";
import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { Send } from "@bitwarden/common/tools/send/models/domain/send";
import { SendService } from "@bitwarden/common/tools/send/services/send.service.abstraction";
import { UserKey } from "@bitwarden/common/types/key";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { CipherType } from "@bitwarden/common/vault/enums/cipher-type";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { Folder } from "@bitwarden/common/vault/models/domain/folder";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";

import { OrganizationUserResetPasswordService } from "../../admin-console/organizations/members/services/organization-user-reset-password/organization-user-reset-password.service";
import { StateService } from "../../core";
import { EmergencyAccessService } from "../emergency-access";

import { UserKeyRotationApiService } from "./user-key-rotation-api.service";
import { UserKeyRotationService } from "./user-key-rotation.service";

describe("KeyRotationService", () => {
  let keyRotationService: UserKeyRotationService;

  let mockApiService: MockProxy<UserKeyRotationApiService>;
  let mockCipherService: MockProxy<CipherService>;
  let mockFolderService: MockProxy<FolderService>;
  let mockSendService: MockProxy<SendService>;
  let mockEmergencyAccessService: MockProxy<EmergencyAccessService>;
  let mockResetPasswordService: MockProxy<OrganizationUserResetPasswordService>;
  let mockDeviceTrustCryptoService: MockProxy<DeviceTrustCryptoServiceAbstraction>;
  let mockCryptoService: MockProxy<CryptoService>;
  let mockEncryptService: MockProxy<EncryptService>;
  let mockStateService: MockProxy<StateService>;
  let mockConfigService: MockProxy<ConfigService>;

  beforeAll(() => {
    mockApiService = mock<UserKeyRotationApiService>();
    mockCipherService = mock<CipherService>();
    mockFolderService = mock<FolderService>();
    mockSendService = mock<SendService>();
    mockEmergencyAccessService = mock<EmergencyAccessService>();
    mockResetPasswordService = mock<OrganizationUserResetPasswordService>();
    mockDeviceTrustCryptoService = mock<DeviceTrustCryptoServiceAbstraction>();
    mockCryptoService = mock<CryptoService>();
    mockEncryptService = mock<EncryptService>();
    mockStateService = mock<StateService>();
    mockConfigService = mock<ConfigService>();

    keyRotationService = new UserKeyRotationService(
      mockApiService,
      mockCipherService,
      mockFolderService,
      mockSendService,
      mockEmergencyAccessService,
      mockResetPasswordService,
      mockDeviceTrustCryptoService,
      mockCryptoService,
      mockEncryptService,
      mockStateService,
      mockConfigService,
    );
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("instantiates", () => {
    expect(keyRotationService).not.toBeFalsy();
  });

  describe("rotateUserKeyAndEncryptedData", () => {
    let folderViews: BehaviorSubject<FolderView[]>;
    let sends: BehaviorSubject<Send[]>;

    beforeAll(() => {
      mockCryptoService.makeMasterKey.mockResolvedValue("mockMasterKey" as any);
      mockCryptoService.makeUserKey.mockResolvedValue([
        new SymmetricCryptoKey(new Uint8Array(64)) as UserKey,
        {
          encryptedString: "mockEncryptedUserKey",
        } as any,
      ]);
      mockCryptoService.hashMasterKey.mockResolvedValue("mockMasterPasswordHash");
      mockConfigService.getFeatureFlag.mockResolvedValue(true);

      // Mock private key
      mockCryptoService.getPrivateKey.mockResolvedValue("MockPrivateKey" as any);

      // Mock ciphers
      const mockCiphers = [createMockCipher("1", "Cipher 1"), createMockCipher("2", "Cipher 2")];
      mockCipherService.getAllDecrypted.mockResolvedValue(mockCiphers);

      // Mock folders
      const mockFolders = [createMockFolder("1", "Folder 1"), createMockFolder("2", "Folder 2")];
      folderViews = new BehaviorSubject<FolderView[]>(mockFolders);
      mockFolderService.folderViews$ = folderViews;

      // Mock sends
      const mockSends = [createMockSend("1", "Send 1"), createMockSend("2", "Send 2")];
      sends = new BehaviorSubject<Send[]>(mockSends);
      mockSendService.sends$ = sends;

      // Mock encryption methods
      mockEncryptService.encrypt.mockResolvedValue({
        encryptedString: "mockEncryptedData",
      } as any);

      mockFolderService.encrypt.mockImplementation((folder, userKey) => {
        const encryptedFolder = new Folder();
        encryptedFolder.id = folder.id;
        encryptedFolder.name = new EncString(
          EncryptionType.AesCbc256_HmacSha256_B64,
          "Encrypted: " + folder.name,
        );
        return Promise.resolve(encryptedFolder);
      });

      mockCipherService.encrypt.mockImplementation((cipher, userKey) => {
        const encryptedCipher = new Cipher();
        encryptedCipher.id = cipher.id;
        encryptedCipher.name = new EncString(
          EncryptionType.AesCbc256_HmacSha256_B64,
          "Encrypted: " + cipher.name,
        );
        return Promise.resolve(encryptedCipher);
      });
    });

    it("rotates the user key and encrypted data", async () => {
      await keyRotationService.rotateUserKeyAndEncryptedData("mockMasterPassword");

      expect(mockApiService.postUserKeyUpdate).toHaveBeenCalled();
      const arg = mockApiService.postUserKeyUpdate.mock.calls[0][0];
      expect(arg.ciphers.length).toBe(2);
      expect(arg.folders.length).toBe(2);
    });

    it("throws if master password provided is falsey", async () => {
      await expect(keyRotationService.rotateUserKeyAndEncryptedData("")).rejects.toThrow();
    });

    it("throws if master key creation fails", async () => {
      mockCryptoService.makeMasterKey.mockResolvedValueOnce(null);

      await expect(
        keyRotationService.rotateUserKeyAndEncryptedData("mockMasterPassword"),
      ).rejects.toThrow();
    });

    it("throws if user key creation fails", async () => {
      mockCryptoService.makeUserKey.mockResolvedValueOnce([null, null]);

      await expect(
        keyRotationService.rotateUserKeyAndEncryptedData("mockMasterPassword"),
      ).rejects.toThrow();
    });

    it("saves the master key in state after creation", async () => {
      await keyRotationService.rotateUserKeyAndEncryptedData("mockMasterPassword");

      expect(mockCryptoService.setMasterKey).toHaveBeenCalledWith("mockMasterKey" as any);
    });

    it("uses legacy rotation if feature flag is off", async () => {
      mockConfigService.getFeatureFlag.mockResolvedValueOnce(false);

      await keyRotationService.rotateUserKeyAndEncryptedData("mockMasterPassword");

      expect(mockApiService.postUserKeyUpdate).toHaveBeenCalled();
      expect(mockEmergencyAccessService.postLegacyRotation).toHaveBeenCalled();
      expect(mockResetPasswordService.postLegacyRotation).toHaveBeenCalled();
    });

    it("throws if server rotation fails", async () => {
      mockApiService.postUserKeyUpdate.mockRejectedValueOnce(new Error("mockError"));

      await expect(
        keyRotationService.rotateUserKeyAndEncryptedData("mockMasterPassword"),
      ).rejects.toThrow();
    });
  });
});

function createMockFolder(id: string, name: string): FolderView {
  const folder = new FolderView();
  folder.id = id;
  folder.name = name;
  return folder;
}

function createMockCipher(id: string, name: string): CipherView {
  const cipher = new CipherView();
  cipher.id = id;
  cipher.name = name;
  cipher.type = CipherType.Login;
  return cipher;
}

function createMockSend(id: string, name: string): Send {
  const send = new Send();
  send.id = id;
  send.name = new EncString(EncryptionType.AesCbc256_HmacSha256_B64, name);
  return send;
}
