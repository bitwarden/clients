import { mock } from "jest-mock-extended";
import { of } from "rxjs";

// eslint-disable-next-line no-restricted-imports
import { KeyService } from "@bitwarden/key-management";
import { LogService } from "@bitwarden/logging";
import { CryptoClient } from "@bitwarden/sdk-internal";
import { UserKeyRotationServiceAbstraction } from "@bitwarden/user-crypto-management";

import { ApiService } from "../../../abstractions/api.service";
import { OrganizationService } from "../../../admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "../../../admin-console/models/domain/organization";
import { FeatureFlag } from "../../../enums/feature-flag.enum";
import { ConfigService } from "../../../platform/abstractions/config/config.service";
import { SymmetricCryptoKey } from "../../../platform/models/domain/symmetric-crypto-key";
import { SyncService } from "../../../platform/sync";
import { UserId } from "../../../types/guid";
import { UserKey, UserPrivateKey } from "../../../types/key";
import { CipherService } from "../../../vault/abstractions/cipher.service";
import { AttachmentView } from "../../../vault/models/view/attachment.view";
import { CipherView } from "../../../vault/models/view/cipher.view";
import { EncString } from "../../crypto/models/enc-string";
import { MasterPasswordServiceAbstraction } from "../../master-password/abstractions/master-password.service.abstraction";

import { V2KeyRotationMigration } from "./v2-key-rotation-migration";

jest.mock("@bitwarden/sdk-internal", () => ({
  CryptoClient: {
    get_key_id_for_symmetric_key: jest.fn(),
  },
}));

jest.mock("@bitwarden/common/platform/abstractions/sdk/sdk-load.service", () => ({
  SdkLoadService: { Ready: Promise.resolve() },
}));

describe("V2KeyRotationMigration", () => {
  const mockKeyService = mock<KeyService>();
  const mockUserKeyRotationService = mock<UserKeyRotationServiceAbstraction>();
  const mockMasterPasswordService = mock<MasterPasswordServiceAbstraction>();
  const mockSyncService = mock<SyncService>();
  const mockConfigService = mock<ConfigService>();
  const mockLogService = mock<LogService>();
  const mockOrganizationService = mock<OrganizationService>();
  const mockCipherService = mock<CipherService>();
  const mockApiService = mock<ApiService>();

  let sut: V2KeyRotationMigration;

  const mockUserId = "00000000-0000-0000-0000-000000000000" as UserId;
  const mockMasterPassword = "masterPassword";
  const mockUserKey = new SymmetricCryptoKey(new Uint8Array(64)) as UserKey;
  const mockUserPrivateKey = new Uint8Array([9, 9, 9]) as UserPrivateKey;
  const v2KeyId = new Uint8Array([1, 2, 3, 4]);

  const setKeyIdForKey = (keyId: Uint8Array | null) => {
    ((CryptoClient as any).get_key_id_for_symmetric_key as jest.Mock).mockReturnValue(keyId);
  };

  const makeCipherWithAttachments = (attachments: AttachmentView[]): CipherView => {
    const cipher = new CipherView();
    cipher.attachments = attachments;
    return cipher;
  };

  const makeAttachment = (hasEncryptedKey: boolean): AttachmentView => {
    const a = new AttachmentView();
    a.encryptedKey = hasEncryptedKey
      ? new EncString("0.abc|def|ghi")
      : (undefined as unknown as EncString);
    return a;
  };

  /** Wires every gate to pass so individual tests can fail a single one. */
  const arrangeHappyPath = () => {
    mockConfigService.getFeatureFlag.mockResolvedValue(true);
    mockMasterPasswordService.userHasMasterPassword.mockResolvedValue(true);
    mockKeyService.userKey$.mockReturnValue(of(mockUserKey));
    mockKeyService.userPrivateKey$.mockReturnValue(of(mockUserPrivateKey));
    setKeyIdForKey(null);
    mockOrganizationService.organizations$.mockReturnValue(of([]));
    mockApiService.send.mockResolvedValue({ Data: [] });
    mockCipherService.failedToDecryptCiphers$.mockReturnValue(of([]));
    mockCipherService.cipherViews$.mockReturnValue(of([]));
  };

  beforeEach(() => {
    jest.clearAllMocks();

    sut = new V2KeyRotationMigration(
      mockKeyService,
      mockUserKeyRotationService,
      mockMasterPasswordService,
      mockSyncService,
      mockConfigService,
      mockLogService,
      mockOrganizationService,
      mockCipherService,
      mockApiService,
    );
  });

  describe("needsMigration", () => {
    it("throws when userId is null", async () => {
      await expect(sut.needsMigration(null as any)).rejects.toThrow("userId");
    });

    it("returns 'noMigrationNeeded' when feature flag is disabled", async () => {
      mockConfigService.getFeatureFlag.mockResolvedValue(false);

      const result = await sut.needsMigration(mockUserId);

      expect(result).toBe("noMigrationNeeded");
      expect(mockConfigService.getFeatureFlag).toHaveBeenCalledWith(
        FeatureFlag.ForceUpgradeV2Encryption,
      );
      expect(mockSyncService.fullSync).not.toHaveBeenCalled();
    });

    it("returns 'noMigrationNeeded' when user has no master password", async () => {
      mockConfigService.getFeatureFlag.mockResolvedValue(true);
      mockMasterPasswordService.userHasMasterPassword.mockResolvedValue(false);

      const result = await sut.needsMigration(mockUserId);

      expect(result).toBe("noMigrationNeeded");
      expect(mockSyncService.fullSync).not.toHaveBeenCalled();
    });

    it("returns 'noMigrationNeeded' when user key is already v2", async () => {
      mockConfigService.getFeatureFlag.mockResolvedValue(true);
      mockMasterPasswordService.userHasMasterPassword.mockResolvedValue(true);
      mockKeyService.userKey$.mockReturnValue(of(mockUserKey));
      setKeyIdForKey(v2KeyId);

      const result = await sut.needsMigration(mockUserId);

      expect(result).toBe("noMigrationNeeded");
      expect(mockSyncService.fullSync).not.toHaveBeenCalled();
    });

    it("returns 'noMigrationNeeded' when user has no user key", async () => {
      mockConfigService.getFeatureFlag.mockResolvedValue(true);
      mockMasterPasswordService.userHasMasterPassword.mockResolvedValue(true);
      mockKeyService.userKey$.mockReturnValue(of(null as unknown as UserKey));

      const result = await sut.needsMigration(mockUserId);

      expect(result).toBe("noMigrationNeeded");
      expect(mockSyncService.fullSync).not.toHaveBeenCalled();
    });

    it("returns 'noMigrationNeeded' when post-sync the user has been upgraded to v2 elsewhere", async () => {
      mockConfigService.getFeatureFlag.mockResolvedValue(true);
      mockMasterPasswordService.userHasMasterPassword.mockResolvedValue(true);
      mockKeyService.userKey$.mockReturnValue(of(mockUserKey));
      ((CryptoClient as any).get_key_id_for_symmetric_key as jest.Mock)
        .mockReturnValueOnce(null)
        .mockReturnValueOnce(v2KeyId);

      const result = await sut.needsMigration(mockUserId);

      expect(result).toBe("noMigrationNeeded");
      expect(mockSyncService.fullSync).toHaveBeenCalledWith(false);
      expect(mockLogService.info).toHaveBeenCalledWith(
        `[V2KeyRotationMigration] After syncing, user ${mockUserId} is already on v2. Skipping.`,
      );
    });

    it("returns 'noMigrationNeeded' when user is enrolled in account recovery", async () => {
      arrangeHappyPath();
      mockOrganizationService.organizations$.mockReturnValue(
        of([{ resetPasswordEnrolled: true } as Organization]),
      );

      const result = await sut.needsMigration(mockUserId);

      expect(result).toBe("noMigrationNeeded");
      expect(mockApiService.send).not.toHaveBeenCalled();
    });

    it("returns 'noMigrationNeeded' when user has granted emergency access", async () => {
      arrangeHappyPath();
      mockApiService.send.mockResolvedValue({ Data: [{ id: "grant-1" }] });

      const result = await sut.needsMigration(mockUserId);

      expect(result).toBe("noMigrationNeeded");
      expect(mockApiService.send).toHaveBeenCalledWith(
        "GET",
        "/emergency-access/granted",
        null,
        mockUserId,
        true,
      );
    });

    it("accepts lowercase 'data' in the emergency-access response", async () => {
      arrangeHappyPath();
      mockApiService.send.mockResolvedValue({ data: [{ id: "grant-1" }] });

      const result = await sut.needsMigration(mockUserId);

      expect(result).toBe("noMigrationNeeded");
    });

    it("returns 'noMigrationNeeded' when user has a corrupted/missing private key", async () => {
      arrangeHappyPath();
      mockKeyService.userPrivateKey$.mockReturnValue(of(null));

      const result = await sut.needsMigration(mockUserId);

      expect(result).toBe("noMigrationNeeded");
    });

    it("returns 'noMigrationNeeded' when user has ciphers that failed to decrypt", async () => {
      arrangeHappyPath();
      mockCipherService.failedToDecryptCiphers$.mockReturnValue(of([new CipherView()]));

      const result = await sut.needsMigration(mockUserId);

      expect(result).toBe("noMigrationNeeded");
    });

    it("waits for failedToDecryptCiphers$ to emit a non-null value", async () => {
      arrangeHappyPath();
      mockCipherService.failedToDecryptCiphers$.mockReturnValue(of(null, []));

      const result = await sut.needsMigration(mockUserId);

      expect(result).toBe("needsMigrationWithMasterPassword");
    });

    it("returns 'noMigrationNeeded' when user has a v1 attachment (no encrypted key)", async () => {
      arrangeHappyPath();
      mockCipherService.cipherViews$.mockReturnValue(
        of([makeCipherWithAttachments([makeAttachment(false)])]),
      );

      const result = await sut.needsMigration(mockUserId);

      expect(result).toBe("noMigrationNeeded");
    });

    it("ignores ciphers whose attachments all have an encrypted key", async () => {
      arrangeHappyPath();
      mockCipherService.cipherViews$.mockReturnValue(
        of([makeCipherWithAttachments([makeAttachment(true), makeAttachment(true)])]),
      );

      const result = await sut.needsMigration(mockUserId);

      expect(result).toBe("needsMigrationWithMasterPassword");
    });

    it("returns 'needsMigrationWithMasterPassword' when all preconditions pass", async () => {
      arrangeHappyPath();

      const result = await sut.needsMigration(mockUserId);

      expect(result).toBe("needsMigrationWithMasterPassword");
      expect(mockSyncService.fullSync).toHaveBeenCalledWith(false);
    });
  });

  describe("runMigrations", () => {
    it("throws when userId is null", async () => {
      await expect(sut.runMigrations(null as any, mockMasterPassword)).rejects.toThrow("userId");
    });

    it("throws when masterPassword is null", async () => {
      await expect(sut.runMigrations(mockUserId, null)).rejects.toThrow("masterPassword");
    });

    it("performs a full sync before rotating the user key", async () => {
      mockUserKeyRotationService.rotateUserKey.mockResolvedValue(true);
      const callOrder: string[] = [];
      mockSyncService.fullSync.mockImplementation(async () => {
        callOrder.push("fullSync");
        return true;
      });
      mockUserKeyRotationService.rotateUserKey.mockImplementation(async () => {
        callOrder.push("rotateUserKey");
        return true;
      });

      await sut.runMigrations(mockUserId, mockMasterPassword);

      expect(mockSyncService.fullSync).toHaveBeenCalledWith(true);
      expect(mockUserKeyRotationService.rotateUserKey).toHaveBeenCalledWith(
        { Password: { password: mockMasterPassword } },
        mockUserId,
      );
      expect(callOrder).toEqual(["fullSync", "rotateUserKey"]);
    });

    it("throws when the rotation service returns false (trust denied)", async () => {
      mockUserKeyRotationService.rotateUserKey.mockResolvedValue(false);

      await expect(sut.runMigrations(mockUserId, mockMasterPassword)).rejects.toThrow(
        "[V2KeyRotationMigration] Rotation aborted by user trust prompt.",
      );
      expect(mockSyncService.fullSync).toHaveBeenCalledWith(true);
    });

    it("propagates errors thrown by the rotation service", async () => {
      const rotationError = new Error("rotation failed");
      mockUserKeyRotationService.rotateUserKey.mockRejectedValue(rotationError);

      await expect(sut.runMigrations(mockUserId, mockMasterPassword)).rejects.toThrow(
        "rotation failed",
      );
    });
  });
});
