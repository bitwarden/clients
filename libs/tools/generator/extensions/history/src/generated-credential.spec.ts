import { GeneratorCategory, GeneratedCredential } from ".";

describe("GeneratedCredential", () => {
  describe("constructor", () => {
    it("assigns credential", () => {
      const result = new GeneratedCredential("example", "passphrase", new Date(100));

      expect(result.credential).toEqual("example");
    });

    it("assigns category", () => {
      const result = new GeneratedCredential("example", "passphrase", new Date(100));

      expect(result.category).toEqual("passphrase");
    });

    it("passes through date parameters", () => {
      const result = new GeneratedCredential("example", "password", new Date(100));

      expect(result.generationDate).toEqual(new Date(100));
    });

    it("converts numeric dates to Dates", () => {
      const result = new GeneratedCredential("example", "password", 100);

      expect(result.generationDate).toEqual(new Date(100));
    });
  });

  it("toJSON converts from a credential into a JSON object", () => {
    const credential = new GeneratedCredential("example", "password", new Date(100));

    const result = credential.toJSON();

    expect(result).toEqual({
      credential: "example",
      category: "password" as GeneratorCategory,
      generationDate: 100,
    });
  });

  it("fromJSON converts Json objects into credentials", () => {
    const jsonValue = {
      credential: "example",
      category: "password" as GeneratorCategory,
      generationDate: 100,
    };

    const result = GeneratedCredential.fromJSON(jsonValue);

    expect(result).toBeInstanceOf(GeneratedCredential);
    expect(result).toEqual({
      credential: "example",
      category: "password",
      generationDate: new Date(100),
    });
  });
});
