import { mock, MockProxy } from "jest-mock-extended";
import * as JSZip from "jszip";
import { BehaviorSubject, of } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { CryptoFunctionService } from "@bitwarden/common/key-management/crypto/abstractions/crypto-function.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import {
  EncryptedString,
  EncString,
} from "@bitwarden/common/key-management/crypto/models/enc-string";
import { PinServiceAbstraction } from "@bitwarden/common/key-management/pin/pin.service.abstraction";
import { CipherWithIdExport } from "@bitwarden/common/models/export/cipher-with-ids.export";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { CipherId, emptyGuid, UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { CipherType } from "@bitwarden/common/vault/enums";
import { AttachmentData } from "@bitwarden/common/vault/models/data/attachment.data";
import { CipherData } from "@bitwarden/common/vault/models/data/cipher.data";
import { Attachment } from "@bitwarden/common/vault/models/domain/attachment";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { Folder } from "@bitwarden/common/vault/models/domain/folder";
import { Login } from "@bitwarden/common/vault/models/domain/login";
import { AttachmentResponse } from "@bitwarden/common/vault/models/response/attachment.response";
import { AttachmentView } from "@bitwarden/common/vault/models/view/attachment.view";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import { LoginView } from "@bitwarden/common/vault/models/view/login.view";
import {
  RestrictedCipherType,
  RestrictedItemTypesService,
} from "@bitwarden/common/vault/services/restricted-item-types.service";
import {
  DEFAULT_KDF_CONFIG,
  PBKDF2KdfConfig,
  KdfConfigService,
  KeyService,
  KdfType,
} from "@bitwarden/key-management";

import { BuildTestObject, GetUniqueString } from "../../../../../../common/spec";
import {
  BitwardenJsonExport,
  ExportedVault,
  ExportedVaultAsBlob,
  ExportedVaultAsString,
} from "../types";

import { IndividualVaultExportService } from "./individual-vault-export.service";

const UserCipherViews = [
  generateCipherView(false),
  generateCipherView(false),
  generateCipherView(true),
];

const UserCipherDomains = [
  generateCipherDomain(false),
  generateCipherDomain(false),
  generateCipherDomain(true),
];

const UserFolderViews = [generateFolderView(), generateFolderView()];

const UserFolders = [generateFolder(), generateFolder()];

function generateCipherView(deleted: boolean) {
  return BuildTestObject(
    {
      id: GetUniqueString("id"),
      notes: GetUniqueString("notes"),
      type: CipherType.Login,
      login: BuildTestObject<LoginView>(
        {
          username: GetUniqueString("username"),
          password: GetUniqueString("password"),
        },
        LoginView,
      ),
      collectionIds: null,
      deletedDate: deleted ? new Date() : null,
    },
    CipherView,
  );
}

function generateCipherDomain(deleted: boolean) {
  return BuildTestObject(
    {
      id: GetUniqueString("id"),
      notes: new EncString(GetUniqueString("notes")),
      type: CipherType.Login,
      login: BuildTestObject<Login>(
        {
          username: new EncString(GetUniqueString("username")),
          password: new EncString(GetUniqueString("password")),
        },
        Login,
      ),
      collectionIds: null,
      deletedDate: deleted ? new Date() : null,
    },
    Cipher,
  );
}

function generateFolderView() {
  return BuildTestObject(
    {
      id: GetUniqueString("id"),
      name: GetUniqueString("name"),
      revisionDate: new Date(),
    },
    FolderView,
  );
}

function generateFolder() {
  const actual = Folder.fromJSON({
    revisionDate: new Date("2022-08-04T01:06:40.441Z").toISOString(),
    name: "name" as EncryptedString,
    id: "id",
  });
  return actual;
}

function expectEqualCiphers(ciphers: CipherView[] | Cipher[], jsonResult: string) {
  const actual = JSON.stringify(JSON.parse(jsonResult).items);
  const items: CipherWithIdExport[] = [];
  ciphers.forEach((c: CipherView | Cipher) => {
    const item = new CipherWithIdExport();
    item.build(c);
    items.push(item);
  });

  expect(actual).toEqual(JSON.stringify(items));
}

function expectEqualFolderViews(folderViews: FolderView[] | Folder[], jsonResult: string) {
  const actual = JSON.parse(jsonResult).folders;
  const folders: FolderResponse[] = [];
  folderViews.forEach((c) => {
    const folder = new FolderResponse();
    folder.id = c.id;
    folder.name = c.name.toString();
    folders.push(folder);
  });

  expect(actual.length).toBeGreaterThan(0);
  expect(actual).toEqual(folders);
}

function expectEqualFolders(folders: Folder[], jsonResult: string) {
  const actual = JSON.parse(jsonResult).folders;

  const expected = folders.map((f) => ({
    id: f.id,
    name: f.name.encryptedString,
  }));

  expect(actual).toMatchObject(expected);
}

describe("VaultExportService", () => {
  let exportService: IndividualVaultExportService;
  let cryptoFunctionService: MockProxy<CryptoFunctionService>;
  let cipherService: MockProxy<CipherService>;
  let pinService: MockProxy<PinServiceAbstraction>;
  let folderService: MockProxy<FolderService>;
  let keyService: MockProxy<KeyService>;
  let encryptService: MockProxy<EncryptService>;
  let kdfConfigService: MockProxy<KdfConfigService>;
  let apiService: MockProxy<ApiService>;
  let restrictedSubject: BehaviorSubject<RestrictedCipherType[]>;
  let restrictedItemTypesService: Partial<RestrictedItemTypesService>;
  let fetchMock: jest.Mock;

  const userId = emptyGuid as UserId;

  beforeEach(() => {
    cryptoFunctionService = mock<CryptoFunctionService>();
    cipherService = mock<CipherService>();
    pinService = mock<PinServiceAbstraction>();
    folderService = mock<FolderService>();
    keyService = mock<KeyService>();
    encryptService = mock<EncryptService>();
    kdfConfigService = mock<KdfConfigService>();
    apiService = mock<ApiService>();

    keyService.userKey$.mockReturnValue(new BehaviorSubject("mockOriginalUserKey" as any));
    restrictedSubject = new BehaviorSubject<RestrictedCipherType[]>([]);
    restrictedItemTypesService = {
      restricted$: new BehaviorSubject<RestrictedCipherType[]>([]),
      isCipherRestricted: jest.fn().mockReturnValue(false),
      isCipherRestricted$: jest.fn().mockReturnValue(of(false)),
    };

    fetchMock = jest.fn().mockResolvedValue({});
    global.fetch = fetchMock;

    const attachmentResponse = {
      id: GetUniqueString("id"),
      url: "https://someurl.com",
      fileName: "fileName",
      key: GetUniqueString("key"),
      size: "size",
      sizeName: "sizeName",
    } as AttachmentResponse;

    folderService.folderViews$.mockReturnValue(of(UserFolderViews));
    folderService.folders$.mockReturnValue(of(UserFolders));
    kdfConfigService.getKdfConfig.mockResolvedValue(DEFAULT_KDF_CONFIG);
    encryptService.encryptString.mockResolvedValue(new EncString("encrypted"));
    apiService.getAttachmentData.mockResolvedValue(attachmentResponse);

    exportService = new IndividualVaultExportService(
      folderService,
      cipherService,
      pinService,
      keyService,
      encryptService,
      cryptoFunctionService,
      kdfConfigService,
      apiService,
      restrictedItemTypesService as RestrictedItemTypesService,
    );
  });

  it("exports unencrypted user ciphers", async () => {
    cipherService.getAllDecrypted.mockResolvedValue(UserCipherViews.slice(0, 1));

    const actual = await exportService.getExport(userId, "json");
    expect(typeof actual.data).toBe("string");
    const exportedData = actual as ExportedVaultAsString;
    expectEqualCiphers(UserCipherViews.slice(0, 1), exportedData.data);
  });

  it("exports encrypted json user ciphers", async () => {
    cipherService.getAll.mockResolvedValue(UserCipherDomains.slice(0, 1));

    const actual = await exportService.getExport(userId, "encrypted_json");
    expect(typeof actual.data).toBe("string");
    const exportedData = actual as ExportedVaultAsString;
    expectEqualCiphers(UserCipherDomains.slice(0, 1), exportedData.data);
  });

  it("does not unencrypted export trashed user items", async () => {
    cipherService.getAllDecrypted.mockResolvedValue(UserCipherViews);

    const actual = await exportService.getExport(userId, "json");
    expect(typeof actual.data).toBe("string");
    const exportedData = actual as ExportedVaultAsString;
    expectEqualCiphers(UserCipherViews.slice(0, 2), exportedData.data);
  });

  it("does not encrypted export trashed user items", async () => {
    cipherService.getAll.mockResolvedValue(UserCipherDomains);

    const actual = await exportService.getExport(userId, "encrypted_json");
    expect(typeof actual.data).toBe("string");
    const exportedData = actual as ExportedVaultAsString;
    expectEqualCiphers(UserCipherDomains.slice(0, 2), exportedData.data);
  });

  it("does not unencrypted export restricted user items", async () => {
    restrictedSubject.next([{ cipherType: CipherType.Card, allowViewOrgIds: [] }]);
    const cardCipher = generateCipherView(false);
    cardCipher.type = CipherType.Card;

    (restrictedItemTypesService.isCipherRestricted as jest.Mock)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true) // cardCipher - restricted
      .mockReturnValueOnce(false);

    const testCiphers = [UserCipherViews[0], cardCipher, UserCipherViews[1]];
    cipherService.getAllDecrypted.mockResolvedValue(testCiphers);

    const actual = await exportService.getExport(userId, "json");
    expect(typeof actual.data).toBe("string");
    const exportedData = actual as ExportedVaultAsString;

    expectEqualCiphers([UserCipherViews[0], UserCipherViews[1]], exportedData.data);
  });

  it("does not encrypted export restricted user items", async () => {
    restrictedSubject.next([{ cipherType: CipherType.Card, allowViewOrgIds: [] }]);
    const cardCipher = generateCipherDomain(false);
    cardCipher.type = CipherType.Card;

    (restrictedItemTypesService.isCipherRestricted as jest.Mock)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true) // cardCipher - restricted
      .mockReturnValueOnce(false);

    const testCiphers = [UserCipherDomains[0], cardCipher, UserCipherDomains[1]];
    cipherService.getAll.mockResolvedValue(testCiphers);

    const actual = await exportService.getExport(userId, "encrypted_json");
    expect(typeof actual.data).toBe("string");
    const exportedData = actual as ExportedVaultAsString;

    expectEqualCiphers([UserCipherDomains[0], UserCipherDomains[1]], exportedData.data);
  });

  describe("zip export", () => {
    it("contains data.json", async () => {
      cipherService.getAllDecrypted.mockResolvedValue([]);
      folderService.getAllDecryptedFromState.mockResolvedValue([]);

      const exportedVault = await exportService.getExport(userId, "zip");

      expect(exportedVault.type).toBe("application/zip");
      const exportZip = exportedVault as ExportedVaultAsBlob;
      const zip = await JSZip.loadAsync(exportZip.data);
      const data = await zip.file("data.json")?.async("string");
      expect(data).toBeDefined();
    });

    it("filters out ciphers that are assigned to an org", async () => {
      // Create a cipher that is not assigned to an org
      const cipherData = new CipherData();
      cipherData.id = "mock-id";
      const cipherView = new CipherView(new Cipher(cipherData));

      // Create a cipher that is assigned to an org
      const orgCipher = new CipherData();
      orgCipher.id = "mock-from-org-id";
      orgCipher.organizationId = "mock-org-id";
      const orgCipherView = new CipherView(new Cipher(orgCipher));

      // Mock the cipher service to return both ciphers
      cipherService.getAllDecrypted.mockResolvedValue([cipherView, orgCipherView]);
      folderService.getAllDecryptedFromState.mockResolvedValue([]);

      const exportedVault = await exportService.getExport(userId, "zip");

      const zip = await JSZip.loadAsync(exportedVault.data);
      const data = await zip.file("data.json")?.async("string");
      const exportData: BitwardenJsonExport = JSON.parse(data);
      expect(exportData.items.length).toBe(1);
      expect(exportData.items[0].id).toBe("mock-id");
      expect(exportData.items[0].organizationId).toBeUndefined();
    });

    it.each([[400], [401], [404], [500]])(
      "throws error if the http request fails (status === %n)",
      async (status) => {
        const cipherData = new CipherData();
        cipherData.id = "mock-id";
        const cipherView = new CipherView(new Cipher(cipherData));
        const attachmentView = new AttachmentView(new Attachment(new AttachmentData()));
        attachmentView.fileName = "mock-file-name";
        cipherView.attachments = [attachmentView];

        cipherService.getAllDecrypted.mockResolvedValue([cipherView]);
        folderService.getAllDecryptedFromState.mockResolvedValue([]);
        encryptService.decryptFileData.mockResolvedValue(new Uint8Array(255));

        global.fetch = jest.fn(() =>
          Promise.resolve({
            status,
          }),
        ) as any;
        global.Request = jest.fn(() => {}) as any;

        await expect(async () => {
          await exportService.getExport(userId, "zip");
        }).rejects.toThrow("Error downloading attachment");
      },
    );

    it("throws error if decrypting attachment fails", async () => {
      const cipherData = new CipherData();
      cipherData.id = "mock-id";
      const cipherView = new CipherView(new Cipher(cipherData));
      const attachmentView = new AttachmentView(new Attachment(new AttachmentData()));
      attachmentView.fileName = "mock-file-name";
      cipherView.attachments = [attachmentView];

      cipherService.getAllDecrypted.mockResolvedValue([cipherView]);
      folderService.getAllDecryptedFromState.mockResolvedValue([]);
      cipherService.getDecryptedAttachmentBuffer.mockRejectedValue(
        new Error("Error decrypting attachment"),
      );

      global.fetch = jest.fn(() =>
        Promise.resolve({
          status: 200,
          arrayBuffer: () => Promise.resolve(null),
        }),
      ) as any;
      global.Request = jest.fn(() => {}) as any;

      await expect(async () => {
        await exportService.getExport(userId, "zip");
      }).rejects.toThrow("Error decrypting attachment");
    });

    it("contains attachments with folders", async () => {
      const cipherData = new CipherData();
      cipherData.id = "mock-id";
      const cipherRecord: Record<CipherId, CipherData> = {
        ["mock-id" as CipherId]: cipherData,
      };
      const cipherView = new CipherView(new Cipher(cipherData));
      const attachmentView = new AttachmentView(new Attachment(new AttachmentData()));
      attachmentView.fileName = "mock-file-name";
      cipherView.attachments = [attachmentView];
      cipherService.ciphers$.mockReturnValue(of(cipherRecord));
      cipherService.getAllDecrypted.mockResolvedValue([cipherView]);
      folderService.getAllDecryptedFromState.mockResolvedValue([]);
      cipherService.getDecryptedAttachmentBuffer.mockResolvedValue(new Uint8Array(255));
      global.fetch = jest.fn(() =>
        Promise.resolve({
          status: 200,
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(255)),
        }),
      ) as any;
      global.Request = jest.fn(() => {}) as any;

      const exportedVault = await exportService.getExport(userId, "zip");

      expect(exportedVault.type).toBe("application/zip");
      const exportZip = exportedVault as ExportedVaultAsBlob;
      const zip = await JSZip.loadAsync(exportZip.data);
      const attachment = await zip.file("attachments/mock-id/mock-file-name")?.async("blob");
      expect(attachment).toBeDefined();
    });
  });

  describe("password protected export", () => {
    let exportedVault: ExportedVault;
    let exportString: string;
    let exportObject: any;
    let mac: MockProxy<EncString>;
    let data: MockProxy<EncString>;
    const password = "password";
    const salt = "salt";

    describe("export json object", () => {
      beforeEach(async () => {
        mac = mock<EncString>();
        data = mock<EncString>();

        mac.encryptedString = "mac" as EncryptedString;
        data.encryptedString = "encData" as EncryptedString;

        jest.spyOn(Utils, "fromBufferToB64").mockReturnValue(salt);
        cipherService.getAllDecrypted.mockResolvedValue(UserCipherViews.slice(0, 1));

        exportedVault = await exportService.getPasswordProtectedExport(userId, password);
        exportString = exportedVault.data;
        exportObject = JSON.parse(exportString);
      });

      it("specifies it is encrypted", () => {
        expect(exportObject.encrypted).toBe(true);
      });

      it("specifies it's password protected", () => {
        expect(exportObject.passwordProtected).toBe(true);
      });

      it("specifies salt", () => {
        expect(exportObject.salt).toEqual("salt");
      });

      it("specifies kdfIterations", () => {
        expect(exportObject.kdfIterations).toEqual(PBKDF2KdfConfig.ITERATIONS.defaultValue);
      });

      it("has kdfType", () => {
        expect(exportObject.kdfType).toEqual(KdfType.PBKDF2_SHA256);
      });

      it("has a mac property", async () => {
        encryptService.encryptString.mockResolvedValue(mac);
        exportedVault = await exportService.getPasswordProtectedExport(userId, password);
        exportString = exportedVault.data;
        exportObject = JSON.parse(exportString);

        expect(exportObject.encKeyValidation_DO_NOT_EDIT).toEqual(mac.encryptedString);
      });

      it("has data property", async () => {
        encryptService.encryptString.mockResolvedValue(data);
        exportedVault = await exportService.getPasswordProtectedExport(userId, password);
        exportString = exportedVault.data;
        exportObject = JSON.parse(exportString);

        expect(exportObject.data).toEqual(data.encryptedString);
      });

      it("encrypts the data property", async () => {
        const unEncryptedExportVault = await exportService.getExport(userId);

        const unEncryptedExportString = unEncryptedExportVault.data;
        expect(exportObject.data).not.toEqual(unEncryptedExportString);
      });
    });
  });

  it("exported unencrypted object contains folders", async () => {
    cipherService.getAllDecrypted.mockResolvedValue(UserCipherViews.slice(0, 1));
    folderService.folderViews$.mockReturnValue(of(UserFolderViews));

    const actual = await exportService.getExport(userId, "json");

    expect(typeof actual.data).toBe("string");
    const exportedData = actual as ExportedVaultAsString;
    expectEqualFolderViews(UserFolderViews, exportedData.data);
  });

  it("exported encrypted json contains folders", async () => {
    cipherService.getAll.mockResolvedValue(UserCipherDomains.slice(0, 1));
    folderService.folders$.mockReturnValue(of(UserFolders));

    const actual = await exportService.getExport(userId, "encrypted_json");

    expect(typeof actual.data).toBe("string");
    const exportedData = actual as ExportedVaultAsString;
    expectEqualFolders(UserFolders, exportedData.data);
  });
});

export class FolderResponse {
  id: string = null;
  name: string = null;
}
