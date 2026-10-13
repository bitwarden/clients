// @storybook/angular ships as ESM that Jest does not transform; mock it with a faithful
// reimplementation of argsToTemplate so we can exercise the function-arg delegation path.
jest.mock("@storybook/angular", () => ({
  argsToTemplate: (args: Record<string, unknown>, options: { include?: string[] } = {}) => {
    const include = options.include ? new Set(options.include) : null;
    return Object.entries(args)
      .filter(([key]) => args[key] !== undefined)
      .filter(([key]) => (include ? include.has(key) : true))
      .map(([key, value]) =>
        typeof value === "function" ? `(${key})="${key}($event)"` : `[${key}]="${key}"`,
      )
      .join(" ");
  },
}));

import { formatArgsForCodeSnippet } from "./format-args-for-code-snippet";

describe("formatArgsForCodeSnippet", () => {
  describe("normal args", () => {
    it("renders a string arg as a plain attribute", () => {
      expect(formatArgsForCodeSnippet({ buttonType: "secondary" }).trim()).toBe(
        'buttonType="secondary"',
      );
    });

    it("renders a boolean arg as a property binding", () => {
      expect(formatArgsForCodeSnippet({ disabled: true }).trim()).toBe('[disabled]="true"');
    });

    it("renders a number arg as a property binding", () => {
      expect(formatArgsForCodeSnippet({ size: 2 }).trim()).toBe('[size]="2"');
    });

    it("renders an array arg as a property binding", () => {
      expect(formatArgsForCodeSnippet({ items: ["a", "b"] }).trim()).toBe("[items]=\"['a', 'b']\"");
    });

    it("skips null and undefined args", () => {
      expect(formatArgsForCodeSnippet({ a: null, b: undefined, c: "ok" }).trim()).toBe('c="ok"');
    });
  });

  describe("value-breakout (XSS) prevention", () => {
    it("escapes a string value that tries to break out of the attribute", () => {
      const result = formatArgsForCodeSnippet({
        buttonType: 'secondary" onclick="alert(1)" x="',
      });

      // The injected double quotes must be escaped, so no new attribute is created.
      expect(result).not.toMatch(/onclick="/);
      expect(result).toContain("&quot;");
      expect(result).toContain(
        'buttonType="secondary&quot; onclick=&quot;alert(1)&quot; x=&quot;"',
      );
    });

    it("escapes <, >, and & in string values", () => {
      const result = formatArgsForCodeSnippet({ label: '<img> & "x"' });
      expect(result).toContain('label="&lt;img&gt; &amp; &quot;x&quot;"');
    });

    it("escapes single quotes in array elements so they cannot break the expression", () => {
      const result = formatArgsForCodeSnippet({ items: ["a'] + alert(1) + ['"] });
      // The single quotes are backslash-escaped, keeping them inside the string literal.
      expect(result).toContain("\\'");
      expect(result).not.toMatch(/\['a'\] \+ alert/);
    });

    it("escapes a double quote in an array element so it cannot break out of the attribute", () => {
      const result = formatArgsForCodeSnippet({ items: ['a" onmouseover="alert(1)'] });
      // The injected double quote must be escaped, so no new attribute is created.
      expect(result).not.toMatch(/onmouseover="/);
      expect(result).toContain("&quot;");
      expect(result).toContain("[items]=\"['a&quot; onmouseover=&quot;alert(1)']\"");
    });
  });

  describe("key-injection (XSS) prevention", () => {
    it("drops an injected on* event-handler key", () => {
      const result = formatArgsForCodeSnippet({ onmouseover: "alert(document.domain)" });
      expect(result).not.toContain("onmouseover");
      expect(result).not.toContain("alert");
    });

    it("drops a string value smuggled under a normally-function key", () => {
      const result = formatArgsForCodeSnippet({ onclick: "alert(1)" });
      expect(result).not.toContain("onclick");
    });

    it("drops keys with non-identifier characters", () => {
      const result = formatArgsForCodeSnippet({ 'x"><script>': "boom" });
      expect(result).not.toContain("script");
      expect(result).not.toContain("boom");
    });
  });

  describe("function args (unchanged path)", () => {
    it("still renders function args as event bindings via argsToTemplate", () => {
      const result = formatArgsForCodeSnippet({ onClick: () => undefined });
      // Function args are delegated to Storybook's argsToTemplate, not the attribute path,
      // so the key filter does not apply to them.
      expect(result).toContain("(onClick)=");
      expect(result).toContain("$event");
    });
  });
});
