import { mock } from "jest-mock-extended";

import { CryptoService } from "../../platform/abstractions/crypto.service";
import { Utils } from "../../platform/misc/utils";
import {
  MasterKey,
  SymmetricCryptoKey,
  UserKey,
} from "../../platform/models/domain/symmetric-crypto-key";
import { AuthRequestCryptoServiceAbstraction } from "../abstractions/auth-request-crypto.service.abstraction";
import { AuthRequestResponse } from "../models/response/auth-request.response";

import { AuthRequestCryptoServiceImplementation } from "./auth-request-crypto.service.implementation";

describe("AuthRequestCryptoService", () => {
  let authReqCryptoService: AuthRequestCryptoServiceAbstraction;
  const cryptoService = mock<CryptoService>();
  let mockPrivateKey: ArrayBuffer;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();

    authReqCryptoService = new AuthRequestCryptoServiceImplementation(cryptoService);

    mockPrivateKey = new ArrayBuffer(64);
  });

  it("instantiates", () => {
    expect(authReqCryptoService).not.toBeFalsy();
  });

  describe("setUserKeyAfterDecryptingSharedUserKey", () => {
    it("decrypts and sets user key when given valid auth request response and private key", async () => {
      // Arrange
      const mockAuthReqResponse = {
        key: "authReqPublicKeyEncryptedUserKey",
      } as AuthRequestResponse;

      const mockDecryptedUserKey = {} as UserKey;
      jest
        .spyOn(authReqCryptoService, "decryptAuthReqPubKeyEncryptedUserKey")
        .mockResolvedValueOnce(mockDecryptedUserKey);

      cryptoService.setUserKey.mockResolvedValueOnce(undefined);

      // Act
      await authReqCryptoService.setUserKeyAfterDecryptingSharedUserKey(
        mockAuthReqResponse,
        mockPrivateKey
      );

      // Assert
      expect(authReqCryptoService.decryptAuthReqPubKeyEncryptedUserKey).toBeCalledWith(
        mockAuthReqResponse.key,
        mockPrivateKey
      );
      expect(cryptoService.setUserKey).toBeCalledWith(mockDecryptedUserKey);
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

      jest
        .spyOn(authReqCryptoService, "decryptAuthReqPubKeyEncryptedMasterKeyAndHash")
        .mockResolvedValueOnce({
          masterKey: mockDecryptedMasterKey,
          masterKeyHash: mockDecryptedMasterKeyHash,
        });

      cryptoService.setMasterKey.mockResolvedValueOnce(undefined);
      cryptoService.setMasterKeyHash.mockResolvedValueOnce(undefined);
      cryptoService.decryptUserKeyWithMasterKey.mockResolvedValueOnce(mockDecryptedUserKey);
      cryptoService.setUserKey.mockResolvedValueOnce(undefined);

      // Act
      await authReqCryptoService.setKeysAfterDecryptingSharedMasterKeyAndHash(
        mockAuthReqResponse,
        mockPrivateKey
      );

      // Assert
      expect(authReqCryptoService.decryptAuthReqPubKeyEncryptedMasterKeyAndHash).toBeCalledWith(
        mockAuthReqResponse.key,
        mockAuthReqResponse.masterPasswordHash,
        mockPrivateKey
      );
      expect(cryptoService.setMasterKey).toBeCalledWith(mockDecryptedMasterKey);
      expect(cryptoService.setMasterKeyHash).toBeCalledWith(mockDecryptedMasterKeyHash);
      expect(cryptoService.decryptUserKeyWithMasterKey).toBeCalledWith(mockDecryptedMasterKey);
      expect(cryptoService.setUserKey).toBeCalledWith(mockDecryptedUserKey);
    });
  });

  describe("decryptAuthReqPubKeyEncryptedUserKey", () => {
    it("returns a decrypted user key when given valid public key encrypted user key and an auth req private key", async () => {
      // Arrange
      const mockPubKeyEncryptedUserKey = "pubKeyEncryptedUserKey";
      const mockDecryptedUserKeyArrayBuffer = new ArrayBuffer(64);
      const mockDecryptedUserKey = new SymmetricCryptoKey(
        mockDecryptedUserKeyArrayBuffer
      ) as UserKey;

      cryptoService.rsaDecrypt.mockResolvedValueOnce(mockDecryptedUserKeyArrayBuffer);

      // Act
      const result = await authReqCryptoService.decryptAuthReqPubKeyEncryptedUserKey(
        mockPubKeyEncryptedUserKey,
        mockPrivateKey
      );

      // Assert
      expect(cryptoService.rsaDecrypt).toBeCalledWith(mockPubKeyEncryptedUserKey, mockPrivateKey);
      expect(result).toEqual(mockDecryptedUserKey);
    });
  });

  describe("decryptAuthReqPubKeyEncryptedMasterKeyAndHash", () => {
    it("returns a decrypted master key and hash when given a valid public key encrypted master key, public key encrypted master key hash, and an auth req private key", async () => {
      // Arrange
      const mockPubKeyEncryptedMasterKey = "pubKeyEncryptedMasterKey";
      const mockPubKeyEncryptedMasterKeyHash = "pubKeyEncryptedMasterKeyHash";

      const mockDecryptedMasterKeyArrayBuffer = new ArrayBuffer(64);
      const mockDecryptedMasterKey = new SymmetricCryptoKey(
        mockDecryptedMasterKeyArrayBuffer
      ) as MasterKey;
      const mockDecryptedMasterKeyHashArrayBuffer = new ArrayBuffer(64);
      const mockDecryptedMasterKeyHash = Utils.fromBufferToUtf8(
        mockDecryptedMasterKeyHashArrayBuffer
      );

      cryptoService.rsaDecrypt
        .mockResolvedValueOnce(mockDecryptedMasterKeyArrayBuffer)
        .mockResolvedValueOnce(mockDecryptedMasterKeyHashArrayBuffer);

      // Act
      const result = await authReqCryptoService.decryptAuthReqPubKeyEncryptedMasterKeyAndHash(
        mockPubKeyEncryptedMasterKey,
        mockPubKeyEncryptedMasterKeyHash,
        mockPrivateKey
      );

      // Assert
      expect(cryptoService.rsaDecrypt).toHaveBeenNthCalledWith(
        1,
        mockPubKeyEncryptedMasterKey,
        mockPrivateKey
      );
      expect(cryptoService.rsaDecrypt).toHaveBeenNthCalledWith(
        2,
        mockPubKeyEncryptedMasterKeyHash,
        mockPrivateKey
      );
      expect(result.masterKey).toEqual(mockDecryptedMasterKey);
      expect(result.masterKeyHash).toEqual(mockDecryptedMasterKeyHash);
    });
  });
});
