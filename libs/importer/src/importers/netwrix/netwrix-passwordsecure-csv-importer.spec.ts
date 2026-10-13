import { Utils } from "@bitwarden/common/platform/misc/utils";
import { OrganizationId } from "@bitwarden/common/types/guid";

import {
  credentialsData,
  credentialsDataAlternateUriHeaders,
  credentialsDataEnclosedInQuotes,
  credentialsDataEnclosedInQuotesEmptyRow,
  credentialsDataEnclosedInQuotesEnglishOrgUnit,
  credentialsDataWithFolders,
} from "../spec-data/netwrix-csv/login-export.csv";

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

  it("should map alternate website column headers to URIs", async () => {
    const result = await importer.parse(credentialsDataAlternateUriHeaders);
    expect(result != null).toBe(true);
    expect(result.success).toBe(true);

    const expectedUris: Record<string, string> = {
      "Internetadresse Entry": "https://www.internetadresse.com",
      "Webseite Entry": "https://www.webseite.com",
      "Website Entry": "https://www.website.com",
      "Webmail Entry": "https://www.webmail.com",
      "Web page Entry": "https://www.webpage.com",
      "URL Entry": "https://www.url.com",
    };

    expect(result.ciphers.length).toBe(Object.keys(expectedUris).length);
    result.ciphers.forEach((cipher) => {
      expect(cipher.login.uris.length).toEqual(1);
      expect(cipher.login.uris[0].uri).toEqual(expectedUris[cipher.name]);
      // Alternate URI headers must not leak into custom fields
      expect(cipher.fields.length).toBe(0);
    });
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

  it("should parse exports where each row is wrapped in an extra layer of quotes", async () => {
    const result = await importer.parse(credentialsDataEnclosedInQuotes);
    expect(result != null).toBe(true);
    expect(result.success).toBe(true);
    expect(result.ciphers.length).toBe(2);

    // Both wrapped rows map to folders
    expect(result.folders.map((f) => f.name)).toEqual([
      "folderOrCollection1",
      "folderOrCollection2",
    ]);
    expect(result.folderRelationships).toEqual([
      [0, 0],
      [1, 1],
    ]);

    const first = result.ciphers[0];
    expect(first.name).toEqual("Test Entry 1");
    expect(first.login.username).toEqual("someUser");
    expect(first.login.password).toEqual("somePassword");
    // Kommentare maps to notes
    expect(first.notes).toEqual("some note for example.com");
    // Internetadresse, Webseite and Webseite1 all map to URIs
    expect(first.login.uris.map((u) => u.uri)).toEqual([
      "https://www.example.com",
      "https://webseite.example.com",
      "https://webseite1.example.com",
    ]);
    // DataTags and EMail-Adresse are preserved as custom fields
    const firstFieldNames = first.fields.map((f) => f.name);
    expect(firstFieldNames).toContain("DataTags");
    expect(firstFieldNames).toContain("EMail-Adresse");
    expect(first.fields.find((f) => f.name === "EMail-Adresse").value).toEqual("user@example.com");

    // Second row: empty columns (DataTags, Webseite, Webseite1) are handled gracefully
    const second = result.ciphers[1];
    expect(second.name).toEqual("Test Entry 2");
    expect(second.login.username).toEqual("jdoe");
    expect(second.login.password).toEqual("secret");
    expect(second.notes).toEqual("Description123");
    expect(second.login.uris.map((u) => u.uri)).toEqual(["http://www.123.com"]);
    // Empty DataTags does not create a custom field; populated EMail-Adresse does
    const secondFieldNames = second.fields.map((f) => f.name);
    expect(secondFieldNames).not.toContain("DataTags");
    expect(second.fields.find((f) => f.name === "EMail-Adresse").value).toEqual("jdoe@123.com");
  });

  it("should not crash on an enclosed-in-quotes export whose only row is empty", async () => {
    // Regression: the re-parse used to collapse to just the header and return null, throwing a
    // TypeError in parse(). It must now resolve gracefully instead.
    const result = await importer.parse(credentialsDataEnclosedInQuotesEmptyRow);
    expect(result).not.toBeNull();
    expect(result.success).toBe(true);
  });

  it("should map the English 'Organisational unit' header to a folder", async () => {
    const result = await importer.parse(credentialsDataEnclosedInQuotesEnglishOrgUnit);
    expect(result != null).toBe(true);
    expect(result.success).toBe(true);

    expect(result.folders.length).toBe(1);
    expect(result.folders[0].name).toBe("Bohn, Markus");
    expect(result.folderRelationships[0]).toEqual([0, 0]);

    const cipher = result.ciphers[0];
    expect(cipher.name).toEqual("TESTING");
    expect(cipher.login.username).toEqual("myUser");
    expect(cipher.login.password).toEqual("test");
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
    importer.organizationId = Utils.newGuid() as OrganizationId;
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

  it("should parse multiple collections", async () => {
    importer.organizationId = Utils.newGuid() as OrganizationId;
    const result = await importer.parse(credentialsDataWithFolders);

    expect(result).not.toBeNull();
    expect(result.success).toBe(true);
    expect(result.collections.length).toBe(3);
    expect(result.collections[0].name).toBe("folder1/folder2/folder3");
    expect(result.collections[1].name).toBe("folder1/folder2");
    expect(result.collections[2].name).toBe("folder1");
    expect(result.collectionRelationships.length).toBe(1);
    expect(result.collectionRelationships[0]).toEqual([0, 0]);
  });
});
