// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { MockProxy } from "jest-mock-extended";
import mock from "jest-mock-extended/lib/Mock";
import { of } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import {
  MasterKeyWrappedUserKey,
  MasterPasswordAuthenticationData,
  MasterPasswordAuthenticationHash,
  MasterPasswordSalt,
  MasterPasswordUnlockData,
} from "@bitwarden/common/key-management/master-password/types/master-password.types";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { UserKeyResponse } from "@bitwarden/common/models/response/user-key.response";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { EncryptionType } from "@bitwarden/common/platform/enums";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { CsprngArray } from "@bitwarden/common/types/csprng";
import { UserId } from "@bitwarden/common/types/guid";
import { UserKey, MasterKey, UserPrivateKey } from "@bitwarden/common/types/key";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { newGuid } from "@bitwarden/guid";
import {
  Argon2KdfConfig,
  DEFAULT_KDF_CONFIG,
  KdfType,
  KeyService,
  PBKDF2KdfConfig,
} from "@bitwarden/key-management";

import { EmergencyAccessStatusType } from "../enums/emergency-access-status-type";
import { EmergencyAccessType } from "../enums/emergency-access-type";
import { GranteeEmergencyAccess, GrantorEmergencyAccess } from "../models/emergency-access";
import { EmergencyAccessPasswordRequest } from "../request/emergency-access-password.request";
import {
  EmergencyAccessGranteeDetailsResponse,
  EmergencyAccessGrantorDetailsResponse,
  EmergencyAccessTakeoverResponse,
  EmergencyAccessViewResponse,
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
  let masterPasswordService: MockProxy<InternalMasterPasswordServiceAbstraction>;
  let configService: MockProxy<ConfigService>;

  const mockNewUserKey = new SymmetricCryptoKey(new Uint8Array(64)) as UserKey;
  const mockTrustedPublicKeys = [Utils.fromUtf8ToArray("trustedPublicKey")];
  const mockUserId = newGuid() as UserId;

  beforeAll(() => {
    emergencyAccessApiService = mock<EmergencyAccessApiService>();
    apiService = mock<ApiService>();
    keyService = mock<KeyService>();
    encryptService = mock<EncryptService>();
    cipherService = mock<CipherService>();
    logService = mock<LogService>();
    masterPasswordService = mock<InternalMasterPasswordServiceAbstraction>();
    configService = mock<ConfigService>();

    emergencyAccessService = new EmergencyAccessService(
      emergencyAccessApiService,
      apiService,
      keyService,
      encryptService,
      cipherService,
      logService,
      masterPasswordService,
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

        const publicKey = new Uint8Array(64);

        const mockUserPublicKeyEncryptedUserKey = new EncString(
          EncryptionType.AesCbc256_HmacSha256_B64,
          "mockUserPublicKeyEncryptedUserKey",
        );

        keyService.userKey$.mockReturnValue(of(mockUserKey));

        encryptService.encapsulateKeyUnsigned.mockResolvedValueOnce(
          mockUserPublicKeyEncryptedUserKey,
        );

        emergencyAccessApiService.postEmergencyAccessConfirm.mockResolvedValueOnce();

        // Act
        await emergencyAccessService.confirm(id, granteeId, publicKey, mockUserId);

        // Assert
        expect(emergencyAccessApiService.postEmergencyAccessConfirm).toHaveBeenCalledWith(id, {
          key: mockUserPublicKeyEncryptedUserKey.encryptedString,
        });
      });
    });
  });

  describe("getViewOnlyCiphers", () => {
    const params = {
      id: "emergency-access-id",
      activeUserId: Utils.newGuid() as UserId,
    };

    it("throws an error is the active user's private key isn't available", async () => {
      keyService.userPrivateKey$.mockReturnValue(of(null));

      await expect(
        emergencyAccessService.getViewOnlyCiphers(params.id, params.activeUserId),
      ).rejects.toThrow("Active user does not have a private key, cannot get view only ciphers.");
    });

    it("should return decrypted and sorted ciphers", async () => {
      const emergencyAccessViewResponse = {
        keyEncrypted: "mockKeyEncrypted",
        ciphers: [
          { id: "cipher1", name: "encryptedName1" },
          { id: "cipher2", name: "encryptedName2" },
        ],
      } as EmergencyAccessViewResponse;

      const mockEncryptedCipher1 = {
        id: "cipher1",
        decrypt: jest.fn().mockResolvedValue({ id: "cipher1", decrypted: true }),
      };
      const mockEncryptedCipher2 = {
        id: "cipher2",
        decrypt: jest.fn().mockResolvedValue({ id: "cipher2", decrypted: true }),
      };
      emergencyAccessViewResponse.ciphers.map = jest.fn().mockImplementation(() => {
        return [mockEncryptedCipher1, mockEncryptedCipher2];
      });
      cipherService.getLocaleSortingFunction.mockReturnValue((a: any, b: any) =>
        a.id.localeCompare(b.id),
      );
      emergencyAccessApiService.postEmergencyAccessView.mockResolvedValue(
        emergencyAccessViewResponse,
      );

      const mockPrivateKey = new Uint8Array(64) as UserPrivateKey;
      keyService.userPrivateKey$.mockReturnValue(of(mockPrivateKey));

      const mockDecryptedGrantorUserKey = new SymmetricCryptoKey(new Uint8Array(64));
      encryptService.decapsulateKeyUnsigned.mockResolvedValueOnce(mockDecryptedGrantorUserKey);
      const mockGrantorUserKey = mockDecryptedGrantorUserKey as UserKey;

      const result = await emergencyAccessService.getViewOnlyCiphers(
        params.id,
        params.activeUserId,
      );

      expect(result).toEqual([
        { id: "cipher1", decrypted: true },
        { id: "cipher2", decrypted: true },
      ]);
      expect(mockEncryptedCipher1.decrypt).toHaveBeenCalledWith(mockGrantorUserKey);
      expect(mockEncryptedCipher2.decrypt).toHaveBeenCalledWith(mockGrantorUserKey);
      expect(emergencyAccessApiService.postEmergencyAccessView).toHaveBeenCalledWith(params.id);
      expect(keyService.userPrivateKey$).toHaveBeenCalledWith(params.activeUserId);
      expect(encryptService.decapsulateKeyUnsigned).toHaveBeenCalledWith(
        new EncString(emergencyAccessViewResponse.keyEncrypted),
        mockPrivateKey,
      );
      expect(cipherService.getLocaleSortingFunction).toHaveBeenCalled();
    });
  });

  /**
   * @deprecated This 'describe' to be removed in PM-28143. When you remove this, check also if there are any imports/properties
   * in the test setup above that are now un-used and can also be removed.
   */
  describe("takeover [PM27086_UpdateAuthenticationApisForInputPassword flag DISABLED]", () => {
    const PM27086_UpdateAuthenticationApisForInputPasswordEnabled = false;

    const params = {
      id: "emergencyAccessId",
      masterPassword: "mockPassword",
      email: "emergencyAccessEmail",
      activeUserId: Utils.newGuid() as UserId,
    };

    const takeoverResponse = {
      keyEncrypted: "EncryptedKey",
      kdf: KdfType.PBKDF2_SHA256,
      kdfIterations: 500,
    } as EmergencyAccessTakeoverResponse;

    const userPrivateKey = new Uint8Array(64) as UserPrivateKey;
    const mockMasterKey = new SymmetricCryptoKey(new Uint8Array(64) as CsprngArray) as MasterKey;
    const mockMasterKeyHash = "mockMasterKeyHash";
    let mockGrantorUserKey: UserKey;

    // must mock [UserKey, EncString] return from keyService.encryptUserKeyWithMasterKey
    // where UserKey is the decrypted grantor user key
    const mockMasterKeyEncryptedUserKey = new EncString(
      EncryptionType.AesCbc256_HmacSha256_B64,
      "mockMasterKeyEncryptedUserKey",
    );

    beforeEach(() => {
      configService.getFeatureFlag.mockResolvedValue(
        PM27086_UpdateAuthenticationApisForInputPasswordEnabled,
      );

      emergencyAccessApiService.postEmergencyAccessTakeover.mockResolvedValueOnce(takeoverResponse);
      keyService.userPrivateKey$.mockReturnValue(of(userPrivateKey));

      const mockDecryptedGrantorUserKey = new SymmetricCryptoKey(new Uint8Array(64));
      encryptService.decapsulateKeyUnsigned.mockResolvedValueOnce(mockDecryptedGrantorUserKey);
      mockGrantorUserKey = mockDecryptedGrantorUserKey as UserKey;

      keyService.makeMasterKey.mockResolvedValueOnce(mockMasterKey);
      keyService.hashMasterKey.mockResolvedValueOnce(mockMasterKeyHash);
      keyService.encryptUserKeyWithMasterKey.mockResolvedValueOnce([
        mockGrantorUserKey,
        mockMasterKeyEncryptedUserKey,
      ]);
    });

    it("posts a new password when decryption succeeds", async () => {
      // Arrange
      const expectedKdfConfig = new PBKDF2KdfConfig(takeoverResponse.kdfIterations);

      const expectedEmergencyAccessPasswordRequest = new EmergencyAccessPasswordRequest();
      expectedEmergencyAccessPasswordRequest.newMasterPasswordHash = mockMasterKeyHash;
      expectedEmergencyAccessPasswordRequest.key = mockMasterKeyEncryptedUserKey.encryptedString;

      // Act
      await emergencyAccessService.takeover(
        params.id,
        params.masterPassword,
        params.email,
        params.activeUserId,
      );

      // Assert
      expect(keyService.userPrivateKey$).toHaveBeenCalledWith(params.activeUserId);
      expect(encryptService.decapsulateKeyUnsigned).toHaveBeenCalledWith(
        new EncString(takeoverResponse.keyEncrypted),
        userPrivateKey,
      );
      expect(keyService.makeMasterKey).toHaveBeenCalledWith(
        params.masterPassword,
        params.email,
        expectedKdfConfig,
      );
      expect(keyService.hashMasterKey).toHaveBeenCalledWith(params.masterPassword, mockMasterKey);
      expect(keyService.encryptUserKeyWithMasterKey).toHaveBeenCalledWith(
        mockMasterKey,
        mockGrantorUserKey,
      );
      expect(emergencyAccessApiService.postEmergencyAccessPassword).toHaveBeenCalledWith(
        params.id,
        expectedEmergencyAccessPasswordRequest,
      );
    });

    it("uses argon2 KDF if takeover response is argon2", async () => {
      const argon2TakeoverResponse = {
        keyEncrypted: "EncryptedKey",
        kdf: KdfType.Argon2id,
        kdfIterations: 3,
        kdfMemory: 64,
        kdfParallelism: 4,
      } as EmergencyAccessTakeoverResponse;
      emergencyAccessApiService.postEmergencyAccessTakeover.mockReset();
      emergencyAccessApiService.postEmergencyAccessTakeover.mockResolvedValueOnce(
        argon2TakeoverResponse,
      );

      const expectedKdfConfig = new Argon2KdfConfig(
        argon2TakeoverResponse.kdfIterations,
        argon2TakeoverResponse.kdfMemory,
        argon2TakeoverResponse.kdfParallelism,
      );

      const expectedEmergencyAccessPasswordRequest = new EmergencyAccessPasswordRequest();
      expectedEmergencyAccessPasswordRequest.newMasterPasswordHash = mockMasterKeyHash;
      expectedEmergencyAccessPasswordRequest.key = mockMasterKeyEncryptedUserKey.encryptedString;

      await emergencyAccessService.takeover(
        params.id,
        params.masterPassword,
        params.email,
        params.activeUserId,
      );

      expect(keyService.userPrivateKey$).toHaveBeenCalledWith(params.activeUserId);
      expect(encryptService.decapsulateKeyUnsigned).toHaveBeenCalledWith(
        new EncString(argon2TakeoverResponse.keyEncrypted),
        userPrivateKey,
      );
      expect(keyService.makeMasterKey).toHaveBeenCalledWith(
        params.masterPassword,
        params.email,
        expectedKdfConfig,
      );
      expect(keyService.hashMasterKey).toHaveBeenCalledWith(params.masterPassword, mockMasterKey);
      expect(keyService.encryptUserKeyWithMasterKey).toHaveBeenCalledWith(
        mockMasterKey,
        mockGrantorUserKey,
      );
      expect(emergencyAccessApiService.postEmergencyAccessPassword).toHaveBeenCalledWith(
        params.id,
        expectedEmergencyAccessPasswordRequest,
      );
    });

    it("throws an error if masterKeyEncryptedUserKey is not found", async () => {
      keyService.encryptUserKeyWithMasterKey.mockReset();
      keyService.encryptUserKeyWithMasterKey.mockResolvedValueOnce(null);
      const expectedKdfConfig = new PBKDF2KdfConfig(takeoverResponse.kdfIterations);

      await expect(
        emergencyAccessService.takeover(
          params.id,
          params.masterPassword,
          params.email,
          params.activeUserId,
        ),
      ).rejects.toThrow("masterKeyEncryptedUserKey not found");

      expect(keyService.userPrivateKey$).toHaveBeenCalledWith(params.activeUserId);
      expect(encryptService.decapsulateKeyUnsigned).toHaveBeenCalledWith(
        new EncString(takeoverResponse.keyEncrypted),
        userPrivateKey,
      );
      expect(keyService.makeMasterKey).toHaveBeenCalledWith(
        params.masterPassword,
        params.email,
        expectedKdfConfig,
      );
      expect(keyService.hashMasterKey).toHaveBeenCalledWith(params.masterPassword, mockMasterKey);
      expect(keyService.encryptUserKeyWithMasterKey).toHaveBeenCalledWith(
        mockMasterKey,
        mockGrantorUserKey,
      );
      expect(emergencyAccessApiService.postEmergencyAccessPassword).not.toHaveBeenCalled();
    });

    it("should not post a new password if decryption fails", async () => {
      emergencyAccessApiService.postEmergencyAccessTakeover.mockResolvedValueOnce(takeoverResponse);
      encryptService.decapsulateKeyUnsigned.mockReset();
      encryptService.decapsulateKeyUnsigned.mockResolvedValueOnce(null);

      await expect(
        emergencyAccessService.takeover(
          params.id,
          params.masterPassword,
          params.email,
          params.activeUserId,
        ),
      ).rejects.toThrow("Failed to decrypt grantor key");

      expect(keyService.userPrivateKey$).toHaveBeenCalledWith(params.activeUserId);
      expect(encryptService.decapsulateKeyUnsigned).toHaveBeenCalledWith(
        new EncString(takeoverResponse.keyEncrypted),
        userPrivateKey,
      );
      expect(keyService.makeMasterKey).not.toHaveBeenCalled();
      expect(keyService.hashMasterKey).not.toHaveBeenCalled();
      expect(keyService.encryptUserKeyWithMasterKey).not.toHaveBeenCalled();
      expect(emergencyAccessApiService.postEmergencyAccessPassword).not.toHaveBeenCalled();
    });

    it("should not post a new password if decryption throws", async () => {
      encryptService.decapsulateKeyUnsigned.mockReset();
      encryptService.decapsulateKeyUnsigned.mockImplementationOnce(() => {
        throw new Error("Failed to unwrap grantor key");
      });

      await expect(
        emergencyAccessService.takeover(
          params.id,
          params.masterPassword,
          params.email,
          params.activeUserId,
        ),
      ).rejects.toThrowError("Failed to unwrap grantor key");

      expect(keyService.userPrivateKey$).toHaveBeenCalledWith(params.activeUserId);
      expect(encryptService.decapsulateKeyUnsigned).toHaveBeenCalledWith(
        new EncString(takeoverResponse.keyEncrypted),
        userPrivateKey,
      );
      expect(keyService.makeMasterKey).not.toHaveBeenCalled();
      expect(keyService.hashMasterKey).not.toHaveBeenCalled();
      expect(keyService.encryptUserKeyWithMasterKey).not.toHaveBeenCalled();
      expect(emergencyAccessApiService.postEmergencyAccessPassword).not.toHaveBeenCalled();
    });

    it("should throw an error if the users private key cannot be retrieved", async () => {
      keyService.userPrivateKey$.mockReturnValue(of(null));

      await expect(
        emergencyAccessService.takeover(
          params.id,
          params.masterPassword,
          params.email,
          params.activeUserId,
        ),
      ).rejects.toThrow("user does not have a private key");

      expect(keyService.userPrivateKey$).toHaveBeenCalledWith(params.activeUserId);
      expect(encryptService.decapsulateKeyUnsigned).not.toHaveBeenCalled();
      expect(keyService.makeMasterKey).not.toHaveBeenCalled();
      expect(keyService.hashMasterKey).not.toHaveBeenCalled();
      expect(keyService.encryptUserKeyWithMasterKey).not.toHaveBeenCalled();
      expect(emergencyAccessApiService.postEmergencyAccessPassword).not.toHaveBeenCalled();
    });
  });

  describe("takeover [PM27086_UpdateAuthenticationApisForInputPassword flag ENABLED]", () => {
    // Mock feature flag value
    const PM27086_UpdateAuthenticationApisForInputPasswordEnabled = true;

    // Mock sut method params
    const id = "emergency-access-id";
    const masterPassword = "mockPassword";
    const email = "user@example.com";
    const activeUserId = newGuid() as UserId;

    // Mock method data
    const kdfConfig = DEFAULT_KDF_CONFIG;

    const takeoverResponse = {
      keyEncrypted: "EncryptedKey",
      kdf: kdfConfig.kdfType,
      kdfIterations: kdfConfig.iterations,
    } as EmergencyAccessTakeoverResponse;

    const activeUserPrivateKey = new Uint8Array(64) as UserPrivateKey;
    let mockGrantorUserKey: UserKey;
    let salt: MasterPasswordSalt;
    let authenticationData: MasterPasswordAuthenticationData;
    let unlockData: MasterPasswordUnlockData;

    beforeEach(() => {
      configService.getFeatureFlag.mockResolvedValue(
        PM27086_UpdateAuthenticationApisForInputPasswordEnabled,
      );

      emergencyAccessApiService.postEmergencyAccessTakeover.mockResolvedValue(takeoverResponse);
      keyService.userPrivateKey$.mockReturnValue(of(activeUserPrivateKey));

      const mockDecryptedGrantorUserKey = new SymmetricCryptoKey(new Uint8Array(64));
      encryptService.decapsulateKeyUnsigned.mockResolvedValue(mockDecryptedGrantorUserKey);
      mockGrantorUserKey = mockDecryptedGrantorUserKey as UserKey;

      salt = email as MasterPasswordSalt;
      masterPasswordService.emailToSalt.mockReturnValue(salt);

      authenticationData = {
        salt,
        kdf: kdfConfig,
        masterPasswordAuthenticationHash:
          "masterPasswordAuthenticationHash" as MasterPasswordAuthenticationHash,
      };

      unlockData = {
        salt,
        kdf: kdfConfig,
        masterKeyWrappedUserKey: "masterKeyWrappedUserKey" as MasterKeyWrappedUserKey,
      } as MasterPasswordUnlockData;

      masterPasswordService.makeMasterPasswordAuthenticationData.mockResolvedValue(
        authenticationData,
      );
      masterPasswordService.makeMasterPasswordUnlockData.mockResolvedValue(unlockData);
    });

    it("should throw if active user private key is not found", async () => {
      // Arrange
      keyService.userPrivateKey$.mockReturnValue(of(null));

      // Act
      const promise = emergencyAccessService.takeover(id, masterPassword, email, activeUserId);

      // Assert
      await expect(promise).rejects.toThrow(
        "Active user does not have a private key, cannot complete a takeover.",
      );
      expect(emergencyAccessApiService.postEmergencyAccessPassword).not.toHaveBeenCalled();
    });

    it("should throw if the grantor user key cannot be decrypted via the active user private key", async () => {
      // Arrange
      encryptService.decapsulateKeyUnsigned.mockResolvedValue(null);

      // Act
      const promise = emergencyAccessService.takeover(id, masterPassword, email, activeUserId);

      // Assert
      await expect(promise).rejects.toThrow("Failed to decrypt grantor key");
      expect(emergencyAccessApiService.postEmergencyAccessPassword).not.toHaveBeenCalled();
    });

    it("should use PBKDF2 if takeover response contains KdfType.PBKDF2_SHA256", async () => {
      // Act
      await emergencyAccessService.takeover(id, masterPassword, email, activeUserId);

      // Assert
      expect(masterPasswordService.makeMasterPasswordAuthenticationData).toHaveBeenCalledWith(
        masterPassword,
        kdfConfig, // default config (PBKDF2)
        salt,
      );
    });

    it("should use Argon2 if takeover response contains KdfType.Argon2id", async () => {
      // Arrange
      const argon2TakeoverResponse = {
        keyEncrypted: "EncryptedKey",
        kdf: KdfType.Argon2id,
        kdfIterations: 3,
        kdfMemory: 64,
        kdfParallelism: 4,
      } as EmergencyAccessTakeoverResponse;

      emergencyAccessApiService.postEmergencyAccessTakeover.mockResolvedValue(
        argon2TakeoverResponse,
      );

      const expectedKdfConfig = new Argon2KdfConfig(
        argon2TakeoverResponse.kdfIterations,
        argon2TakeoverResponse.kdfMemory,
        argon2TakeoverResponse.kdfParallelism,
      );

      // Act
      await emergencyAccessService.takeover(id, masterPassword, email, activeUserId);

      // Assert
      expect(masterPasswordService.makeMasterPasswordAuthenticationData).toHaveBeenCalledWith(
        masterPassword,
        expectedKdfConfig,
        salt,
      );
      expect(masterPasswordService.makeMasterPasswordAuthenticationData).not.toHaveBeenCalledWith(
        masterPassword,
        kdfConfig, // default config (PBKDF2)
        salt,
      );
    });

    it("should call makeMasterPasswordAuthenticationData and makeMasterPasswordUnlockData with the correct parameters", async () => {
      // Act
      await emergencyAccessService.takeover(id, masterPassword, email, activeUserId);

      // Assert
      const request = EmergencyAccessPasswordRequest.newConstructor(authenticationData, unlockData);

      expect(masterPasswordService.makeMasterPasswordAuthenticationData).toHaveBeenCalledWith(
        masterPassword,
        kdfConfig,
        salt,
      );

      expect(masterPasswordService.makeMasterPasswordUnlockData).toHaveBeenCalledWith(
        masterPassword,
        kdfConfig,
        salt,
        mockGrantorUserKey,
      );

      expect(emergencyAccessApiService.postEmergencyAccessPassword).toHaveBeenCalledWith(
        id,
        request,
      );
    });

    it("should call the API method to change the grantor's master password", async () => {
      // Act
      await emergencyAccessService.takeover(id, masterPassword, email, activeUserId);

      // Assert
      const request = EmergencyAccessPasswordRequest.newConstructor(authenticationData, unlockData);

      expect(emergencyAccessApiService.postEmergencyAccessPassword).toHaveBeenCalledTimes(1);
      expect(emergencyAccessApiService.postEmergencyAccessPassword).toHaveBeenCalledWith(
        id,
        request,
      );
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
