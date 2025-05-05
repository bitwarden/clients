import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import {
  Fido2Credential,
  Cipher as SdkCipher,
  CipherType as SdkCipherType,
  CipherView as SdkCipherView,
  CipherListView,
  Attachment as SdkAttachment,
} from "@bitwarden/sdk-internal";

import { mockEnc } from "../../../spec";
import { UriMatchStrategy } from "../../models/domain/domain-service";
import { LogService } from "../../platform/abstractions/log.service";
import { SdkService } from "../../platform/abstractions/sdk/sdk.service";
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
  let sdkCipherView: SdkCipherView;

  const mockSdkClient = {
    vault: jest.fn().mockReturnValue({
      ciphers: jest.fn().mockReturnValue({
        decrypt: jest.fn(),
        decrypt_list: jest.fn(),
        decrypt_fido2_credentials: jest.fn(),
      }),
      attachments: jest.fn().mockReturnValue({
        decrypt_buffer: jest.fn(),
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
    cipherEncryptionService = new DefaultCipherEncryptionService(sdkService, logService);
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
  });

  describe("decryptManyLegacy", () => {
    it("should decrypt multiple ciphers successfully", async () => {
      const ciphers = [new Cipher(cipherData), new Cipher(cipherData)];

      const expectedViews = [
        {
          id: "test-id-1",
          name: "test-name-1",
        } as CipherView,
        {
          id: "test-id-2",
          name: "test-name-2",
        } as CipherView,
      ];

      mockSdkClient
        .vault()
        .ciphers()
        .decrypt.mockReturnValueOnce({ id: "test-id-1", name: "test-name-1" } as SdkCipherView)
        .mockReturnValueOnce({ id: "test-id-2", name: "test-name-2" } as SdkCipherView);

      jest
        .spyOn(CipherView, "fromSdkCipherView")
        .mockReturnValueOnce(expectedViews[0])
        .mockReturnValueOnce(expectedViews[1]);

      const result = await cipherEncryptionService.decryptManyLegacy(ciphers, userId);

      expect(result).toEqual(expectedViews);
      expect(mockSdkClient.vault().ciphers().decrypt).toHaveBeenCalledTimes(2);
      expect(CipherView.fromSdkCipherView).toHaveBeenCalledTimes(2);
    });

    it("should throw EmptyError when SDK is not available", async () => {
      sdkService.userClient$ = jest.fn().mockReturnValue(of(null)) as any;

      await expect(
        cipherEncryptionService.decryptManyLegacy([cipherObj], userId),
      ).rejects.toThrow();

      expect(logService.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to decrypt ciphers"),
      );
    });
  });

  describe("decryptMany", () => {
    it("should decrypt multiple ciphers to list views", async () => {
      const ciphers = [new Cipher(cipherData), new Cipher(cipherData)];

      const expectedListViews = [
        { id: "list1", name: "List 1" } as CipherListView,
        { id: "list2", name: "List 2" } as CipherListView,
      ];

      mockSdkClient.vault().ciphers().decrypt_list.mockReturnValue(expectedListViews);

      const result = await cipherEncryptionService.decryptMany(ciphers, userId);

      expect(result).toEqual(expectedListViews);
      expect(mockSdkClient.vault().ciphers().decrypt_list).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ id: cipherData.id }),
          expect.objectContaining({ id: cipherData.id }),
        ]),
      );
    });

    it("should throw EmptyError when SDK is not available", async () => {
      sdkService.userClient$ = jest.fn().mockReturnValue(of(null)) as any;

      await expect(cipherEncryptionService.decryptMany([cipherObj], userId)).rejects.toThrow();

      expect(logService.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to decrypt cipher list"),
      );
    });
  });

  describe("decryptAttachmentContent", () => {
    it("should decrypt attachment content successfully", async () => {
      const cipher = new Cipher(cipherData);
      const attachment = new AttachmentView(cipher.attachments![0]);
      const encryptedContent = new Uint8Array([1, 2, 3, 4]);
      const expectedDecryptedContent = new Uint8Array([5, 6, 7, 8]);

      jest.spyOn(cipher, "toSdkCipher").mockReturnValue({ id: "id" } as SdkCipher);
      jest.spyOn(attachment, "toSdkAttachmentView").mockReturnValue({ id: "a1" } as SdkAttachment);
      mockSdkClient.vault().attachments().decrypt_buffer.mockReturnValue(expectedDecryptedContent);

      const result = await cipherEncryptionService.decryptAttachmentContent(
        cipher,
        attachment,
        encryptedContent,
        userId,
      );

      expect(result).toEqual(expectedDecryptedContent);
      expect(cipher.toSdkCipher).toHaveBeenCalled();
      expect(attachment.toSdkAttachmentView).toHaveBeenCalled();
      expect(mockSdkClient.vault().attachments().decrypt_buffer).toHaveBeenCalledWith(
        { id: "id" },
        { id: "a1" },
        encryptedContent,
      );
    });
  });
});
