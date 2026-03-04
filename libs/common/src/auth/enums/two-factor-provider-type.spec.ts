import { isTwoFactorProviderType, TwoFactorProviderType } from "./two-factor-provider-type";

describe("isTwoFactorProviderType", () => {
  describe("valid values", () => {
    it.each(Object.values(TwoFactorProviderType))(
      "returns true for TwoFactorProviderType value %i",
      (value) => {
        expect(isTwoFactorProviderType(value)).toBe(true);
      },
    );
  });

  describe("invalid numeric values", () => {
    it.each([-1, 4, 9, 100, NaN, Infinity, -Infinity, 1.5])("returns false for %p", (value) => {
      expect(isTwoFactorProviderType(value)).toBe(false);
    });
  });

  describe("non-number types", () => {
    it.each([null, undefined, "1", true, false, {}, []])("returns false for %p", (value) => {
      expect(isTwoFactorProviderType(value)).toBe(false);
    });
  });
});
