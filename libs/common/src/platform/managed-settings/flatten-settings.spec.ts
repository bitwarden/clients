import { flattenSettings } from "./flatten-settings";

describe("flattenSettings", () => {
  it("joins nested object paths with a dot", () => {
    const result = flattenSettings({ a: { b: 1 } });

    expect(result.get("a.b")).toBe("1");
  });

  it("json-encodes a number leaf", () => {
    const result = flattenSettings({ a: 1 });

    expect(result.get("a")).toBe("1");
  });

  it("json-encodes a boolean leaf", () => {
    const result = flattenSettings({ a: true });

    expect(result.get("a")).toBe("true");
  });

  it("json-encodes a string leaf", () => {
    const result = flattenSettings({ a: "x" });

    expect(result.get("a")).toBe('"x"');
  });

  it("json-encodes a null leaf", () => {
    const result = flattenSettings({ a: null });

    expect(result.get("a")).toBe("null");
  });

  it("treats an array as a leaf rather than recursing into it", () => {
    const result = flattenSettings({ a: [1, 2] });

    expect(result.get("a")).toBe("[1,2]");
  });

  it("skips an undefined value", () => {
    const result = flattenSettings({ a: undefined });

    expect(result.has("a")).toBe(false);
  });

  it("contributes no keys for an empty nested object", () => {
    const result = flattenSettings({ a: {} });

    expect(result.size).toBe(0);
  });

  it("returns an empty map for an empty top-level object", () => {
    const result = flattenSettings({});

    expect(result.size).toBe(0);
  });
});
