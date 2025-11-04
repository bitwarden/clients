import { CipherType } from "@bitwarden/common/vault/enums";

import { ButtercupCsvImporter } from "./buttercup-csv-importer";
import {
  basicLoginWithSubfolder,
  customFieldsCaseSensitive,
  multipleSubfolders,
  caseInsensitiveCustomFields,
  entryWithoutFolderMarker,
  preservedCustomFields,
  folderMarkerWithCredentials,
  emptyData,
  multipleUris,
} from "./spec-data/buttercup-csv/buttercup-sample.csv";

describe("Buttercup CSV Importer", () => {
  let importer: ButtercupCsvImporter;

  beforeEach(() => {
    importer = new ButtercupCsvImporter();
  });

  it("should parse basic login with subfolder association", async () => {
    const result = await importer.parse(basicLoginWithSubfolder);

    expect(result).not.toBeNull();
    expect(result.success).toBe(true);

    // Should have 2 folders: Root and Root/Email
    expect(result.folders.length).toBe(2);
    expect(result.folders[0].name).toBe("Root");
    expect(result.folders[1].name).toBe("Root/Email");

    // Should have 1 cipher (folder markers should be filtered out)
    expect(result.ciphers.length).toBe(1);

    const cipher = result.ciphers[0];
    expect(cipher.name).toBe("Gmail Account");
    expect(cipher.type).toBe(CipherType.Login);
    expect(cipher.login.username).toBe("john@example.com");
    expect(cipher.login.password).toBe("SecurePass123");
    expect(cipher.login.uris.length).toBe(1);
    expect(cipher.login.uris[0].uri).toBe("https://gmail.com");

    // Cipher should be associated with the "Root/Email" folder
    expect(cipher.folderId).toBe(result.folders[1].id);
  });

  it("should map custom url and note fields to proper cipher properties", async () => {
    const result = await importer.parse(customFieldsCaseSensitive);

    expect(result.success).toBe(true);
    expect(result.ciphers.length).toBe(1);

    const cipher = result.ciphers[0];
    expect(cipher.name).toBe("Bank Account");
    expect(cipher.login.username).toBe("user@bank.com");
    expect(cipher.login.password).toBe("BankPass456");

    // The custom "url" field should be added to login.uris
    expect(cipher.login.uris.length).toBe(1);
    expect(cipher.login.uris[0].uri).toBe("https://bank.com");

    // The custom "note" field should be mapped to cipher.notes
    expect(cipher.notes).toBe("Important banking info");

    // "url" and "note" should not appear in custom fields
    expect(cipher.fields).toEqual([]);
  });

  it("should handle multiple subfolders with proper nesting", async () => {
    const result = await importer.parse(multipleSubfolders);

    expect(result.success).toBe(true);

    // Should have 3 folders: Root, Root/Work, Root/Work/Clients
    expect(result.folders.length).toBe(3);
    expect(result.folders[0].name).toBe("Root");
    expect(result.folders[1].name).toBe("Root/Work");
    expect(result.folders[2].name).toBe("Root/Work/Clients");

    // Should have 2 ciphers
    expect(result.ciphers.length).toBe(2);

    // First cipher should be in Root/Work/Clients
    const clientCipher = result.ciphers[0];
    expect(clientCipher.name).toBe("Client Portal");
    expect(clientCipher.folderId).toBe(result.folders[2].id);

    // Second cipher should be in Root/Work
    const vpnCipher = result.ciphers[1];
    expect(vpnCipher.name).toBe("Office VPN");
    expect(vpnCipher.folderId).toBe(result.folders[1].id);
  });

  it("should handle case-insensitive custom field names", async () => {
    const result = await importer.parse(caseInsensitiveCustomFields);

    expect(result.success).toBe(true);
    expect(result.ciphers.length).toBe(1);

    const cipher = result.ciphers[0];
    expect(cipher.name).toBe("Test Entry");

    // "Note" (capital N) should map to cipher.notes
    expect(cipher.notes).toBe("This is a NOTE field");

    // "Url" (capital U) should map to login.uris
    expect(cipher.login.uris.length).toBe(1);
    expect(cipher.login.uris[0].uri).toBe("https://example.com");

    // Custom fields should not contain Note or Url
    expect(cipher.fields).toEqual([]);
  });

  it("should use fallback folder association when folder marker is missing", async () => {
    const result = await importer.parse(entryWithoutFolderMarker);

    expect(result.success).toBe(true);

    // The processFolder method processes every !group_name it encounters,
    // creating a folder for each unique path component
    // In this case "Root/NoMarker" creates 2 folders: "Root" and "Root/NoMarker"
    expect(result.folders.length).toBeGreaterThanOrEqual(1);
    const noMarkerFolder = result.folders.find((f) => f.name === "Root/NoMarker");
    expect(noMarkerFolder).toBeDefined();

    // Should have 1 cipher
    expect(result.ciphers.length).toBe(1);

    const cipher = result.ciphers[0];
    expect(cipher.name).toBe("Solo Entry");
    // Should be associated with the folder via group name fallback
    expect(cipher.folderId).toBe(noMarkerFolder.id);
  });

  it("should preserve non-standard custom fields", async () => {
    const result = await importer.parse(preservedCustomFields);

    expect(result.success).toBe(true);
    expect(result.ciphers.length).toBe(1);

    const cipher = result.ciphers[0];
    expect(cipher.name).toBe("Account");

    // Should have 2 custom fields
    expect(cipher.fields).not.toBeNull();
    expect(cipher.fields.length).toBe(2);

    const securityQuestion = cipher.fields.find((f) => f.name === "Security Question");
    expect(securityQuestion).toBeDefined();
    expect(securityQuestion.value).toBe("What is your pet name?");

    const recoveryEmail = cipher.fields.find((f) => f.name === "Recovery Email");
    expect(recoveryEmail).toBeDefined();
    expect(recoveryEmail.value).toBe("backup@example.com");
  });

  it("should not remove standard fields from custom fields", async () => {
    const result = await importer.parse(basicLoginWithSubfolder);

    expect(result.success).toBe(true);
    expect(result.ciphers.length).toBe(1);

    const cipher = result.ciphers[0];
    // Verify that processed standard fields are not in custom fields
    expect(cipher.fields).toEqual([]);
  });

  it("should not filter folder marker with username and password", async () => {
    const result = await importer.parse(folderMarkerWithCredentials);

    expect(result.success).toBe(true);

    // Should have 1 folder
    expect(result.folders.length).toBe(1);

    // Should have 1 cipher (not filtered because it has username and password)
    expect(result.ciphers.length).toBe(1);

    const cipher = result.ciphers[0];
    expect(cipher.name).toBe("--");
    expect(cipher.login.username).toBe("admin");
    expect(cipher.login.password).toBe("adminpass");
  });

  it("should handle empty CSV gracefully", async () => {
    const result = await importer.parse(emptyData);

    expect(result).not.toBeNull();
    // Empty CSV with only headers may not parse successfully
    // This is expected behavior
    expect(result.ciphers.length).toBe(0);
  });

  it("should handle multiple URIs from URL and url fields", async () => {
    const result = await importer.parse(multipleUris);

    expect(result.success).toBe(true);
    expect(result.ciphers.length).toBe(1);

    const cipher = result.ciphers[0];
    expect(cipher.name).toBe("Multi URL");

    // Should have 2 URIs: one from URL field and one from url custom field
    expect(cipher.login.uris.length).toBe(2);
    expect(cipher.login.uris[0].uri).toBe("https://primary.com");
    expect(cipher.login.uris[1].uri).toBe("https://secondary.com");
  });

  it("should return error when given invalid CSV", async () => {
    const result = await importer.parse("not a valid csv");

    expect(result).not.toBeNull();
    expect(result.success).toBe(false);
  });

  it("should handle empty input", async () => {
    const result = await importer.parse("");

    expect(result).not.toBeNull();
    expect(result.success).toBe(false);
  });
});
