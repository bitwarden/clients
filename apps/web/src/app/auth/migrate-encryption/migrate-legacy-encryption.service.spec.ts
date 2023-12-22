import { mock } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { EncryptService } from "@bitwarden/common/platform/abstractions/encrypt.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { EncryptionType, KdfType } from "@bitwarden/common/platform/enums";
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

import { AccountRecoveryService } from "../../admin-console/organizations/members/services/account-recovery/account-recovery.service";
import { EmergencyAccessService } from "../emergency-access";

import { MigrateFromLegacyEncryptionService } from "./migrate-legacy-encryption.service";

describe("migrateFromLegacyEncryptionService", () => {
  let migrateFromLegacyEncryptionService: MigrateFromLegacyEncryptionService;

  const emergencyAccessService = mock<EmergencyAccessService>();
  const accountRecoveryService = mock<AccountRecoveryService>();
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
      emergencyAccessService,
      accountRecoveryService,
      apiService,
      cryptoService,
      encryptService,
      syncService,
      cipherService,
      folderService,
      sendService,
      stateService,
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
        migrateFromLegacyEncryptionService.createNewUserKey(mockMasterPassword),
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
      cryptoService.rsaEncrypt.mockResolvedValue(
        new EncString(EncryptionType.AesCbc256_HmacSha256_B64, "Encrypted"),
      );

      folderViews = new BehaviorSubject<FolderView[]>(mockFolders);
      folderService.folderViews$ = folderViews;

      cipherService.getAllDecrypted.mockResolvedValue(mockCiphers);

      sends = new BehaviorSubject<Send[]>(mockSends);
      sendService.sends$ = sends;

      encryptService.encrypt.mockImplementation((plainValue, userKey) => {
        return Promise.resolve(
          new EncString(EncryptionType.AesCbc256_HmacSha256_B64, "Encrypted: " + plainValue),
        );
      });

      folderService.encrypt.mockImplementation((folder, userKey) => {
        const encryptedFolder = new Folder();
        encryptedFolder.id = folder.id;
        encryptedFolder.name = new EncString(
          EncryptionType.AesCbc256_HmacSha256_B64,
          "Encrypted: " + folder.name,
        );
        return Promise.resolve(encryptedFolder);
      });

      cipherService.encrypt.mockImplementation((cipher, userKey) => {
        const encryptedCipher = new Cipher();
        encryptedCipher.id = cipher.id;
        encryptedCipher.name = new EncString(
          EncryptionType.AesCbc256_HmacSha256_B64,
          "Encrypted: " + cipher.name,
        );
        return Promise.resolve(encryptedCipher);
      });
    });

    it("derives the master key in case it hasn't been set", async () => {
      await migrateFromLegacyEncryptionService.updateKeysAndEncryptedData(
        mockMasterPassword,
        mockUserKey,
        mockEncUserKey,
      );

      expect(cryptoService.getOrDeriveMasterKey).toHaveBeenCalled();
    });

    it("syncs latest data", async () => {
      await migrateFromLegacyEncryptionService.updateKeysAndEncryptedData(
        mockMasterPassword,
        mockUserKey,
        mockEncUserKey,
      );
      expect(syncService.fullSync).toHaveBeenCalledWith(true, "update-keys");
    });

    it("does not post new account data if sync fails", async () => {
      syncService.fullSync.mockRejectedValueOnce(new Error("sync failed"));

      await expect(
        migrateFromLegacyEncryptionService.updateKeysAndEncryptedData(
          mockMasterPassword,
          mockUserKey,
          mockEncUserKey,
        ),
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
          mockEncUserKey,
        ),
      ).rejects.toThrowError("Ciphers failed to be retrieved");

      expect(apiService.postAccountKey).not.toHaveBeenCalled();
    });
  });

  describe("updateEmergencyAccesses", () => {
    let mockUserKey: UserKey;

    beforeEach(() => {
      const mockRandomBytes = new Uint8Array(64) as CsprngArray;
      mockUserKey = new SymmetricCryptoKey(mockRandomBytes) as UserKey;
    });

    it("Uses emergency access service to rotate", async () => {
      await migrateFromLegacyEncryptionService.updateEmergencyAccesses(mockUserKey);

      expect(emergencyAccessService.rotate).toHaveBeenCalled();
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
