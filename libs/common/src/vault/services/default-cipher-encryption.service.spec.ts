import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import {
  Fido2Credential,
  Cipher as SdkCipher,
  CipherType as SdkCipherType,
  CipherView as SdkCipherView,
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
        decrypt_fido2_credentials: jest.fn(),
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
        keyValue: "keyValue",
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
});
