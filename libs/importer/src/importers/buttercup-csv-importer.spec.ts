import { ButtercupCsvImporter } from "./buttercup-csv-importer";
import {
  buttercupCsvTestData,
  buttercupCsvWithCustomFieldsTestData,
  buttercupCsvWithNoteTestData,
  buttercupCsvWithSubfoldersTestData,
  buttercupCsvWithUrlFieldTestData,
} from "./spec-data/buttercup-csv/testdata.csv";

describe("Buttercup CSV Importer", () => {
  let importer: ButtercupCsvImporter;

  beforeEach(() => {
    importer = new ButtercupCsvImporter();
  });

  describe("given basic login data", () => {
    it("should parse login data when provided valid CSV", async () => {
      const result = await importer.parse(buttercupCsvTestData);
      expect(result.success).toBe(true);
      expect(result.ciphers.length).toBe(2);

      const cipher = result.ciphers[0];
      expect(cipher.name).toEqual("Test Entry");
      expect(cipher.login.username).toEqual("testuser");
      expect(cipher.login.password).toEqual("testpass123");
      expect(cipher.login.uris.length).toEqual(1);
      expect(cipher.login.uris[0].uri).toEqual("https://example.com");
    });

    it("should assign entries to folders based on group_name", async () => {
      const result = await importer.parse(buttercupCsvTestData);
      expect(result.success).toBe(true);
      expect(result.folders.length).toBe(1);
      expect(result.folders[0].name).toEqual("General");
      expect(result.folderRelationships.length).toBe(2);
    });
  });

  describe("given URL field variations", () => {
    it("should handle lowercase url field", async () => {
      const result = await importer.parse(buttercupCsvWithUrlFieldTestData);
      expect(result.success).toBe(true);

      const cipher = result.ciphers[0];
      expect(cipher.login.uris.length).toEqual(1);
      expect(cipher.login.uris[0].uri).toEqual("https://lowercase-url.com");
    });
  });

  describe("given note field", () => {
    it("should map note field to notes", async () => {
      const result = await importer.parse(buttercupCsvWithNoteTestData);
      expect(result.success).toBe(true);

      const cipher = result.ciphers[0];
      expect(cipher.notes).toEqual("This is a note");
    });
  });

  describe("given custom fields", () => {
    it("should import custom fields and exclude official props", async () => {
      const result = await importer.parse(buttercupCsvWithCustomFieldsTestData);
      expect(result.success).toBe(true);

      const cipher = result.ciphers[0];
      expect(cipher.fields.length).toBe(2);
      expect(cipher.fields[0].name).toEqual("custom_field");
      expect(cipher.fields[0].value).toEqual("custom value");
      expect(cipher.fields[1].name).toEqual("another_field");
      expect(cipher.fields[1].value).toEqual("another value");
    });
  });

  describe("given subfolders", () => {
    it("should create nested folder structure", async () => {
      const result = await importer.parse(buttercupCsvWithSubfoldersTestData);
      expect(result.success).toBe(true);

      const folderNames = result.folders.map((f) => f.name);
      expect(folderNames).toContain("Work/Projects");
      expect(folderNames).toContain("Work");
      expect(folderNames).toContain("Personal/Finance");
      expect(folderNames).toContain("Personal");
    });
  });
});
