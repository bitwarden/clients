import { classifySender, SenderClass, __resetExtensionOriginForTests } from "./sender";

describe("classifySender", () => {
  const ourId = "our-extension-id";
  const ourOrigin = "chrome-extension://our-extension-id";

  beforeEach(() => {
    __resetExtensionOriginForTests();
    (chrome.runtime as any).id = ourId;
    (chrome.runtime.getURL as jest.Mock).mockImplementation(
      (path: string) => `${ourOrigin}/${path}`,
    );
  });

  /**
   * Synthetic sender factory. Defaults model a Chrome / Firefox-126+ sender —
   * `id` and `origin` both stamped by the kernel. Tests that simulate Firefox
   * 91-125 explicitly override `origin: undefined`.
   */
  const sender = (
    overrides: Partial<chrome.runtime.MessageSender> = {},
  ): chrome.runtime.MessageSender =>
    ({ id: ourId, origin: ourOrigin, ...overrides }) as chrome.runtime.MessageSender;

  // --------------------------------------------------------------------------
  // Leaf coverage — every branch of the §2 decision tree, Chrome-shaped sender.
  // --------------------------------------------------------------------------

  describe("step 1 — sender.id membership", () => {
    it("classifies a foreign extension id as OtherExtension", () => {
      expect(classifySender(sender({ id: "some-other-extension" }))).toBe(
        SenderClass.OtherExtension,
      );
    });

    it("classifies a missing id as OtherExtension", () => {
      expect(classifySender({ origin: ourOrigin } as chrome.runtime.MessageSender)).toBe(
        SenderClass.OtherExtension,
      );
    });
  });

  describe("step 2 — origin defense-in-depth (only when origin is present)", () => {
    it("classifies a present-but-mismatched origin as Untrusted", () => {
      expect(classifySender(sender({ origin: "https://evil.example.com" }))).toBe(
        SenderClass.Untrusted,
      );
    });

    it("does NOT reject when origin is absent (Firefox 91-125 path)", () => {
      // The shape of a legitimate popup on older Firefox: id present, origin
      // absent, tab absent. Must classify as ForegroundPage, not Untrusted.
      expect(classifySender(sender({ origin: undefined, frameId: 0 }))).toBe(
        SenderClass.ForegroundPage,
      );
    });
  });

  describe("step 3 — content-script senders (tab present)", () => {
    const tab = { id: 42 } as chrome.tabs.Tab;

    it("frameId 0 → ContentScriptTopFrame", () => {
      expect(classifySender(sender({ tab, frameId: 0 }))).toBe(SenderClass.ContentScriptTopFrame);
    });

    it("frameId > 0 → ContentScriptSubframe", () => {
      expect(classifySender(sender({ tab, frameId: 7 }))).toBe(SenderClass.ContentScriptSubframe);
    });
  });

  describe("step 4 — foreground senders (no tab)", () => {
    it("frameId 0 → ForegroundPage", () => {
      expect(classifySender(sender({ frameId: 0 }))).toBe(SenderClass.ForegroundPage);
    });

    it("absent frameId → ForegroundPage (real popup shape)", () => {
      // Chrome popups/options pages arrive with frameId absent entirely.
      expect(classifySender(sender({}))).toBe(SenderClass.ForegroundPage);
    });

    it("positive frameId → ForegroundSubframe", () => {
      expect(classifySender(sender({ frameId: 1 }))).toBe(SenderClass.ForegroundSubframe);
    });
  });

  // --------------------------------------------------------------------------
  // Firefox-simulation suite — sender.origin is undefined everywhere. Firefox
  // 91-125 must classify legitimate messages exactly the same as Chrome.
  //
  // Critical regression test: sender.url is intentionally set to a HOSTILE
  // value on content-script cases (the page URL is attacker-controlled). The
  // implementation must never read sender.url for trust — these tests would
  // re-fail if it did.
  // --------------------------------------------------------------------------

  describe("Firefox 91-125 (sender.origin undefined)", () => {
    const firefoxContent = (overrides: Partial<chrome.runtime.MessageSender> = {}) =>
      ({
        id: ourId,
        origin: undefined,
        url: "https://evil.example.com/login", // page URL — attacker-controlled
        tab: { id: 42 } as chrome.tabs.Tab,
        frameId: 0,
        ...overrides,
      }) as chrome.runtime.MessageSender;

    const firefoxPopup = (overrides: Partial<chrome.runtime.MessageSender> = {}) =>
      ({
        id: ourId,
        origin: undefined,
        url: `${ourOrigin}/popup.html`,
        ...overrides,
      }) as chrome.runtime.MessageSender;

    it("(a) legitimate content script → ContentScriptTopFrame (was Untrusted under broken fallback)", () => {
      expect(classifySender(firefoxContent())).toBe(SenderClass.ContentScriptTopFrame);
    });

    it("legitimate content subframe → ContentScriptSubframe", () => {
      expect(classifySender(firefoxContent({ frameId: 3 }))).toBe(
        SenderClass.ContentScriptSubframe,
      );
    });

    it("(b) legitimate popup → ForegroundPage (was Untrusted under broken fallback)", () => {
      expect(classifySender(firefoxPopup())).toBe(SenderClass.ForegroundPage);
    });

    it("(c) foreign extension → OtherExtension", () => {
      expect(classifySender(firefoxContent({ id: "some-other-extension" }))).toBe(
        SenderClass.OtherExtension,
      );
    });

    it("ignores sender.url even when it claims our extension origin", () => {
      // An attacker controlling sender.url cannot promote themselves to
      // trusted by writing our extension origin into it — sender.url is never
      // a trust signal. With sender.id mismatching, classification must still
      // come out as OtherExtension.
      const hostile = {
        id: "some-other-extension",
        origin: undefined,
        url: `${ourOrigin}/popup.html`,
      } as chrome.runtime.MessageSender;
      expect(classifySender(hostile)).toBe(SenderClass.OtherExtension);
    });

    it("ignores sender.url even when it claims to be a page", () => {
      // Symmetric test: a legitimate content script with a hostile-looking
      // sender.url is STILL classified by tab + id, not by url parsing.
      const legitimate = {
        id: ourId,
        origin: undefined,
        url: "data:text/html,<script>...</script>",
        tab: { id: 1 } as chrome.tabs.Tab,
        frameId: 0,
      } as chrome.runtime.MessageSender;
      expect(classifySender(legitimate)).toBe(SenderClass.ContentScriptTopFrame);
    });
  });

  // --------------------------------------------------------------------------
  // Cross-platform parity — every leaf produces the same SenderClass with and
  // without sender.origin populated. This is the load-bearing invariant: the
  // same legitimate message must classify identically on Chrome and on
  // Firefox 91-125.
  // --------------------------------------------------------------------------

  describe("cross-platform parity (origin present vs origin undefined)", () => {
    const leaves: Array<{
      label: string;
      chrome: chrome.runtime.MessageSender;
      firefox: chrome.runtime.MessageSender;
      expected: SenderClass;
    }> = [
      {
        label: "ForegroundPage — popup",
        chrome: { id: ourId, origin: ourOrigin } as chrome.runtime.MessageSender,
        firefox: { id: ourId, origin: undefined } as chrome.runtime.MessageSender,
        expected: SenderClass.ForegroundPage,
      },
      {
        label: "ForegroundSubframe",
        chrome: { id: ourId, origin: ourOrigin, frameId: 2 } as chrome.runtime.MessageSender,
        firefox: { id: ourId, origin: undefined, frameId: 2 } as chrome.runtime.MessageSender,
        expected: SenderClass.ForegroundSubframe,
      },
      {
        label: "ContentScriptTopFrame",
        chrome: {
          id: ourId,
          origin: ourOrigin,
          tab: { id: 1 } as chrome.tabs.Tab,
          frameId: 0,
        } as chrome.runtime.MessageSender,
        firefox: {
          id: ourId,
          origin: undefined,
          url: "https://example.com/",
          tab: { id: 1 } as chrome.tabs.Tab,
          frameId: 0,
        } as chrome.runtime.MessageSender,
        expected: SenderClass.ContentScriptTopFrame,
      },
      {
        label: "ContentScriptSubframe",
        chrome: {
          id: ourId,
          origin: ourOrigin,
          tab: { id: 1 } as chrome.tabs.Tab,
          frameId: 5,
        } as chrome.runtime.MessageSender,
        firefox: {
          id: ourId,
          origin: undefined,
          url: "https://example.com/iframe",
          tab: { id: 1 } as chrome.tabs.Tab,
          frameId: 5,
        } as chrome.runtime.MessageSender,
        expected: SenderClass.ContentScriptSubframe,
      },
      {
        label: "OtherExtension",
        chrome: {
          id: "other-id",
          origin: "chrome-extension://other-id",
        } as chrome.runtime.MessageSender,
        firefox: { id: "other-id", origin: undefined } as chrome.runtime.MessageSender,
        expected: SenderClass.OtherExtension,
      },
    ];

    for (const leaf of leaves) {
      it(`${leaf.label}: same classification on Chrome and Firefox 91-125`, () => {
        expect(classifySender(leaf.chrome)).toBe(leaf.expected);
        expect(classifySender(leaf.firefox)).toBe(leaf.expected);
      });
    }
  });

  // --------------------------------------------------------------------------
  // Purity
  // --------------------------------------------------------------------------

  describe("purity", () => {
    it("does not mutate the sender object", () => {
      const s = sender({ frameId: 0 });
      const snapshot = JSON.stringify(s);
      classifySender(s);
      expect(JSON.stringify(s)).toBe(snapshot);
    });

    it("is deterministic for identical inputs", () => {
      const s = sender({ tab: { id: 1 } as chrome.tabs.Tab, frameId: 0 });
      expect(classifySender(s)).toBe(classifySender(s));
    });
  });
});
