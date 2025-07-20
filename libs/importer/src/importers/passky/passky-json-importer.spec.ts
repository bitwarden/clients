import { testData as EncryptedData } from "../spec-data/passky-json/passky-encrypted.json";
import { testData as UnencryptedData } from "../spec-data/passky-json/passky-unencrypted.json";

import { PasskyJsonImporter } from "./passky-json-importer";

describe("Passky Json Importer", () => {
  let importer: PasskyJsonImporter;
  beforeEach(() => {
    importer = new PasskyJsonImporter();
  });

  it("should not import encrypted backups", async () => {
    const testDataJson = JSON.stringify(EncryptedData);
    const result = await importer.parse(testDataJson);
    expect(result != null).toBe(true);
    expect(result.success).toBe(false);
    expect(result.errorMessage).toBe("Unable to import an encrypted passky backup.");
  });

  it("should parse login data", async () => {
    const testDataJson = JSON.stringify(UnencryptedData);
    const result = await importer.parse(testDataJson);
    expect(result != null).toBe(true);

    const cipher = result.ciphers.shift();
    expect(cipher.name).toEqual("https://bitwarden.com/");
    expect(cipher.login.username).toEqual("testUser");
    expect(cipher.login.password).toEqual("testPassword");
    expect(cipher.login.uris.length).toEqual(1);
    const uriView = cipher.login.uris.shift();
    expect(uriView.uri).toEqual("https://bitwarden.com/");
    expect(cipher.notes).toEqual("my notes");
  });
});
