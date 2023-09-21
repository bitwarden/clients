import { mock } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationUserService } from "@bitwarden/common/abstractions/organization-user/organization-user.service";
import { OrganizationUserResetPasswordEnrollmentRequest } from "@bitwarden/common/abstractions/organization-user/requests";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { OrganizationKeysResponse } from "@bitwarden/common/admin-console/models/response/organization-keys.response";
import { OrganizationApiService } from "@bitwarden/common/admin-console/services/organization/organization-api.service";
import { EmergencyAccessStatusType } from "@bitwarden/common/auth/enums/emergency-access-status-type";
import { EmergencyAccessUpdateRequest } from "@bitwarden/common/auth/models/request/emergency-access-update.request";
import { EmergencyAccessGranteeDetailsResponse } from "@bitwarden/common/auth/models/response/emergency-access.response";
import { EncryptionType, KdfType } from "@bitwarden/common/enums";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { UserKeyResponse } from "@bitwarden/common/models/response/user-key.response";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { EncryptService } from "@bitwarden/common/platform/abstractions/encrypt.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";
import {
  MasterKey,
  SymmetricCryptoKey,
  UserKey,
} from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { Send } from "@bitwarden/common/tools/send/models/domain/send";
import { SendService } from "@bitwarden/common/tools/send/services/send.service.abstraction";
import { CsprngArray } from "@bitwarden/common/types/csprng";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { Folder } from "@bitwarden/common/vault/models/domain/folder";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";

import { MigrateFromLegacyEncryptionService } from "./migrate-legacy-encryption.service";

describe("migrateFromLegacyEncryptionService", () => {
  let migrateFromLegacyEncryptionService: MigrateFromLegacyEncryptionService;

  const organizationService = mock<OrganizationService>();
  const organizationApiService = mock<OrganizationApiService>();
  const organizationUserService = mock<OrganizationUserService>();
  const apiService = mock<ApiService>();
  const encryptService = mock<EncryptService>();
  const cryptoService = mock<CryptoService>();
  const syncService = mock<SyncService>();
  const cipherService = mock<CipherService>();
  const folderService = mock<FolderService>();
  const sendService = mock<SendService>();
  const stateService = mock<StateService>();
  let folderViews: BehaviorSubject<FolderView[]>;
  let sends: BehaviorSubject<Send[]>;

  beforeEach(() => {
    jest.clearAllMocks();

    migrateFromLegacyEncryptionService = new MigrateFromLegacyEncryptionService(
      organizationService,
      organizationApiService,
      organizationUserService,
      apiService,
      cryptoService,
      encryptService,
      syncService,
      cipherService,
      folderService,
      sendService,
      stateService
    );
  });

  it("instantiates", () => {
    expect(migrateFromLegacyEncryptionService).not.toBeFalsy();
  });

  describe("createNewUserKey", () => {
    it("validates master password and legacy user", async () => {
      const mockMasterPassword = "mockMasterPassword";
      const mockRandomBytes = new Uint8Array(64) as CsprngArray;
      const mockMasterKey = new SymmetricCryptoKey(mockRandomBytes) as MasterKey;
      stateService.getEmail.mockResolvedValue("mockEmail");
      stateService.getKdfType.mockResolvedValue(KdfType.PBKDF2_SHA256);
      stateService.getKdfConfig.mockResolvedValue({ iterations: 100000 });
      cryptoService.makeMasterKey.mockResolvedValue(mockMasterKey);
      cryptoService.isLegacyUser.mockResolvedValue(false);

      await expect(
        migrateFromLegacyEncryptionService.createNewUserKey(mockMasterPassword)
      ).rejects.toThrowError("Invalid master password or user may not be legacy");
    });
  });

  describe("updateKeysAndEncryptedData", () => {
    let mockMasterPassword: string;
    let mockUserKey: UserKey;
    let mockEncUserKey: EncString;

    beforeEach(() => {
      mockMasterPassword = "mockMasterPassword";

      const mockRandomBytes = new Uint8Array(64) as CsprngArray;
      mockUserKey = new SymmetricCryptoKey(mockRandomBytes) as UserKey;
      mockEncUserKey = new EncString("mockEncUserKey");

      const mockFolders = [createMockFolder("1", "Folder 1"), createMockFolder("2", "Folder 2")];
      const mockCiphers = [createMockCipher("1", "Cipher 1"), createMockCipher("2", "Cipher 2")];
      const mockSends = [createMockSend("1", "Send 1"), createMockSend("2", "Send 2")];

      cryptoService.getPrivateKey.mockResolvedValue(new Uint8Array(64) as CsprngArray);

      folderViews = new BehaviorSubject<FolderView[]>(mockFolders);
      folderService.folderViews$ = folderViews;

      cipherService.getAllDecrypted.mockResolvedValue(mockCiphers);

      sends = new BehaviorSubject<Send[]>(mockSends);
      sendService.sends$ = sends;

      encryptService.encrypt.mockImplementation((plainValue, userKey) => {
        return Promise.resolve(
          new EncString(EncryptionType.AesCbc256_HmacSha256_B64, "Encrypted: " + plainValue)
        );
      });

      folderService.encrypt.mockImplementation((folder, userKey) => {
        const encryptedFolder = new Folder();
        encryptedFolder.id = folder.id;
        encryptedFolder.name = new EncString(
          EncryptionType.AesCbc256_HmacSha256_B64,
          "Encrypted: " + folder.name
        );
        return Promise.resolve(encryptedFolder);
      });

      cipherService.encrypt.mockImplementation((cipher, userKey) => {
        const encryptedCipher = new Cipher();
        encryptedCipher.id = cipher.id;
        encryptedCipher.name = new EncString(
          EncryptionType.AesCbc256_HmacSha256_B64,
          "Encrypted: " + cipher.name
        );
        return Promise.resolve(encryptedCipher);
      });
    });

    it("derives the master key in case it hasn't been set", async () => {
      await migrateFromLegacyEncryptionService.updateKeysAndEncryptedData(
        mockMasterPassword,
        mockUserKey,
        mockEncUserKey
      );

      expect(cryptoService.getOrDeriveMasterKey).toHaveBeenCalled();
    });

    it("syncs latest data", async () => {
      await migrateFromLegacyEncryptionService.updateKeysAndEncryptedData(
        mockMasterPassword,
        mockUserKey,
        mockEncUserKey
      );
      expect(syncService.fullSync).toHaveBeenCalledWith(true);
    });

    it("does not post new account data if sync fails", async () => {
      syncService.fullSync.mockRejectedValueOnce(new Error("sync failed"));

      await expect(
        migrateFromLegacyEncryptionService.updateKeysAndEncryptedData(
          mockMasterPassword,
          mockUserKey,
          mockEncUserKey
        )
      ).rejects.toThrowError("sync failed");

      expect(apiService.postAccountKey).not.toHaveBeenCalled();
    });

    it("does not post new account data if data retrieval fails", async () => {
      (migrateFromLegacyEncryptionService as any).encryptCiphers = async () => {
        throw new Error("Ciphers failed to be retrieved");
      };

      await expect(
        migrateFromLegacyEncryptionService.updateKeysAndEncryptedData(
          mockMasterPassword,
          mockUserKey,
          mockEncUserKey
        )
      ).rejects.toThrowError("Ciphers failed to be retrieved");

      expect(apiService.postAccountKey).not.toHaveBeenCalled();
    });
  });

  describe("updateEmergencyAccesses", () => {
    let mockUserKey: UserKey;

    beforeEach(() => {
      const mockRandomBytes = new Uint8Array(64) as CsprngArray;
      mockUserKey = new SymmetricCryptoKey(mockRandomBytes) as UserKey;

      const mockEmergencyAccess = {
        data: [
          createMockEmergencyAccess("0", "EA 0", EmergencyAccessStatusType.Invited),
          createMockEmergencyAccess("1", "EA 1", EmergencyAccessStatusType.Accepted),
          createMockEmergencyAccess("2", "EA 2", EmergencyAccessStatusType.Confirmed),
          createMockEmergencyAccess("3", "EA 3", EmergencyAccessStatusType.RecoveryInitiated),
          createMockEmergencyAccess("4", "EA 4", EmergencyAccessStatusType.RecoveryApproved),
        ],
      } as ListResponse<EmergencyAccessGranteeDetailsResponse>;
      apiService.getEmergencyAccessTrusted.mockResolvedValue(mockEmergencyAccess);
      apiService.getUserPublicKey.mockResolvedValue({
        userId: "mockUserId",
        publicKey: "mockPublicKey",
      } as UserKeyResponse);

      cryptoService.rsaEncrypt.mockImplementation((plainValue, publicKey) => {
        return Promise.resolve(
          new EncString(EncryptionType.Rsa2048_OaepSha1_B64, "Encrypted: " + plainValue)
        );
      });
    });

    it("Only updates emergency accesses with allowed statuses", async () => {
      await migrateFromLegacyEncryptionService.updateEmergencyAccesses(mockUserKey);

      expect(apiService.putEmergencyAccess).not.toHaveBeenCalledWith(
        "0",
        expect.any(EmergencyAccessUpdateRequest)
      );
      expect(apiService.putEmergencyAccess).not.toHaveBeenCalledWith(
        "1",
        expect.any(EmergencyAccessUpdateRequest)
      );
    });
  });

  describe("updateAllAdminRecoveryKeys", () => {
    let mockMasterPassword: string;
    let mockUserKey: UserKey;

    beforeEach(() => {
      mockMasterPassword = "mockMasterPassword";

      const mockRandomBytes = new Uint8Array(64) as CsprngArray;
      mockUserKey = new SymmetricCryptoKey(mockRandomBytes) as UserKey;

      organizationService.getAll.mockResolvedValue([
        createOrganization("1", "Org 1", true),
        createOrganization("2", "Org 2", true),
        createOrganization("3", "Org 3", false),
        createOrganization("4", "Org 4", false),
      ]);

      organizationApiService.getKeys.mockImplementation((orgId) => {
        return Promise.resolve({
          publicKey: orgId + "mockPublicKey",
          privateKey: orgId + "mockPrivateKey",
        } as OrganizationKeysResponse);
      });
    });

    it("Only updates organizations that are enrolled in admin recovery", async () => {
      await migrateFromLegacyEncryptionService.updateAllAdminRecoveryKeys(
        mockMasterPassword,
        mockUserKey
      );

      expect(
        organizationUserService.putOrganizationUserResetPasswordEnrollment
      ).toHaveBeenCalledWith(
        "1",
        expect.any(String),
        expect.any(OrganizationUserResetPasswordEnrollmentRequest)
      );
      expect(
        organizationUserService.putOrganizationUserResetPasswordEnrollment
      ).toHaveBeenCalledWith(
        "2",
        expect.any(String),
        expect.any(OrganizationUserResetPasswordEnrollmentRequest)
      );
      expect(
        organizationUserService.putOrganizationUserResetPasswordEnrollment
      ).not.toHaveBeenCalledWith(
        "3",
        expect.any(String),
        expect.any(OrganizationUserResetPasswordEnrollmentRequest)
      );
      expect(
        organizationUserService.putOrganizationUserResetPasswordEnrollment
      ).not.toHaveBeenCalledWith(
        "4",
        expect.any(String),
        expect.any(OrganizationUserResetPasswordEnrollmentRequest)
      );
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
  return cipher;
}

function createMockSend(id: string, name: string): Send {
  const send = new Send();
  send.id = id;
  send.name = new EncString(EncryptionType.AesCbc256_HmacSha256_B64, name);
  return send;
}

function createMockEmergencyAccess(
  id: string,
  name: string,
  status: EmergencyAccessStatusType
): EmergencyAccessGranteeDetailsResponse {
  const emergencyAccess = new EmergencyAccessGranteeDetailsResponse({});
  emergencyAccess.id = id;
  emergencyAccess.name = name;
  emergencyAccess.type = 0;
  emergencyAccess.status = status;
  return emergencyAccess;
}

function createOrganization(id: string, name: string, resetPasswordEnrolled: boolean) {
  const org = new Organization();
  org.id = id;
  org.name = name;
  org.resetPasswordEnrolled = resetPasswordEnrolled;
  org.userId = "mockUserID";
  return org;
}
