import {
  CipherType,
  cipherTypeNames,
  isCipherType,
  toCipherType,
  toCipherTypeName,
} from "./cipher-type";

describe("CipherType", () => {
  describe("toCipherTypeName", () => {
    it("should map CipherType correctly", () => {
      // identity test as the value is calculated
      expect(cipherTypeNames).toEqual({
        1: "Login",
        2: "SecureNote",
        3: "Card",
        4: "Identity",
        5: "SshKey",
      });
    });
  });

  describe("toCipherTypeName", () => {
    it("returns the associated name for the cipher type", () => {
      expect(toCipherTypeName(1)).toBe("Login");
      expect(toCipherTypeName(2)).toBe("SecureNote");
      expect(toCipherTypeName(3)).toBe("Card");
      expect(toCipherTypeName(4)).toBe("Identity");
      expect(toCipherTypeName(5)).toBe("SshKey");
    });

    it("returns undefined for an invalid cipher type", () => {
      expect(toCipherTypeName(999 as any)).toBeUndefined();
      expect(toCipherTypeName("" as any)).toBeUndefined();
    });
  });

  describe("isCipherType", () => {
    it("returns true for valid CipherType values", () => {
      [1, 2, 3, 4, 5].forEach((value) => {
        expect(isCipherType(value)).toBe(true);
      });
    });

    it("returns false for invalid CipherType values", () => {
      expect(isCipherType(999 as any)).toBe(false);
      expect(isCipherType("Login" as any)).toBe(false);
      expect(isCipherType(null)).toBe(false);
      expect(isCipherType(undefined)).toBe(false);
    });
  });

  describe("toCipherType", () => {
    it("converts valid values to CipherType", () => {
      expect(toCipherType("1")).toBe(CipherType.Login);
      expect(toCipherType("02")).toBe(CipherType.SecureNote);
    });

    it("returns null for invalid values", () => {
      expect(toCipherType(999 as any)).toBeUndefined();
      expect(toCipherType("Login" as any)).toBeUndefined();
      expect(toCipherType(null)).toBeUndefined();
      expect(toCipherType(undefined)).toBeUndefined();
    });
  });
});
