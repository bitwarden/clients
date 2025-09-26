import { mock } from "jest-mock-extended";
import { firstValueFrom, of } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AuthRequestResponse } from "@bitwarden/common/auth/models/response/auth-request.response";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { FakeMasterPasswordService } from "@bitwarden/common/key-management/master-password/services/fake-master-password.service";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { AuthRequestPushNotification } from "@bitwarden/common/models/response/notification.response";
import { AppIdService } from "@bitwarden/common/platform/abstractions/app-id.service";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { StateProvider } from "@bitwarden/common/platform/state";
import { UserId } from "@bitwarden/common/types/guid";
import { MasterKey, UserKey } from "@bitwarden/common/types/key";
import { newGuid } from "@bitwarden/guid";
import { KeyService } from "@bitwarden/key-management";

import { DefaultAuthRequestApiService } from "./auth-request-api.service";
import { AuthRequestService } from "./auth-request.service";

describe("AuthRequestService", () => {
  let sut: AuthRequestService;

  const stateProvider = mock<StateProvider>();
  let masterPasswordService: FakeMasterPasswordService;
  const appIdService = mock<AppIdService>();
  const keyService = mock<KeyService>();
  const encryptService = mock<EncryptService>();
  const apiService = mock<ApiService>();
  const authRequestApiService = mock<DefaultAuthRequestApiService>();

  let mockPrivateKey: Uint8Array;
  let mockPublicKey: Uint8Array;
  const mockUserId = newGuid() as UserId;

  beforeEach(() => {
    jest.clearAllMocks();
    masterPasswordService = new FakeMasterPasswordService();

    sut = new AuthRequestService(
      appIdService,
      masterPasswordService,
      keyService,
      encryptService,
      apiService,
      stateProvider,
      authRequestApiService,
    );

    mockPrivateKey = new Uint8Array(64);
    mockPublicKey = new Uint8Array(64);
  });

  describe("authRequestPushNotification$", () => {
    it("should emit when sendAuthRequestPushNotification is called", () => {
      const notification = {
        id: "PUSH_NOTIFICATION",
        userId: "USER_ID",
      } as AuthRequestPushNotification;

      const spy = jest.fn();
      sut.authRequestPushNotification$.subscribe(spy);

      sut.sendAuthRequestPushNotification(notification);

      expect(spy).toHaveBeenCalledWith("PUSH_NOTIFICATION");
    });
  });

  describe("AdminAuthRequest", () => {
    it("returns an error when userId isn't provided", async () => {
      await expect(sut.getAdminAuthRequest(undefined)).rejects.toThrow("User ID is required");
      await expect(sut.setAdminAuthRequest(undefined, undefined)).rejects.toThrow(
        "User ID is required",
      );
      await expect(sut.clearAdminAuthRequest(undefined)).rejects.toThrow("User ID is required");
    });

    it("does not allow clearing from setAdminAuthRequest", async () => {
      await expect(sut.setAdminAuthRequest(null, "USER_ID" as UserId)).rejects.toThrow(
        "Auth request is required",
      );
    });
  });

  describe("approveOrDenyAuthRequest", () => {
    beforeEach(() => {
      encryptService.encapsulateKeyUnsigned.mockResolvedValue({
        encryptedString: "ENCRYPTED_STRING",
      } as EncString);
      appIdService.getAppId.mockResolvedValue("APP_ID");
    });
    it("should throw if auth request is missing id or key", async () => {
      const authRequestNoId = new AuthRequestResponse({ id: "", key: "KEY" });
      const authRequestNoPublicKey = new AuthRequestResponse({ id: "123", publicKey: "" });

      await expect(sut.approveOrDenyAuthRequest(true, authRequestNoId, mockUserId)).rejects.toThrow(
        "Auth request has no id",
      );
      await expect(
        sut.approveOrDenyAuthRequest(true, authRequestNoPublicKey, mockUserId),
      ).rejects.toThrow("Auth request has no public key");
    });

    it("should use the user key if the master key and hash do not exist", async () => {
      keyService.userKey$.mockReturnValue(
        of(new SymmetricCryptoKey(new Uint8Array(64)) as UserKey),
      );

      await sut.approveOrDenyAuthRequest(
        true,
        new AuthRequestResponse({ id: "123", publicKey: "KEY" }),
        mockUserId,
      );

      expect(encryptService.encapsulateKeyUnsigned).toHaveBeenCalledWith(
        new SymmetricCryptoKey(new Uint8Array(64)),
        expect.anything(),
      );
    });
  });

  describe("setUserKeyAfterDecryptingSharedUserKey", () => {
    it("decrypts and sets user key when given valid auth request response and private key", async () => {
      // Arrange
      const mockAuthReqResponse = {
        key: "authReqPublicKeyEncryptedUserKey",
      } as AuthRequestResponse;

      const mockDecryptedUserKey = {} as UserKey;
      jest.spyOn(sut, "decryptPubKeyEncryptedUserKey").mockResolvedValueOnce(mockDecryptedUserKey);

      keyService.setUserKey.mockResolvedValueOnce(undefined);

      // Act
      await sut.setUserKeyAfterDecryptingSharedUserKey(
        mockAuthReqResponse,
        mockPrivateKey,
        mockUserId,
      );

      // Assert
      expect(sut.decryptPubKeyEncryptedUserKey).toBeCalledWith(
        mockAuthReqResponse.key,
        mockPrivateKey,
      );
      expect(keyService.setUserKey).toBeCalledWith(mockDecryptedUserKey, mockUserId);
    });
  });

  describe("setKeysAfterDecryptingSharedMasterKeyAndHash", () => {
    it("decrypts and sets master key and hash and user key when given valid auth request response and private key", async () => {
      // Arrange
      const mockAuthReqResponse = {
        key: "authReqPublicKeyEncryptedMasterKey",
        masterPasswordHash: "authReqPublicKeyEncryptedMasterKeyHash",
      } as AuthRequestResponse;

      const mockDecryptedMasterKey = {} as MasterKey;
      const mockDecryptedMasterKeyHash = "mockDecryptedMasterKeyHash";
      const mockDecryptedUserKey = {} as UserKey;

      jest.spyOn(sut, "decryptPubKeyEncryptedMasterKeyAndHash").mockResolvedValueOnce({
        masterKey: mockDecryptedMasterKey,
        masterKeyHash: mockDecryptedMasterKeyHash,
      });

      masterPasswordService.masterKeySubject.next(undefined);
      masterPasswordService.masterKeyHashSubject.next(undefined);
      masterPasswordService.mock.decryptUserKeyWithMasterKey.mockResolvedValue(
        mockDecryptedUserKey,
      );
      keyService.setUserKey.mockResolvedValueOnce(undefined);

      // Act
      await sut.setKeysAfterDecryptingSharedMasterKeyAndHash(
        mockAuthReqResponse,
        mockPrivateKey,
        mockUserId,
      );

      // Assert
      expect(sut.decryptPubKeyEncryptedMasterKeyAndHash).toBeCalledWith(
        mockAuthReqResponse.key,
        mockAuthReqResponse.masterPasswordHash,
        mockPrivateKey,
      );
      expect(masterPasswordService.mock.setMasterKey).toHaveBeenCalledWith(
        mockDecryptedMasterKey,
        mockUserId,
      );
      expect(masterPasswordService.mock.setMasterKeyHash).toHaveBeenCalledWith(
        mockDecryptedMasterKeyHash,
        mockUserId,
      );
      expect(masterPasswordService.mock.decryptUserKeyWithMasterKey).toHaveBeenCalledWith(
        mockDecryptedMasterKey,
        mockUserId,
        undefined,
      );
      expect(keyService.setUserKey).toHaveBeenCalledWith(mockDecryptedUserKey, mockUserId);
    });
  });

  describe("decryptAuthReqPubKeyEncryptedUserKey", () => {
    it("returns a decrypted user key when given valid public key encrypted user key and an auth req private key", async () => {
      // Arrange
      const mockPubKeyEncryptedUserKey = "pubKeyEncryptedUserKey";
      const mockDecryptedUserKeyBytes = new Uint8Array(64);
      const mockDecryptedUserKey = new SymmetricCryptoKey(mockDecryptedUserKeyBytes) as UserKey;

      encryptService.decapsulateKeyUnsigned.mockResolvedValueOnce(
        new SymmetricCryptoKey(mockDecryptedUserKeyBytes),
      );

      // Act
      const result = await sut.decryptPubKeyEncryptedUserKey(
        mockPubKeyEncryptedUserKey,
        mockPrivateKey,
      );

      // Assert
      expect(encryptService.decapsulateKeyUnsigned).toBeCalledWith(
        new EncString(mockPubKeyEncryptedUserKey),
        mockPrivateKey,
      );
      expect(result).toEqual(mockDecryptedUserKey);
    });
  });

  describe("getFingerprintPhrase", () => {
    it("returns the same fingerprint regardless of email casing", () => {
      const email = "test@email.com";
      const emailUpperCase = email.toUpperCase();
      const phrase = sut.getFingerprintPhrase(email, mockPublicKey);
      const phraseUpperCase = sut.getFingerprintPhrase(emailUpperCase, mockPublicKey);
      expect(phrase).toEqual(phraseUpperCase);
    });
  });

  describe("getLatestAuthRequest", () => {
    it("returns newest authRequest from list of authRequests", async () => {
      const now = minutesAgo(0);
      const fiveMinutesAgo = minutesAgo(5);
      const tenMinutesAgo = minutesAgo(10);

      const newerAuthRequest = createMockAuthRequest(
        "now-request",
        false,
        false,
        now.toISOString(), // newer request
        "1fda13f4-5134-4157-90e3-b4e3fb2d855z",
      );
      const olderAuthRequest = createMockAuthRequest(
        "5-minute-old-request",
        false,
        false,
        fiveMinutesAgo.toISOString(), // older request
        "1fda13f4-5134-4157-90e3-b4e3fb2d855c",
      );
      const oldestAuthRequest = createMockAuthRequest(
        "10-minute-old-request",
        false,
        false,
        tenMinutesAgo.toISOString(), // oldest request
        "1fda13f4-5134-4157-90e3-b4e3fb2d855a",
      );

      const listResponse = new ListResponse(
        { Data: [oldestAuthRequest, olderAuthRequest, newerAuthRequest] },
        AuthRequestResponse,
      );

      // Ensure the mock is properly set up to return the list response
      authRequestApiService.getPendingAuthRequests.mockResolvedValue(listResponse);

      // Act
      const sutReturnValue = await firstValueFrom(sut.getLatestPendingAuthRequest$());

      // Assert
      // Verify the mock was called
      expect(authRequestApiService.getPendingAuthRequests).toHaveBeenCalledTimes(1);
      expect(sutReturnValue.creationDate).toEqual(newerAuthRequest.creationDate);
      expect(sutReturnValue.id).toEqual(newerAuthRequest.id);
    });
  });

  it("returns null from empty list of authRequests", async () => {
    const listResponse = new ListResponse({ Data: [] }, AuthRequestResponse);

    // Ensure the mock is properly set up to return the list response
    authRequestApiService.getPendingAuthRequests.mockResolvedValue(listResponse);

    // Act
    const sutReturnValue = await firstValueFrom(sut.getLatestPendingAuthRequest$());

    // Assert
    // Verify the mock was called
    expect(authRequestApiService.getPendingAuthRequests).toHaveBeenCalledTimes(1);
    expect(sutReturnValue).toBeNull();
  });
});

function createMockAuthRequest(
  id: string,
  isAnswered: boolean,
  isExpired: boolean,
  creationDate: string,
  deviceId?: string,
): AuthRequestResponse {
  const authRequestResponse = new AuthRequestResponse({
    id: id,
    publicKey:
      "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA+AIKUBDf4exqE9JDzGJegDzIoaZcNkUeewovgwSJuKuya0mP4CPP00ajmi9GEu6z3VWfB+yzx1O4gxHV/T5s620wnMYm6nAv2gDS+kEaXou4MOt7QMidq4kVhM7aixN2klKivH/E8GFPiMUzNQv0lMQthsVLLWFuMRxYfChe9Cxn9EWp7TYy4rAmi+jSTxzIGj+RC7f2qu2qdPSsKHLXtW7NA0SWhIntWbmc9QxD2nQ4qHgk/qUwvHoUhwKGNCcIDkXqMJ7ChN3v5tX1sFpwhQQrmlwiVC4+sBScfAgyYylfTPnuBd6b3UrC3D34GvHMgDvLjz7LwlBrkSXoF7xWZwIDAQAB",
    requestDeviceIdentifier: "1fda13f4-5134-4157-90e3-b4e3fb2d855c",
    requestDeviceTypeValue: 10,
    requestDeviceType: "Firefox",
    requestIpAddress: "2a04:4e40:9400:0:bb4:3591:d601:f5cc",
    requestCountryName: "united states",
    key: null,
    masterPasswordHash: null,
    creationDate: creationDate, // ISO 8601 date string : "2025-07-11T19:11:17.9866667Z"
    responseDate: null,
    requestApproved: false,
    isAnswered: isAnswered,
    isExpired: isExpired,
    deviceId: deviceId,
  });

  return authRequestResponse;
}

function minutesAgo(minutes: number): Date {
  return new Date(Date.now() - minutes * 60_000);
}
