import { CipherType } from "@bitwarden/common/vault/enums";

import { RoboFormCsvImporter } from "./roboform-csv-importer";
import { data as dataNoFolder } from "./spec-data/roboform-csv/empty-folders";
import { data as dataFolder } from "./spec-data/roboform-csv/with-folders";

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
    expect(result.ciphers.length).toBe(5);
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

  it("should parse CSV data secure note", async () => {
    const importer = new RoboFormCsvImporter();
    const result = await importer.parse(dataNoFolder);
    expect(result != null).toBe(true);
    expect(result.ciphers[4].type).toBe(CipherType.SecureNote);
    expect(result.ciphers[4].notes).toBe("This is a safe note");
    expect(result.ciphers[4].name).toBe("note - 2023-03-31");
  });
});
