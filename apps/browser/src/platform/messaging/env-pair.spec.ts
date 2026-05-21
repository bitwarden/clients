import { WEB_EXT_SENDER } from "@bitwarden/messaging";

import {
  passesEnvPair,
  runEnvPairListener,
  requireInternalSender,
  requireSenderTab,
  requireFrameId,
  distinguishContentVsExtensionPage,
  __resetExtensionOriginForTests,
  middlewareByEnvPair,
} from "./env-pair";

describe("env-pair", () => {
  const extensionOrigin = "chrome-extension://test-id";

  beforeEach(() => {
    __resetExtensionOriginForTests();
    (chrome.runtime.getURL as jest.Mock).mockImplementation(
      (path: string) => `${extensionOrigin}/${path}`,
    );
  });

  const popupSender = (
    overrides: Partial<chrome.runtime.MessageSender> = {},
  ): chrome.runtime.MessageSender =>
    ({ origin: extensionOrigin, ...overrides }) as chrome.runtime.MessageSender;

  const contentSender = (
    overrides: Partial<chrome.runtime.MessageSender> = {},
  ): chrome.runtime.MessageSender =>
    ({
      origin: extensionOrigin,
      tab: { id: 1 } as chrome.tabs.Tab,
      frameId: 0,
      ...overrides,
    }) as chrome.runtime.MessageSender;

  describe("requireInternalSender", () => {
    it("accepts an extension-origin popup sender", () => {
      expect(requireInternalSender({}, popupSender())).toBe(true);
    });

    it("rejects a sender without an origin", () => {
      expect(requireInternalSender({}, {} as chrome.runtime.MessageSender)).toBe(false);
    });

    it("rejects a foreign origin", () => {
      expect(requireInternalSender({}, popupSender({ origin: "https://evil.example.com" }))).toBe(
        false,
      );
    });

    it("rejects a present-but-nonzero frameId from an internal sender", () => {
      expect(requireInternalSender({}, popupSender({ frameId: 3 }))).toBe(false);
    });

    it("tolerates a present frameId of zero", () => {
      expect(requireInternalSender({}, popupSender({ frameId: 0 }))).toBe(true);
    });
  });

  describe("requireSenderTab", () => {
    it("accepts a tab-bearing sender", () => {
      expect(requireSenderTab({}, contentSender())).toBe(true);
    });

    it("rejects a tabless sender", () => {
      expect(requireSenderTab({}, popupSender())).toBe(false);
    });
  });

  describe("distinguishContentVsExtensionPage (Phase 3 §7.1)", () => {
    it("tab-absent: accepts a popup-shaped sender, rejects a content-shaped one", () => {
      const check = distinguishContentVsExtensionPage("tab-absent");
      expect(check({}, popupSender())).toBe(true);
      expect(check({}, contentSender())).toBe(false);
    });

    it("tab-present: accepts a content-shaped sender, rejects a popup-shaped one", () => {
      const check = distinguishContentVsExtensionPage("tab-present");
      expect(check({}, contentSender())).toBe(true);
      expect(check({}, popupSender())).toBe(false);
    });
  });

  describe("requireFrameId", () => {
    it("accepts a sender with a numeric frameId", () => {
      expect(requireFrameId({}, contentSender())).toBe(true);
    });

    it("rejects a sender without a frameId", () => {
      expect(requireFrameId({}, popupSender())).toBe(false);
    });
  });

  describe("passesEnvPair — registered pairs", () => {
    it("rejects when no _envPair claim is present", () => {
      expect(passesEnvPair({}, popupSender())).toBe(false);
    });

    it("rejects when the claimed pair has no registered chain (§2.4 fail-closed)", () => {
      expect(passesEnvPair({ _envPair: "page:background" }, popupSender())).toBe(false);
    });

    describe("popup:background", () => {
      it("accepts a popup-shaped sender", () => {
        expect(passesEnvPair({ _envPair: "popup:background" }, popupSender())).toBe(true);
      });

      it("rejects a content-shaped sender claiming popup:background (Phase 3 §7.1 closed)", () => {
        // distinguishContentVsExtensionPage("tab-absent") on popup:background
        // closes the old soft-check gap — a content-shaped sender (with tab)
        // is now rejected by the chain.
        expect(passesEnvPair({ _envPair: "popup:background" }, contentSender())).toBe(false);
      });

      it("rejects a foreign-origin sender claiming popup:background", () => {
        expect(
          passesEnvPair(
            { _envPair: "popup:background" },
            popupSender({ origin: "chrome-extension://foreign" }),
          ),
        ).toBe(false);
      });
    });

    describe("content:background", () => {
      it("accepts a content-shaped sender", () => {
        expect(passesEnvPair({ _envPair: "content:background" }, contentSender())).toBe(true);
      });

      it("rejects a popup-shaped sender claiming content:background", () => {
        // The chain requires sender.tab and a numeric frameId — popup has neither.
        expect(passesEnvPair({ _envPair: "content:background" }, popupSender())).toBe(false);
      });

      it("rejects a tabless sender even with a numeric frameId", () => {
        expect(
          passesEnvPair({ _envPair: "content:background" }, popupSender({ frameId: 5 } as any)),
        ).toBe(false);
      });
    });
  });

  describe("runEnvPairListener", () => {
    it("returns false when no Symbol-stamped sender is present", () => {
      // A message without [WEB_EXT_SENDER] is intra-process or otherwise non-runtime traffic.
      expect(runEnvPairListener({ _envPair: "popup:background" } as any)).toBe(false);
    });

    it("runs the chain when the adapter has stamped a sender", () => {
      const message: Record<PropertyKey, unknown> = { _envPair: "popup:background" };
      message[WEB_EXT_SENDER] = popupSender();
      expect(runEnvPairListener(message as any)).toBe(true);
    });

    it("rejects when the stamped sender's origin does not match", () => {
      const message: Record<PropertyKey, unknown> = { _envPair: "popup:background" };
      message[WEB_EXT_SENDER] = popupSender({ origin: "https://attacker.example" });
      expect(runEnvPairListener(message as any)).toBe(false);
    });
  });

  describe("registered chains", () => {
    it("declares chains for the four Phase 0 pairs", () => {
      expect(middlewareByEnvPair["popup:background"]).toBeDefined();
      expect(middlewareByEnvPair["background:popup"]).toBeDefined();
      expect(middlewareByEnvPair["content:background"]).toBeDefined();
      expect(middlewareByEnvPair["background:content"]).toBeDefined();
    });
  });
});
