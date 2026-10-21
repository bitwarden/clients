import { mock } from "jest-mock-extended";
import { of } from "rxjs";

// eslint-disable-next-line no-restricted-imports
import { KeyService } from "@bitwarden/key-management";
// eslint-disable-next-line no-restricted-imports
import { SymmetricCryptoKey } from "@bitwarden/legacy-crypto";
import { LogService } from "@bitwarden/logging";
import { LockService, LockSource, UnlockMethod, UnlockService } from "@bitwarden/unlock";
import { UserKeyRotationServiceAbstraction } from "@bitwarden/user-crypto-management";

import { FeatureFlag } from "../../../enums/feature-flag.enum";
import { ConfigService } from "../../../platform/abstractions/config/config.service";
import { SdkService } from "../../../platform/abstractions/sdk/sdk.service";
import { SyncService } from "../../../platform/sync";
import { UserId } from "../../../types/guid";
import { UserKey } from "../../../types/key";
import { CipherService } from "../../../vault/abstractions/cipher.service";
import { AttachmentView } from "../../../vault/models/view/attachment.view";
import { CipherView } from "../../../vault/models/view/cipher.view";
import { MasterPasswordServiceAbstraction } from "../../master-password/abstractions/master-password.service.abstraction";

import { V2KeyRotationMigration } from "./v2-key-rotation-migration";

describe("V2KeyRotationMigration", () => {
  const mockKeyService = mock<KeyService>();
  const mockUserKeyRotationService = mock<UserKeyRotationServiceAbstraction>();
  const mockMasterPasswordService = mock<MasterPasswordServiceAbstraction>();
  const mockSyncService = mock<SyncService>();
  const mockConfigService = mock<ConfigService>();
  const mockLogService = mock<LogService>();
  const mockCipherService = mock<CipherService>();
  const mockSdkService = mock<SdkService>();
  const mockUnlockService = mock<UnlockService>();
  const mockLockService = mock<LockService>();

  let sut: V2KeyRotationMigration;
  let mockUserCryptoMgmt: {
    get_untrusted_organization_public_keys: jest.Mock;
    get_untrusted_emergency_access_public_keys: jest.Mock;
    should_regenerate_public_key_encryption_key_pair: jest.Mock;
  };

  const mockUserId = "00000000-0000-0000-0000-000000000000" as UserId;
  const mockMasterPassword = "masterPassword";
  const mockUserKey = new SymmetricCryptoKey(new Uint8Array(64)) as UserKey;
  const mockUserKeyV2 = new SymmetricCryptoKey(new Uint8Array(75)) as UserKey;

  const makeCipherWithAttachments = (attachments: AttachmentView[]): CipherView => {
    const cipher = new CipherView();
    cipher.attachments = attachments;
    return cipher;
  };

  const makeAttachment = (hasKey: boolean): AttachmentView => {
    const a = new AttachmentView();
    a.key = hasKey ? mock<SymmetricCryptoKey>() : undefined;
    return a;
  };

  /**
   * Backs the three SDK methods reached via `withPasswordManagerSdk`:
   * organization-recovery enrollment, granted emergency access, and
   * corrupted-private-key detection.
   */
  const arrangeSdkResult = ({
    orgKeys = [] as unknown[],
    emergencyKeys = [] as unknown[],
    shouldRegenerate = false,
  }: {
    orgKeys?: unknown[];
    emergencyKeys?: unknown[];
    shouldRegenerate?: boolean;
  } = {}) => {
    mockUserCryptoMgmt = {
      get_untrusted_organization_public_keys: jest.fn().mockResolvedValue(orgKeys),
      get_untrusted_emergency_access_public_keys: jest.fn().mockResolvedValue(emergencyKeys),
      should_regenerate_public_key_encryption_key_pair: jest
        .fn()
        .mockResolvedValue(shouldRegenerate),
    };
    mockSdkService.userClient$.mockReturnValue(
      of({
        take: () => ({
          value: { user_crypto_management: () => mockUserCryptoMgmt },
          [Symbol.dispose]: jest.fn(),
        }),
      } as any),
    );
  };

  /** Wires every gate to pass so individual tests can fail a single one. */
  const arrangeHappyPath = () => {
    mockConfigService.getFeatureFlag.mockResolvedValue(true);
    mockMasterPasswordService.userHasMasterPassword.mockResolvedValue(true);
    mockKeyService.userKey$.mockReturnValue(of(mockUserKey));
    mockCipherService.failedToDecryptCiphers$.mockReturnValue(of([]));
    mockCipherService.cipherViews$.mockReturnValue(of([]));
    arrangeSdkResult();
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
      mockCipherService,
      mockSdkService,
      mockUnlockService,
      mockLockService,
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
      arrangeHappyPath();
      mockMasterPasswordService.userHasMasterPassword.mockResolvedValue(false);

      const result = await sut.needsMigration(mockUserId);

      expect(result).toBe("noMigrationNeeded");
      expect(mockSyncService.fullSync).toHaveBeenCalledWith(false);
    });

    it("returns 'noMigrationNeeded' when user key is already v2", async () => {
      mockConfigService.getFeatureFlag.mockResolvedValue(true);
      mockKeyService.userKey$.mockReturnValue(of(mockUserKeyV2));

      const result = await sut.needsMigration(mockUserId);

      expect(result).toBe("noMigrationNeeded");
      expect(mockSyncService.fullSync).not.toHaveBeenCalled();
    });

    it("throws when the user has no user key", async () => {
      mockConfigService.getFeatureFlag.mockResolvedValue(true);
      mockKeyService.userKey$.mockReturnValue(of(null as unknown as UserKey));

      await expect(sut.needsMigration(mockUserId)).rejects.toThrow("No user key found");
      expect(mockSyncService.fullSync).not.toHaveBeenCalled();
    });

    it("returns 'noMigrationNeeded' when post-sync the user has been upgraded to v2 elsewhere", async () => {
      arrangeHappyPath();
      mockKeyService.userKey$
        .mockReturnValueOnce(of(mockUserKey))
        .mockReturnValueOnce(of(mockUserKeyV2));

      const result = await sut.needsMigration(mockUserId);

      expect(result).toBe("noMigrationNeeded");
      expect(mockSyncService.fullSync).toHaveBeenCalledWith(false);
      expect(mockLogService.info).toHaveBeenCalledWith(
        `[V2KeyRotationMigration] After syncing, user ${mockUserId} is already on v2. Skipping.`,
      );
    });

    it("returns 'noMigrationNeeded' when user is enrolled in account recovery", async () => {
      arrangeHappyPath();
      arrangeSdkResult({ orgKeys: [{}] });

      const result = await sut.needsMigration(mockUserId);

      expect(result).toBe("noMigrationNeeded");
      expect(mockSyncService.fullSync).toHaveBeenCalledWith(false);
    });

    it("requests untrusted organization public keys for a CreateIfNeeded rotation", async () => {
      arrangeHappyPath();

      await sut.needsMigration(mockUserId);

      expect(mockUserCryptoMgmt.get_untrusted_organization_public_keys).toHaveBeenCalledWith(
        "CreateIfNeeded",
      );
    });

    it("returns 'noMigrationNeeded' when user has granted emergency access", async () => {
      arrangeHappyPath();
      arrangeSdkResult({ emergencyKeys: [{}] });

      const result = await sut.needsMigration(mockUserId);

      expect(result).toBe("noMigrationNeeded");
      expect(mockSyncService.fullSync).toHaveBeenCalledWith(false);
    });

    it("returns 'noMigrationNeeded' when user has a corrupted/missing private key", async () => {
      arrangeHappyPath();
      arrangeSdkResult({ shouldRegenerate: true });

      const result = await sut.needsMigration(mockUserId);

      expect(result).toBe("noMigrationNeeded");
    });

    it("returns 'noMigrationNeeded' when user has ciphers that failed to decrypt", async () => {
      arrangeHappyPath();
      mockCipherService.failedToDecryptCiphers$.mockReturnValue(of([new CipherView()]));

      const result = await sut.needsMigration(mockUserId);

      expect(result).toBe("noMigrationNeeded");
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
    let callOrder: string[];

    beforeEach(() => {
      callOrder = [];
      mockMasterPasswordService.userHasMasterPassword.mockResolvedValue(true);
      // The rotation writes the new user key to state.
      mockKeyService.userKey$.mockReturnValue(of(mockUserKeyV2));
      mockUserKeyRotationService.rotateUserKey.mockImplementation(async () => {
        callOrder.push("rotateUserKey");
        return true;
      });
      mockUnlockService.unlockWithDecryptedUserKey.mockImplementation(async () => {
        callOrder.push("rekey");
      });
      mockSyncService.fullSync.mockImplementation(async () => {
        callOrder.push("fullSync");
        return true;
      });
      mockLockService.lock.mockResolvedValue(undefined);
    });

    it("throws when userId is null", async () => {
      await expect(sut.runMigrations(null as any, mockMasterPassword)).rejects.toThrow("userId");
    });

    it("unlocks with the rotated user key, then performs a full sync", async () => {
      await sut.runMigrations(mockUserId, mockMasterPassword);

      expect(mockUserKeyRotationService.rotateUserKey).toHaveBeenCalledWith(
        { Password: { password: mockMasterPassword } },
        "CreateIfNeeded",
        mockUserId,
      );
      expect(mockUnlockService.unlockWithDecryptedUserKey).toHaveBeenCalledWith(
        mockUserId,
        mockUserKeyV2,
        UnlockMethod.KeyRotation,
      );
      expect(mockSyncService.fullSync).toHaveBeenCalledWith(true);
      expect(callOrder).toEqual(["rotateUserKey", "rekey", "fullSync"]);
      expect(mockLockService.lock).not.toHaveBeenCalled();
    });

    it("locks and rethrows when unlocking with the rotated user key fails", async () => {
      const rekeyError = new Error("rekey failed");
      mockUnlockService.unlockWithDecryptedUserKey.mockRejectedValue(rekeyError);

      await expect(sut.runMigrations(mockUserId, mockMasterPassword)).rejects.toBe(rekeyError);

      expect(mockLockService.lock).toHaveBeenCalledWith(mockUserId, LockSource.Manual);
      expect(mockSyncService.fullSync).not.toHaveBeenCalled();
    });

    it("locks when the rotated user key is missing from state", async () => {
      mockKeyService.userKey$.mockReturnValue(of(null));

      await expect(sut.runMigrations(mockUserId, mockMasterPassword)).rejects.toThrow();

      expect(mockUnlockService.unlockWithDecryptedUserKey).not.toHaveBeenCalled();
      expect(mockLockService.lock).toHaveBeenCalledWith(mockUserId, LockSource.Manual);
    });

    it("rethrows the original error and logs when locking also fails", async () => {
      const rekeyError = new Error("rekey failed");
      mockUnlockService.unlockWithDecryptedUserKey.mockRejectedValue(rekeyError);
      mockLockService.lock.mockRejectedValue(new Error("lock failed"));

      await expect(sut.runMigrations(mockUserId, mockMasterPassword)).rejects.toBe(rekeyError);

      expect(mockLogService.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to lock"),
        expect.any(Error),
      );
    });

    it("throws when the rotation service returns false (trust denied)", async () => {
      mockUserKeyRotationService.rotateUserKey.mockResolvedValue(false);

      await expect(sut.runMigrations(mockUserId, mockMasterPassword)).rejects.toThrow(
        "[V2KeyRotationMigration] Rotation aborted by user trust prompt.",
      );
      expect(mockUnlockService.unlockWithDecryptedUserKey).not.toHaveBeenCalled();
      expect(mockLockService.lock).not.toHaveBeenCalled();
      expect(mockSyncService.fullSync).not.toHaveBeenCalled();
    });

    it("propagates errors thrown by the rotation service", async () => {
      const rotationError = new Error("rotation failed");
      mockUserKeyRotationService.rotateUserKey.mockRejectedValue(rotationError);

      await expect(sut.runMigrations(mockUserId, mockMasterPassword)).rejects.toThrow(
        "rotation failed",
      );
      expect(mockUnlockService.unlockWithDecryptedUserKey).not.toHaveBeenCalled();
      expect(mockLockService.lock).not.toHaveBeenCalled();
    });
  });
});
