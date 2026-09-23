import { CliUtils } from "./utils";

describe("CliUtils.convertBooleanOption", () => {
  describe("native booleans (commander argv flow)", () => {
    it("returns true for true", () => {
      expect(CliUtils.convertBooleanOption(true)).toBe(true);
    });

    it("returns false for false", () => {
      expect(CliUtils.convertBooleanOption(false)).toBe(false);
    });
  });

  describe("string values (serve query parameters)", () => {
    it('returns true for "true"', () => {
      expect(CliUtils.convertBooleanOption("true")).toBe(true);
    });

    it('returns false for "false"', () => {
      expect(CliUtils.convertBooleanOption("false")).toBe(false);
    });

    it('is case-insensitive for "TRUE"', () => {
      expect(CliUtils.convertBooleanOption("TRUE")).toBe(true);
    });

    it('is case-insensitive for "False"', () => {
      expect(CliUtils.convertBooleanOption("False")).toBe(false);
    });

    it("returns true for empty string (flag present without value)", () => {
      expect(CliUtils.convertBooleanOption("")).toBe(true);
    });

    it('returns false for unrelated strings like "yes"', () => {
      expect(CliUtils.convertBooleanOption("yes")).toBe(false);
    });
  });

  describe("nullish and other values", () => {
    it("returns false for undefined", () => {
      expect(CliUtils.convertBooleanOption(undefined)).toBe(false);
    });

    it("returns false for null", () => {
      expect(CliUtils.convertBooleanOption(null)).toBe(false);
    });

    it("returns false for the number 0", () => {
      expect(CliUtils.convertBooleanOption(0)).toBe(false);
    });

    it("returns false for the number 1", () => {
      expect(CliUtils.convertBooleanOption(1)).toBe(false);
    });
  });
});
