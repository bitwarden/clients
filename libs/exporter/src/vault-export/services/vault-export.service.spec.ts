// eslint-disable-next-line no-restricted-imports
import { Arg, Substitute, SubstituteOf } from "@fluffy-spoon/substitute";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { KdfConfig } from "@bitwarden/common/auth/models/domain/kdf-config";
import { KdfType, DEFAULT_PBKDF2_ITERATIONS } from "@bitwarden/common/enums";
import { CipherWithIdExport } from "@bitwarden/common/models/export/cipher-with-ids.export";
import { CryptoFunctionService } from "@bitwarden/common/platform/abstractions/crypto-function.service";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { EncryptedString, EncString } from "@bitwarden/common/platform/models/domain/enc-string";
import { StateService } from "@bitwarden/common/platform/services/state.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { CipherType } from "@bitwarden/common/vault/enums/cipher-type";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { Folder } from "@bitwarden/common/vault/models/domain/folder";
import { Login } from "@bitwarden/common/vault/models/domain/login";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import { LoginView } from "@bitwarden/common/vault/models/view/login.view";

import { BuildTestObject, GetUniqueString } from "../../../../common/spec";

import { VaultExportService } from "./vault-export.service";

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
        LoginView
      ),
      collectionIds: null,
      deletedDate: deleted ? new Date() : null,
    },
    CipherView
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
        Login
      ),
      collectionIds: null,
      deletedDate: deleted ? new Date() : null,
    },
    Cipher
  );
}

function generateFolderView() {
  return BuildTestObject(
    {
      id: GetUniqueString("id"),
      name: GetUniqueString("name"),
      revisionDate: new Date(),
    },
    FolderView
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

function expectEqualFolderViews(folderviews: FolderView[] | Folder[], jsonResult: string) {
  const actual = JSON.stringify(JSON.parse(jsonResult).folders);
  const folders: FolderResponse[] = [];
  folderviews.forEach((c) => {
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
  let exportService: VaultExportService;
  let apiService: SubstituteOf<ApiService>;
  let cryptoFunctionService: SubstituteOf<CryptoFunctionService>;
  let cipherService: SubstituteOf<CipherService>;
  let folderService: SubstituteOf<FolderService>;
  let cryptoService: SubstituteOf<CryptoService>;
  let stateService: SubstituteOf<StateService>;

  beforeEach(() => {
    apiService = Substitute.for<ApiService>();
    cryptoFunctionService = Substitute.for<CryptoFunctionService>();
    cipherService = Substitute.for<CipherService>();
    folderService = Substitute.for<FolderService>();
    cryptoService = Substitute.for<CryptoService>();
    stateService = Substitute.for<StateService>();

    folderService.getAllDecryptedFromState().resolves(UserFolderViews);
    folderService.getAllFromState().resolves(UserFolders);
    stateService.getKdfType().resolves(KdfType.PBKDF2_SHA256);
    stateService.getKdfConfig().resolves(new KdfConfig(DEFAULT_PBKDF2_ITERATIONS));

    exportService = new VaultExportService(
      folderService,
      cipherService,
      apiService,
      cryptoService,
      cryptoFunctionService,
      stateService
    );
  });

  it("exports unencrypted user ciphers", async () => {
    cipherService.getAllDecrypted().resolves(UserCipherViews.slice(0, 1));

    const actual = await exportService.getExport("json");

    expectEqualCiphers(UserCipherViews.slice(0, 1), actual);
  });

  it("exports encrypted json user ciphers", async () => {
    cipherService.getAll().resolves(UserCipherDomains.slice(0, 1));

    const actual = await exportService.getExport("encrypted_json");

    expectEqualCiphers(UserCipherDomains.slice(0, 1), actual);
  });

  it("does not unencrypted export trashed user items", async () => {
    cipherService.getAllDecrypted().resolves(UserCipherViews);

    const actual = await exportService.getExport("json");

    expectEqualCiphers(UserCipherViews.slice(0, 2), actual);
  });

  it("does not encrypted export trashed user items", async () => {
    cipherService.getAll().resolves(UserCipherDomains);

    const actual = await exportService.getExport("encrypted_json");

    expectEqualCiphers(UserCipherDomains.slice(0, 2), actual);
  });

  describe("password protected export", () => {
    let exportString: string;
    let exportObject: any;
    let mac: SubstituteOf<EncString>;
    let data: SubstituteOf<EncString>;
    const password = "password";
    const salt = "salt";

    describe("export json object", () => {
      beforeEach(async () => {
        mac = Substitute.for<EncString>();
        data = Substitute.for<EncString>();

        mac.encryptedString.returns("mac" as EncryptedString);
        data.encryptedString.returns("encData" as EncryptedString);

        jest.spyOn(Utils, "fromBufferToB64").mockReturnValue(salt);
        cipherService.getAllDecrypted().resolves(UserCipherViews.slice(0, 1));

        exportString = await exportService.getPasswordProtectedExport(password);
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
        expect(exportObject.kdfIterations).toEqual(DEFAULT_PBKDF2_ITERATIONS);
      });

      it("has kdfType", () => {
        expect(exportObject.kdfType).toEqual(KdfType.PBKDF2_SHA256);
      });

      it("has a mac property", async () => {
        cryptoService.encrypt(Arg.any(), Arg.any()).resolves(mac);
        exportString = await exportService.getPasswordProtectedExport(password);
        exportObject = JSON.parse(exportString);

        expect(exportObject.encKeyValidation_DO_NOT_EDIT).toEqual(mac.encryptedString);
      });

      it("has data property", async () => {
        cryptoService.encrypt(Arg.any(), Arg.any()).resolves(data);
        exportString = await exportService.getPasswordProtectedExport(password);
        exportObject = JSON.parse(exportString);

        expect(exportObject.data).toEqual(data.encryptedString);
      });

      it("encrypts the data property", async () => {
        const unencrypted = await exportService.getExport();
        expect(exportObject.data).not.toEqual(unencrypted);
      });
    });
  });

  it("exported unencrypted object contains folders", async () => {
    cipherService.getAllDecrypted().resolves(UserCipherViews.slice(0, 1));
    await folderService.getAllDecryptedFromState();
    const actual = await exportService.getExport("json");

    expectEqualFolderViews(UserFolderViews, actual);
  });

  it("exported encrypted json contains folders", async () => {
    cipherService.getAll().resolves(UserCipherDomains.slice(0, 1));
    await folderService.getAllFromState();
    const actual = await exportService.getExport("encrypted_json");

    expectEqualFolders(UserFolders, actual);
  });
});

export class FolderResponse {
  id: string = null;
  name: string = null;
}
