import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountInfo, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { CryptoFunctionService } from "@bitwarden/common/key-management/crypto/abstractions/crypto-function.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import {
  EncryptedString,
  EncString,
} from "@bitwarden/common/key-management/crypto/models/enc-string";
import { PinServiceAbstraction } from "@bitwarden/common/key-management/pin/pin.service.abstraction";
import { CipherWithIdExport } from "@bitwarden/common/models/export/cipher-with-ids.export";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { CipherType } from "@bitwarden/common/vault/enums";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { Folder } from "@bitwarden/common/vault/models/domain/folder";
import { Login } from "@bitwarden/common/vault/models/domain/login";
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
import { ExportedVault, ExportedVaultAsString } from "../types";

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
  const actual = JSON.stringify(JSON.parse(jsonResult).folders);
  const folders: FolderResponse[] = [];
  folderViews.forEach((c) => {
    const folder = new FolderResponse();
    folder.id = c.id;
    folder.name = c.name.toString();
    folders.push(folder);
  });

  expect(actual.length).toBeGreaterThan(0);
  expect(actual).toEqual(JSON.stringify(folders));
}

function expectEqualFolders(folders: Folder[], jsonResult: string) {
  const actual = JSON.stringify(JSON.parse(jsonResult).folders);
  const items: Folder[] = [];
  folders.forEach((c) => {
    const item = new Folder();
    item.id = c.id;
    item.name = c.name;
    items.push(item);
  });

  expect(actual.length).toBeGreaterThan(0);
  expect(actual).toEqual(JSON.stringify(items));
}

describe("VaultExportService", () => {
  let exportService: IndividualVaultExportService;
  let cryptoFunctionService: MockProxy<CryptoFunctionService>;
  let cipherService: MockProxy<CipherService>;
  let pinService: MockProxy<PinServiceAbstraction>;
  let folderService: MockProxy<FolderService>;
  let keyService: MockProxy<KeyService>;
  let encryptService: MockProxy<EncryptService>;
  let accountService: MockProxy<AccountService>;
  let kdfConfigService: MockProxy<KdfConfigService>;
  let apiService: MockProxy<ApiService>;
  let restrictedItemTypesService: Partial<RestrictedItemTypesService>;

  beforeEach(() => {
    cryptoFunctionService = mock<CryptoFunctionService>();
    cipherService = mock<CipherService>();
    pinService = mock<PinServiceAbstraction>();
    folderService = mock<FolderService>();
    keyService = mock<KeyService>();
    encryptService = mock<EncryptService>();
    accountService = mock<AccountService>();
    apiService = mock<ApiService>();

    kdfConfigService = mock<KdfConfigService>();

    folderService.folderViews$.mockReturnValue(of(UserFolderViews));
    folderService.folders$.mockReturnValue(of(UserFolders));
    kdfConfigService.getKdfConfig.mockResolvedValue(DEFAULT_KDF_CONFIG);
    encryptService.encryptString.mockResolvedValue(new EncString("encrypted"));
    keyService.userKey$.mockReturnValue(new BehaviorSubject("mockOriginalUserKey" as any));
    const userId = "" as UserId;
    const accountInfo: AccountInfo = {
      email: "",
      emailVerified: true,
      name: undefined,
    };
    const activeAccount = { id: userId, ...accountInfo };
    accountService.activeAccount$ = new BehaviorSubject(activeAccount);

    restrictedItemTypesService = {
      restricted$: new BehaviorSubject<RestrictedCipherType[]>([]),
      isCipherRestricted: jest.fn().mockReturnValue(false),
      isCipherRestricted$: jest.fn().mockReturnValue(of(false)),
    };

    exportService = new IndividualVaultExportService(
      folderService,
      cipherService,
      pinService,
      keyService,
      encryptService,
      cryptoFunctionService,
      kdfConfigService,
      accountService,
      apiService,
      restrictedItemTypesService as RestrictedItemTypesService,
    );
  });

  it("exports unencrypted user ciphers", async () => {
    cipherService.getAllDecrypted.mockResolvedValue(UserCipherViews.slice(0, 1));

    const actual = await exportService.getExport("json");
    expect(typeof actual.data).toBe("string");
    const exportedData = actual as ExportedVaultAsString;
    expectEqualCiphers(UserCipherViews.slice(0, 1), exportedData.data);
  });

  it("exports encrypted json user ciphers", async () => {
    cipherService.getAll.mockResolvedValue(UserCipherDomains.slice(0, 1));

    const actual = await exportService.getExport("encrypted_json");
    expect(typeof actual.data).toBe("string");
    const exportedData = actual as ExportedVaultAsString;
    expectEqualCiphers(UserCipherDomains.slice(0, 1), exportedData.data);
  });

  it("does not unencrypted export trashed user items", async () => {
    cipherService.getAllDecrypted.mockResolvedValue(UserCipherViews);

    const actual = await exportService.getExport("json");
    expect(typeof actual.data).toBe("string");
    const exportedData = actual as ExportedVaultAsString;
    expectEqualCiphers(UserCipherViews.slice(0, 2), exportedData.data);
  });

  it("does not encrypted export trashed user items", async () => {
    cipherService.getAll.mockResolvedValue(UserCipherDomains);

    const actual = await exportService.getExport("encrypted_json");
    expect(typeof actual.data).toBe("string");
    const exportedData = actual as ExportedVaultAsString;
    expectEqualCiphers(UserCipherDomains.slice(0, 2), exportedData.data);
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

        exportedVault = await exportService.getPasswordProtectedExport(password);
        expect(typeof exportedVault.data).toBe("string");
        exportString = (exportedVault as ExportedVaultAsString).data;
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

        exportedVault = await exportService.getPasswordProtectedExport(password);

        expect(typeof exportedVault.data).toBe("string");
        exportString = (exportedVault as ExportedVaultAsString).data;
        exportObject = JSON.parse(exportString);
        expect(exportObject.encKeyValidation_DO_NOT_EDIT).toEqual(mac.encryptedString);
      });

      it("has data property", async () => {
        encryptService.encryptString.mockResolvedValue(data);

        exportedVault = await exportService.getPasswordProtectedExport(password);

        expect(typeof exportedVault.data).toBe("string");
        exportString = (exportedVault as ExportedVaultAsString).data;
        exportObject = JSON.parse(exportString);
        expect(exportObject.data).toEqual(data.encryptedString);
      });

      it("encrypts the data property", async () => {
        const unEncryptedExportVault = await exportService.getExport();

        expect(typeof unEncryptedExportVault.data).toBe("string");
        const unEncryptedExportString = (unEncryptedExportVault as ExportedVaultAsString).data;
        expect(exportObject.data).not.toEqual(unEncryptedExportString);
      });
    });
  });

  it("exported unencrypted object contains folders", async () => {
    cipherService.getAllDecrypted.mockResolvedValue(UserCipherViews.slice(0, 1));

    const actual = await exportService.getExport("json");

    expect(typeof actual.data).toBe("string");
    const exportedData = actual as ExportedVaultAsString;
    expectEqualFolderViews(UserFolderViews, exportedData.data);
  });

  it("exported encrypted json contains folders", async () => {
    cipherService.getAll.mockResolvedValue(UserCipherDomains.slice(0, 1));

    const actual = await exportService.getExport("encrypted_json");

    expect(typeof actual.data).toBe("string");
    const exportedData = actual as ExportedVaultAsString;
    expectEqualFolders(UserFolders, exportedData.data);
  });
});

export class FolderResponse {
  id: string = null;
  name: string = null;
}
