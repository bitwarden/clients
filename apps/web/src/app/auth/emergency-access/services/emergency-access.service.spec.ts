// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { MockProxy } from "jest-mock-extended";
import mock from "jest-mock-extended/lib/Mock";
import { of } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { UserKeyResponse } from "@bitwarden/common/models/response/user-key.response";
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
  EncryptionType,
  EncryptService,
  EncString,
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
import { EmergencyAccessGranteeDetailsResponse } from "../response/emergency-access.response";

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
  let sdkService: MockSdkService;

  const mockNewUserKey = new SymmetricCryptoKey(new Uint8Array(64)) as UserKey;
  const mockTrustedPublicKeys = [Utils.fromUtf8ToArray("trustedPublicKey")];
  const mockUserId = newGuid() as UserId;
  const emergencyAccessId = newGuid();

  beforeAll(() => {
    emergencyAccessApiService = mock<EmergencyAccessApiService>();
    apiService = mock<ApiService>();
    keyService = mock<KeyService>();
    legacyCompatKeyService = mock<LegacyCompatKeyService>();
    encryptService = mock<EncryptService>();
    cipherService = mock<CipherService>();
    logService = mock<LogService>();
    sdkService = new MockSdkService();

    emergencyAccessService = new EmergencyAccessService(
      emergencyAccessApiService,
      apiService,
      keyService,
      legacyCompatKeyService,
      encryptService,
      cipherService,
      logService,
      sdkService,
      mockAccountServiceWith(mockUserId),
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
        await emergencyAccessService.confirm(emergencyAccessId, granteeId, publicKey, activeUserId);

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
      const client = mockEmergencyAccessClient(userId);
      client.view_vault_items.mockResolvedValue(result);
      return client.view_vault_items;
    }
  });

  describe("takeover", () => {
    const masterPassword = "mockPassword";
    const email = "user@example.com";
    const activeUserId = newGuid() as UserId;

    it("should take over through the active user's SDK client", async () => {
      // Arrange
      const client = mockEmergencyAccessClient(activeUserId);

      // Act
      await emergencyAccessService.takeover(emergencyAccessId, masterPassword, email, activeUserId);

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
