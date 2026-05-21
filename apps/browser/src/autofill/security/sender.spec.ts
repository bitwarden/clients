import { classifySender, SenderClass, __resetExtensionOriginForTests } from "./sender";

describe("classifySender", () => {
  const ourId = "our-extension-id";
  const ourOrigin = "chrome-extension://our-extension-id";

  beforeEach(() => {
    // Reset cached origin so a beforeAll mutation in another suite can't bleed in.
    __resetExtensionOriginForTests();
    (chrome.runtime as any).id = ourId;
    (chrome.runtime.getURL as jest.Mock).mockImplementation(
      (path: string) => `${ourOrigin}/${path}`,
    );
  });

  const sender = (overrides: Partial<chrome.runtime.MessageSender>): chrome.runtime.MessageSender =>
    ({ id: ourId, origin: ourOrigin, ...overrides }) as chrome.runtime.MessageSender;

  describe("foreign / untrusted senders", () => {
    it("classifies a sender with a different extension id as OtherExtension", () => {
      expect(classifySender(sender({ id: "some-other-extension" }))).toBe(
        SenderClass.OtherExtension,
      );
    });

    it("classifies a sender with no id at all as OtherExtension", () => {
      expect(classifySender({ origin: ourOrigin } as chrome.runtime.MessageSender)).toBe(
        SenderClass.OtherExtension,
      );
    });

    it("classifies a sender from a foreign origin as Untrusted", () => {
      expect(classifySender(sender({ origin: "https://evil.example.com" }))).toBe(
        SenderClass.Untrusted,
      );
    });

    it("classifies a sender with neither origin nor url as Untrusted", () => {
      expect(classifySender(sender({ origin: undefined, url: undefined }))).toBe(
        SenderClass.Untrusted,
      );
    });
  });

  describe("foreground (no tab)", () => {
    it("classifies frameId 0 with no tab as ForegroundPage", () => {
      expect(classifySender(sender({ frameId: 0 }))).toBe(SenderClass.ForegroundPage);
    });

    it("classifies absent frameId with no tab as ForegroundPage (real popup shape)", () => {
      // Chrome popups/options pages arrive without a frameId at all.
      expect(classifySender(sender({}))).toBe(SenderClass.ForegroundPage);
    });

    it("classifies a positive frameId with no tab as ForegroundSubframe", () => {
      expect(classifySender(sender({ frameId: 1 }))).toBe(SenderClass.ForegroundSubframe);
    });
  });

  describe("content scripts (has tab)", () => {
    const tab = { id: 42 } as chrome.tabs.Tab;

    it("classifies tab + frameId 0 as ContentScriptTopFrame", () => {
      expect(classifySender(sender({ tab, frameId: 0 }))).toBe(SenderClass.ContentScriptTopFrame);
    });

    it("classifies tab + frameId > 0 as ContentScriptSubframe", () => {
      expect(classifySender(sender({ tab, frameId: 7 }))).toBe(SenderClass.ContentScriptSubframe);
    });
  });

  describe("Firefox MV2 sender.origin fallback (§2.8)", () => {
    it("derives origin from sender.url when sender.origin is absent", () => {
      // Older Gecko ships MessageSender without an `origin` property.
      // Note: chrome-extension scheme is non-special per WHATWG so new URL().origin returns "null".
      // For this case the fallback still yields a comparable string — we test with http to exercise the URL parser.
      (chrome.runtime.getURL as jest.Mock).mockImplementation(
        (path: string) => `https://web.example/${path}`,
      );
      __resetExtensionOriginForTests();
      const s = sender({
        origin: undefined,
        url: "https://web.example/path/to/page.html",
        frameId: 0,
      });
      expect(classifySender(s)).toBe(SenderClass.ForegroundPage);
    });

    it("falls back to Untrusted when sender.url cannot be parsed", () => {
      const s = sender({ origin: undefined, url: "not a url at all" });
      expect(classifySender(s)).toBe(SenderClass.Untrusted);
    });
  });

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
