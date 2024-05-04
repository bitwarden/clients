import { mock, MockProxy } from "jest-mock-extended";

import { UriMatchStrategy } from "@bitwarden/common/models/domain/domain-service";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CollectionService } from "@bitwarden/common/vault/abstractions/collection.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { CipherRepromptType } from "@bitwarden/common/vault/enums/cipher-reprompt-type";
import { CipherType } from "@bitwarden/common/vault/enums/cipher-type";
import { FieldType } from "@bitwarden/common/vault/enums/field-type.enum";
import { CipherData } from "@bitwarden/common/vault/models/data/cipher.data";
import { CollectionData } from "@bitwarden/common/vault/models/data/collection.data";
import { FolderData } from "@bitwarden/common/vault/models/data/folder.data";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { Collection } from "@bitwarden/common/vault/models/domain/collection";
import { Folder } from "@bitwarden/common/vault/models/domain/folder";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { CollectionView } from "@bitwarden/common/vault/models/view/collection.view";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";

import { unencryptedIndividualExport } from "../../spec/test-data/bitwarden-json/unencrypted-individual.json";
import { unencryptedOrgExport } from "../../spec/test-data/bitwarden-json/unencrypted-org.json";
import { BitwardenPasswordProtectedImporter } from "../importers/bitwarden/bitwarden-password-protected-importer";
import { Importer } from "../importers/importer";
import { ImportResult } from "../models/import-result";

import { ImportApiServiceAbstraction } from "./import-api.service.abstraction";
import { ImportService } from "./import.service";

const cipherData: CipherData = {
  id: "id",
  organizationId: "1234",
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
  fields: [
    {
      name: "EncryptedString",
      value: "EncryptedString",
      type: FieldType.Text,
      linkedId: null,
    },
    {
      name: "EncryptedString",
      value: "EncryptedString",
      type: FieldType.Hidden,
      linkedId: null,
    },
  ],
};

const collectionData: CollectionData = {
  id: "1234-1234" as CollectionId,
  organizationId: "1234" as OrganizationId,
  name: "collection123",
  readOnly: false,
  manage: true,
  externalId: "",
  hidePasswords: false,
};

const folderData: FolderData = {
  id: "id",
  name: "name",
  revisionDate: "2024-03-02",
};

describe("ImportService", () => {
  let importService: ImportService;
  let cipherService: MockProxy<CipherService>;
  let folderService: MockProxy<FolderService>;
  let importApiService: MockProxy<ImportApiServiceAbstraction>;
  let i18nService: MockProxy<I18nService>;
  let collectionService: MockProxy<CollectionService>;
  let cryptoService: MockProxy<CryptoService>;

  beforeEach(() => {
    cipherService = mock<CipherService>();
    folderService = mock<FolderService>();
    importApiService = mock<ImportApiServiceAbstraction>();
    i18nService = mock<I18nService>();
    collectionService = mock<CollectionService>();
    cryptoService = mock<CryptoService>();

    importService = new ImportService(
      cipherService,
      folderService,
      importApiService,
      i18nService,
      collectionService,
      cryptoService,
    );
  });

  describe("getImporterInstance", () => {
    describe("Get bitPasswordProtected importer", () => {
      let importer: Importer;
      const organizationId = Utils.newGuid();
      const password = Utils.newGuid();
      const promptForPassword_callback = async () => {
        return password;
      };

      beforeEach(() => {
        importer = importService.getImporter(
          "bitwardenpasswordprotected",
          promptForPassword_callback,
          organizationId,
        );
      });

      it("returns an instance of BitwardenPasswordProtectedImporter", () => {
        expect(importer).toBeInstanceOf(BitwardenPasswordProtectedImporter);
      });

      it("has the promptForPassword_callback set", async () => {
        // Cast to any to access private property. Note: assumes instance of BitwardenPasswordProtectedImporter
        expect((importer as any).promptForPassword_callback).not.toBeNull();
        expect(await (importer as any).promptForPassword_callback()).toEqual(password);
      });

      it("has the appropriate organization Id", () => {
        expect(importer.organizationId).toEqual(organizationId);
      });
    });
  });

  describe("setImportTarget", () => {
    const organizationId = Utils.newGuid();

    let importResult: ImportResult;

    beforeEach(() => {
      importResult = new ImportResult();
    });

    it("empty importTarget does nothing", async () => {
      await importService["setImportTarget"](importResult, null, null);
      expect(importResult.folders.length).toBe(0);
    });

    const mockImportTargetFolder = new FolderView();
    mockImportTargetFolder.id = "myImportTarget";
    mockImportTargetFolder.name = "myImportTarget";

    it("passing importTarget adds it to folders", async () => {
      folderService.getAllDecryptedFromState.mockReturnValue(
        Promise.resolve([mockImportTargetFolder]),
      );

      await importService["setImportTarget"](importResult, null, mockImportTargetFolder);
      expect(importResult.folders.length).toBe(1);
      expect(importResult.folders[0]).toBe(mockImportTargetFolder);
    });

    const mockFolder1 = new FolderView();
    mockFolder1.id = "folder1";
    mockFolder1.name = "folder1";

    const mockFolder2 = new FolderView();
    mockFolder2.id = "folder2";
    mockFolder2.name = "folder2";

    it("passing importTarget sets it as new root for all existing folders", async () => {
      folderService.getAllDecryptedFromState.mockResolvedValue([
        mockImportTargetFolder,
        mockFolder1,
        mockFolder2,
      ]);

      importResult.folders.push(mockFolder1);
      importResult.folders.push(mockFolder2);

      await importService["setImportTarget"](importResult, null, mockImportTargetFolder);
      expect(importResult.folders.length).toBe(3);
      expect(importResult.folders[0]).toBe(mockImportTargetFolder);
      expect(importResult.folders[1].name).toBe(
        `${mockImportTargetFolder.name}/${mockFolder1.name}`,
      );
      expect(importResult.folders[2].name).toBe(
        `${mockImportTargetFolder.name}/${mockFolder2.name}`,
      );
    });

    const mockImportTargetCollection = new CollectionView();
    mockImportTargetCollection.id = "myImportTarget";
    mockImportTargetCollection.name = "myImportTarget";
    mockImportTargetCollection.organizationId = organizationId;

    const mockCollection1 = new CollectionView();
    mockCollection1.id = "collection1";
    mockCollection1.name = "collection1";
    mockCollection1.organizationId = organizationId;

    const mockCollection2 = new CollectionView();
    mockCollection1.id = "collection2";
    mockCollection1.name = "collection2";
    mockCollection1.organizationId = organizationId;

    it("passing importTarget adds it to collections", async () => {
      collectionService.getAllDecrypted.mockResolvedValue([
        mockImportTargetCollection,
        mockCollection1,
      ]);

      await importService["setImportTarget"](
        importResult,
        organizationId,
        mockImportTargetCollection,
      );
      expect(importResult.collections.length).toBe(1);
      expect(importResult.collections[0]).toBe(mockImportTargetCollection);
    });

    it("passing importTarget sets it as new root for all existing collections", async () => {
      collectionService.getAllDecrypted.mockResolvedValue([
        mockImportTargetCollection,
        mockCollection1,
        mockCollection2,
      ]);

      importResult.collections.push(mockCollection1);
      importResult.collections.push(mockCollection2);

      await importService["setImportTarget"](
        importResult,
        organizationId,
        mockImportTargetCollection,
      );
      expect(importResult.collections.length).toBe(3);
      expect(importResult.collections[0]).toBe(mockImportTargetCollection);
      expect(importResult.collections[1].name).toBe(
        `${mockImportTargetCollection.name}/${mockCollection1.name}`,
      );
      expect(importResult.collections[2].name).toBe(
        `${mockImportTargetCollection.name}/${mockCollection2.name}`,
      );
    });

    it("passing importTarget as null on setImportTarget with organizationId throws error", async () => {
      const setImportTargetMethod = importService["setImportTarget"](
        null,
        organizationId,
        new Object() as FolderView,
      );

      await expect(setImportTargetMethod).rejects.toThrow();
    });

    it("passing importTarget as null on setImportTarget throws error", async () => {
      const setImportTargetMethod = importService["setImportTarget"](
        null,
        "",
        new Object() as CollectionView,
      );

      await expect(setImportTargetMethod).rejects.toThrow();
    });

    it("passing importTarget, collectionRelationship has the expected values", async () => {
      collectionService.getAllDecrypted.mockResolvedValue([
        mockImportTargetCollection,
        mockCollection1,
        mockCollection2,
      ]);

      importResult.ciphers.push(createCipher({ name: "cipher1" }));
      importResult.ciphers.push(createCipher({ name: "cipher2" }));
      importResult.collectionRelationships.push([0, 0]);
      importResult.collections.push(mockCollection1);
      importResult.collections.push(mockCollection2);

      await importService["setImportTarget"](
        importResult,
        organizationId,
        mockImportTargetCollection,
      );
      expect(importResult.collectionRelationships.length).toEqual(2);
      expect(importResult.collectionRelationships[0]).toEqual([1, 0]);
      expect(importResult.collectionRelationships[1]).toEqual([0, 1]);
    });

    it("passing importTarget, folderRelationship has the expected values", async () => {
      folderService.getAllDecryptedFromState.mockResolvedValue([
        mockImportTargetFolder,
        mockFolder1,
        mockFolder2,
      ]);

      importResult.folders.push(mockFolder1);
      importResult.folders.push(mockFolder2);

      importResult.ciphers.push(createCipher({ name: "cipher1", folderId: mockFolder1.id }));
      importResult.ciphers.push(createCipher({ name: "cipher2" }));
      importResult.folderRelationships.push([0, 0]);

      await importService["setImportTarget"](importResult, "", mockImportTargetFolder);
      expect(importResult.folderRelationships.length).toEqual(2);
      expect(importResult.folderRelationships[0]).toEqual([1, 0]);
      expect(importResult.folderRelationships[1]).toEqual([0, 1]);
    });

    it("if no targetCollection is found, does nothing", async () => {
      collectionService.getAllDecrypted.mockResolvedValue([mockCollection1, mockCollection2]);
      importResult.collections.push(mockImportTargetCollection);

      await importService["setImportTarget"](importResult, "123", mockImportTargetCollection);
      expect(importResult.collections.length).toBe(1);
      expect(importResult.collections[0].name).toBe("myImportTarget");
    });
  });

  describe("Import organization", () => {
    let importer: Importer;
    const organizationId = Utils.newGuid();
    const password = Utils.newGuid();
    const promptForPassword_callback = async () => {
      return password;
    };

    beforeEach(() => {
      importer = importService.getImporter(
        "bitwardenpasswordprotected",
        promptForPassword_callback,
        organizationId,
      );
    });

    it("Should work flawlessly", async () => {
      cipherService.encrypt.mockResolvedValue(new Cipher(cipherData));
      collectionService.encrypt.mockResolvedValue(new Collection(collectionData));

      const result = await importService.import(importer, unencryptedOrgExport, "1234", null, true);

      expect(result.collectionRelationships.length).toBe(1);
      expect(result.ciphers.length).toBe(1);
      expect(result.collections.length).toBe(1);
    });

    it("Collections should have organizationId", async () => {
      cipherService.encrypt.mockResolvedValue(new Cipher(cipherData));
      collectionService.encrypt.mockResolvedValue(new Collection(collectionData));

      const result = await importService.import(importer, unencryptedOrgExport, "1234", null, true);

      expect(result.collections[0].organizationId).not.toBeNull();
    });

    it("Should throw error building import data on null ciphers", async () => {
      cipherService.encrypt.mockResolvedValue(undefined);
      collectionService.encrypt.mockResolvedValue(new Collection(collectionData));

      await expect(
        importService.import(importer, unencryptedOrgExport, "1234", null, true),
      ).rejects.toThrow(
        "Unexpected error building import data: Cannot read properties of undefined (reading 'type')",
      );
    });

    it("Should throw error building import data on null collections", async () => {
      cipherService.encrypt.mockResolvedValue(new Cipher(cipherData));
      collectionService.encrypt.mockResolvedValue(undefined);

      await expect(
        importService.import(importer, unencryptedOrgExport, "1234", null, true),
      ).rejects.toThrow();
    });
  });

  describe("Import individual vault", () => {
    let importer: Importer;
    const password = Utils.newGuid();
    const promptForPassword_callback = async () => {
      return password;
    };

    beforeEach(() => {
      importer = importService.getImporter(
        "bitwardenpasswordprotected",
        promptForPassword_callback,
        null,
      );
    });

    it("Should work flawlessly", async () => {
      cipherService.encrypt.mockResolvedValue(new Cipher(cipherData));
      folderService.encrypt.mockResolvedValue(new Folder(folderData));

      const result = await importService.import(
        importer,
        unencryptedIndividualExport,
        null,
        null,
        true,
      );

      expect(result.folderRelationships.length).toBe(1);
      expect(result.ciphers.length).toBe(2);
      expect(result.folders.length).toBe(1);
    });

    it("Should throw error building import data on null ciphers", async () => {
      cipherService.encrypt.mockResolvedValue(undefined);
      folderService.encrypt.mockResolvedValue(new Folder(folderData));

      await expect(
        importService.import(importer, unencryptedIndividualExport, null, null, true),
      ).rejects.toThrow(
        "Unexpected error building import data: Cannot read properties of undefined (reading 'type')",
      );
    });

    it("Should throw error building import data on null folders", async () => {
      cipherService.encrypt.mockResolvedValue(new Cipher(cipherData));
      folderService.encrypt.mockResolvedValue(undefined);

      await expect(
        importService.import(importer, unencryptedIndividualExport, null, null, true),
      ).rejects.toThrow(
        "Unexpected error building import data: Cannot read properties of undefined (reading 'name')",
      );
    });
  });
});

function createCipher(options: Partial<CipherView> = {}) {
  const cipher = new CipherView();

  cipher.name;
  cipher.type = options.type;
  cipher.folderId = options.folderId;
  cipher.collectionIds = options.collectionIds;
  cipher.organizationId = options.organizationId;

  return cipher;
}
