import { CountryAbbreviations, isDirectlyTaxableCountry } from "./taxable-countries";

describe("isDirectlyTaxableCountry", () => {
  describe("directly taxable countries", () => {
    it("should return true for United States (US)", () => {
      expect(isDirectlyTaxableCountry(CountryAbbreviations.UnitedStates)).toBe(true);
    });

    it("should return true for Switzerland (CH)", () => {
      expect(isDirectlyTaxableCountry(CountryAbbreviations.Switzerland)).toBe(true);
    });
  });

  describe("non-taxable countries", () => {
    it("should return false for Canada (CA)", () => {
      expect(isDirectlyTaxableCountry("CA")).toBe(false);
    });

    it("should return false for United Kingdom (GB)", () => {
      expect(isDirectlyTaxableCountry("GB")).toBe(false);
    });

    it("should return false for Germany (DE)", () => {
      expect(isDirectlyTaxableCountry("DE")).toBe(false);
    });

    it("should return false for France (FR)", () => {
      expect(isDirectlyTaxableCountry("FR")).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("should return false for empty string", () => {
      expect(isDirectlyTaxableCountry("")).toBe(false);
    });

    it("should return true for lowercase country codes", () => {
      expect(isDirectlyTaxableCountry("us")).toBe(true);
      expect(isDirectlyTaxableCountry("ch")).toBe(true);
    });

    it("should return false for undefined country code", () => {
      expect(isDirectlyTaxableCountry(undefined as any)).toBe(false);
    });

    it("should return false for null country code", () => {
      expect(isDirectlyTaxableCountry(null as any)).toBe(false);
    });
  });
});
