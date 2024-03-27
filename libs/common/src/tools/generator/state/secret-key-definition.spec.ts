import { GENERATOR_DISK } from "../../../platform/state";

import { SecretClassifier } from "./secret-classifier";
import { SecretKeyDefinition } from "./secret-key-definition";

describe("SecretKeyDefinition", () => {
  const classifier = SecretClassifier.allSecret<{ foo: boolean }>();
  const options = { deserializer: (v: any) => v };

  describe("value", () => {
    it("returns an initialized SecretKeyDefinition", () => {
      const definition = SecretKeyDefinition.value(GENERATOR_DISK, "key", classifier, options);

      expect(definition).toBeInstanceOf(SecretKeyDefinition);
      expect(definition.stateDefinition).toBe(GENERATOR_DISK);
      expect(definition.key).toBe("key");
      expect(definition.classifier).toBe(classifier);
    });

    it("deconstruct returns an array with a single item", () => {
      const definition = SecretKeyDefinition.value(GENERATOR_DISK, "key", classifier, options);
      const value = { foo: true };

      const result = definition.deconstruct(value);

      expect(result).toEqual([[null, value]]);
    });

    it("reconstruct returns the inner value", () => {
      const definition = SecretKeyDefinition.value(GENERATOR_DISK, "key", classifier, options);
      const value = { foo: true };

      const result = definition.reconstruct([[null, value]]);

      expect(result).toBe(value);
    });
  });

  describe("array", () => {
    it("returns an initialized SecretKeyDefinition", () => {
      const definition = SecretKeyDefinition.array(GENERATOR_DISK, "key", classifier, options);

      expect(definition).toBeInstanceOf(SecretKeyDefinition);
      expect(definition.stateDefinition).toBe(GENERATOR_DISK);
      expect(definition.key).toBe("key");
      expect(definition.classifier).toBe(classifier);
    });

    describe("deconstruct", () => {
      it("over a 0-length array returns an empty array", () => {
        const definition = SecretKeyDefinition.array(GENERATOR_DISK, "key", classifier, options);
        const value: { foo: boolean }[] = [];

        const result = definition.deconstruct(value);

        expect(result).toStrictEqual([]);
      });

      it("over a 1-length array returns a pair of indices and values", () => {
        const definition = SecretKeyDefinition.array(GENERATOR_DISK, "key", classifier, options);
        const value = [{ foo: true }];

        const result = definition.deconstruct(value);

        expect(result).toStrictEqual([[0, value[0]]]);
      });

      it("over an n-length array returns n pairs of indices and values", () => {
        const definition = SecretKeyDefinition.array(GENERATOR_DISK, "key", classifier, options);
        const value = [{ foo: true }, { foo: false }];

        const result = definition.deconstruct(value);

        expect(result).toStrictEqual([
          [0, value[0]],
          [1, value[1]],
        ]);
      });
    });

    describe("deconstruct", () => {
      it("over a 0-length array of entries returns an empty array", () => {
        const definition = SecretKeyDefinition.array(GENERATOR_DISK, "key", classifier, options);

        const result = definition.reconstruct([]);

        expect(result).toStrictEqual([]);
      });

      it("over a 1-length array of entries returns a 1-length array", () => {
        const definition = SecretKeyDefinition.array(GENERATOR_DISK, "key", classifier, options);
        const value = [{ foo: true }];

        const result = definition.reconstruct([[0, value[0]]]);

        expect(result).toStrictEqual(value);
      });

      it("over an n-length array of entries returns an n-length array", () => {
        const definition = SecretKeyDefinition.array(GENERATOR_DISK, "key", classifier, options);
        const value = [{ foo: true }, { foo: false }];

        const result = definition.reconstruct([
          [0, value[0]],
          [1, value[1]],
        ]);

        expect(result).toStrictEqual(value);
      });
    });
  });

  describe("record", () => {
    it("returns an initialized SecretKeyDefinition", () => {
      const definition = SecretKeyDefinition.record(GENERATOR_DISK, "key", classifier, options);

      expect(definition).toBeInstanceOf(SecretKeyDefinition);
      expect(definition.stateDefinition).toBe(GENERATOR_DISK);
      expect(definition.key).toBe("key");
      expect(definition.classifier).toBe(classifier);
    });

    describe("deconstruct", () => {
      it("over a 0-key record returns an empty array", () => {
        const definition = SecretKeyDefinition.record(GENERATOR_DISK, "key", classifier, options);
        const value: Record<string, { foo: boolean }> = {};

        const result = definition.deconstruct(value);

        expect(result).toStrictEqual([]);
      });

      it("over a 1-key record returns a pair of indices and values", () => {
        const definition = SecretKeyDefinition.record(GENERATOR_DISK, "key", classifier, options);
        const value = { foo: { foo: true } };

        const result = definition.deconstruct(value);

        expect(result).toStrictEqual([["foo", value["foo"]]]);
      });

      it("over an n-key record returns n pairs of indices and values", () => {
        const definition = SecretKeyDefinition.record(GENERATOR_DISK, "key", classifier, options);
        const value = { foo: { foo: true }, bar: { foo: false } };

        const result = definition.deconstruct(value);

        expect(result).toStrictEqual([
          ["foo", value["foo"]],
          ["bar", value["bar"]],
        ]);
      });
    });

    describe("deconstruct", () => {
      it("over a 0-key record of entries returns an empty array", () => {
        const definition = SecretKeyDefinition.record(GENERATOR_DISK, "key", classifier, options);

        const result = definition.reconstruct([]);

        expect(result).toStrictEqual({});
      });

      it("over a 1-key record of entries returns a 1-length record", () => {
        const definition = SecretKeyDefinition.record(GENERATOR_DISK, "key", classifier, options);
        const value = { foo: { foo: true } };

        const result = definition.reconstruct([["foo", value["foo"]]]);

        expect(result).toStrictEqual(value);
      });

      it("over an n-key record of entries returns an n-length record", () => {
        const definition = SecretKeyDefinition.record(GENERATOR_DISK, "key", classifier, options);
        const value = { foo: { foo: true }, bar: { foo: false } };

        const result = definition.reconstruct([
          ["foo", value["foo"]],
          ["bar", value["bar"]],
        ]);

        expect(result).toStrictEqual(value);
      });
    });
  });
});
