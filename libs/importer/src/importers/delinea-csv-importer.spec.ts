import { CipherType, FieldType } from "@bitwarden/common/vault/enums";

import { DelineaCsvImporter } from "./delinea-csv-importer";
import {
  DelineaCsvTestData,
  DelineaCsvTestDataEmpty,
} from "./spec-data/delinea/delinea-csv-importer-testdata";

describe("Delinea CSV Importer", () => {
  it("should parse CSV data", async () => {
    const importer = new DelineaCsvImporter();
    const result = await importer.parse(DelineaCsvTestData);
    expect(result.success).toEqual(true);
    expect(result).not.toBeNull();
    expect(result.ciphers.length).toEqual(2);
  });

  it("should return a result with no data if the import file has now rows besides the header", async () => {
    const importer = new DelineaCsvImporter();
    const result = await importer.parse(DelineaCsvTestDataEmpty);
    expect(result.success).toEqual(false);
    expect(result.ciphers.length).toEqual(0);
    expect(result.folders.length).toEqual(0);
    expect(result.folderRelationships.length).toEqual(0);
  });

  it("should import folders if they exist", async () => {
    const importer = new DelineaCsvImporter();
    const result = await importer.parse(DelineaCsvTestData);
    expect(result.success).toEqual(true);
    expect(result).not.toBeNull();

    expect(result.folders.length).toEqual(1);
    expect(result.folders[0].name).toEqual("Finance");
    expect(result.folderRelationships.length).toEqual(1);
    expect(result.folderRelationships[0]).toEqual([0, 0]);
  });

  it("should import Secrets without a url field as Secure Notes with custom fields for all Secret info except notes", async () => {
    const importer = new DelineaCsvImporter();
    const result = await importer.parse(DelineaCsvTestData);
    expect(result.success).toEqual(true);
    expect(result).not.toBeNull();

    expect(result.ciphers.length).toEqual(2);
    const noteCipher = result.ciphers[1];
    expect(noteCipher.type).toEqual(CipherType.SecureNote);
    expect(noteCipher.notes).toEqual("Level 1 = 1024");

    const cipherFields = noteCipher.fields;
    expect(cipherFields.length).toEqual(4);
    expect(cipherFields[0].name).toEqual("Username");
    expect(cipherFields[0].value).toEqual("myUser");
    expect(cipherFields[1].name).toEqual("Password");
    expect(cipherFields[1].value).toEqual("SoftBatchCookies123!");
    expect(cipherFields[1].type).toEqual(FieldType.Hidden);
    expect(cipherFields[2].name).toEqual("Date Created");
    expect(cipherFields[2].value).toEqual("9/24/2020 9:02");
    expect(cipherFields[3].name).toEqual("Expires");
    expect(cipherFields[3].value).toEqual("9/24/2020 9:00");
  });

  it("should import Secrets with a url field as Logins with Secret info set in the correct place", async () => {
    const importer = new DelineaCsvImporter();
    const result = await importer.parse(DelineaCsvTestData);
    expect(result.success).toEqual(true);
    expect(result).not.toBeNull();

    expect(result.ciphers.length).toEqual(2);
    const loginCipher = result.ciphers[0];
    expect(loginCipher.type).toEqual(CipherType.Login);
    expect(loginCipher.login.username).toEqual("myUser");
    expect(loginCipher.login.uris.length).toEqual(1);
    expect(loginCipher.login.uris[0].uri).toEqual("https://bitwarden.com");
    expect(loginCipher.login.password).toEqual("SoftBatchCookies123!");
    expect(loginCipher.notes).toEqual("Level 1 = 1024");

    const cipherFields = loginCipher.fields;
    expect(cipherFields.length).toEqual(2);
    expect(cipherFields[0].name).toEqual("Date Created");
    expect(cipherFields[0].value).toEqual("3/9/2020 9:29");
    expect(cipherFields[1].name).toEqual("Expires");
    expect(cipherFields[1].value).toEqual("3/9/2020 8:52");
  });
});
