import { GENERATOR_SETTINGS } from "./key-definitions";

describe("Key definitions", () => {
  describe("GENERATOR_SETTINGS", () => {
    it("should pass through deserialization", () => {
      const value = {};
      const result = GENERATOR_SETTINGS.deserializer(value);
      expect(result).toBe(value);
    });
  });
});
