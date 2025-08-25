import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { Utils } from "@bitwarden/common/platform/misc/utils";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { UserKey } from "@bitwarden/common/types/key";
import { Fido2Credential } from "@bitwarden/common/vault/models/domain/fido2-credential";
import {
  Fido2Credential as SdkFido2Credential,
  Cipher as SdkCipher,
  CipherType as SdkCipherType,
  CipherView as SdkCipherView,
  CipherListView,
  AttachmentView as SdkAttachmentView,
  Fido2CredentialFullView,
} from "@bitwarden/sdk-internal";

import { mockEnc } from "../../../spec";
import { UriMatchStrategy } from "../../models/domain/domain-service";
import { LogService } from "../../platform/abstractions/log.service";
import { SdkService } from "../../platform/abstractions/sdk/sdk.service";
import { UserId, CipherId, OrganizationId } from "../../types/guid";
import { CipherRepromptType, CipherType } from "../enums";
import { CipherPermissionsApi } from "../models/api/cipher-permissions.api";
import { CipherData } from "../models/data/cipher.data";
import { Cipher } from "../models/domain/cipher";
import { AttachmentView } from "../models/view/attachment.view";
import { CipherView } from "../models/view/cipher.view";
import { Fido2CredentialView } from "../models/view/fido2-credential.view";

import { DefaultCipherEncryptionService } from "./default-cipher-encryption.service";

const cipherId = "bdc4ef23-1116-477e-ae73-247854af58cb" as CipherId;
const orgId = "c5e9654f-6cc5-44c4-8e09-3d323522668c" as OrganizationId;
const folderId = "a3e9654f-6cc5-44c4-8e09-3d323522668c";
const userId = "59fbbb44-8cc8-4279-ab40-afc5f68704f4" as UserId;

const cipherData: CipherData = {
  id: cipherId,
  organizationId: orgId,
  folderId: folderId,
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
  let sdkCipher: SdkCipher;

  const mockSdkClient = {
    vault: jest.fn().mockReturnValue({
      ciphers: jest.fn().mockReturnValue({
        encrypt: jest.fn(),
        encrypt_cipher_for_rotation: jest.fn(),
        set_fido2_credentials: jest.fn(),
        decrypt: jest.fn(),
        decrypt_list: jest.fn(),
        decrypt_fido2_credentials: jest.fn(),
        move_to_organization: jest.fn(),
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

  let cipherObj: Cipher;
  let cipherViewObj: CipherView;

  beforeEach(() => {
    sdkService.userClient$ = jest.fn((userId: UserId) => of(mockSdk)) as any;
    cipherEncryptionService = new DefaultCipherEncryptionService(sdkService, logService);
    cipherObj = new Cipher(cipherData);
    cipherViewObj = new CipherView(cipherObj);

    jest.spyOn(cipherObj, "toSdkCipher").mockImplementation(() => {
      return { id: cipherData.id as any } as SdkCipher;
    });

    jest.spyOn(cipherViewObj, "toSdkCipherView").mockImplementation(() => {
      return { id: cipherData.id as any } as SdkCipherView;
    });

    sdkCipherView = {
      id: cipherId as any,
      type: SdkCipherType.Login,
      name: "test-name",
      login: {
        username: "test-username",
        password: "test-password",
      },
    } as SdkCipherView;

    sdkCipher = {
      id: cipherId,
      type: SdkCipherType.Login,
      name: "encrypted-name",
      login: {
        username: "encrypted-username",
        password: "encrypted-password",
      },
    } as unknown as SdkCipher;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("encrypt", () => {
    it("should encrypt a cipher successfully", async () => {
      const expectedCipher: Cipher = {
        id: cipherId as string,
        type: CipherType.Login,
        name: "encrypted-name",
        login: {
          username: "encrypted-username",
          password: "encrypted-password",
        },
      } as unknown as Cipher;

      mockSdkClient.vault().ciphers().encrypt.mockReturnValue({
        cipher: sdkCipher,
        encryptedFor: userId,
      });
      jest.spyOn(Cipher, "fromSdkCipher").mockReturnValue(expectedCipher);

      const result = await cipherEncryptionService.encrypt(cipherViewObj, userId);

      expect(result).toBeDefined();
      expect(result!.cipher).toEqual(expectedCipher);
      expect(result!.encryptedFor).toBe(userId);
      expect(cipherViewObj.toSdkCipherView).toHaveBeenCalled();
      expect(mockSdkClient.vault().ciphers().encrypt).toHaveBeenCalledWith({ id: cipherData.id });
    });

    it("should encrypt FIDO2 credentials if present", async () => {
      const fidoCredentialView = new Fido2CredentialView();
      fidoCredentialView.credentialId = "credentialId";

      cipherViewObj.login.fido2Credentials = [fidoCredentialView];

      jest.spyOn(fidoCredentialView, "toSdkFido2CredentialFullView").mockImplementation(
        () =>
          ({
            credentialId: "credentialId",
          }) as Fido2CredentialFullView,
      );
      jest.spyOn(cipherViewObj, "toSdkCipherView").mockImplementation(
        () =>
          ({
            id: cipherId as string,
            login: {
              fido2Credentials: undefined,
            },
          }) as unknown as SdkCipherView,
      );

      mockSdkClient
        .vault()
        .ciphers()
        .set_fido2_credentials.mockReturnValue({
          id: cipherId as string,
          login: {
            fido2Credentials: [
              {
                credentialId: "encrypted-credentialId",
              },
            ],
          },
        });

      mockSdkClient.vault().ciphers().encrypt.mockReturnValue({
        cipher: sdkCipher,
        encryptedFor: userId,
      });

      cipherObj.login!.fido2Credentials = [
        { credentialId: "encrypted-credentialId" } as unknown as Fido2Credential,
      ];

      jest.spyOn(Cipher, "fromSdkCipher").mockReturnValue(cipherObj);

      const result = await cipherEncryptionService.encrypt(cipherViewObj, userId);

      expect(result).toBeDefined();
      expect(result!.cipher.login!.fido2Credentials).toHaveLength(1);

      // Ensure set_fido2_credentials was called with correct parameters
      expect(mockSdkClient.vault().ciphers().set_fido2_credentials).toHaveBeenCalledWith(
        expect.objectContaining({ id: cipherId }),
        [{ credentialId: "credentialId" }],
      );

      // Encrypted fido2 credential should be in the cipher passed to encrypt
      expect(mockSdkClient.vault().ciphers().encrypt).toHaveBeenCalledWith(
        expect.objectContaining({
          id: cipherId,
          login: { fido2Credentials: [{ credentialId: "encrypted-credentialId" }] },
        }),
      );
    });
  });

  describe("encryptCipherForRotation", () => {
    it("should call the sdk method to encrypt the cipher with a new key for rotation", async () => {
      mockSdkClient.vault().ciphers().encrypt_cipher_for_rotation.mockReturnValue({
        cipher: sdkCipher,
        encryptedFor: userId,
      });

      const newUserKey: UserKey = new SymmetricCryptoKey(
        Utils.fromUtf8ToArray("00000000000000000000000000000000"),
      ) as UserKey;

      const result = await cipherEncryptionService.encryptCipherForRotation(
        cipherViewObj,
        userId,
        newUserKey,
      );

      expect(result).toBeDefined();
      expect(mockSdkClient.vault().ciphers().encrypt_cipher_for_rotation).toHaveBeenCalledWith(
        expect.objectContaining({ id: cipherId }),
        newUserKey.toBase64(),
      );
    });
  });

  describe("moveToOrganization", () => {
    it("should call the sdk method to move a cipher to an organization", async () => {
      const expectedCipher: Cipher = {
        id: cipherId as string,
        type: CipherType.Login,
        name: "encrypted-name",
        organizationId: orgId,
        login: {
          username: "encrypted-username",
          password: "encrypted-password",
        },
      } as unknown as Cipher;

      mockSdkClient.vault().ciphers().move_to_organization.mockReturnValue({
        id: cipherId,
        organizationId: orgId,
      });
      mockSdkClient.vault().ciphers().encrypt.mockReturnValue({
        cipher: sdkCipher,
        encryptedFor: userId,
      });
      jest.spyOn(Cipher, "fromSdkCipher").mockReturnValue(expectedCipher);

      const result = await cipherEncryptionService.moveToOrganization(cipherViewObj, orgId, userId);

      expect(result).toBeDefined();
      expect(result!.cipher).toEqual(expectedCipher);
      expect(result!.encryptedFor).toBe(userId);
      expect(cipherViewObj.toSdkCipherView).toHaveBeenCalled();
      expect(mockSdkClient.vault().ciphers().move_to_organization).toHaveBeenCalledWith(
        { id: cipherData.id },
        orgId,
      );
    });

    it("should re-encrypt any fido2 credentials when moving to an organization", async () => {
      const mockSdkCredentialView = {
        username: "username",
      } as unknown as Fido2CredentialFullView;
      const mockCredentialView = mock<Fido2CredentialView>();
      mockCredentialView.toSdkFido2CredentialFullView.mockReturnValue(mockSdkCredentialView);
      cipherViewObj.login.fido2Credentials = [mockCredentialView];
      const expectedCipher: Cipher = {
        id: cipherId as string,
        type: CipherType.Login,
        name: "encrypted-name",
        organizationId: orgId,
        login: {
          username: "encrypted-username",
          password: "encrypted-password",
          fido2Credentials: [{ username: "encrypted-username" }],
        },
      } as unknown as Cipher;

      mockSdkClient
        .vault()
        .ciphers()
        .set_fido2_credentials.mockReturnValue({
          id: cipherId as any,
          login: {
            fido2Credentials: [mockSdkCredentialView],
          },
        } as SdkCipherView);
      mockSdkClient.vault().ciphers().move_to_organization.mockReturnValue({
        id: cipherId,
        organizationId: orgId,
      });
      mockSdkClient.vault().ciphers().encrypt.mockReturnValue({
        cipher: sdkCipher,
        encryptedFor: userId,
      });
      jest.spyOn(Cipher, "fromSdkCipher").mockReturnValue(expectedCipher);

      const result = await cipherEncryptionService.moveToOrganization(cipherViewObj, orgId, userId);

      expect(result).toBeDefined();
      expect(result!.cipher).toEqual(expectedCipher);
      expect(result!.encryptedFor).toBe(userId);
      expect(cipherViewObj.toSdkCipherView).toHaveBeenCalled();
      expect(mockSdkClient.vault().ciphers().set_fido2_credentials).toHaveBeenCalledWith(
        expect.objectContaining({ id: cipherId }),
        expect.arrayContaining([mockSdkCredentialView]),
      );
      expect(mockSdkClient.vault().ciphers().move_to_organization).toHaveBeenCalledWith(
        { id: cipherData.id, login: { fido2Credentials: [mockSdkCredentialView] } },
        orgId,
      );
    });
  });

  describe("decrypt", () => {
    it("should decrypt a cipher successfully", async () => {
      const expectedCipherView: CipherView = {
        id: cipherId as string,
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
      ] as unknown as SdkFido2Credential[];

      sdkCipherView.login!.fido2Credentials = fido2Credentials;

      const expectedCipherView: CipherView = {
        id: cipherId,
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

      const cipherId2 = "bdc4ef23-2222-477e-ae73-247854af58cb" as CipherId;

      const expectedViews = [
        {
          id: cipherId as string,
          name: "test-name-1",
        } as CipherView,
        {
          id: cipherId2 as string,
          name: "test-name-2",
        } as CipherView,
      ];

      mockSdkClient
        .vault()
        .ciphers()
        .decrypt.mockReturnValueOnce({
          id: cipherId,
          name: "test-name-1",
        } as unknown as SdkCipherView)
        .mockReturnValueOnce({ id: cipherId2, name: "test-name-2" } as unknown as SdkCipherView);

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
        { id: "list1" as any, name: "List 1" } as CipherListView,
        { id: "list2" as any, name: "List 2" } as CipherListView,
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

      jest.spyOn(cipher, "toSdkCipher").mockReturnValue({ id: "id" as any } as SdkCipher);
      jest
        .spyOn(attachment, "toSdkAttachmentView")
        .mockReturnValue({ id: "a1" } as SdkAttachmentView);
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
