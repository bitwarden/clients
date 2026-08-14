import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";
import { CipherType } from "@bitwarden/common/vault/enums";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import { isImportError, PasswordManagerClient } from "@bitwarden/sdk-internal";

import { SdkImportContext } from "../sdk-vault-importer";

import { KdbxSdkImporter } from "./kdbx-sdk-importer";

// `isImportError` is a WASM call; override just it so the error-mapping is unit-testable.
jest.mock("@bitwarden/sdk-internal", () => ({
  ...jest.requireActual("@bitwarden/sdk-internal"),
  isImportError: jest.fn(),
}));

describe("KdbxSdkImporter", () => {
  let importer: KdbxSdkImporter;
  let importKdbx: jest.Mock;
  let client: PasswordManagerClient;

  beforeEach(() => {
    importer = new KdbxSdkImporter();
    importKdbx = jest.fn().mockResolvedValue({ ciphers: [], folders: 0, collections: 0 });
    client = {
      importers: () => ({ import_kdbx: importKdbx }),
    } as unknown as PasswordManagerClient;
  });

  it("declares password + key file credentials and a .kdbx file hint", () => {
    expect(importer.credentialKind).toBe("passwordWithKeyFile");
    expect(importer.fileTypeHint).toBe(".kdbx");
  });

  it("rejects credentials of the wrong kind", async () => {
    await expect(
      importer.import(
        client,
        new Uint8Array(),
        { kind: "password", password: "x" },
        {
          restrictedTypes: [],
        },
      ),
    ).rejects.toThrow();
    expect(importKdbx).not.toHaveBeenCalled();
  });

  it("maps a personal folder target and restricted types into the SDK options", async () => {
    const folder = new FolderView();
    folder.id = Utils.newGuid();
    folder.name = "Personal";
    const context: SdkImportContext = {
      selectedImportTarget: folder,
      restrictedTypes: [CipherType.Card],
    };

    await importer.import(
      client,
      new Uint8Array([1]),
      { kind: "passwordWithKeyFile", password: "pw", keyFile: null },
      context,
    );

    expect(importKdbx).toHaveBeenCalledWith(new Uint8Array([1]), "pw", undefined, {
      organization_id: undefined,
      target_folder: { id: folder.id, name: "Personal" },
      target_collection: undefined,
      restricted_types: [CipherType.Card],
    });
  });

  it("maps an organization collection target and key file into the SDK options", async () => {
    const organizationId = Utils.newGuid() as OrganizationId;
    const collection = new CollectionView({
      id: Utils.newGuid() as CollectionId,
      name: "Shared",
      organizationId,
    });
    const keyFile = new Uint8Array([9, 9]);
    const context: SdkImportContext = {
      organizationId,
      selectedImportTarget: collection,
      restrictedTypes: [],
    };

    await importer.import(
      client,
      new Uint8Array([2]),
      { kind: "passwordWithKeyFile", password: "pw", keyFile },
      context,
    );

    expect(importKdbx).toHaveBeenCalledWith(new Uint8Array([2]), "pw", keyFile, {
      organization_id: organizationId,
      target_folder: undefined,
      target_collection: { id: collection.id, name: "Shared" },
      restricted_types: [],
    });
  });

  it("maps known import-error variants to i18n keys", () => {
    (isImportError as unknown as jest.Mock).mockReturnValue(true);

    expect(importer.errorMessageKey({ variant: "KdbxWrongCredentials" })).toBe(
      "invalidFilePassword",
    );
    expect(importer.errorMessageKey({ variant: "KdbxInvalidFormat" })).toBe("kdbxWrongFileType");
    expect(importer.errorMessageKey({ variant: "KdbxCorruptOrUnsupported" })).toBe(
      "kdbxCorruptOrOutdated",
    );
    expect(importer.errorMessageKey({ variant: "KdbxFileTooLarge" })).toBe("kdbxFileTooLarge");
    expect(importer.errorMessageKey({ variant: "Api" })).toBeUndefined();
  });

  it("returns undefined for non-import errors", () => {
    (isImportError as unknown as jest.Mock).mockReturnValue(false);

    expect(importer.errorMessageKey(new Error("boom"))).toBeUndefined();
  });
});
