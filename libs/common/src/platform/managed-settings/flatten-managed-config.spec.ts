import {
  MAX_FLATTEN_DEPTH,
  MAX_FLATTEN_KEYS,
  flattenManagedConfig,
} from "./flatten-managed-config";

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

  it("bounds recursion depth, emitting an over-deep subtree as one JSON leaf", () => {
    let deep: Record<string, unknown> = { value: "leaf" };
    for (let i = 0; i < MAX_FLATTEN_DEPTH + 5; i++) {
      deep = { nested: deep };
    }

    const result = flattenManagedConfig(deep);

    // Does not overflow the stack; produces exactly one capped key.
    expect(result.size).toBe(1);
    const [key] = [...result.keys()];
    expect(key.split(".").length).toBeLessThanOrEqual(MAX_FLATTEN_DEPTH);
  });

  it("bounds output size for an oversized managed object", () => {
    const wide: Record<string, unknown> = {};
    for (let i = 0; i < MAX_FLATTEN_KEYS + 50; i++) {
      wide[`k${i}`] = i;
    }

    expect(flattenManagedConfig(wide).size).toBe(MAX_FLATTEN_KEYS);
  });
});
