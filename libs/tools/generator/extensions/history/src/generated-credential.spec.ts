/// SDK/WASM code relies on TextEncoder/TextDecoder being available globally
import { TextEncoder, TextDecoder } from "util";
Object.assign(global, { TextDecoder, TextEncoder });

import { Algorithm, Type } from "@bitwarden/generator-core";

import { GeneratedCredential } from ".";

describe("GeneratedCredential", () => {
  describe("constructor", () => {
    it("assigns credential", () => {
      const result = new GeneratedCredential("example", Type.password, new Date(100));

      expect(result.credential).toEqual("example");
    });

    it("assigns category", () => {
      const result = new GeneratedCredential("example", Type.password, new Date(100));

      expect(result.category).toEqual(Type.password);
    });

    it("passes through date parameters", () => {
      const result = new GeneratedCredential("example", Type.password, new Date(100));

      expect(result.generationDate).toEqual(new Date(100));
    });

    it("converts numeric dates to Dates", () => {
      const result = new GeneratedCredential("example", Type.password, 100);

      expect(result.generationDate).toEqual(new Date(100));
    });

    it("assigns algorithm when provided", () => {
      const result = new GeneratedCredential(
        "example",
        Type.password,
        new Date(100),
        Algorithm.passphrase,
      );

      expect(result.algorithm).toEqual(Algorithm.passphrase);
    });

    it("leaves algorithm undefined when omitted", () => {
      const result = new GeneratedCredential("example", Type.password, new Date(100));

      expect(result.algorithm).toBeUndefined();
    });
  });

  it("toJSON converts from a credential into a JSON object", () => {
    const credential = new GeneratedCredential(
      "example",
      Type.password,
      new Date(100),
      Algorithm.passphrase,
    );

    const result = credential.toJSON();

    expect(result).toEqual({
      credential: "example",
      category: Type.password,
      generationDate: 100,
      algorithm: Algorithm.passphrase,
    });
  });

  it("fromJSON converts Json objects into credentials", () => {
    const jsonValue = {
      credential: "example",
      category: Type.password,
      generationDate: 100,
      algorithm: Algorithm.passphrase,
    };

    const result = GeneratedCredential.fromJSON(jsonValue);

    expect(result).toBeInstanceOf(GeneratedCredential);
    expect(result).toEqual({
      credential: "example",
      category: Type.password,
      generationDate: new Date(100),
      algorithm: Algorithm.passphrase,
    });
  });

  it("fromJSON works with legacy data that has no algorithm", () => {
    const jsonValue = {
      credential: "example",
      category: Type.password,
      generationDate: 100,
    } as any;

    const result = GeneratedCredential.fromJSON(jsonValue);

    expect(result).toBeInstanceOf(GeneratedCredential);
    expect(result.algorithm).toBeUndefined();
  });
});
