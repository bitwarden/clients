import { GENERATOR_DISK, UserKeyDefinition } from "../../platform/state";

import { BufferedKeyDefinition } from "./buffered-key-definition";

describe("BufferedKeyDefinition", () => {
  const deserializer = (jsonValue: number) => jsonValue + 1;

  describe("toKeyDefinition", () => {
    it("should create a key definition", () => {
      const key = new BufferedKeyDefinition(GENERATOR_DISK, "test", {
        deserializer,
        cleanupDelayMs: 5,
        clearOn: [],
      });

      const result = key.toKeyDefinition();

      expect(result).toBeInstanceOf(UserKeyDefinition);
      expect(result.stateDefinition).toBe(GENERATOR_DISK);
      expect(result.key).toBe("test");
      expect(result.deserializer(1)).toEqual(2);
      expect(result.cleanupDelayMs).toEqual(5);
    });
  });

  describe("shouldOverwrite", () => {
    it("should call the shouldOverwrite function when its defined", async () => {
      const shouldOverwrite = jest.fn(() => true);
      const key = new BufferedKeyDefinition(GENERATOR_DISK, "test", {
        deserializer,
        shouldOverwrite,
        clearOn: [],
      });

      const result = await key.shouldOverwrite(true);

      expect(shouldOverwrite).toHaveBeenCalledWith(true);
      expect(result).toStrictEqual(true);
    });

    it("should return true when shouldOverwrite is not defined and the input is truthy", async () => {
      const key = new BufferedKeyDefinition<number, number, number>(GENERATOR_DISK, "test", {
        deserializer,
        clearOn: [],
      });

      const result = await key.shouldOverwrite(1);

      expect(result).toStrictEqual(true);
    });

    it("should return false when shouldOverwrite is not defined and the input is falsy", async () => {
      const key = new BufferedKeyDefinition<number, number, number>(GENERATOR_DISK, "test", {
        deserializer,
        clearOn: [],
      });

      const result = await key.shouldOverwrite(0);

      expect(result).toStrictEqual(false);
    });
  });

  describe("map", () => {
    it("should call the map function when its defined", async () => {
      const map = jest.fn((value: number) => Promise.resolve(`${value}`));
      const key = new BufferedKeyDefinition(GENERATOR_DISK, "test", {
        deserializer,
        map,
        clearOn: [],
      });

      const result = await key.map(1, true);

      expect(map).toHaveBeenCalledWith(1, true);
      expect(result).toStrictEqual("1");
    });

    it("should fall back to an identity function when map is not defined", async () => {
      const key = new BufferedKeyDefinition(GENERATOR_DISK, "test", { deserializer, clearOn: [] });

      const result = await key.map(1, null);

      expect(result).toStrictEqual(1);
    });
  });

  describe("isValid", () => {
    it("should call the isValid function when its defined", async () => {
      const isValid = jest.fn(() => Promise.resolve(true));
      const key = new BufferedKeyDefinition(GENERATOR_DISK, "test", {
        deserializer,
        isValid,
        clearOn: [],
      });

      const result = await key.isValid(1, true);

      expect(isValid).toHaveBeenCalledWith(1, true);
      expect(result).toStrictEqual(true);
    });

    it("should return true when isValid is not defined and the input is truthy", async () => {
      const key = new BufferedKeyDefinition(GENERATOR_DISK, "test", { deserializer, clearOn: [] });

      const result = await key.isValid(1, null);

      expect(result).toStrictEqual(true);
    });

    it("should return false when isValid is not defined and the input is falsy", async () => {
      const key = new BufferedKeyDefinition(GENERATOR_DISK, "test", { deserializer, clearOn: [] });

      const result = await key.isValid(0, null);

      expect(result).toStrictEqual(false);
    });
  });
});
