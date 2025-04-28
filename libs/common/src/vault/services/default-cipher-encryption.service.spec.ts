import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { KeyService } from "@bitwarden/key-management";
import {
  Fido2Credential,
  Cipher as SdkCipher,
  CipherType as SdkCipherType,
  CipherView as SdkCipherView,
  AttachmentView as SdkAttachmentView,
} from "@bitwarden/sdk-internal";

import { makeSymmetricCryptoKey, mockEnc } from "../../../spec";
import { EncryptService } from "../../key-management/crypto/abstractions/encrypt.service";
import { UriMatchStrategy } from "../../models/domain/domain-service";
import { ConfigService } from "../../platform/abstractions/config/config.service";
import { LogService } from "../../platform/abstractions/log.service";
import { SdkService } from "../../platform/abstractions/sdk/sdk.service";
import { EncArrayBuffer } from "../../platform/models/domain/enc-array-buffer";
import { UserId } from "../../types/guid";
import { CipherRepromptType, CipherType } from "../enums";
import { CipherPermissionsApi } from "../models/api/cipher-permissions.api";
import { CipherData } from "../models/data/cipher.data";
import { Cipher } from "../models/domain/cipher";
import { AttachmentView } from "../models/view/attachment.view";
import { CipherView } from "../models/view/cipher.view";
import { Fido2CredentialView } from "../models/view/fido2-credential.view";

import { DefaultCipherEncryptionService } from "./default-cipher-encryption.service";

const cipherData: CipherData = {
  id: "id",
  organizationId: "orgId",
  folderId: "folderId",
  edit: true,
  viewPassword: true,
  organizationUseTotp: true,
  favorite: false,
  revisionDate: "2022-01-31T12:00:00.000Z",
  type: CipherType.Login,
  name: "EncryptedString",
  notes: "EncryptedString",
  creationDate: "2022-01-01T12:00:00.000Z",
  deletedDate: null,
  permissions: new CipherPermissionsApi(),
  key: "EncKey",
  reprompt: CipherRepromptType.None,
  login: {
    uris: [
      { uri: "EncryptedString", uriChecksum: "EncryptedString", match: UriMatchStrategy.Domain },
    ],
    username: "EncryptedString",
    password: "EncryptedString",
    passwordRevisionDate: "2022-01-31T12:00:00.000Z",
    totp: "EncryptedString",
    autofillOnPageLoad: false,
  },
  passwordHistory: [{ password: "EncryptedString", lastUsedDate: "2022-01-31T12:00:00.000Z" }],
  attachments: [
    {
      id: "a1",
      url: "url",
      size: "1100",
      sizeName: "1.1 KB",
      fileName: "file",
      key: "EncKey",
    },
    {
      id: "a2",
      url: "url",
      size: "1100",
      sizeName: "1.1 KB",
      fileName: "file",
      key: "EncKey",
    },
  ],
};

describe("DefaultCipherEncryptionService", () => {
  let cipherEncryptionService: DefaultCipherEncryptionService;
  const sdkService = mock<SdkService>();
  const logService = mock<LogService>();
  const encryptService = mock<EncryptService>();
  const configService = mock<ConfigService>();
  const keyService = mock<KeyService>();
  let sdkCipherView: SdkCipherView;

  const mockSdkClient = {
    vault: jest.fn().mockReturnValue({
      ciphers: jest.fn().mockReturnValue({
        decrypt: jest.fn(),
        decrypt_fido2_credentials: jest.fn(),
      }),
      attachments: jest.fn().mockReturnValue({
        decrypt_buffer_view: jest.fn(),
      }),
    }),
  };
  const mockRef = {
    value: mockSdkClient,
    [Symbol.dispose]: jest.fn(),
  };
  const mockSdk = {
    take: jest.fn().mockReturnValue(mockRef),
  };

  const userId = "user-id" as UserId;

  let cipherObj: Cipher;

  beforeEach(() => {
    sdkService.userClient$ = jest.fn((userId: UserId) => of(mockSdk)) as any;
    cipherEncryptionService = new DefaultCipherEncryptionService(
      sdkService,
      configService,
      logService,
      encryptService,
      keyService,
    );
    cipherObj = new Cipher(cipherData);

    jest.spyOn(cipherObj, "toSdkCipher").mockImplementation(() => {
      return { id: cipherData.id } as SdkCipher;
    });

    sdkCipherView = {
      id: "test-id",
      type: SdkCipherType.Login,
      name: "test-name",
      login: {
        username: "test-username",
        password: "test-password",
      },
    } as SdkCipherView;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("decrypt", () => {
    it("should decrypt a cipher successfully", async () => {
      const expectedCipherView: CipherView = {
        id: "test-id",
        type: CipherType.Login,
        name: "test-name",
        login: {
          username: "test-username",
          password: "test-password",
        },
      } as CipherView;

      mockSdkClient.vault().ciphers().decrypt.mockReturnValue(sdkCipherView);
      jest.spyOn(CipherView, "fromSdkCipherView").mockReturnValue(expectedCipherView);

      const result = await cipherEncryptionService.decrypt(cipherObj, userId);

      expect(result).toEqual(expectedCipherView);
      expect(cipherObj.toSdkCipher).toHaveBeenCalledTimes(1);
      expect(mockSdkClient.vault().ciphers().decrypt).toHaveBeenCalledWith({ id: cipherData.id });
      expect(CipherView.fromSdkCipherView).toHaveBeenCalledWith(sdkCipherView);
      expect(mockSdkClient.vault().ciphers().decrypt_fido2_credentials).not.toHaveBeenCalled();
    });

    it("should decrypt FIDO2 credentials if present", async () => {
      const fido2Credentials = [
        {
          credentialId: mockEnc("credentialId"),
          keyType: mockEnc("keyType"),
          keyAlgorithm: mockEnc("keyAlgorithm"),
          keyCurve: mockEnc("keyCurve"),
          keyValue: mockEnc("keyValue"),
          rpId: mockEnc("rpId"),
          userHandle: mockEnc("userHandle"),
          userName: mockEnc("userName"),
          counter: mockEnc("2"),
          rpName: mockEnc("rpName"),
          userDisplayName: mockEnc("userDisplayName"),
          discoverable: mockEnc("true"),
          creationDate: new Date("2023-01-01T12:00:00.000Z"),
        },
      ] as unknown as Fido2Credential[];

      sdkCipherView.login!.fido2Credentials = fido2Credentials;

      const expectedCipherView: CipherView = {
        id: "test-id",
        type: CipherType.Login,
        name: "test-name",
        login: {
          username: "test-username",
          password: "test-password",
          fido2Credentials: [],
        },
      } as unknown as CipherView;

      const fido2CredentialView: Fido2CredentialView = {
        credentialId: "credentialId",
        keyType: "keyType",
        keyAlgorithm: "keyAlgorithm",
        keyCurve: "keyCurve",
        keyValue: "decrypted-key-value",
        rpId: "rpId",
        userHandle: "userHandle",
        userName: "userName",
        counter: 2,
        rpName: "rpName",
        userDisplayName: "userDisplayName",
        discoverable: true,
        creationDate: new Date("2023-01-01T12:00:00.000Z"),
      } as unknown as Fido2CredentialView;

      mockSdkClient.vault().ciphers().decrypt.mockReturnValue(sdkCipherView);
      mockSdkClient.vault().ciphers().decrypt_fido2_credentials.mockReturnValue(fido2Credentials);
      mockSdkClient.vault().ciphers().decrypt_fido2_private_key = jest
        .fn()
        .mockReturnValue("decrypted-key-value");

      jest.spyOn(CipherView, "fromSdkCipherView").mockReturnValue(expectedCipherView);
      jest
        .spyOn(Fido2CredentialView, "fromSdkFido2CredentialView")
        .mockReturnValueOnce(fido2CredentialView);

      const result = await cipherEncryptionService.decrypt(cipherObj, userId);

      expect(result).toBe(expectedCipherView);
      expect(result.login?.fido2Credentials).toEqual([fido2CredentialView]);
      expect(mockSdkClient.vault().ciphers().decrypt_fido2_credentials).toHaveBeenCalledWith(
        sdkCipherView,
      );
      expect(mockSdkClient.vault().ciphers().decrypt_fido2_private_key).toHaveBeenCalledWith(
        sdkCipherView,
      );
      expect(Fido2CredentialView.fromSdkFido2CredentialView).toHaveBeenCalledTimes(1);
    });

    it("should handle decryption failure", async () => {
      const errorMessage = "Decryption failed";
      mockSdkClient
        .vault()
        .ciphers()
        .decrypt.mockImplementation(() => {
          throw new Error(errorMessage);
        });

      const result = await cipherEncryptionService.decrypt(cipherObj, userId);

      expect(result).toBeInstanceOf(CipherView);
      expect(result.decryptionFailure).toBe(true);
      expect(result.name).toBe("[error: cannot decrypt]");
    });
  });

  describe("getDecryptedAttachmentBuffer", () => {
    it("should use SDK when feature flag is enabled", async () => {
      const cipher = new Cipher(cipherData);
      const attachment = new AttachmentView(cipher.attachments![0]);

      const mockResponse = {
        arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(4)),
      } as unknown as Response;

      const expectedDecryptedContent = new Uint8Array([1, 2, 3, 4]);

      configService.getFeatureFlag.mockResolvedValue(true);
      jest.spyOn(cipher, "toSdkCipher").mockReturnValue({ id: "id" } as SdkCipher);
      jest
        .spyOn(attachment, "toSdkAttachmentView")
        .mockReturnValue({ id: "a1" } as SdkAttachmentView);
      mockSdkClient
        .vault()
        .attachments()
        .decrypt_buffer_view.mockReturnValue(expectedDecryptedContent);

      const result = await cipherEncryptionService.getDecryptedAttachmentBuffer(
        cipher,
        attachment,
        mockResponse,
        userId,
      );

      expect(result).toEqual(expectedDecryptedContent);
      expect(mockResponse.arrayBuffer).toHaveBeenCalled();
      expect(mockSdkClient.vault().attachments().decrypt_buffer_view).toHaveBeenCalledWith(
        { id: "id" },
        { id: "a1" },
        expect.any(Uint8Array),
      );
    });

    it("should use legacy decryption when feature flag is enabled", async () => {
      const cipher = new Cipher(cipherData);
      const attachment = new AttachmentView(cipher.attachments![0]);
      attachment.key = makeSymmetricCryptoKey(64);

      const mockResponse = {
        arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(4)),
      } as unknown as Response;
      const mockEncBuf = {} as EncArrayBuffer;
      const expectedDecryptedContent = new Uint8Array([1, 2, 3, 4]);

      configService.getFeatureFlag.mockResolvedValue(false);
      EncArrayBuffer.fromResponse = jest.fn().mockResolvedValue(mockEncBuf);
      encryptService.decryptToBytes.mockResolvedValue(expectedDecryptedContent);

      const result = await cipherEncryptionService.getDecryptedAttachmentBuffer(
        cipher,
        attachment,
        mockResponse,
        userId,
      );

      expect(result).toEqual(expectedDecryptedContent);
      expect(EncArrayBuffer.fromResponse).toHaveBeenCalledWith(mockResponse);
      expect(encryptService.decryptToBytes).toHaveBeenCalledWith(mockEncBuf, attachment.key);
    });
  });
});
