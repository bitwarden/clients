import { FieldType } from "@bitwarden/common/vault/enums";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";

import { KeePass2XmlImporter } from "./keepass2-xml-importer";
import {
  TestData,
  TestData1,
  TestData2,
  TestDataWithProtectedFields,
  TestDataDuplicateKeys,
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
    expect(result.folders[0].name).toEqual(actual[0].name);
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

  describe("protected fields handling", () => {
    it("should import protected custom fields as hidden fields", async () => {
      const importer = new KeePass2XmlImporter();
      const result = await importer.parse(TestDataWithProtectedFields);

      expect(result.success).toBe(true);
      expect(result.ciphers.length).toBe(1);

      const cipher = result.ciphers[0];
      expect(cipher.name).toBe("Test Entry");
      expect(cipher.login.username).toBe("testuser");
      expect(cipher.login.password).toBe("testpass");
      expect(cipher.notes).toContain("Regular notes");

      // Check that protected custom field is imported as hidden field
      const protectedField = cipher.fields.find((f) => f.name === "SAFE UN-LOCKING instructions");
      expect(protectedField).toBeDefined();
      expect(protectedField?.value).toBe("Secret instructions here");
      expect(protectedField?.type).toBe(FieldType.Hidden);

      // Check that regular custom field is imported as text field
      const regularField = cipher.fields.find((f) => f.name === "CustomField");
      expect(regularField).toBeDefined();
      expect(regularField?.value).toBe("Custom value");
      expect(regularField?.type).toBe(FieldType.Text);
    });

    it("should import long protected fields as hidden fields (not appended to notes)", async () => {
      const importer = new KeePass2XmlImporter();
      const result = await importer.parse(TestDataWithProtectedFields);

      const cipher = result.ciphers[0];

      // Long protected field should be imported as hidden field
      const longField = cipher.fields.find((f) => f.name === "LongProtectedField");
      expect(longField).toBeDefined();
      expect(longField?.type).toBe(FieldType.Hidden);
      expect(longField?.value).toContain("This is a very long protected field");

      // Should not be appended to notes
      expect(cipher.notes).not.toContain("LongProtectedField");
    });

    it("should import multiline protected fields as hidden fields (not appended to notes)", async () => {
      const importer = new KeePass2XmlImporter();
      const result = await importer.parse(TestDataWithProtectedFields);

      const cipher = result.ciphers[0];

      // Multiline protected field should be imported as hidden field
      const multilineField = cipher.fields.find((f) => f.name === "MultilineProtectedField");
      expect(multilineField).toBeDefined();
      expect(multilineField?.type).toBe(FieldType.Hidden);
      expect(multilineField?.value).toContain("Line 1");

      // Should not be appended to notes
      expect(cipher.notes).not.toContain("MultilineProtectedField");
    });

    it("should not append protected custom fields to notes", async () => {
      const importer = new KeePass2XmlImporter();
      const result = await importer.parse(TestDataWithProtectedFields);

      const cipher = result.ciphers[0];
      expect(cipher.notes).not.toContain("SAFE UN-LOCKING instructions");
      expect(cipher.notes).not.toContain("Secret instructions here");
    });
  });

  describe("duplicate String keys", () => {
    it("preserves displaced Password values as hidden fields", async () => {
      const importer = new KeePass2XmlImporter();
      const result = await importer.parse(TestDataDuplicateKeys);

      const cipher = result.ciphers[0];
      expect(cipher.login.password).toEqual("newsecret");

      const displaced = cipher.fields.find((f) => f.name === "Password");
      expect(displaced).toBeDefined();
      expect(displaced?.type).toBe(FieldType.Hidden);
      expect(displaced?.value).toEqual("oldsecret");
    });

    it("preserves displaced UserName, Title and otp values as custom fields", async () => {
      const importer = new KeePass2XmlImporter();
      const result = await importer.parse(TestDataDuplicateKeys);

      const cipher = result.ciphers[0];
      expect(cipher.login.username).toEqual("second user");
      expect(cipher.name).toEqual("second title");
      expect(cipher.login.totp).toEqual("NEWTOTP");

      const userField = cipher.fields.find((f) => f.name === "UserName");
      expect(userField?.value).toEqual("first user");
      const titleField = cipher.fields.find((f) => f.name === "Title");
      expect(titleField?.value).toEqual("first title");
      const otpField = cipher.fields.find((f) => f.name === "otp");
      expect(otpField?.type).toBe(FieldType.Hidden);
      expect(otpField?.value).toEqual("OLDTOTP");
    });

    it("appends duplicate URL keys to the uri list", async () => {
      const importer = new KeePass2XmlImporter();
      const result = await importer.parse(TestDataDuplicateKeys);

      const uris = result.ciphers[0].login.uris;
      expect(uris.length).toEqual(2);
      expect(uris[0].uri).toEqual("https://one.example.com");
      expect(uris[1].uri).toEqual("https://two.example.com");
    });
  });
});
