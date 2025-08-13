import { CipherType } from "@bitwarden/common/vault/enums";

import { RoboFormCsvImporter } from "./roboform-csv-importer";
import { data as dataNoFolder } from "./spec-data/roboform-csv/empty-folders";
import { data as dataFolder, dataWithFolderHierarchy } from "./spec-data/roboform-csv/with-folders";

describe("Roboform CSV Importer", () => {
  beforeEach(() => {
    // Importers currently create their own ConsoleLogService. This should be replaced by injecting a test log service.
    jest.spyOn(console, "warn").mockImplementation();
  });

  it("should parse CSV data", async () => {
    const importer = new RoboFormCsvImporter();
    const result = await importer.parse(dataNoFolder);
    expect(result != null).toBe(true);

    expect(result.folders.length).toBe(0);
    expect(result.ciphers.length).toBe(4);
    expect(result.ciphers[0].name).toBe("Bitwarden");
    expect(result.ciphers[0].login.username).toBe("user@bitwarden.com");
    expect(result.ciphers[0].login.password).toBe("password");
  });

  it("should parse CSV data with folders", async () => {
    const importer = new RoboFormCsvImporter();
    const result = await importer.parse(dataFolder);
    expect(result != null).toBe(true);

    expect(result.folders.length).toBe(3);
    expect(result.ciphers.length).toBe(5);
  });

  it("should parse CSV data totp", async () => {
    const importer = new RoboFormCsvImporter();
    const result = await importer.parse(dataNoFolder);
    expect(result != null).toBe(true);

    expect(result.ciphers[2].login.totp).toBe("totpKeyValue");
  });

  it("should parse CSV data custom fields", async () => {
    const importer = new RoboFormCsvImporter();
    const result = await importer.parse(dataNoFolder);
    expect(result != null).toBe(true);

    expect(result.ciphers[1].fields[0].name).toBe("Custom Field 1");
    expect(result.ciphers[1].fields[0].value).toBe("Custom Field 1 Value");
    expect(result.ciphers[1].fields[1].name).toBe("Custom Field 2");
    expect(result.ciphers[1].fields[1].value).toBe("Custom Field 2 Value");
  });

  it("should parse CSV data secure note", async () => {
    const importer = new RoboFormCsvImporter();
    const result = await importer.parse(dataNoFolder);
    expect(result != null).toBe(true);
    expect(result.ciphers[3].type).toBe(CipherType.SecureNote);
    expect(result.ciphers[3].notes).toBe("This is a safe note");
    expect(result.ciphers[3].name).toBe("note - 2023-03-31");
  });

  it("should parse CSV data with folder hierarchy", async () => {
    const importer = new RoboFormCsvImporter();
    const result = await importer.parse(dataWithFolderHierarchy);
    expect(result != null).toBe(true);

    expect(result.folders.length).toBe(5);
    expect(result.ciphers.length).toBe(5);

    expect(result.folders[0].name).toBe("folder1");
    expect(result.folders[1].name).toBe("folder2");
    expect(result.folders[2].name).toBe("folder2/folder3");
    expect(result.folders[3].name).toBe("folder1/folder2/folder3");
    expect(result.folders[4].name).toBe("folder1/folder2");
  });
});
