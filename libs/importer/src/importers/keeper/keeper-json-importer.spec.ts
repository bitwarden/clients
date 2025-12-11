import { Utils } from "@bitwarden/common/platform/misc/utils";
import { OrganizationId } from "@bitwarden/common/types/guid";

import { testData as TestData } from "../spec-data/keeper-json/testdata.json";

import { KeeperJsonImporter } from "./keeper-json-importer";

describe("Keeper Json Importer", () => {
  const testDataJson = JSON.stringify(TestData);

  let importer: KeeperJsonImporter;
  beforeEach(() => {
    importer = new KeeperJsonImporter();
  });

  it("should parse login data", async () => {
    const result = await importer.parse(testDataJson);
    expect(result != null).toBe(true);

    const cipher = result.ciphers.shift();
    expect(cipher.name).toEqual("Bank Account 1");
    expect(cipher.login.username).toEqual("customer1234");
    expect(cipher.login.password).toEqual("4813fJDHF4239fdk");
    expect(cipher.login.uris.length).toEqual(1);
    const uriView = cipher.login.uris.shift();
    expect(uriView.uri).toEqual("https://chase.com");
    expect(cipher.notes).toEqual("These are some notes.");

    const cipher2 = result.ciphers.shift();
    expect(cipher2.name).toEqual("Bank Account 2");
    expect(cipher2.login.username).toEqual("mybankusername");
    expect(cipher2.login.password).toEqual("w4k4k193f$^&@#*%2");
    expect(cipher2.login.uris.length).toEqual(1);
    const uriView2 = cipher2.login.uris.shift();
    expect(uriView2.uri).toEqual("https://amex.com");
    expect(cipher2.notes).toEqual("Some great information here.");

    const cipher3 = result.ciphers.shift();
    expect(cipher3.name).toEqual("Some Account");
    expect(cipher3.login.username).toEqual("someUserName");
    expect(cipher3.login.password).toEqual("w4k4k1wergf$^&@#*%2");
    expect(cipher3.notes).toBeNull();
    expect(cipher3.fields.length).toBe(0);
    expect(cipher3.login.uris.length).toEqual(1);
    const uriView3 = cipher3.login.uris.shift();
    expect(uriView3.uri).toEqual("https://example.com");
  });

  it("should import TOTP when present", async () => {
    const result = await importer.parse(testDataJson);
    expect(result != null).toBe(true);

    const cipher = result.ciphers.shift();
    expect(cipher.login.totp).toBeUndefined();

    // 2nd Cipher
    const cipher2 = result.ciphers.shift();
    expect(cipher2.login.totp).toEqual(
      "otpauth://totp/Amazon:me@company.com?secret=JBSWY3DPEHPK3PXP&issuer=Amazon&algorithm=SHA1&digits=6&period=30",
    );
  });

  it("should parse custom fields", async () => {
    const result = await importer.parse(testDataJson);
    expect(result != null).toBe(true);

    const cipher = result.ciphers.shift();
    expect(cipher.fields.length).toBe(1);
    expect(cipher.fields[0].name).toEqual("Account Number");
    expect(cipher.fields[0].value).toEqual("123-456-789");

    // 2nd Cipher
    const cipher2 = result.ciphers.shift();
    expect(cipher2.fields.length).toBe(2);
    expect(cipher2.fields[0].name).toEqual("Security Group");
    expect(cipher2.fields[0].value).toEqual("Public");

    expect(cipher2.fields[1].name).toEqual("IP Address");
    expect(cipher2.fields[1].value).toEqual("12.45.67.8");
  });

  it("should create folders and assigned ciphers to them", async () => {
    const result = await importer.parse(testDataJson);
    expect(result != null).toBe(true);

    const folders = result.folders;
    expect(folders.length).toBe(2);
    expect(folders[0].name).toBe("Optional Private Folder 1");
    expect(folders[1].name).toBe("My Customer 1");

    expect(result.folderRelationships[0]).toEqual([0, 0]);
    expect(result.folderRelationships[1]).toEqual([1, 0]);
    expect(result.folderRelationships[2]).toEqual([1, 1]);
  });

  it("should create collections if part of an organization", async () => {
    importer.organizationId = Utils.newGuid() as OrganizationId;
    const result = await importer.parse(testDataJson);
    expect(result != null).toBe(true);

    const collections = result.collections;
    expect(collections.length).toBe(2);
    expect(collections[0].name).toBe("Optional Private Folder 1");
    expect(collections[1].name).toBe("My Customer 1");

    expect(result.collectionRelationships[0]).toEqual([0, 0]);
    expect(result.collectionRelationships[1]).toEqual([1, 0]);
    expect(result.collectionRelationships[2]).toEqual([1, 1]);
  });
});
