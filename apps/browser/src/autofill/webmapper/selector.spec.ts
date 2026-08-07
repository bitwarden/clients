import { generateSelector } from "./selector";

describe("generateSelector", () => {
  afterEach(() => {
    document.documentElement.innerHTML = "";
  });

  it("uses a stable attribute when one uniquely identifies the element", () => {
    document.body.innerHTML = `<form><input name="username"></form>`;
    const input = document.querySelector("input")!;

    const result = generateSelector(input);

    expect(result.selector).toBe('input[name="username"]');
    expect(result.matches).toBe(1);
    expect(result.structural).toBe(false);
  });

  describe("structural fallback (no stable attributes)", () => {
    it("does not emit a `:scope` prefix — an absolute child-chain matches from the document", () => {
      // A container-like element with nothing stable to key on: the generator
      // falls back to a positional chain. Historically this was prefixed with
      // `:scope >`, which resolves to the documentElement and matches nothing.
      document.body.innerHTML = `
        <div></div>
        <div><form><input></form></div>`;
      const form = document.querySelectorAll("div")[1].querySelector("form")!;

      const result = generateSelector(form);

      expect(result.selector).not.toContain(":scope");
      expect(result.structural).toBe(true);
      // The regression: the chosen selector must actually resolve.
      expect(document.querySelectorAll(result.selector!)).toHaveLength(1);
      expect(document.querySelector(result.selector!)).toBe(form);
    });

    it("reports matches: 1 for a resolvable positional container selector", () => {
      document.body.innerHTML = `
        <section><div></div></section>
        <section><div></div></section>`;
      const targetDiv = document.querySelectorAll("section")[1].querySelector("div")!;

      const result = generateSelector(targetDiv);

      expect(result.matches).toBe(1);
      expect(document.querySelector(result.selector!)).toBe(targetDiv);
      // Positional fallbacks are flagged brittle, not broken.
      expect(result.warnings.some((w) => w.includes("brittle"))).toBe(true);
    });
  });

  it("returns a null selector and structural: false for a non-element", () => {
    const result = generateSelector(null);

    expect(result.selector).toBeNull();
    expect(result.structural).toBe(false);
    expect(result.warnings).toContain("target is not an element");
  });
});
