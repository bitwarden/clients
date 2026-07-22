// Polyfill Symbol.dispose for explicit resource management (used by the SDK client `using`)
if (!(Symbol as any).dispose) {
  (Symbol as any).dispose = Symbol("Symbol.dispose");
}

import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { CollectionService } from "@bitwarden/admin-console/common";
import {
  CollectionView,
  CollectionTypes,
} from "@bitwarden/common/admin-console/models/collections";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { KeyGenerationService } from "@bitwarden/common/key-management/crypto";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { CollectionId, OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { CipherType } from "@bitwarden/common/vault/enums";
import { Folder } from "@bitwarden/common/vault/models/domain/folder";
import { FolderWithOptionalIdRequest } from "@bitwarden/common/vault/models/request/folder-with-optional-id.request";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import { RestrictedItemTypesService } from "@bitwarden/common/vault/services/restricted-item-types.service";
import { KeyService } from "@bitwarden/key-management";

import { BitwardenPasswordProtectedImporter } from "../importers";
import { Importer } from "../importers/importer";
import { ImportResult } from "../models/import-result";
import { SdkImportCredentials } from "../sdk";

import { ImportApiServiceAbstraction } from "./import-api.service.abstraction";
import { ImportService } from "./import.service";

describe("ImportService", () => {
  let importService: ImportService;
  let cipherService: MockProxy<CipherService>;
  let folderService: MockProxy<FolderService>;
  let importApiService: MockProxy<ImportApiServiceAbstraction>;
  let i18nService: MockProxy<I18nService>;
  let collectionService: MockProxy<CollectionService>;
  let keyService: MockProxy<KeyService>;
  let encryptService: MockProxy<EncryptService>;
  let keyGenerationService: MockProxy<KeyGenerationService>;
  let accountService: MockProxy<AccountService>;
  let restrictedItemTypesService: MockProxy<RestrictedItemTypesService>;
  let sdkService: MockProxy<SdkService>;

  beforeEach(() => {
    cipherService = mock<CipherService>();
    folderService = mock<FolderService>();
    importApiService = mock<ImportApiServiceAbstraction>();
    i18nService = mock<I18nService>();
    collectionService = mock<CollectionService>();
    keyService = mock<KeyService>();
    encryptService = mock<EncryptService>();
    keyGenerationService = mock<KeyGenerationService>();
    accountService = mock<AccountService>();
    restrictedItemTypesService = mock<RestrictedItemTypesService>();
    sdkService = mock<SdkService>();

    importService = new ImportService(
      cipherService,
      folderService,
      importApiService,
      i18nService,
      collectionService,
      keyService,
      encryptService,
      keyGenerationService,
      accountService,
      restrictedItemTypesService,
      sdkService,
    );
  });

  describe("getImporterInstance", () => {
    describe("Get bitPasswordProtected importer", () => {
      let importer: Importer;
      const organizationId = Utils.newGuid() as OrganizationId;
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
    const organizationId = Utils.newGuid() as OrganizationId;

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

    const mockName = "myImportTarget";
    const mockId = "myImportTarget" as CollectionId;
    const mockImportTargetCollection = new CollectionView({
      name: mockName,
      id: mockId,
      organizationId,
    });

    const mockName1 = "collection1";
    const mockId1 = "collection1" as CollectionId;
    const mockCollection1 = new CollectionView({
      name: mockName1,
      id: mockId1,
      organizationId,
    });

    const mockName2 = "collection2";
    const mockId2 = "collection2" as CollectionId;
    const mockCollection2 = new CollectionView({
      name: mockName2,
      id: mockId2,
      organizationId,
    });

    it("passing importTarget adds it to collections", async () => {
      await importService["setImportTarget"](
        importResult,
        organizationId,
        mockImportTargetCollection,
      );
      expect(importResult.collections.length).toBe(1);
      expect(importResult.collections[0]).toBe(mockImportTargetCollection);
    });

    it("passing importTarget sets it as new root for all existing collections", async () => {
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

    it("passing importTarget as undefined on setImportTarget with organizationId throws error", async () => {
      const setImportTargetMethod = importService["setImportTarget"](
        null,
        organizationId,
        new Object() as FolderView,
      );

      await expect(setImportTargetMethod).rejects.toThrow();
    });

    it("passing importTarget as undefined on setImportTarget throws error", async () => {
      const setImportTargetMethod = importService["setImportTarget"](
        null,
        undefined,
        new Object() as CollectionView,
      );

      await expect(setImportTargetMethod).rejects.toThrow();
    });

    it("passing importTarget, collectionRelationship has the expected values", async () => {
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
      importResult.folders.push(mockFolder1);
      importResult.folders.push(mockFolder2);

      importResult.ciphers.push(createCipher({ name: "cipher1", folderId: mockFolder1.id }));
      importResult.ciphers.push(createCipher({ name: "cipher2" }));
      importResult.folderRelationships.push([0, 0]);

      await importService["setImportTarget"](importResult, undefined, mockImportTargetFolder);
      expect(importResult.folderRelationships.length).toEqual(2);
      expect(importResult.folderRelationships[0]).toEqual([1, 0]);
      expect(importResult.folderRelationships[1]).toEqual([0, 1]);
    });

    it("If importTarget is of type DefaultUserCollection sets it as new root for all ciphers as nesting is not supported", async () => {
      importResult.collections.push(mockCollection1);
      importResult.collections.push(mockCollection2);
      importResult.ciphers.push(createCipher({ name: "cipher1" }));
      importResult.ciphers.push(createCipher({ name: "cipher2" }));
      importResult.ciphers.push(createCipher({ name: "cipher3" }));

      importResult.collectionRelationships.push([0, 0]);
      importResult.collectionRelationships.push([1, 1]);
      importResult.collectionRelationships.push([2, 0]);

      mockImportTargetCollection.type = CollectionTypes.DefaultUserCollection;
      await importService["setImportTarget"](
        importResult,
        organizationId,
        mockImportTargetCollection,
      );
      expect(importResult.collections.length).toBe(1);
      expect(importResult.collections[0]).toBe(mockImportTargetCollection);

      expect(importResult.collectionRelationships.length).toEqual(3);
      expect(importResult.collectionRelationships[0]).toEqual([0, 0]);
      expect(importResult.collectionRelationships[1]).toEqual([1, 0]);
      expect(importResult.collectionRelationships[2]).toEqual([2, 0]);

      expect(importResult.collectionRelationships.map((r) => r[0])).toEqual([0, 1, 2]);
      expect(importResult.collectionRelationships.every((r) => r[1] === 0)).toBe(true);
    });

    it("If importTarget is of type DefaultUserCollection throw an error if trying to import cipher with multiple collections", async () => {
      importResult.collections.push(mockCollection1);
      importResult.collections.push(mockCollection2);
      importResult.ciphers.push(createCipher({ name: "cipher1" }));
      importResult.collectionRelationships.push([0, 0], [0, 1]);

      mockImportTargetCollection.type = CollectionTypes.DefaultUserCollection;
      const setImportTargetMethod = importService["setImportTarget"](
        importResult,
        organizationId,
        mockImportTargetCollection,
      );
      await expect(setImportTargetMethod).rejects.toThrow();
    });

    it("If importTarget is of type DefaultUserCollection and import has folders, preserve them", async () => {
      importResult.folders.push(mockFolder1);
      importResult.folders.push(mockFolder2);
      importResult.ciphers.push(createCipher({ name: "cipher1", folderId: mockFolder1.id }));
      importResult.ciphers.push(createCipher({ name: "cipher2", folderId: mockFolder2.id }));

      mockImportTargetCollection.type = CollectionTypes.DefaultUserCollection;
      await importService["setImportTarget"](
        importResult,
        organizationId,
        mockImportTargetCollection,
      );

      expect(importResult.folders.length).toEqual(2);
      expect(importResult.folders[0].name).toEqual(mockFolder1.name);
      expect(importResult.folders[1].name).toEqual(mockFolder2.name);
      expect(importResult.folderRelationships.length).toEqual(2);
      expect(importResult.folderRelationships[0]).toEqual([0, 0]);
      expect(importResult.folderRelationships[1]).toEqual([1, 1]);
      expect(importResult.collectionRelationships.length).toEqual(2);
      expect(importResult.collectionRelationships[0]).toEqual([0, 0]);
      expect(importResult.collectionRelationships[1]).toEqual([1, 0]);
    });

    it("If importTarget is of type DefaultUserCollection and import has no folders, convert collections to folders", async () => {
      importResult.collections.push(mockCollection1);
      importResult.collections.push(mockCollection2);
      importResult.ciphers.push(
        createCipher({ name: "cipher1", collectionIds: [mockCollection1.id] }),
      );
      importResult.ciphers.push(
        createCipher({ name: "cipher2", collectionIds: [mockCollection2.id] }),
      );

      mockImportTargetCollection.type = CollectionTypes.DefaultUserCollection;
      await importService["setImportTarget"](
        importResult,
        organizationId,
        mockImportTargetCollection,
      );

      expect(importResult.collections.length).toEqual(1);
      expect(importResult.collectionRelationships.length).toEqual(2);
      expect(importResult.collectionRelationships[0]).toEqual([0, 0]);
      expect(importResult.collectionRelationships[1]).toEqual([1, 0]);
      expect(importResult.folders.length).toEqual(2);
      expect(importResult.folders[0].name).toEqual(mockCollection1.name);
      expect(importResult.folders[1].name).toEqual(mockCollection2.name);
    });
  });

  describe("handleIndividualImport", () => {
    it("sends folder requests without an id when folder has no id", async () => {
      const importResult = new ImportResult();
      const folderView = new FolderView();
      folderView.name = "Test Folder";
      importResult.folders.push(folderView);

      const encryptedFolder = new Folder();
      encryptedFolder.id = "";
      encryptedFolder.name = new EncString("2.encryptedName");
      folderService.encrypt.mockResolvedValue(encryptedFolder);

      cipherService.encryptMany.mockResolvedValue([]);
      keyService.userKey$.mockReturnValue(of(null));

      const userId = "test-user-id" as UserId;
      await importService["handleIndividualImport"](importResult, userId);

      const request = importApiService.postImportCiphers.mock.calls[0][0];
      expect(request.folders).toHaveLength(1);
      expect(request.folders[0]).toBeInstanceOf(FolderWithOptionalIdRequest);
      expect(request.folders[0].name).toBe("2.encryptedName");
      expect(request.folders[0].id).toBeUndefined();
    });

    it("sends folder requests with an id when folder has an id", async () => {
      const importResult = new ImportResult();
      const folderView = new FolderView();
      folderView.name = "Test Folder";
      importResult.folders.push(folderView);

      const encryptedFolder = new Folder();
      encryptedFolder.id = "folder-id-123";
      encryptedFolder.name = new EncString("2.encryptedName");
      folderService.encrypt.mockResolvedValue(encryptedFolder);

      cipherService.encryptMany.mockResolvedValue([]);
      keyService.userKey$.mockReturnValue(of(null));

      const userId = "test-user-id" as UserId;
      await importService["handleIndividualImport"](importResult, userId);

      const request = importApiService.postImportCiphers.mock.calls[0][0];
      expect(request.folders).toHaveLength(1);
      expect(request.folders[0]).toBeInstanceOf(FolderWithOptionalIdRequest);
      expect(request.folders[0].name).toBe("2.encryptedName");
      expect(request.folders[0].id).toBe("folder-id-123");
    });
  });

  describe("importWithSdk", () => {
    const userId = Utils.newGuid() as UserId;
    const credentials: SdkImportCredentials = {
      kind: "passwordWithKeyFile",
      password: "master-pw",
      keyFile: null,
    };
    const file = new Uint8Array([1, 2, 3]);
    const summary = { ciphers: [{ type: CipherType.Login, count: 1 }], folders: 0, collections: 0 };

    // The real KdbxSdkImporter strategy runs (resolved from the registry); only the SDK client is
    // mocked, so these also cover the registry wiring + the strategy's option mapping.
    let importKdbx: jest.Mock;

    beforeEach(() => {
      importKdbx = jest.fn().mockResolvedValue(summary);
      const sdkValue = { importers: jest.fn().mockReturnValue({ import_kdbx: importKdbx }) };
      const sdkClient = {
        take: jest.fn().mockReturnValue({ value: sdkValue, [Symbol.dispose]: jest.fn() }),
      };
      sdkService.userClient$.mockReturnValue(of(sdkClient) as any);
      accountService.activeAccount$ = of({ id: userId } as any);
      (restrictedItemTypesService as any).restricted$ = of([]);
      i18nService.t.mockImplementation((key) => key);
    });

    it("recognizes registered SDK importers", () => {
      expect(importService.isSdkImporter("keepasskdbx")).toBe(true);
      expect(importService.credentialKindFor("keepasskdbx")).toBe("passwordWithKeyFile");
      expect(importService.isSdkImporter("bitwardencsv")).toBe(false);
    });

    it("imports into the personal vault, passing the target folder", async () => {
      const target = new FolderView();
      target.id = Utils.newGuid();
      target.name = "My Folder";

      const result = await importService.importWithSdk(
        "keepasskdbx",
        file,
        credentials,
        null,
        target,
        false,
      );

      expect(result).toBe(summary);
      expect(importKdbx).toHaveBeenCalledWith(file, "master-pw", undefined, {
        organization_id: undefined,
        target_folder: { id: target.id, name: "My Folder" },
        target_collection: undefined,
        restricted_types: [],
      });
    });

    it("imports into an organization, passing the target collection", async () => {
      const organizationId = Utils.newGuid() as OrganizationId;
      const target = new CollectionView({
        id: Utils.newGuid() as CollectionId,
        name: "Shared",
        organizationId,
      });

      await importService.importWithSdk(
        "keepasskdbx",
        file,
        credentials,
        organizationId,
        target,
        false,
      );

      expect(importKdbx).toHaveBeenCalledWith(file, "master-pw", undefined, {
        organization_id: organizationId,
        target_folder: undefined,
        target_collection: { id: target.id, name: "Shared" },
        restricted_types: [],
      });
    });

    it("throws importUnassignedItemsError for an org import with no target and no permission", async () => {
      const organizationId = Utils.newGuid() as OrganizationId;

      await expect(
        importService.importWithSdk("keepasskdbx", file, credentials, organizationId, null, false),
      ).rejects.toThrow("importUnassignedItemsError");
      expect(importKdbx).not.toHaveBeenCalled();
    });

    it("allows an org import with no target when the user has import/export permission", async () => {
      const organizationId = Utils.newGuid() as OrganizationId;

      await importService.importWithSdk(
        "keepasskdbx",
        file,
        credentials,
        organizationId,
        null,
        true,
      );

      expect(importKdbx).toHaveBeenCalledWith(
        file,
        "master-pw",
        undefined,
        expect.objectContaining({
          organization_id: organizationId,
          target_collection: undefined,
        }),
      );
    });

    it("forwards restricted cipher types to the SDK options", async () => {
      (restrictedItemTypesService as any).restricted$ = of([{ cipherType: CipherType.Card }]);

      await importService.importWithSdk("keepasskdbx", file, credentials, null, null, false);

      expect(importKdbx).toHaveBeenCalledWith(
        file,
        "master-pw",
        undefined,
        expect.objectContaining({ restricted_types: [CipherType.Card] }),
      );
    });

    it("forwards the key file when provided", async () => {
      const keyFile = new Uint8Array([9, 9]);

      await importService.importWithSdk(
        "keepasskdbx",
        file,
        { kind: "passwordWithKeyFile", password: "pw", keyFile },
        null,
        null,
        false,
      );

      expect(importKdbx).toHaveBeenCalledWith(file, "pw", keyFile, expect.anything());
    });

    it("throws for an unregistered SDK importer", async () => {
      await expect(
        importService.importWithSdk("bitwardencsv", file, credentials, null, null, false),
      ).rejects.toThrow("No SDK importer registered");
    });

    it("throws when the SDK client is unavailable", async () => {
      sdkService.userClient$.mockReturnValue(of(null) as any);

      await expect(
        importService.importWithSdk("keepasskdbx", file, credentials, null, null, false),
      ).rejects.toThrow("SDK not available");
    });
  });
});

function createCipher(options: Partial<CipherView> = {}) {
  const cipher = new CipherView();

  cipher.name = options.name;
  cipher.type = options.type;
  cipher.folderId = options.folderId;
  cipher.collectionIds = options.collectionIds;
  cipher.organizationId = options.organizationId;

  return cipher;
}
