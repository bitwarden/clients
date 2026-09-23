import { ExportHelper } from "./export-helper";

describe("ExportHelper", () => {
  describe("getFileName", () => {
    it("should generate a filename with default prefix and format", () => {
      const fileName = ExportHelper.getFileName();
      expect(fileName).toMatch(/^bitwarden_export_\d{8}\d{6}\.csv$/);
    });

    it("should generate a filename with given prefix and default format", () => {
      const fileName = ExportHelper.getFileName("test");
      expect(fileName).toMatch(/^bitwarden_test_export_\d{8}\d{6}\.csv$/);
    });

    it("should generate a filename with given prefix and given format", () => {
      const fileName = ExportHelper.getFileName("org", "json");
      expect(fileName).toMatch(/^bitwarden_org_export_\d{8}\d{6}\.json$/);
    });

    it("should generate a filename with encrypted_json format and modify prefix", () => {
      const fileName = ExportHelper.getFileName("org", "encrypted_json");
      expect(fileName).toMatch(/^bitwarden_encrypted_org_export_\d{8}\d{6}\.json$/);
    });

    it("should generate a filename with encrypted_json format and default prefix", () => {
      const fileName = ExportHelper.getFileName("", "encrypted_json");
      expect(fileName).toMatch(/^bitwarden_encrypted_export_\d{8}\d{6}\.json$/);
    });
  });
});
