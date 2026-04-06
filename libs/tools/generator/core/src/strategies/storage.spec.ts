import {
  EFF_USERNAME_SETTINGS,
  CATCHALL_SETTINGS,
  SUBADDRESS_SETTINGS,
  PASSPHRASE_SETTINGS,
  PASSWORD_SETTINGS,
} from "./storage";

describe("Key definitions", () => {
  describe("PASSWORD_SETTINGS", () => {
    it("should pass through deserialization", () => {
      const value = {};
      const result = PASSWORD_SETTINGS.deserializer(value);
      expect(result).toBe(value);
    });
  });

  describe("PASSPHRASE_SETTINGS", () => {
    it("should pass through deserialization", () => {
      const value = {};
      const result = PASSPHRASE_SETTINGS.deserializer(value);
      expect(result).toBe(value);
    });
  });

  describe("EFF_USERNAME_SETTINGS", () => {
    it("should pass through deserialization", () => {
      const value = { website: null as string };
      const result = EFF_USERNAME_SETTINGS.deserializer(value);
      expect(result).toBe(value);
    });
  });

  describe("CATCHALL_SETTINGS", () => {
    it("should pass through deserialization", () => {
      const value = { website: null as string };
      const result = CATCHALL_SETTINGS.deserializer(value);
      expect(result).toBe(value);
    });
  });

  describe("SUBADDRESS_SETTINGS", () => {
    it("should pass through deserialization", () => {
      const value = { website: null as string };
      const result = SUBADDRESS_SETTINGS.deserializer(value);
      expect(result).toBe(value);
    });
  });
});
