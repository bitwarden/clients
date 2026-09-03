import { flattenSettings } from "./flatten-settings";

describe("flattenSettings", () => {
  it.each([
    ["string", "https://vault.example.com", '"https://vault.example.com"'],
    ["number", 20, "20"],
    ["boolean", true, "true"],
  ])("encodes a %s leaf as its JSON representation", (_type, value, expected) => {
    expect(flattenSettings({ value })).toEqual(new Map([["value", expected]]));
  });

  it("keeps a null leaf, because presence in the profile means the value is forced", () => {
    expect(flattenSettings({ value: null })).toEqual(new Map([["value", "null"]]));
  });

  it("joins a nested object's keys with a dot", () => {
    expect(flattenSettings({ environment: { base: "https://vault.example.com" } })).toEqual(
      new Map([["environment.base", '"https://vault.example.com"']]),
    );
  });

  it("joins keys across multiple levels of nesting", () => {
    expect(flattenSettings({ generator: { password: { length: 20 } } })).toEqual(
      new Map([["generator.password.length", "20"]]),
    );
  });

  it("encodes an array leaf as one JSON value rather than indexed keys", () => {
    expect(flattenSettings({ regions: ["us", "eu"] })).toEqual(
      new Map([["regions", '["us","eu"]']]),
    );
  });

  it("omits an empty object, because a dotted key cannot address a namespace", () => {
    expect(flattenSettings({ environment: {} })).toEqual(new Map());
  });

  it("omits a key whose value is undefined", () => {
    expect(flattenSettings({ value: undefined })).toEqual(new Map());
  });

  it("returns an empty map for an empty source", () => {
    expect(flattenSettings({})).toEqual(new Map());
  });

  it("emits a source key that already contains a dot verbatim", () => {
    expect(flattenSettings({ "environment.base": "https://vault.example.com" })).toEqual(
      new Map([["environment.base", '"https://vault.example.com"']]),
    );
  });

  it("flattens every branch of a source holding more than one namespace", () => {
    expect(
      flattenSettings({
        environment: { base: "https://vault.example.com", api: "https://api.example.com" },
        generator: { password: { length: 20 } },
      }),
    ).toEqual(
      new Map([
        ["environment.base", '"https://vault.example.com"'],
        ["environment.api", '"https://api.example.com"'],
        ["generator.password.length", "20"],
      ]),
    );
  });
});
