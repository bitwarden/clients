import { flattenManagedConfig } from "./flatten-managed-config";

describe("flattenManagedConfig", () => {
  it("flattens nested objects to dotted keys with JSON-encoded leaves", () => {
    const result = flattenManagedConfig({
      environment: { base: "https://x", api: "https://x/api" },
    });

    expect(result.get("environment.base")).toBe('"https://x"');
    expect(result.get("environment.api")).toBe('"https://x/api"');
    expect(result.size).toBe(2);
  });

  it("treats arrays and primitives as leaves", () => {
    const result = flattenManagedConfig({ list: [1, 2], count: 3, flag: true });

    expect(result.get("list")).toBe("[1,2]");
    expect(result.get("count")).toBe("3");
    expect(result.get("flag")).toBe("true");
  });

  it("encodes a null leaf rather than dropping the key", () => {
    expect(flattenManagedConfig({ a: null }).get("a")).toBe("null");
  });

  it("returns an empty map for an empty object", () => {
    expect(flattenManagedConfig({}).size).toBe(0);
  });
});
