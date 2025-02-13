import { Utils } from "@bitwarden/common/platform/misc/utils";

import { credentialsData } from "../spec-data/netwrix-csv/login-export.csv";

import { NetwrixPasswordSecureCsvImporter } from "./netwrix-passwordsecure-csv-importer";

describe("Netwrix Password Secure CSV Importer", () => {
  let importer: NetwrixPasswordSecureCsvImporter;
  beforeEach(() => {
    importer = new NetwrixPasswordSecureCsvImporter();
  });

  it("passing invalid data returns false", async () => {
    const result = await importer.parse("");
    expect(result != null).toBe(true);
    expect(result.success).toBe(false);
  });

  it("should parse login records", async () => {
    const result = await importer.parse(credentialsData);
    expect(result != null).toBe(true);

    let cipher = result.ciphers.shift();
    expect(cipher.name).toEqual("Test Entry 1");
    expect(cipher.login.username).toEqual("someUser");
    expect(cipher.login.password).toEqual("somePassword");
    expect(cipher.login.totp).toEqual("someTOTPSeed");
    expect(cipher.login.uris.length).toEqual(1);
    let uriView = cipher.login.uris.shift();
    expect(uriView.uri).toEqual("https://www.example.com");
    expect(cipher.notes).toEqual("some note for example.com");

    cipher = result.ciphers.shift();
    expect(cipher.name).toEqual("Test Entry 2");
    expect(cipher.login.username).toEqual("jdoe");
    expect(cipher.login.password).toEqual("})9+Kg2fz_O#W1§H1-<ox>0Zio");
    expect(cipher.login.totp).toEqual("anotherTOTP");
    expect(cipher.login.uris.length).toEqual(1);
    uriView = cipher.login.uris.shift();
    expect(uriView.uri).toEqual("http://www.123.com");
    expect(cipher.notes).toEqual("Description123");

    cipher = result.ciphers.shift();
    expect(cipher.name).toEqual("Test Entry 3");
    expect(cipher.login.username).toEqual("username");
    expect(cipher.login.password).toEqual("password");
    expect(cipher.login.totp).toBeNull();
    expect(cipher.login.uris.length).toEqual(1);
    uriView = cipher.login.uris.shift();
    expect(uriView.uri).toEqual("http://www.internetsite.com");
    expect(cipher.notes).toEqual("Information");
  });

  it("should add any unmapped fields as custom fields", async () => {
    const result = await importer.parse(credentialsData);
    expect(result != null).toBe(true);

    const cipher = result.ciphers.shift();
    expect(cipher.fields.length).toBe(1);
    const field = cipher.fields.shift();
    expect(field.name).toEqual("DataTags");
    expect(field.value).toEqual("tag1, tag2, tag3");
  });

  it("should parse an item and create a folder", async () => {
    const result = await importer.parse(credentialsData);

    expect(result).not.toBeNull();
    expect(result.success).toBe(true);
    expect(result.folders.length).toBe(2);
    expect(result.folders[0].name).toBe("folderOrCollection1");
    expect(result.folders[1].name).toBe("folderOrCollection2");
    expect(result.folderRelationships[0]).toEqual([0, 0]);
    expect(result.folderRelationships[1]).toEqual([1, 1]);
    expect(result.folderRelationships[2]).toEqual([2, 0]);
  });

  it("should parse an item and create a collection when importing into an organization", async () => {
    importer.organizationId = Utils.newGuid();
    const result = await importer.parse(credentialsData);

    expect(result).not.toBeNull();
    expect(result.success).toBe(true);
    expect(result.collections.length).toBe(2);
    expect(result.collections[0].name).toBe("folderOrCollection1");
    expect(result.collections[1].name).toBe("folderOrCollection2");
    expect(result.collectionRelationships[0]).toEqual([0, 0]);
    expect(result.collectionRelationships[1]).toEqual([1, 1]);
    expect(result.collectionRelationships[2]).toEqual([2, 0]);
  });
});
