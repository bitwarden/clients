import { CipherType } from "@bitwarden/common/vault/enums";

import { DelineaXmlImporter } from "./delinea-xml-importer";
import {
  DelineaXmlTestDataNote,
  DelineaXmlTestDataLogin,
  DelineaXmlTestDataMissingRoot,
  DelineaXmlTestDataEmptySlugValue,
} from "./spec-data/delinea/delinea-xml-importer-testdata";

describe("Delinea Xml Importer", () => {
  it("should parse XML data", async () => {
    const importer = new DelineaXmlImporter();
    const result = await importer.parse(DelineaXmlTestDataNote);
    expect(result.success).toEqual(true);
    expect(result).not.toBeNull();
  });

  it("should return error with missing root tag", async () => {
    const importer = new DelineaXmlImporter();
    const result = await importer.parse(DelineaXmlTestDataMissingRoot);
    expect(result.success).toEqual(false);
    expect(result.errorMessage).toBe("Missing `ImportFile` node.");
  });

  it("should import folders if they exist", async () => {
    const importer = new DelineaXmlImporter();
    const result = await importer.parse(DelineaXmlTestDataLogin);
    expect(result.success).toEqual(true);
    expect(result).not.toBeNull();

    expect(result.folders.length).toEqual(1);
    expect(result.folders[0].name).toEqual("Finance");
    expect(result.folderRelationships.length).toEqual(1);
    expect(result.folderRelationships[0]).toEqual([0, 0]);
  });

  it("should import Secrets without a url slug as Secure Notes with custom fields for all Secret info except notes", async () => {
    const importer = new DelineaXmlImporter();
    const result = await importer.parse(DelineaXmlTestDataNote);
    expect(result.success).toEqual(true);
    expect(result).not.toBeNull();

    expect(result.ciphers.length).toEqual(1);
    const noteCipher = result.ciphers[0];
    expect(noteCipher.type).toEqual(CipherType.SecureNote);
    expect(noteCipher.notes).toEqual("Level 1 = 1024");

    const cipherFields = noteCipher.fields;
    expect(cipherFields.length).toEqual(3);
    expect(cipherFields[0].name).toEqual("username");
    expect(cipherFields[0].value).toEqual("myUser");
    expect(cipherFields[1].name).toEqual("password");
    expect(cipherFields[1].value).toEqual("SoftBatchCookies123!");
    expect(cipherFields[2].name).toEqual("expires");
    expect(cipherFields[2].value).toEqual("2020-03-09 08:52:49 AM");

    expect(result.folders.length).toEqual(0);
    expect(result.folderRelationships.length).toEqual(0);
  });

  it("should import Secrets with a url slug as Logins with Secret info set in the correct place", async () => {
    const importer = new DelineaXmlImporter();
    const result = await importer.parse(DelineaXmlTestDataLogin);
    expect(result.success).toEqual(true);
    expect(result).not.toBeNull();

    expect(result.ciphers.length).toEqual(1);
    const loginCipher = result.ciphers[0];
    expect(loginCipher.type).toEqual(CipherType.Login);
    expect(loginCipher.login.username).toEqual("myUser");
    expect(loginCipher.login.uris.length).toEqual(1);
    expect(loginCipher.login.uris[0].uri).toEqual("https://bitwarden.com");
    expect(loginCipher.login.password).toEqual("SoftBatchCookies123!");
    expect(loginCipher.notes).toEqual("Level 1 = 1024");

    const cipherFields = loginCipher.fields;
    expect(cipherFields.length).toEqual(2);
    expect(cipherFields[0].name).toEqual("date-created");
    expect(cipherFields[0].value).toEqual("2020-03-09 09:29:08 AM");
    expect(cipherFields[1].name).toEqual("expires");
    expect(cipherFields[1].value).toEqual("2020-03-09 08:52:49 AM");

    expect(result.folders.length).toEqual(1);
    expect(result.folderRelationships.length).toEqual(1);
    expect(result.folderRelationships[0]).toEqual([0, 0]);
  });

  it("should ignore slugs whose values are empty", async () => {
    const importer = new DelineaXmlImporter();
    const result = await importer.parse(DelineaXmlTestDataEmptySlugValue);
    expect(result.success).toEqual(true);
    expect(result).not.toBeNull();

    expect(result.ciphers.length).toEqual(1);
    const cipher = result.ciphers[0];
    expect(cipher.type).toEqual(CipherType.SecureNote);
    expect(cipher.notes).toBeNull();

    const cipherFields = result.ciphers[0].fields;
    expect(cipherFields.length).toEqual(2);
    expect(cipherFields[0].name).toEqual("username");
    expect(cipherFields[0].value).toEqual("myUser");
    expect(cipherFields[1].name).toEqual("password");
    expect(cipherFields[1].value).toEqual("SoftBatchCookies123!");

    expect(result.folders.length).toEqual(0);
    expect(result.folderRelationships.length).toEqual(0);
  });
});
