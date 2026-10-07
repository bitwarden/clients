import { MockProxy } from "jest-mock-extended";
import mock from "jest-mock-extended/lib/Mock";
import { of } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";
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
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { MockSdkService } from "@bitwarden/common/platform/spec/mock-sdk.service";
import { mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { UserKey, UserPrivateKey } from "@bitwarden/common/types/key";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { newGuid } from "@bitwarden/guid";
import { KeyService } from "@bitwarden/key-management";
// eslint-disable-next-line no-restricted-imports
import {
  Argon2KdfConfig,
  DEFAULT_KDF_CONFIG,
  EncryptionType,
  EncryptService,
  EncString,
  KdfType,
  LegacyCompatKeyService,
  SymmetricCryptoKey,
} from "@bitwarden/legacy-crypto";
import {
  Cipher as SdkCipher,
  CipherView as SdkCipherView,
  DecryptCipherResult,
  EmergencyAccessClient,
  GranteeEmergencyAccess as SdkGranteeEmergencyAccess,
  GrantorEmergencyAccess as SdkGrantorEmergencyAccess,
  Policy as SdkPolicy,
} from "@bitwarden/sdk-internal";

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
  let legacyCompatKeyService: MockProxy<LegacyCompatKeyService>;
  let encryptService: MockProxy<EncryptService>;
  let cipherService: MockProxy<CipherService>;
  let logService: MockProxy<LogService>;
  let emergencyAccessService: EmergencyAccessService;
  let masterPasswordService: MockProxy<InternalMasterPasswordServiceAbstraction>;
  let sdkService: MockSdkService;
  let configService: MockProxy<ConfigService>;

  const mockNewUserKey = new SymmetricCryptoKey(new Uint8Array(64)) as UserKey;
  const mockTrustedPublicKeys = [Utils.fromUtf8ToArray("trustedPublicKey")];
  const mockUserId = newGuid() as UserId;

  beforeAll(() => {
    emergencyAccessApiService = mock<EmergencyAccessApiService>();
    apiService = mock<ApiService>();
    keyService = mock<KeyService>();
    legacyCompatKeyService = mock<LegacyCompatKeyService>();
    encryptService = mock<EncryptService>();
    cipherService = mock<CipherService>();
    logService = mock<LogService>();
    masterPasswordService = mock<InternalMasterPasswordServiceAbstraction>();
    sdkService = new MockSdkService();
    configService = mock<ConfigService>();

    emergencyAccessService = new EmergencyAccessService(
      emergencyAccessApiService,
      apiService,
      keyService,
      legacyCompatKeyService,
      encryptService,
      cipherService,
      logService,
      masterPasswordService,
      sdkService,
      mockAccountServiceWith(mockUserId),
      configService,
    );
  });

  beforeEach(() => {
    configService.getFeatureFlag.mockResolvedValue(false);
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
      id: Utils.newGuid(),
      activeUserId: Utils.newGuid() as UserId,
    };

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("throws an error is the active user's private key isn't available", async () => {
      keyService.userPrivateKey$.mockReturnValue(of(null));

      await expect(
        emergencyAccessService.getViewOnlyCiphers(params.id, params.activeUserId),
      ).rejects.toThrow("Active user does not have a private key, cannot get view only ciphers.");
    });

    it("should return ciphers fetched and decrypted by the SDK, sorted", async () => {
      keyService.userPrivateKey$.mockReturnValue(of(new Uint8Array(64) as UserPrivateKey));
      const viewCiphers = mockSdkViewCiphers(params.activeUserId, {
        successes: [
          { id: "cipher2" } as unknown as SdkCipherView,
          { id: "cipher1" } as unknown as SdkCipherView,
        ],
        failures: [],
      });
      jest
        .spyOn(CipherView, "fromSdkCipherView")
        .mockImplementation((view) => ({ id: view.id }) as unknown as CipherView);
      cipherService.getLocaleSortingFunction.mockReturnValue((a: any, b: any) =>
        a.id.localeCompare(b.id),
      );

      const result = await emergencyAccessService.getViewOnlyCiphers(
        params.id,
        params.activeUserId,
      );

      expect(result).toEqual([{ id: "cipher1" }, { id: "cipher2" }]);
      expect(viewCiphers).toHaveBeenCalledWith(params.id);
      expect(encryptService.decapsulateKeyUnsigned).not.toHaveBeenCalled();
    });

    it("should mark ciphers that failed to decrypt", async () => {
      keyService.userPrivateKey$.mockReturnValue(of(new Uint8Array(64) as UserPrivateKey));
      mockSdkViewCiphers(params.activeUserId, {
        successes: [],
        failures: [{} as SdkCipher],
      });
      const failedCipher = new Cipher();
      failedCipher.id = "cipher1";
      jest.spyOn(Cipher, "fromSdkCipher").mockReturnValue(failedCipher);
      cipherService.getLocaleSortingFunction.mockReturnValue(() => 0);

      const result = await emergencyAccessService.getViewOnlyCiphers(
        params.id,
        params.activeUserId,
      );

      expect(result).toHaveLength(1);
      expect(result[0].id).toEqual("cipher1");
      expect(result[0].name).toEqual("[error: cannot decrypt]");
      expect(result[0].decryptionFailure).toBe(true);
    });

    /** Makes the user's SDK client return `result` from `emergency_access().view_vault_items`. */
    function mockSdkViewCiphers(userId: UserId, result: DecryptCipherResult): jest.Mock {
      const viewCiphers = jest.fn().mockResolvedValue(result);
      const sdkClient = sdkService.simulate.userLogin(userId);
      (sdkClient as any).emergency_access = jest
        .fn()
        .mockReturnValue({ view_vault_items: viewCiphers });
      return viewCiphers;
    }
  });

  describe("takeover", () => {
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
      encryptService.decapsulateKeyUnsigned.mockResolvedValue(
        null as unknown as SymmetricCryptoKey,
      );

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
        argon2TakeoverResponse.kdfMemory!,
        argon2TakeoverResponse.kdfParallelism!,
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
      const request = new EmergencyAccessPasswordRequest(authenticationData, unlockData);

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
      const request = new EmergencyAccessPasswordRequest(authenticationData, unlockData);

      expect(emergencyAccessApiService.postEmergencyAccessPassword).toHaveBeenCalledTimes(1);
      expect(emergencyAccessApiService.postEmergencyAccessPassword).toHaveBeenCalledWith(
        id,
        request,
      );
    });

    it("should use server-provided salt when present in takeover response", async () => {
      // Arrange
      const serverSalt = "server-provided-salt";
      const serverSaltAsMasterPasswordSalt = serverSalt as MasterPasswordSalt;

      const takeoverResponseWithSalt = {
        ...takeoverResponse,
        salt: serverSalt,
      } as EmergencyAccessTakeoverResponse;

      emergencyAccessApiService.postEmergencyAccessTakeover.mockResolvedValue(
        takeoverResponseWithSalt,
      );

      // Act
      await emergencyAccessService.takeover(id, masterPassword, email, activeUserId);

      // Assert
      expect(masterPasswordService.emailToSalt).not.toHaveBeenCalled();
      expect(masterPasswordService.makeMasterPasswordAuthenticationData).toHaveBeenCalledWith(
        masterPassword,
        kdfConfig,
        serverSaltAsMasterPasswordSalt,
      );
      expect(masterPasswordService.makeMasterPasswordUnlockData).toHaveBeenCalledWith(
        masterPassword,
        kdfConfig,
        serverSaltAsMasterPasswordSalt,
        mockGrantorUserKey,
      );
    });

    it("should fall back to emailToSalt when salt is absent from takeover response", async () => {
      // Arrange — takeoverResponse in beforeEach has no salt property (undefined)

      // Act
      await emergencyAccessService.takeover(id, masterPassword, email, activeUserId);

      // Assert
      expect(masterPasswordService.emailToSalt).toHaveBeenCalledWith(email);
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
    });

    it("should fall back to emailToSalt when response salt is explicitly null", async () => {
      // Arrange
      const takeoverResponseWithNullSalt = {
        ...takeoverResponse,
        salt: null,
      } as unknown as EmergencyAccessTakeoverResponse;

      emergencyAccessApiService.postEmergencyAccessTakeover.mockResolvedValue(
        takeoverResponseWithNullSalt,
      );

      // Act
      await emergencyAccessService.takeover(id, masterPassword, email, activeUserId);

      // Assert
      expect(masterPasswordService.emailToSalt).toHaveBeenCalledWith(email);
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
        emergencyAccessService.getRotatedData(
          null as unknown as UserKey,
          mockTrustedPublicKeys,
          "mockUserId" as UserId,
        ),
      ).rejects.toThrow("New user key is required for rotation.");
    });
  });

  describe("getEmergencyAccessTrusted", () => {
    it("should return an empty array if no emergency access is granted", async () => {
      emergencyAccessApiService.getEmergencyAccessTrusted.mockResolvedValue(
        new ListResponse({ Data: [] }, EmergencyAccessGranteeDetailsResponse),
      );

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
      emergencyAccessApiService.getEmergencyAccessGranted.mockResolvedValue(
        new ListResponse({ Data: [] }, EmergencyAccessGrantorDetailsResponse),
      );

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

  describe("with the SDK flag on", () => {
    const emergencyAccessId = newGuid();

    beforeEach(() => {
      configService.getFeatureFlag.mockResolvedValue(true);
    });

    describe("3 step setup process", () => {
      afterEach(() => {
        jest.resetAllMocks();
      });

      describe("Step 1: invite", () => {
        it("should invite through the active user's SDK client", async () => {
          // Arrange
          const email = "test@example.com";
          const type = EmergencyAccessType.View;
          const waitTimeDays = 5;
          const client = mockEmergencyAccessClient(mockUserId);

          // Act
          await emergencyAccessService.invite(email, type, waitTimeDays);

          // Assert
          expect(client.invite).toHaveBeenCalledWith(email, type, waitTimeDays);
        });
      });

      describe("Step 2: accept", () => {
        it("should accept through the active user's SDK client", async () => {
          // Arrange
          const token = "some-token";
          const client = mockEmergencyAccessClient(mockUserId);

          // Act
          await emergencyAccessService.accept(emergencyAccessId, token);

          // Assert
          expect(client.accept).toHaveBeenCalledWith(emergencyAccessId, token);
        });
      });

      describe("Step 3: confirm", () => {
        it("should pass the verified public key to the SDK", async () => {
          // Arrange
          const granteeId = "grantee-id";
          const activeUserId = newGuid() as UserId;
          const publicKey = new Uint8Array(64);
          const client = mockEmergencyAccessClient(activeUserId);

          // Act
          await emergencyAccessService.confirm(
            emergencyAccessId,
            granteeId,
            publicKey,
            activeUserId,
          );

          // Assert
          expect(client.confirm).toHaveBeenCalledWith(
            emergencyAccessId,
            Utils.fromBufferToB64(publicKey),
          );
          expect(encryptService.encapsulateKeyUnsigned).not.toHaveBeenCalled();
        });
      });
    });

    describe("status changes", () => {
      it.each([
        ["reinvite", "reinvite"],
        ["delete", "delete"],
        ["requestAccess", "initiate"],
        ["approve", "approve"],
        ["reject", "reject"],
      ] as const)("%s should call %s on the SDK client", async (method, sdkMethod) => {
        const client = mockEmergencyAccessClient(mockUserId);

        await emergencyAccessService[method](emergencyAccessId);

        expect(client[sdkMethod]).toHaveBeenCalledWith(emergencyAccessId);
      });

      it("update should send the type and wait time", async () => {
        const client = mockEmergencyAccessClient(mockUserId);

        await emergencyAccessService.update(emergencyAccessId, EmergencyAccessType.Takeover, 7);

        expect(client.update).toHaveBeenCalledWith(
          emergencyAccessId,
          EmergencyAccessType.Takeover,
          7,
        );
      });
    });

    describe("getEmergencyAccess", () => {
      it("should map the SDK emergency access", async () => {
        const client = mockEmergencyAccessClient(mockUserId);
        client.get.mockResolvedValue(
          createSdkGranteeEmergencyAccess(emergencyAccessId, EmergencyAccessStatusType.Accepted),
        );

        const result = await emergencyAccessService.getEmergencyAccess(emergencyAccessId);

        expect(client.get).toHaveBeenCalledWith(emergencyAccessId);
        expect(result).toBeInstanceOf(GranteeEmergencyAccess);
        expect(result.id).toBe(emergencyAccessId);
        expect(result.status).toBe(EmergencyAccessStatusType.Accepted);
        expect(result.type).toBe(EmergencyAccessType.View);
        expect(result.waitTimeDays).toBe(7);
      });
    });

    describe("getGrantorPolicies", () => {
      it("should map the SDK policies", async () => {
        const client = mockEmergencyAccessClient(mockUserId);
        const sdkPolicy = { id: newGuid() } as unknown as SdkPolicy;
        const policy = new Policy();
        client.get_grantor_policies.mockResolvedValue([sdkPolicy]);
        const fromSdkPolicy = jest.spyOn(Policy, "fromSdkPolicy").mockReturnValue(policy);

        const result = await emergencyAccessService.getGrantorPolicies(emergencyAccessId);

        expect(client.get_grantor_policies).toHaveBeenCalledWith(emergencyAccessId);
        expect(fromSdkPolicy).toHaveBeenCalledWith(sdkPolicy);
        expect(result).toEqual([policy]);
        fromSdkPolicy.mockRestore();
      });
    });

    describe("takeover", () => {
      const masterPassword = "mockPassword";
      const email = "user@example.com";
      const activeUserId = newGuid() as UserId;

      it("should take over through the active user's SDK client", async () => {
        // Arrange
        const client = mockEmergencyAccessClient(activeUserId);

        // Act
        await emergencyAccessService.takeover(
          emergencyAccessId,
          masterPassword,
          email,
          activeUserId,
        );

        // Assert
        expect(client.takeover).toHaveBeenCalledWith(emergencyAccessId, masterPassword, email);
      });

      it("should throw if the SDK takeover fails", async () => {
        // Arrange
        const client = mockEmergencyAccessClient(activeUserId);
        client.takeover.mockRejectedValue(new Error("Crypto"));

        // Act
        const promise = emergencyAccessService.takeover(
          emergencyAccessId,
          masterPassword,
          email,
          activeUserId,
        );

        // Assert
        await expect(promise).rejects.toThrow("Crypto");
      });
    });

    describe("getEmergencyAccessTrusted", () => {
      it("should return an empty array if no emergency access is granted", async () => {
        mockEmergencyAccessClient(mockUserId).list_trusted.mockResolvedValue([]);

        const result = await emergencyAccessService.getEmergencyAccessTrusted();

        expect(result).toEqual([]);
      });

      it("should return a list of trusted emergency access contacts", async () => {
        const sdkAccesses = [
          createSdkGranteeEmergencyAccess(newGuid(), EmergencyAccessStatusType.Invited),
          createSdkGranteeEmergencyAccess(newGuid(), EmergencyAccessStatusType.Confirmed),
        ];
        mockEmergencyAccessClient(mockUserId).list_trusted.mockResolvedValue(sdkAccesses);

        const result = await emergencyAccessService.getEmergencyAccessTrusted();

        expect(result).toHaveLength(sdkAccesses.length);
        result.forEach((access, index) => {
          expect(access).toBeInstanceOf(GranteeEmergencyAccess);
          expect(access.id).toBe(sdkAccesses[index].id);
          expect(access.granteeId).toBe(sdkAccesses[index].granteeId);
          expect(access.name).toBe(sdkAccesses[index].name);
          expect(access.status).toBe(sdkAccesses[index].status);
          expect(access.type).toBe(sdkAccesses[index].type);
        });
      });
    });

    describe("getEmergencyAccessGranted", () => {
      it("should return an empty array if no emergency access is granted", async () => {
        mockEmergencyAccessClient(mockUserId).list_granted.mockResolvedValue([]);

        const result = await emergencyAccessService.getEmergencyAccessGranted();

        expect(result).toEqual([]);
      });

      it("should return a list of granted emergency access contacts", async () => {
        const sdkAccesses = [
          createSdkGrantorEmergencyAccess(newGuid(), EmergencyAccessStatusType.Invited),
          createSdkGrantorEmergencyAccess(newGuid(), EmergencyAccessStatusType.RecoveryApproved),
        ];
        mockEmergencyAccessClient(mockUserId).list_granted.mockResolvedValue(sdkAccesses);

        const result = await emergencyAccessService.getEmergencyAccessGranted();

        expect(result).toHaveLength(sdkAccesses.length);
        result.forEach((access, index) => {
          expect(access).toBeInstanceOf(GrantorEmergencyAccess);
          expect(access.id).toBe(sdkAccesses[index].id);
          expect(access.grantorId).toBe(sdkAccesses[index].grantorId);
          expect(access.name).toBe(sdkAccesses[index].name);
          expect(access.status).toBe(sdkAccesses[index].status);
          expect(access.type).toBe(sdkAccesses[index].type);
        });
      });
    });
  });

  /** Makes the user's SDK client return a mocked `emergency_access()` client. */
  function mockEmergencyAccessClient(userId: UserId): MockProxy<EmergencyAccessClient> {
    const client = mock<EmergencyAccessClient>();
    const sdkClient = sdkService.simulate.userLogin(userId);
    (sdkClient as any).emergency_access = jest.fn().mockReturnValue(client);
    return client;
  }
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

function createSdkGranteeEmergencyAccess(
  id: string,
  status: EmergencyAccessStatusType,
): SdkGranteeEmergencyAccess {
  return {
    id,
    granteeId: newGuid(),
    name: "EA " + id,
    email: "grantee@example.com",
    type: EmergencyAccessType.View,
    status,
    waitTimeDays: 7,
    avatarColor: undefined,
  } as unknown as SdkGranteeEmergencyAccess;
}

function createSdkGrantorEmergencyAccess(
  id: string,
  status: EmergencyAccessStatusType,
): SdkGrantorEmergencyAccess {
  return {
    id,
    grantorId: newGuid(),
    name: "EA " + id,
    email: "grantor@example.com",
    type: EmergencyAccessType.Takeover,
    status,
    waitTimeDays: 7,
    avatarColor: undefined,
  } as unknown as SdkGrantorEmergencyAccess;
}
