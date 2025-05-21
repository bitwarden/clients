import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";

import { KeePass2XmlImporter } from "./keepass2-xml-importer";
import {
  TestData,
  TestData1,
  TestData2,
} from "./spec-data/keepass2-xml/keepass2-xml-importer-testdata";

describe("KeePass2 Xml Importer", () => {
  it("should parse XML data", async () => {
    const importer = new KeePass2XmlImporter();
    const result = await importer.parse(TestData);
    expect(result != null).toBe(true);
  });

  it("parse XML should contains folders", async () => {
    const importer = new KeePass2XmlImporter();
    const folder = new FolderView();
    folder.name = "Folder2";
    const actual = [folder];

    const result = await importer.parse(TestData);
    expect(result.folders).toEqual(actual);
  });

  it("parse XML should contains login details", async () => {
    const importer = new KeePass2XmlImporter();
    const result = await importer.parse(TestData);
    expect(result.ciphers[0].login.uri != null).toBe(true);
    expect(result.ciphers[0].login.username != null).toBe(true);
    expect(result.ciphers[0].login.password != null).toBe(true);
  });

  it("should return error with missing root tag", async () => {
    const importer = new KeePass2XmlImporter();
    const result = await importer.parse(TestData1);
    expect(result.errorMessage).toBe("Missing `KeePassFile > Root` node.");
  });

  it("should return error with missing KeePassFile tag", async () => {
    const importer = new KeePass2XmlImporter();
    const result = await importer.parse(TestData2);
    expect(result.success).toBe(false);
  });
});
