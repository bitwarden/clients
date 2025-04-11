import { KeePassXCsvImporter } from "./keepassx-csv-importer";
import { keepassxTestData } from "./spec-data/keepassx-csv/testdata.csv";

describe("KeePassX CSV Importer", () => {
  let importer: KeePassXCsvImporter;

  beforeEach(() => {
    importer = new KeePassXCsvImporter();
  });

  describe("given login data", () => {
    it("should parse login data when provided valid CSV", async () => {
      const result = await importer.parse(keepassxTestData);
      expect(result != null).toBe(true);

      const cipher = result.ciphers.shift();
      expect(cipher.name).toEqual("Example Entry");
      expect(cipher.login.username).toEqual("testuser");
      expect(cipher.login.password).toEqual("password123");
      expect(cipher.login.uris.length).toEqual(1);
      const uriView = cipher.login.uris.shift();
      expect(uriView.uri).toEqual("https://example.com");
      expect(cipher.notes).toEqual("Some notes");
    });

    it("should import TOTP when present in the CSV", async () => {
      const result = await importer.parse(keepassxTestData);
      expect(result != null).toBe(true);

      const cipher = result.ciphers.pop();
      expect(cipher.name).toEqual("Another Entry");
      expect(cipher.login.username).toEqual("anotheruser");
      expect(cipher.login.password).toEqual("anotherpassword");
      expect(cipher.login.uris.length).toEqual(1);
      const uriView = cipher.login.uris.shift();
      expect(uriView.uri).toEqual("https://another.com");
      expect(cipher.notes).toEqual("Another set of notes");
      expect(cipher.login.totp).toEqual("otpauth://totp/Another?secret=ABCD1234EFGH5678");
    });
  });
});
