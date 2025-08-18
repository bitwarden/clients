import { record } from "@bitwarden/serialization/deserialization-helpers";

describe("deserialization helpers", () => {
  describe("record", () => {
    it("deserializes a record when keys are strings", () => {
      const deserializer = record((value: number) => value);
      const input = {
        a: 1,
        b: 2,
      };
      const output = deserializer(input);
      expect(output).toEqual(input);
    });

    it("deserializes a record when keys are numbers", () => {
      const deserializer = record((value: number) => value);
      const input = {
        1: 1,
        2: 2,
      };
      const output = deserializer(input);
      expect(output).toEqual(input);
    });
  });
});
