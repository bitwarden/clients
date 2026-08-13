import { buildContainerCandidates, buildSelectorCapture } from "./webmapper-picker";

describe("webmapper-picker", () => {
  afterEach(() => {
    document.documentElement.innerHTML = "";
  });

  describe("buildSelectorCapture", () => {
    it("returns a null selector for a null target", () => {
      const result = buildSelectorCapture(null);

      expect(result.selector).toBeNull();
      expect(result.matches).toBe(0);
    });

    it("delegates to the selector generator for an element", () => {
      document.body.innerHTML = `<form><input name="username"></form>`;
      const input = document.querySelector("input")!;

      const result = buildSelectorCapture(input);

      expect(result.selector).toBe('input[name="username"]');
      expect(result.matches).toBe(1);
    });
  });

  describe("buildContainerCandidates", () => {
    it("returns no candidates for a null target", () => {
      expect(buildContainerCandidates(null, [])).toEqual({ candidates: [] });
    });

    it("proposes the element, its form, captured-field ancestor, and higher ancestors", () => {
      document.body.innerHTML = `
        <main>
          <form id="loginform">
            <div id="wrap">
              <input id="user" name="username" />
              <input id="pass" name="password" />
            </div>
            <button id="btn">Login</button>
          </form>
        </main>`;
      const user = document.querySelector<HTMLElement>("#user")!;

      const { candidates } = buildContainerCandidates(user, ["#user", "#pass"]);
      const labels = candidates.map((c) => c.label);

      expect(labels).toContain("right-clicked element");
      expect(labels).toContain("nearest <form>");
      expect(labels).toContain("smallest ancestor of 2 captured fields");
      expect(labels).toContain("<main> ancestor");
      // #wrap is both the fields' common ancestor and the target's parent — it
      // must appear exactly once (visited-set dedup).
      const wrapCandidates = candidates.filter((c) => c.selector.includes("wrap"));
      expect(wrapCandidates).toHaveLength(1);
      // Each candidate carries the generator's structural flag and warnings.
      expect(typeof candidates[0].structural).toBe("boolean");
      expect(Array.isArray(candidates[0].warnings)).toBe(true);
    });

    it("omits the captured-field ancestor when no field selectors resolve", () => {
      document.body.innerHTML = `<div id="outer"><span id="target">x</span></div>`;
      const target = document.querySelector<HTMLElement>("#target")!;

      const { candidates } = buildContainerCandidates(target, []);

      expect(candidates.some((c) => c.label.includes("captured field"))).toBe(false);
      expect(candidates.some((c) => c.label === "right-clicked element")).toBe(true);
    });

    it("skips the <form> proposal when the target has no form ancestor", () => {
      document.body.innerHTML = `<section><p id="t">no form here</p></section>`;
      const target = document.querySelector<HTMLElement>("#t")!;

      const { candidates } = buildContainerCandidates(target, []);

      expect(candidates.some((c) => c.label === "nearest <form>")).toBe(false);
    });

    it("ignores field selectors that fail to parse (e.g. shadow `>>>`)", () => {
      document.body.innerHTML = `<form><input id="user" name="username" /></form>`;
      const user = document.querySelector<HTMLElement>("#user")!;

      // Should not throw despite the invalid selector, and no field-ancestor label.
      const { candidates } = buildContainerCandidates(user, ["iframe >>> #inner"]);

      expect(candidates.some((c) => c.label.includes("captured field"))).toBe(false);
    });

    it("caps how far up the ancestor chain it walks", () => {
      document.body.innerHTML = `
        <div id="a6"><div id="a5"><div id="a4"><div id="a3"><div id="a2"><div id="a1">
          <span id="t">deep</span>
        </div></div></div></div></div></div>`;
      const target = document.querySelector<HTMLElement>("#t")!;

      const { candidates } = buildContainerCandidates(target, []);
      const ancestorCandidates = candidates.filter((c) => c.label.endsWith("ancestor>"));

      // parent (#a1) + at most MAX_EXTRA_ANCESTORS (4) further up = a2..a5; a6 is beyond the cap.
      expect(candidates.some((c) => c.selector.includes("a6"))).toBe(false);
      expect(ancestorCandidates.length).toBeLessThanOrEqual(4);
    });
  });
});
