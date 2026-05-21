import { __resetExtensionOriginForTests } from "../autofill/security/sender";

import { runSecurityPreflight } from "./security-preflight";

describe("runSecurityPreflight", () => {
  const ourId = "our-extension-id";
  const ourOrigin = "chrome-extension://our-extension-id";

  beforeEach(() => {
    __resetExtensionOriginForTests();
    (chrome.runtime as any).id = ourId;
    (chrome.runtime.getURL as jest.Mock).mockImplementation(
      (path: string) => `${ourOrigin}/${path}`,
    );
  });

  const sender = (
    overrides: Partial<chrome.runtime.MessageSender> = {},
  ): chrome.runtime.MessageSender =>
    ({ id: ourId, origin: ourOrigin, ...overrides }) as chrome.runtime.MessageSender;

  describe("step 1 — sender class rejection (applies to all messages)", () => {
    it("rejects OtherExtension senders even on legacy commands", () => {
      expect(runSecurityPreflight({ command: "legacyCommand" }, sender({ id: "other" }))).toBe(
        false,
      );
    });

    it("rejects Untrusted senders even on legacy commands", () => {
      expect(
        runSecurityPreflight(
          { command: "legacyCommand" },
          sender({ origin: "https://evil.example" }),
        ),
      ).toBe(false);
    });

    it("rejects ForegroundSubframe senders even on legacy commands", () => {
      expect(runSecurityPreflight({ command: "legacyCommand" }, sender({ frameId: 5 }))).toBe(
        false,
      );
    });
  });

  describe("legacy soft path", () => {
    it("allows a legacy message (no _envPair) from a popup-shaped sender", () => {
      expect(runSecurityPreflight({ command: "legacyCommand" }, sender())).toBe(true);
    });

    it("allows a legacy message from a content-shaped sender", () => {
      expect(
        runSecurityPreflight(
          { command: "legacyCommand" },
          sender({ tab: { id: 1 } as chrome.tabs.Tab, frameId: 0 }),
        ),
      ).toBe(true);
    });
  });

  describe("strict env-paired path", () => {
    it("rejects a popup:background claim that fails the predicate chain", () => {
      // No origin → requireInternalSender fails.
      expect(
        runSecurityPreflight(
          { command: "x", _envPair: "popup:background" },
          sender({ origin: undefined }),
        ),
      ).toBe(false);
    });

    it("allows a popup:background claim from a correctly-shaped sender", () => {
      expect(runSecurityPreflight({ command: "x", _envPair: "popup:background" }, sender())).toBe(
        true,
      );
    });

    it("rejects a claim for an unregistered envPair (fail-closed §2.4)", () => {
      expect(
        runSecurityPreflight({ command: "x", _envPair: "page:background" as any }, sender()),
      ).toBe(false);
    });
  });
});
