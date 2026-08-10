import { getSubFrameUrlVariations } from "./url-variations";

describe("getSubFrameUrlVariations", () => {
  it("returns null for malformed URLs that cannot be parsed even with a base", () => {
    expect(getSubFrameUrlVariations("https://[malformed", "http://example.com")).toBeNull();
  });

  it("returns a set including the input URL", () => {
    const variations = getSubFrameUrlVariations("https://example.com/iframe");

    expect(variations).not.toBeNull();
    expect(variations!.has("https://example.com/iframe")).toBe(true);
  });

  it("includes the trailing-slash variation when the URL ends with a slash", () => {
    const variations = getSubFrameUrlVariations("https://example.com/iframe/");

    expect(variations!.has("https://example.com/iframe/")).toBe(true);
    expect(variations!.has("https://example.com/iframe")).toBe(true);
  });

  it("treats trailing-slash and no-trailing-slash variants as equivalent matches", () => {
    const variationsWithSlash = getSubFrameUrlVariations("https://example.com/path/");
    const variationsWithoutSlash = getSubFrameUrlVariations("https://example.com/path");

    expect(variationsWithSlash!.has("https://example.com/path")).toBe(true);
    expect(variationsWithoutSlash!.has("https://example.com/path")).toBe(true);
  });

  it("includes hostname-prefixed variations", () => {
    const variations = getSubFrameUrlVariations("https://example.com/iframe");

    expect(variations!.has("example.com/iframe")).toBe(true);
  });

  it("includes origin-prefixed variations distinct from full href", () => {
    const variations = getSubFrameUrlVariations("https://example.com/iframe?q=1#h");

    expect(variations!.has("https://example.com/iframe")).toBe(true);
    expect(variations!.has("https://example.com/iframe?q=1")).toBe(true);
    expect(variations!.has("https://example.com/iframe#h")).toBe(true);
    expect(variations!.has("https://example.com/iframe?q=1#h")).toBe(true);
  });

  it("includes path-only variations", () => {
    const variations = getSubFrameUrlVariations("https://example.com/iframe");

    expect(variations!.has("/iframe")).toBe(true);
  });

  it("resolves a relative URL against the provided base", () => {
    const variations = getSubFrameUrlVariations("/inner", "https://example.com/outer/");

    expect(variations).not.toBeNull();
    expect(variations!.has("https://example.com/inner")).toBe(true);
  });

  it("ignores a provided base when the input URL is absolute", () => {
    const variations = getSubFrameUrlVariations(
      "https://other.example/page",
      "https://example.com/outer/",
    );

    expect(variations!.has("https://other.example/page")).toBe(true);
    expect(variations!.has("https://example.com/page")).toBe(false);
  });
});
