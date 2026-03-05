import { OrganizationId } from "@bitwarden/common/types/guid";
import { CipherType, SecureNoteType } from "@bitwarden/common/vault/enums";
import { CipherRepromptType } from "@bitwarden/common/vault/enums/cipher-reprompt-type";

import { BitwardenCsvImporter } from "./bitwarden-csv-importer";

describe("BitwardenCsvImporter", () => {
  let importer: BitwardenCsvImporter;

  beforeEach(() => {
    importer = new BitwardenCsvImporter();
    importer.organizationId = "orgId" as OrganizationId;
  });

  it("should return an empty result if data is null", async () => {
    const result = await importer.parse("");
    expect(result.success).toBe(false);
    expect(result.ciphers.length).toBe(0);
  });

  it("should parse CSV data correctly", async () => {
    const data =
      `collections,type,name,notes,fields,reprompt,login_uri,login_username,login_password,login_totp` +
      `\ncollection1/collection2,login,testlogin,testnotes,,0,https://example.com,testusername,testpassword,`;

    const result = await importer.parse(data);

    expect(result.success).toBe(true);
    expect(result.ciphers.length).toBe(1);

    const cipher = result.ciphers[0];
    expect(cipher.name).toBe("testlogin");
    expect(cipher.type).toBe(CipherType.Login);
    expect(cipher.notes).toBe("testnotes");
    expect(cipher.reprompt).toBe(CipherRepromptType.None);

    expect(cipher.login).toBeDefined();
    expect(cipher.login.username).toBe("testusername");
    expect(cipher.login.password).toBe("testpassword");
    expect(cipher.login.uris[0].uri).toBe("https://example.com");

    expect(result.collections.length).toBe(2);
    expect(result.collections[0].name).toBe("collection1/collection2");
    expect(result.collections[1].name).toBe("collection1");
  });

  it("should handle secure notes correctly", async () => {
    const data = `name,type,notes` + `\nTest Note,note,Some secure notes`;

    const result = await importer.parse(data);

    expect(result.success).toBe(true);
    expect(result.ciphers.length).toBe(1);

    const cipher = result.ciphers[0];
    expect(cipher.name).toBe("Test Note");
    expect(cipher.type).toBe(CipherType.SecureNote);
    expect(cipher.notes).toBe("Some secure notes");

    expect(cipher.secureNote).toBeDefined();
    expect(cipher.secureNote.type).toBe(SecureNoteType.Generic);
  });

  it("should handle missing fields gracefully", async () => {
    const data =
      `name,login_username,login_password,login_uri` +
      `\nTest Login,username,password,http://example.com`;

    const result = await importer.parse(data);

    expect(result.success).toBe(true);
    expect(result.ciphers.length).toBe(1);

    const cipher = result.ciphers[0];
    expect(cipher.name).toBe("Test Login");
    expect(cipher.type).toBe(CipherType.Login);
    expect(cipher.login.username).toBe("username");
    expect(cipher.login.password).toBe("password");
    expect(cipher.login.uris[0].uri).toBe("http://example.com");
  });

  it("should handle collections correctly", async () => {
    const data = `name,collections` + `\nTest Login,collection1/collection2`;

    const result = await importer.parse(data);

    expect(result.success).toBe(true);
    expect(result.ciphers.length).toBe(1);

    expect(result.collections.length).toBe(2);
    expect(result.collections[0].name).toBe("collection1/collection2");
    expect(result.collections[1].name).toBe("collection1");
  });

  it("should parse archived items correctly", async () => {
    const archivedDate = "2025-01-15T10:30:00.000Z";
    const data =
      `name,type,archivedDate,login_uri,login_username,login_password` +
      `\nArchived Login,login,${archivedDate},https://example.com,user,pass`;

    importer.organizationId = null;
    const result = await importer.parse(data);

    expect(result.success).toBe(true);
    expect(result.ciphers.length).toBe(1);

    const cipher = result.ciphers[0];
    expect(cipher.name).toBe("Archived Login");
    expect(cipher.archivedDate).toBeDefined();
    expect(cipher.archivedDate.toISOString()).toBe(archivedDate);
  });

  it("should handle missing archivedDate gracefully", async () => {
    const data = `name,type,login_uri` + `\nTest Login,login,https://example.com`;

    importer.organizationId = null;
    const result = await importer.parse(data);

    expect(result.success).toBe(true);
    expect(result.ciphers.length).toBe(1);
    expect(result.ciphers[0].archivedDate).toBeUndefined();
  });

  describe("Individual vault imports with folders", () => {
    beforeEach(() => {
      importer.organizationId = null;
    });

    it("should parse folder and create a folder relationship", async () => {
      const data =
        `folder,favorite,type,name,login_uri,login_username,login_password` +
        `\nSocial,0,login,Facebook,https://facebook.com,user@example.com,password`;

      const result = await importer.parse(data);

      expect(result.success).toBe(true);
      expect(result.ciphers.length).toBe(1);
      expect(result.folders.length).toBe(1);
      expect(result.folders[0].name).toBe("Social");
      expect(result.folderRelationships).toHaveLength(1);
      expect(result.folderRelationships[0]).toEqual([0, 0]);
    });

    it("should deduplicate folders when multiple items share the same folder", async () => {
      const data =
        `folder,favorite,type,name,login_uri,login_username,login_password` +
        `\nSocial,0,login,Facebook,https://facebook.com,user1,pass1` +
        `\nSocial,0,login,Twitter,https://twitter.com,user2,pass2`;

      const result = await importer.parse(data);

      expect(result.success).toBe(true);
      expect(result.ciphers.length).toBe(2);
      expect(result.folders.length).toBe(1);
      expect(result.folders[0].name).toBe("Social");
      expect(result.folderRelationships).toHaveLength(2);
      expect(result.folderRelationships[0]).toEqual([0, 0]);
      expect(result.folderRelationships[1]).toEqual([1, 0]);
    });

    it("should create parent folders for nested folder paths", async () => {
      const data =
        `folder,favorite,type,name,login_uri,login_username,login_password` +
        `\nWork/Email,0,login,Gmail,https://gmail.com,user@work.com,pass`;

      const result = await importer.parse(data);

      expect(result.success).toBe(true);
      expect(result.folders.length).toBe(2);
      expect(result.folders.map((f) => f.name)).toContain("Work/Email");
      expect(result.folders.map((f) => f.name)).toContain("Work");
      expect(result.folderRelationships).toHaveLength(1);
      expect(result.folderRelationships[0]).toEqual([0, 0]);
    });

    it("should create no folder or relationship when folder column is empty", async () => {
      const data =
        `folder,favorite,type,name,login_uri,login_username,login_password` +
        `\n,0,login,No Folder Item,https://example.com,user,pass`;

      const result = await importer.parse(data);

      expect(result.success).toBe(true);
      expect(result.ciphers.length).toBe(1);
      expect(result.folders.length).toBe(0);
      expect(result.folderRelationships).toHaveLength(0);
    });
  });

  describe("organization collection import", () => {
    it("should set collectionRelationships mapping ciphers to collections", async () => {
      const data =
        `collections,type,name,login_uri,login_username,login_password` +
        `\ncol1,login,Item1,https://example.com,user1,pass1` +
        `\ncol2,login,Item2,https://example.com,user2,pass2`;

      const result = await importer.parse(data);

      expect(result.success).toBe(true);
      expect(result.ciphers.length).toBe(2);
      expect(result.collections.length).toBe(2);
      // Each cipher maps to its own collection
      expect(result.collectionRelationships).toHaveLength(2);
      expect(result.collectionRelationships[0]).toEqual([0, 0]);
      expect(result.collectionRelationships[1]).toEqual([1, 1]);
    });

    it("should deduplicate collections and map both ciphers to the shared collection", async () => {
      const data =
        `collections,type,name,login_uri,login_username,login_password` +
        `\nShared,login,Item1,https://example.com,user1,pass1` +
        `\nShared,login,Item2,https://example.com,user2,pass2`;

      const result = await importer.parse(data);

      expect(result.success).toBe(true);
      expect(result.ciphers.length).toBe(2);
      expect(result.collections.length).toBe(1);
      expect(result.collections[0].name).toBe("Shared");
      expect(result.collectionRelationships).toHaveLength(2);
      expect(result.collectionRelationships[0]).toEqual([0, 0]);
      expect(result.collectionRelationships[1]).toEqual([1, 0]);
    });
  });
});
