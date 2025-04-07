import { CipherType } from "@bitwarden/common/vault/enums";

import { ImportResult } from "../../models/import-result";
import { dutchHeaders } from "../spec-data/passwordxp-csv/dutch-headers";
import { germanHeaders } from "../spec-data/passwordxp-csv/german-headers";
import { noFolder } from "../spec-data/passwordxp-csv/no-folder.csv";
import { withFolders } from "../spec-data/passwordxp-csv/passwordxp-with-folders.csv";
import { withoutFolders } from "../spec-data/passwordxp-csv/passwordxp-without-folders.csv";

import { PasswordXPCsvImporter } from "./passwordxp-csv-importer";

async function importLoginWithCustomFields(importer: PasswordXPCsvImporter, csvData: string) {
  const result: ImportResult = await importer.parse(csvData);
  expect(result.success).toBe(true);

  const cipher = result.ciphers.shift();
  expect(cipher.type).toBe(CipherType.Login);
  expect(cipher.name).toBe("Title2");
  expect(cipher.notes).toBe("Test Notes");
  expect(cipher.login.username).toBe("Username2");
  expect(cipher.login.password).toBe("12345678");
  expect(cipher.login.uris[0].uri).toBe("http://URL2.com");

  expect(cipher.fields.length).toBe(5);
  let field = cipher.fields.shift();
  expect(field.name).toBe("Account");
  expect(field.value).toBe("Account2");

  field = cipher.fields.shift();
  expect(field.name).toBe("Modified");
  expect(field.value).toBe("27-3-2024 08:11:21");

  field = cipher.fields.shift();
  expect(field.name).toBe("Created");
  expect(field.value).toBe("27-3-2024 08:11:21");

  field = cipher.fields.shift();
  expect(field.name).toBe("Expire on");
  expect(field.value).toBe("27-5-2024 08:11:21");

  field = cipher.fields.shift();
  expect(field.name).toBe("Modified by");
  expect(field.value).toBe("someone");
}

describe("PasswordXPCsvImporter", () => {
  let importer: PasswordXPCsvImporter;

  beforeEach(() => {
    importer = new PasswordXPCsvImporter();
    // Importers currently create their own ConsoleLogService. This should be replaced by injecting a test log service.
    jest.spyOn(console, "warn").mockImplementation();
  });

  it("should return success false if CSV data is null", async () => {
    const data = "";
    const result: ImportResult = await importer.parse(data);
    expect(result.success).toBe(false);
  });

  it("should return success false if CSV headers did not get translated", async () => {
    const data = germanHeaders.replace("Titel;", "UnknownTitle;");
    const result: ImportResult = await importer.parse(data);
    expect(result.success).toBe(false);
  });

  it("should skip rows starting with >>>", async () => {
    const result: ImportResult = await importer.parse(noFolder);
    expect(result.success).toBe(true);
    expect(result.ciphers.length).toBe(0);
  });

  it("should parse CSV data and return success true", async () => {
    const result: ImportResult = await importer.parse(withoutFolders);
    expect(result.success).toBe(true);
    expect(result.ciphers.length).toBe(4);

    let cipher = result.ciphers.shift();
    expect(cipher.type).toBe(CipherType.Login);
    expect(cipher.name).toBe("Title2");
    expect(cipher.notes).toBe("Test Notes");
    expect(cipher.login.username).toBe("Username2");
    expect(cipher.login.password).toBe("12345678");
    expect(cipher.login.uris[0].uri).toBe("http://URL2.com");

    cipher = result.ciphers.shift();
    expect(cipher.type).toBe(CipherType.Login);
    expect(cipher.name).toBe("Title Test 1");
    expect(cipher.notes).toBe("Test Notes 2");
    expect(cipher.login.username).toBe("Username1");
    expect(cipher.login.password).toBe("Password1");
    expect(cipher.login.uris[0].uri).toBe("http://URL1.com");

    cipher = result.ciphers.shift();
    expect(cipher.type).toBe(CipherType.SecureNote);
    expect(cipher.name).toBe("Certificate 1");
    expect(cipher.notes).toBe("Test Notes Certicate 1");

    cipher = result.ciphers.shift();
    expect(cipher.type).toBe(CipherType.Login);
    expect(cipher.name).toBe("test");
    expect(cipher.notes).toBe("Test Notes 3");
    expect(cipher.login.username).toBe("testtest");
    expect(cipher.login.password).toBe("test");
    expect(cipher.login.uris[0].uri).toBe("http://test");
  });

  it("should parse CSV data with English headers and import unmapped columns as custom fields", async () => {
    await importLoginWithCustomFields(importer, withoutFolders);
  });

  it("should parse CSV data with German headers and import unmapped columns as custom fields", async () => {
    await importLoginWithCustomFields(importer, germanHeaders);
  });

  it("should parse CSV data with Dutch headers and import unmapped columns as custom fields", async () => {
    await importLoginWithCustomFields(importer, dutchHeaders);
  });

  it("should parse CSV data with folders and assign items to them", async () => {
    const result: ImportResult = await importer.parse(withFolders);
    expect(result.success).toBe(true);
    expect(result.ciphers.length).toBe(5);

    expect(result.folders.length).toBe(3);
    let folder = result.folders.shift();
    expect(folder.name).toEqual("Test Folder");
    folder = result.folders.shift();
    expect(folder.name).toEqual("Cert folder");
    folder = result.folders.shift();
    expect(folder.name).toEqual("Cert folder/Nested folder");

    expect(result.folderRelationships.length).toBe(4);
    let folderRelationship = result.folderRelationships.shift();
    expect(folderRelationship).toEqual([1, 0]);
    folderRelationship = result.folderRelationships.shift();
    expect(folderRelationship).toEqual([2, 1]);
    folderRelationship = result.folderRelationships.shift();
    expect(folderRelationship).toEqual([3, 1]);
    folderRelationship = result.folderRelationships.shift();
    expect(folderRelationship).toEqual([4, 2]);
    folderRelationship = result.folderRelationships.shift();
  });

  it("should convert folders to collections when importing into an organization", async () => {
    importer.organizationId = "someOrg";
    const result: ImportResult = await importer.parse(withFolders);
    expect(result.success).toBe(true);
    expect(result.ciphers.length).toBe(5);

    expect(result.collections.length).toBe(3);
    expect(result.collections[0].name).toEqual("Test Folder");
    expect(result.collectionRelationships[0]).toEqual([1, 0]);
    expect(result.collections[1].name).toEqual("Cert folder");
    expect(result.collectionRelationships[1]).toEqual([2, 1]);
    expect(result.collectionRelationships[2]).toEqual([3, 1]);
    expect(result.collections[2].name).toEqual("Cert folder/Nested folder");

    expect(result.collectionRelationships.length).toBe(4);
    let collectionRelationship = result.collectionRelationships.shift();
    expect(collectionRelationship).toEqual([1, 0]);
    collectionRelationship = result.collectionRelationships.shift();
    expect(collectionRelationship).toEqual([2, 1]);
    collectionRelationship = result.collectionRelationships.shift();
    expect(collectionRelationship).toEqual([3, 1]);
    collectionRelationship = result.collectionRelationships.shift();
    expect(collectionRelationship).toEqual([4, 2]);
    collectionRelationship = result.collectionRelationships.shift();
  });
});
