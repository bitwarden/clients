import { CipherType } from "@bitwarden/common/vault/enums";

import { DelineaXmlImporter } from "./delinea-xml-importer";
import {
  DelineaXmlTestData,
  DelineaXmlTestDataMissingRoot,
} from "./spec-data/delinea-xml/delinea-xml-importer-testdata";

describe("Delinea Xml Importer", () => {
  it("should parse XML data", async () => {
    const importer = new DelineaXmlImporter();
    const result = await importer.parse(DelineaXmlTestData);
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
    const result = await importer.parse(DelineaXmlTestData);
    expect(result.success).toEqual(true);
    expect(result).not.toBeNull();

    expect(result.folders.length).toEqual(1);
    expect(result.folders[0].name).toEqual("Finance");
    expect(result.folderRelationships.length).toEqual(1);
    expect(result.folderRelationships[0]).toEqual([0, 0]);
  });

  it("should import all Secrets as Secure Notes with custom fields for the Secret's info", async () => {
    const importer = new DelineaXmlImporter();
    const result = await importer.parse(DelineaXmlTestData);
    expect(result.success).toEqual(true);
    expect(result).not.toBeNull();

    expect(result.ciphers.length).toEqual(1);
    expect(result.ciphers[0].type).toEqual(CipherType.SecureNote);
    const cipherFields = result.ciphers[0].fields;
    expect(cipherFields.length).toEqual(6);

    expect(cipherFields[0].name).toEqual("username");
    expect(cipherFields[0].value).toEqual("myUser");
    expect(cipherFields[1].name).toEqual("url");
    expect(cipherFields[1].value).toEqual("https://bitwarden.com");
    expect(cipherFields[2].name).toEqual("password");
    expect(cipherFields[2].value).toEqual("SoftBatchCookies123!");
    expect(cipherFields[3].name).toEqual("notes");
    expect(cipherFields[3].value).toEqual("Level 1 = 1024");
    expect(cipherFields[4].name).toEqual("date-created");
    expect(cipherFields[4].value).toEqual("2020-03-09 09:29:08 AM");
    expect(cipherFields[5].name).toEqual("expires");
    expect(cipherFields[5].value).toEqual("2020-03-09 08:52:49 AM");
  });
});
