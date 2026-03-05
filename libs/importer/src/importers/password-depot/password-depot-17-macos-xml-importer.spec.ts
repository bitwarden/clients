import {
  MacOS_MultipleFolders,
  MacOS_PasswordDepotXmlFile,
  MacOS_WrongVersion,
} from "../spec-data/password-depot-xml";

import { PasswordDepot17XmlImporter } from "./password-depot-17-xml-importer";

describe("Password Depot 17 MacOS Xml Importer", () => {
  it("should return error with invalid export version", async () => {
    const importer = new PasswordDepot17XmlImporter();
    const result = await importer.parse(MacOS_WrongVersion);
    expect(result.errorMessage).toBe(
      "Unsupported export version detected - (only 17.0 is supported)",
    );
  });

  it("should not create a folder/collection if the group fingerprint is null", async () => {
    const importer = new PasswordDepot17XmlImporter();
    const result = await importer.parse(MacOS_PasswordDepotXmlFile);
    expect(result.folders.length).toBe(0);
  });

  it("should create folders and with correct assignments", async () => {
    const importer = new PasswordDepot17XmlImporter();
    const result = await importer.parse(MacOS_MultipleFolders);

    // Expect 10 ciphers, 5 without a folder and 3 within 'folder macos' and 2 with 'folder 2'
    expect(result.ciphers.length).toBe(10);

    expect(result.folders.length).toBe(2);
    expect(result.folders[0].name).toBe("folder macos");
    expect(result.folders[1].name).toBe("folder 2");

    // 3 items within 'folder macos'
    expect(result.folderRelationships[0]).toEqual([5, 0]);
    expect(result.folderRelationships[1]).toEqual([6, 0]);
    expect(result.folderRelationships[2]).toEqual([7, 0]);

    //2 items with 'folder 2'
    expect(result.folderRelationships[3]).toEqual([8, 1]);
    expect(result.folderRelationships[4]).toEqual([9, 1]);
  });

  it("should parse custom fields from a MacOS exported file", async () => {
    const importer = new PasswordDepot17XmlImporter();
    const result = await importer.parse(MacOS_PasswordDepotXmlFile);

    const cipher = result.ciphers.shift();
    expect(cipher.name).toBe("card 1");
    expect(cipher.notes).toBe("comment");

    expect(cipher.card).not.toBeNull();

    expect(cipher.card.cardholderName).toBe("some CC holder");
    expect(cipher.card.number).toBe("4242424242424242");
    expect(cipher.card.brand).toBe("Visa");
    expect(cipher.card.expMonth).toBe("8");
    expect(cipher.card.expYear).toBe("2028");
    expect(cipher.card.code).toBe("125");
  });
});
