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

  describe("open shadow roots", () => {
    const HOST_SEGMENT = "#widget";

    /** Host with a stable id holding `inner`, so the composed path has a prefix. */
    function withShadowHost(inner: string): ShadowRoot {
      document.body.innerHTML = `<my-widget id="widget"></my-widget>`;
      const host = document.querySelector("my-widget")!;
      const root = host.attachShadow({ mode: "open" });
      root.innerHTML = inner;
      return root;
    }

    it("joins the host and inner segments with `>>>`", () => {
      const root = withShadowHost(`<input name="username">`);

      const result = generateSelector(root.querySelector("input")!);

      expect(result.selector).toBe(`${HOST_SEGMENT} >>> input[name="username"]`);
    });

    it("prefixes alternates so each one can replace the chosen selector", () => {
      // Two unique candidates for the input: [name="x"] is chosen, [type="text"]
      // becomes the alternate the panel offers under "Use".
      const root = withShadowHost(`<input name="x" type="text"><input type="password">`);

      const result = generateSelector(root.querySelector("input")!);

      expect(result.alternates).not.toHaveLength(0);
      // The regression: a root-local alternate swapped in for the full path would
      // stop resolving into the shadow root.
      for (const alternate of result.alternates) {
        expect(alternate.startsWith(`${HOST_SEGMENT} >>> `)).toBe(true);
      }
    });

    it("leaves alternates unprefixed for a document-rooted element", () => {
      document.body.innerHTML = `<input name="x" type="text"><input type="password">`;

      const result = generateSelector(document.querySelector("input")!);

      expect(result.alternates).not.toHaveLength(0);
      for (const alternate of result.alternates) {
        expect(alternate).not.toContain(">>>");
        expect(document.querySelector(alternate)).toBe(document.querySelector("input"));
      }
    });
  });

  describe("id candidates", () => {
    it("prefers a stable #id and reports it as unique", () => {
      document.body.innerHTML = `<form><input id="username"></form>`;
      const input = document.querySelector("input")!;

      const result = generateSelector(input);

      expect(result.selector).toBe("#username");
      expect(result.matches).toBe(1);
      expect(document.querySelector(result.selector!)).toBe(input);
    });

    it("escapes id characters that would otherwise change the selector's meaning", () => {
      // A ":" in an id reads as a pseudo-class unescaped, so the selector would
      // either throw or match something else entirely.
      document.body.innerHTML = `<form><input id="user:name"></form>`;
      const input = document.querySelector("input")!;

      const result = generateSelector(input);

      expect(result.selector).toBe("#user\\:name");
      expect(document.querySelector(result.selector!)).toBe(input);
    });

    it("takes an auto-generated id only as a last resort, and warns", () => {
      document.body.innerHTML = `<form><input id="css-1a2b3c"></form>`;
      const input = document.querySelector("input")!;

      const result = generateSelector(input);

      expect(result.selector).toBe("#css-1a2b3c");
      expect(result.warnings.some((w) => w.includes("auto-generated"))).toBe(true);
    });

    it("prefers a stable attribute over an auto-generated id", () => {
      document.body.innerHTML = `<form><input id="css-1a2b3c" name="username"></form>`;
      const input = document.querySelector("input")!;

      const result = generateSelector(input);

      expect(result.selector).toBe('input[name="username"]');
      expect(result.warnings.some((w) => w.includes("auto-generated"))).toBe(true);
    });
  });

  it("returns a null selector and structural: false for a non-element", () => {
    const result = generateSelector(null);

    expect(result.selector).toBeNull();
    expect(result.structural).toBe(false);
    expect(result.warnings).toContain("target is not an element");
  });
});
