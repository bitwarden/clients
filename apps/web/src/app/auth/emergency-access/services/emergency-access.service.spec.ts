import { MockProxy } from "jest-mock-extended";
import mock from "jest-mock-extended/lib/Mock";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { UserKeyResponse } from "@bitwarden/common/models/response/user-key.response";
import { BulkEncryptService } from "@bitwarden/common/platform/abstractions/bulk-encrypt.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { EncryptService } from "@bitwarden/common/platform/abstractions/encrypt.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { EncryptionType, KdfType } from "@bitwarden/common/platform/enums";
import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { CsprngArray } from "@bitwarden/common/types/csprng";
import { UserKey, MasterKey } from "@bitwarden/common/types/key";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";

import { EmergencyAccessStatusType } from "../enums/emergency-access-status-type";
import { EmergencyAccessType } from "../enums/emergency-access-type";
import { EmergencyAccessPasswordRequest } from "../request/emergency-access-password.request";
import {
  EmergencyAccessGranteeDetailsResponse,
  EmergencyAccessTakeoverResponse,
} from "../response/emergency-access.response";

import { EmergencyAccessApiService } from "./emergency-access-api.service";
import { EmergencyAccessService } from "./emergency-access.service";

describe("EmergencyAccessService", () => {
  let emergencyAccessApiService: MockProxy<EmergencyAccessApiService>;
  let apiService: MockProxy<ApiService>;
  let cryptoService: MockProxy<CryptoService>;
  let encryptService: MockProxy<EncryptService>;
  let bulkEncryptService: MockProxy<BulkEncryptService>;
  let cipherService: MockProxy<CipherService>;
  let logService: MockProxy<LogService>;
  let emergencyAccessService: EmergencyAccessService;
  let configService: ConfigService;

  beforeAll(() => {
    emergencyAccessApiService = mock<EmergencyAccessApiService>();
    apiService = mock<ApiService>();
    cryptoService = mock<CryptoService>();
    encryptService = mock<EncryptService>();
    bulkEncryptService = mock<BulkEncryptService>();
    cipherService = mock<CipherService>();
    logService = mock<LogService>();

    emergencyAccessService = new EmergencyAccessService(
      emergencyAccessApiService,
      apiService,
      cryptoService,
      encryptService,
      bulkEncryptService,
      cipherService,
      logService,
      configService,
    );
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("3 step setup process", () => {
    afterEach(() => {
      jest.resetAllMocks();
    });

    describe("Step 1: invite", () => {
      it("should post an emergency access invitation", async () => {
        // Arrange
        const email = "test@example.com";
        const type = EmergencyAccessType.View;
        const waitTimeDays = 5;

        emergencyAccessApiService.postEmergencyAccessInvite.mockResolvedValueOnce();

        // Act
        await emergencyAccessService.invite(email, type, waitTimeDays);

        // Assert
        expect(emergencyAccessApiService.postEmergencyAccessInvite).toHaveBeenCalledWith({
          email: email.trim(),
          type: type,
          waitTimeDays: waitTimeDays,
        });
      });
    });

    describe("Step 2: accept", () => {
      it("should post an emergency access accept request", async () => {
        // Arrange
        const id = "some-id";
        const token = "some-token";

        emergencyAccessApiService.postEmergencyAccessAccept.mockResolvedValueOnce();

        // Act
        await emergencyAccessService.accept(id, token);

        // Assert
        expect(emergencyAccessApiService.postEmergencyAccessAccept).toHaveBeenCalledWith(id, {
          token: token,
        });
      });
    });

    describe("Step 3: confirm", () => {
      it("should post an emergency access confirmation", async () => {
        // Arrange
        const id = "some-id";
        const granteeId = "grantee-id";
        const mockUserKey = new SymmetricCryptoKey(new Uint8Array(64)) as UserKey;

        const mockPublicKeyB64 = "some-public-key-in-base64";

        // const publicKey = Utils.fromB64ToArray(publicKeyB64);

        const mockUserPublicKeyResponse = new UserKeyResponse({
          UserId: granteeId,
          PublicKey: mockPublicKeyB64,
        });

        const mockUserPublicKeyEncryptedUserKey = new EncString(
          EncryptionType.AesCbc256_HmacSha256_B64,
          "mockUserPublicKeyEncryptedUserKey",
        );

        cryptoService.getUserKey.mockResolvedValueOnce(mockUserKey);
        apiService.getUserPublicKey.mockResolvedValueOnce(mockUserPublicKeyResponse);

        cryptoService.rsaEncrypt.mockResolvedValueOnce(mockUserPublicKeyEncryptedUserKey);

        emergencyAccessApiService.postEmergencyAccessConfirm.mockResolvedValueOnce();

        // Act
        await emergencyAccessService.confirm(id, granteeId);

        // Assert
        expect(emergencyAccessApiService.postEmergencyAccessConfirm).toHaveBeenCalledWith(id, {
          key: mockUserPublicKeyEncryptedUserKey.encryptedString,
        });
      });
    });
  });

  describe("takeover", () => {
    const mockId = "emergencyAccessId";
    const mockEmail = "emergencyAccessEmail";
    const mockName = "emergencyAccessName";

    it("posts a new password when decryption succeeds", async () => {
      // Arrange
      emergencyAccessApiService.postEmergencyAccessTakeover.mockResolvedValueOnce({
        keyEncrypted: "EncryptedKey",
        kdf: KdfType.PBKDF2_SHA256,
        kdfIterations: 500,
      } as EmergencyAccessTakeoverResponse);

      const mockDecryptedGrantorUserKey = new Uint8Array(64);
      cryptoService.getPrivateKey.mockResolvedValue(new Uint8Array(64));
      cryptoService.rsaDecrypt.mockResolvedValueOnce(mockDecryptedGrantorUserKey);

      const mockMasterKey = new SymmetricCryptoKey(new Uint8Array(64) as CsprngArray) as MasterKey;

      cryptoService.makeMasterKey.mockResolvedValueOnce(mockMasterKey);

      const mockMasterKeyHash = "mockMasterKeyHash";
      cryptoService.hashMasterKey.mockResolvedValueOnce(mockMasterKeyHash);

      // must mock [UserKey, EncString] return from cryptoService.encryptUserKeyWithMasterKey
      // where UserKey is the decrypted grantor user key
      const mockMasterKeyEncryptedUserKey = new EncString(
        EncryptionType.AesCbc256_HmacSha256_B64,
        "mockMasterKeyEncryptedUserKey",
      );

      const mockUserKey = new SymmetricCryptoKey(mockDecryptedGrantorUserKey) as UserKey;

      cryptoService.encryptUserKeyWithMasterKey.mockResolvedValueOnce([
        mockUserKey,
        mockMasterKeyEncryptedUserKey,
      ]);

      const expectedEmergencyAccessPasswordRequest = new EmergencyAccessPasswordRequest();
      expectedEmergencyAccessPasswordRequest.newMasterPasswordHash = mockMasterKeyHash;
      expectedEmergencyAccessPasswordRequest.key = mockMasterKeyEncryptedUserKey.encryptedString;

      // Act
      await emergencyAccessService.takeover(mockId, mockEmail, mockName);

      // Assert
      expect(emergencyAccessApiService.postEmergencyAccessPassword).toHaveBeenCalledWith(
        mockId,
        expectedEmergencyAccessPasswordRequest,
      );
    });

    it("should not post a new password if decryption fails", async () => {
      cryptoService.rsaDecrypt.mockResolvedValueOnce(null);
      emergencyAccessApiService.postEmergencyAccessTakeover.mockResolvedValueOnce({
        keyEncrypted: "EncryptedKey",
        kdf: KdfType.PBKDF2_SHA256,
        kdfIterations: 500,
      } as EmergencyAccessTakeoverResponse);
      cryptoService.getPrivateKey.mockResolvedValue(new Uint8Array(64));

      await expect(
        emergencyAccessService.takeover(mockId, mockEmail, mockName),
      ).rejects.toThrowError("Failed to decrypt grantor key");

      expect(emergencyAccessApiService.postEmergencyAccessPassword).not.toHaveBeenCalled();
    });

    it("should throw an error if the users private key cannot be retrieved", async () => {
      emergencyAccessApiService.postEmergencyAccessTakeover.mockResolvedValueOnce({
        keyEncrypted: "EncryptedKey",
        kdf: KdfType.PBKDF2_SHA256,
        kdfIterations: 500,
      } as EmergencyAccessTakeoverResponse);
      cryptoService.getPrivateKey.mockResolvedValue(null);

      await expect(emergencyAccessService.takeover(mockId, mockEmail, mockName)).rejects.toThrow(
        "user does not have a private key",
      );

      expect(emergencyAccessApiService.postEmergencyAccessPassword).not.toHaveBeenCalled();
    });
  });

  describe("getRotatedKeys", () => {
    let mockUserKey: UserKey;
    const allowedStatuses = [
      EmergencyAccessStatusType.Confirmed,
      EmergencyAccessStatusType.RecoveryInitiated,
      EmergencyAccessStatusType.RecoveryApproved,
    ];

    const mockEmergencyAccess = {
      data: [
        createMockEmergencyAccess("0", "EA 0", EmergencyAccessStatusType.Invited),
        createMockEmergencyAccess("1", "EA 1", EmergencyAccessStatusType.Accepted),
        createMockEmergencyAccess("2", "EA 2", EmergencyAccessStatusType.Confirmed),
        createMockEmergencyAccess("3", "EA 3", EmergencyAccessStatusType.RecoveryInitiated),
        createMockEmergencyAccess("4", "EA 4", EmergencyAccessStatusType.RecoveryApproved),
      ],
    } as ListResponse<EmergencyAccessGranteeDetailsResponse>;

    beforeEach(() => {
      const mockRandomBytes = new Uint8Array(64) as CsprngArray;
      mockUserKey = new SymmetricCryptoKey(mockRandomBytes) as UserKey;

      emergencyAccessApiService.getEmergencyAccessTrusted.mockResolvedValue(mockEmergencyAccess);
      apiService.getUserPublicKey.mockResolvedValue({
        userId: "mockUserId",
        publicKey: "mockPublicKey",
      } as UserKeyResponse);

      cryptoService.rsaEncrypt.mockImplementation((plainValue, publicKey) => {
        return Promise.resolve(
          new EncString(EncryptionType.Rsa2048_OaepSha1_B64, "Encrypted: " + plainValue),
        );
      });
    });

    it("Only returns emergency accesses with allowed statuses", async () => {
      const result = await emergencyAccessService.getRotatedKeys(mockUserKey);

      expect(result).toHaveLength(allowedStatuses.length);
    });
  });
});

function createMockEmergencyAccess(
  id: string,
  name: string,
  status: EmergencyAccessStatusType,
): EmergencyAccessGranteeDetailsResponse {
  const emergencyAccess = new EmergencyAccessGranteeDetailsResponse({});
  emergencyAccess.id = id;
  emergencyAccess.name = name;
  emergencyAccess.type = 0;
  emergencyAccess.status = status;
  return emergencyAccess;
}
