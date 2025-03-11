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
});
