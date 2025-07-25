// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { MockProxy } from "jest-mock-extended";
import mock from "jest-mock-extended/lib/Mock";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { UserKeyResponse } from "@bitwarden/common/models/response/user-key.response";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { EncryptionType } from "@bitwarden/common/platform/enums";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { CsprngArray } from "@bitwarden/common/types/csprng";
import { UserId } from "@bitwarden/common/types/guid";
import { UserKey, MasterKey } from "@bitwarden/common/types/key";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { KdfType, KeyService } from "@bitwarden/key-management";

import { EmergencyAccessStatusType } from "../enums/emergency-access-status-type";
import { EmergencyAccessType } from "../enums/emergency-access-type";
import { GranteeEmergencyAccess, GrantorEmergencyAccess } from "../models/emergency-access";
import { EmergencyAccessPasswordRequest } from "../request/emergency-access-password.request";
import {
  EmergencyAccessGranteeDetailsResponse,
  EmergencyAccessGrantorDetailsResponse,
  EmergencyAccessTakeoverResponse,
} from "../response/emergency-access.response";

import { EmergencyAccessApiService } from "./emergency-access-api.service";
import { EmergencyAccessService } from "./emergency-access.service";

describe("EmergencyAccessService", () => {
  let emergencyAccessApiService: MockProxy<EmergencyAccessApiService>;
  let apiService: MockProxy<ApiService>;
  let keyService: MockProxy<KeyService>;
  let encryptService: MockProxy<EncryptService>;
  let cipherService: MockProxy<CipherService>;
  let logService: MockProxy<LogService>;
  let emergencyAccessService: EmergencyAccessService;

  const mockNewUserKey = new SymmetricCryptoKey(new Uint8Array(64)) as UserKey;
  const mockTrustedPublicKeys = [Utils.fromUtf8ToArray("trustedPublicKey")];

  beforeAll(() => {
    emergencyAccessApiService = mock<EmergencyAccessApiService>();
    apiService = mock<ApiService>();
    keyService = mock<KeyService>();
    encryptService = mock<EncryptService>();
    cipherService = mock<CipherService>();
    logService = mock<LogService>();

    emergencyAccessService = new EmergencyAccessService(
      emergencyAccessApiService,
      apiService,
      keyService,
      encryptService,
      cipherService,
      logService,
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

        const publicKey = new Uint8Array(64);

        const mockUserPublicKeyEncryptedUserKey = new EncString(
          EncryptionType.AesCbc256_HmacSha256_B64,
          "mockUserPublicKeyEncryptedUserKey",
        );

        keyService.getUserKey.mockResolvedValueOnce(mockUserKey);

        encryptService.encapsulateKeyUnsigned.mockResolvedValueOnce(
          mockUserPublicKeyEncryptedUserKey,
        );

        emergencyAccessApiService.postEmergencyAccessConfirm.mockResolvedValueOnce();

        // Act
        await emergencyAccessService.confirm(id, granteeId, publicKey);

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
      keyService.getPrivateKey.mockResolvedValue(new Uint8Array(64));
      encryptService.decapsulateKeyUnsigned.mockResolvedValueOnce(
        new SymmetricCryptoKey(mockDecryptedGrantorUserKey),
      );

      const mockMasterKey = new SymmetricCryptoKey(new Uint8Array(64) as CsprngArray) as MasterKey;

      keyService.makeMasterKey.mockResolvedValueOnce(mockMasterKey);

      const mockMasterKeyHash = "mockMasterKeyHash";
      keyService.hashMasterKey.mockResolvedValueOnce(mockMasterKeyHash);

      // must mock [UserKey, EncString] return from keyService.encryptUserKeyWithMasterKey
      // where UserKey is the decrypted grantor user key
      const mockMasterKeyEncryptedUserKey = new EncString(
        EncryptionType.AesCbc256_HmacSha256_B64,
        "mockMasterKeyEncryptedUserKey",
      );

      const mockUserKey = new SymmetricCryptoKey(mockDecryptedGrantorUserKey) as UserKey;

      keyService.encryptUserKeyWithMasterKey.mockResolvedValueOnce([
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
      encryptService.rsaDecrypt.mockResolvedValueOnce(null);
      emergencyAccessApiService.postEmergencyAccessTakeover.mockResolvedValueOnce({
        keyEncrypted: "EncryptedKey",
        kdf: KdfType.PBKDF2_SHA256,
        kdfIterations: 500,
      } as EmergencyAccessTakeoverResponse);
      keyService.getPrivateKey.mockResolvedValue(new Uint8Array(64));

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
      keyService.getPrivateKey.mockResolvedValue(null);

      await expect(emergencyAccessService.takeover(mockId, mockEmail, mockName)).rejects.toThrow(
        "user does not have a private key",
      );

      expect(emergencyAccessApiService.postEmergencyAccessPassword).not.toHaveBeenCalled();
    });
  });

  describe("getRotatedData", () => {
    const allowedStatuses = [
      EmergencyAccessStatusType.Confirmed,
      EmergencyAccessStatusType.RecoveryInitiated,
      EmergencyAccessStatusType.RecoveryApproved,
    ];

    const mockEmergencyAccess = {
      data: [
        createMockEmergencyAccessGranteeDetails("0", "EA 0", EmergencyAccessStatusType.Invited),
        createMockEmergencyAccessGranteeDetails("1", "EA 1", EmergencyAccessStatusType.Accepted),
        createMockEmergencyAccessGranteeDetails("2", "EA 2", EmergencyAccessStatusType.Confirmed),
        createMockEmergencyAccessGranteeDetails(
          "3",
          "EA 3",
          EmergencyAccessStatusType.RecoveryInitiated,
        ),
        createMockEmergencyAccessGranteeDetails(
          "4",
          "EA 4",
          EmergencyAccessStatusType.RecoveryApproved,
        ),
      ],
    } as ListResponse<EmergencyAccessGranteeDetailsResponse>;

    beforeEach(() => {
      emergencyAccessApiService.getEmergencyAccessTrusted.mockResolvedValue(mockEmergencyAccess);
      apiService.getUserPublicKey.mockResolvedValue({
        userId: "mockUserId",
        publicKey: Utils.fromUtf8ToB64("trustedPublicKey"),
      } as UserKeyResponse);

      encryptService.encapsulateKeyUnsigned.mockImplementation((plainValue, publicKey) => {
        return Promise.resolve(
          new EncString(EncryptionType.Rsa2048_OaepSha1_B64, "Encrypted: " + plainValue),
        );
      });
    });

    it("Only returns emergency accesses with allowed statuses", async () => {
      const result = await emergencyAccessService.getRotatedData(
        mockNewUserKey,
        mockTrustedPublicKeys,
        "mockUserId" as UserId,
      );

      expect(result).toHaveLength(allowedStatuses.length);
    });

    it("Throws if emergency access public key is not trusted", async () => {
      apiService.getUserPublicKey.mockResolvedValue({
        userId: "mockUserId",
        publicKey: Utils.fromUtf8ToB64("untrustedPublicKey"),
      } as UserKeyResponse);

      await expect(
        emergencyAccessService.getRotatedData(
          mockNewUserKey,
          mockTrustedPublicKeys,
          "mockUserId" as UserId,
        ),
      ).rejects.toThrow("Public key for user is not trusted.");
    });

    it("throws if new user key is null", async () => {
      await expect(
        emergencyAccessService.getRotatedData(null, mockTrustedPublicKeys, "mockUserId" as UserId),
      ).rejects.toThrow("New user key is required for rotation.");
    });
  });

  describe("getEmergencyAccessTrusted", () => {
    it("should return an empty array if no emergency access is granted", async () => {
      emergencyAccessApiService.getEmergencyAccessTrusted.mockResolvedValue({
        data: [],
      } as ListResponse<EmergencyAccessGranteeDetailsResponse>);

      const result = await emergencyAccessService.getEmergencyAccessTrusted();

      expect(result).toEqual([]);
    });

    it("should return an empty array if the API returns an empty response", async () => {
      emergencyAccessApiService.getEmergencyAccessTrusted.mockResolvedValue(
        null as unknown as ListResponse<EmergencyAccessGranteeDetailsResponse>,
      );

      const result = await emergencyAccessService.getEmergencyAccessTrusted();

      expect(result).toEqual([]);
    });

    it("should return a list of trusted emergency access contacts", async () => {
      const mockEmergencyAccess = [
        createMockEmergencyAccessGranteeDetails("1", "EA 1", EmergencyAccessStatusType.Invited),
        createMockEmergencyAccessGranteeDetails("2", "EA 2", EmergencyAccessStatusType.Invited),
        createMockEmergencyAccessGranteeDetails("3", "EA 3", EmergencyAccessStatusType.Accepted),
        createMockEmergencyAccessGranteeDetails("4", "EA 4", EmergencyAccessStatusType.Confirmed),
        createMockEmergencyAccessGranteeDetails(
          "5",
          "EA 5",
          EmergencyAccessStatusType.RecoveryInitiated,
        ),
      ];
      emergencyAccessApiService.getEmergencyAccessTrusted.mockResolvedValue({
        data: mockEmergencyAccess,
      } as ListResponse<EmergencyAccessGranteeDetailsResponse>);

      const result = await emergencyAccessService.getEmergencyAccessTrusted();

      expect(result).toHaveLength(mockEmergencyAccess.length);

      result.forEach((access, index) => {
        expect(access).toBeInstanceOf(GranteeEmergencyAccess);

        expect(access.id).toBe(mockEmergencyAccess[index].id);
        expect(access.name).toBe(mockEmergencyAccess[index].name);
        expect(access.status).toBe(mockEmergencyAccess[index].status);
        expect(access.type).toBe(mockEmergencyAccess[index].type);
      });
    });
  });

  describe("getEmergencyAccessGranted", () => {
    it("should return an empty array if no emergency access is granted", async () => {
      emergencyAccessApiService.getEmergencyAccessGranted.mockResolvedValue({
        data: [],
      } as ListResponse<EmergencyAccessGrantorDetailsResponse>);

      const result = await emergencyAccessService.getEmergencyAccessGranted();

      expect(result).toEqual([]);
    });

    it("should return an empty array if the API returns an empty response", async () => {
      emergencyAccessApiService.getEmergencyAccessGranted.mockResolvedValue(
        null as unknown as ListResponse<EmergencyAccessGrantorDetailsResponse>,
      );

      const result = await emergencyAccessService.getEmergencyAccessGranted();

      expect(result).toEqual([]);
    });

    it("should return a list of granted emergency access contacts", async () => {
      const mockEmergencyAccess = [
        createMockEmergencyAccessGrantorDetails("1", "EA 1", EmergencyAccessStatusType.Invited),
        createMockEmergencyAccessGrantorDetails("2", "EA 2", EmergencyAccessStatusType.Invited),
        createMockEmergencyAccessGrantorDetails("3", "EA 3", EmergencyAccessStatusType.Accepted),
        createMockEmergencyAccessGrantorDetails("4", "EA 4", EmergencyAccessStatusType.Confirmed),
        createMockEmergencyAccessGrantorDetails(
          "5",
          "EA 5",
          EmergencyAccessStatusType.RecoveryInitiated,
        ),
      ];
      emergencyAccessApiService.getEmergencyAccessGranted.mockResolvedValue({
        data: mockEmergencyAccess,
      } as ListResponse<EmergencyAccessGrantorDetailsResponse>);

      const result = await emergencyAccessService.getEmergencyAccessGranted();

      expect(result).toHaveLength(mockEmergencyAccess.length);

      result.forEach((access, index) => {
        expect(access).toBeInstanceOf(GrantorEmergencyAccess);

        expect(access.id).toBe(mockEmergencyAccess[index].id);
        expect(access.name).toBe(mockEmergencyAccess[index].name);
        expect(access.status).toBe(mockEmergencyAccess[index].status);
        expect(access.type).toBe(mockEmergencyAccess[index].type);
      });
    });
  });
});

function createMockEmergencyAccessGranteeDetails(
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

function createMockEmergencyAccessGrantorDetails(
  id: string,
  name: string,
  status: EmergencyAccessStatusType,
): EmergencyAccessGrantorDetailsResponse {
  const emergencyAccess = new EmergencyAccessGrantorDetailsResponse({});
  emergencyAccess.id = id;
  emergencyAccess.name = name;
  emergencyAccess.type = 0;
  emergencyAccess.status = status;
  return emergencyAccess;
}
