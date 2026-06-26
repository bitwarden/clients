import {
  MAX_FLATTEN_DEPTH,
  MAX_FLATTEN_KEYS,
  flattenManagedConfig,
} from "./flatten-managed-config";

// Real catalog keys used in coercion tests.
// boolean: autofill.showFavicons
// integer: autofill.inlineMenuVisibility
// string:  environment.base, theming.selection

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

  describe("catalog-type coercion (Windows registry / macOS plist string values)", () => {
    it('coerces boolean catalog key string "true" to JSON true', () => {
      const result = flattenManagedConfig({ autofill: { showFavicons: "true" } });

      expect(result.get("autofill.showFavicons")).toBe("true");
    });

    it('coerces boolean catalog key string "false" to JSON false', () => {
      const result = flattenManagedConfig({ autofill: { showFavicons: "false" } });

      expect(result.get("autofill.showFavicons")).toBe("false");
    });

    it('coerces integer catalog key string "2" to JSON 2', () => {
      const result = flattenManagedConfig({ autofill: { inlineMenuVisibility: "2" } });

      expect(result.get("autofill.inlineMenuVisibility")).toBe("2");
    });

    it("leaves an integer catalog key with a non-integer string unchanged (double-quoted)", () => {
      const result = flattenManagedConfig({ autofill: { inlineMenuVisibility: "x" } });

      expect(result.get("autofill.inlineMenuVisibility")).toBe('"x"');
    });

    it("leaves an integer catalog key with a leading-zero string unchanged (double-quoted)", () => {
      const result = flattenManagedConfig({ autofill: { inlineMenuVisibility: "02" } });

      expect(result.get("autofill.inlineMenuVisibility")).toBe('"02"');
    });

    it("passes through an already-typed boolean true without change", () => {
      const result = flattenManagedConfig({ autofill: { showFavicons: true } });

      expect(result.get("autofill.showFavicons")).toBe("true");
    });

    it("passes through an already-typed number 2 without change", () => {
      const result = flattenManagedConfig({ autofill: { inlineMenuVisibility: 2 } });

      expect(result.get("autofill.inlineMenuVisibility")).toBe("2");
    });

    it("leaves a string-typed catalog key double-quoted (no coercion)", () => {
      const result = flattenManagedConfig({ theming: { selection: "dark" } });

      expect(result.get("theming.selection")).toBe('"dark"');
    });

    it("leaves a key not in the catalog double-quoted (pass-through)", () => {
      const result = flattenManagedConfig({ unknown: { key: "foo" } });

      expect(result.get("unknown.key")).toBe('"foo"');
    });

    it("coerces boolean through the dotted path in a nested object", () => {
      const result = flattenManagedConfig({ autofill: { showFavicons: "false" } });

      expect(result.get("autofill.showFavicons")).toBe("false");
    });

    it("leaves a boolean catalog key with an unrecognized string double-quoted", () => {
      const result = flattenManagedConfig({ autofill: { showFavicons: "maybe" } });

      expect(result.get("autofill.showFavicons")).toBe('"maybe"');
    });
  });
});
