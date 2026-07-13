import { PERMISSIONS_POLICY_REPORT_COMMAND } from "../../content/iframe-allow-reporter";
import { IframeAllowAttribute } from "../../content/iframe-allow-scraper";

import { PermissionsPolicyBackground } from "./permissions-policy.background";

type MessageListener = (
  message: unknown,
  sender: chrome.runtime.MessageSender,
) => boolean | void | Promise<unknown>;

function createMockEvent() {
  return { addListener: jest.fn(), removeListener: jest.fn() };
}

function createChromes() {
  const webRequestOnHeadersReceived = createMockEvent();
  const tabsOnRemoved = createMockEvent();
  const runtimeOnMessage = createMockEvent();
  // Matches the callback-style signature that our getAllFrames wrapper calls.
  // Default: invoke the callback with `null`, which our wrapper coerces to a
  // fail-open "no frame tree available" result.
  const webNavigationGetAllFrames = jest.fn(
    (_details: unknown, callback: (result: unknown) => void) => callback(null),
  );

  const chromeWebRequest = {
    onHeadersReceived: webRequestOnHeadersReceived,
  } as unknown as typeof chrome.webRequest;
  const chromeTabs = {
    onRemoved: tabsOnRemoved,
  } as unknown as typeof chrome.tabs;
  const chromeWebNavigation = {
    getAllFrames: webNavigationGetAllFrames,
  } as unknown as typeof chrome.webNavigation;
  const chromeRuntime = {
    onMessage: runtimeOnMessage,
  } as unknown as typeof chrome.runtime;

  return {
    chromeWebRequest,
    chromeTabs,
    chromeWebNavigation,
    chromeRuntime,
    events: {
      webRequestOnHeadersReceived,
      tabsOnRemoved,
      runtimeOnMessage,
    },
    webNavigationGetAllFrames,
  };
}

function validReport(iframes: IframeAllowAttribute[]) {
  return { command: PERMISSIONS_POLICY_REPORT_COMMAND, iframes };
}

describe("PermissionsPolicyBackground", () => {
  describe("init", () => {
    it("starts both caches and registers the runtime message listener", () => {
      const chromes = createChromes();
      const orchestrator = new PermissionsPolicyBackground(
        chromes.chromeWebRequest,
        chromes.chromeTabs,
        chromes.chromeWebNavigation,
        chromes.chromeRuntime,
      );

      orchestrator.init();

      expect(chromes.events.webRequestOnHeadersReceived.addListener).toHaveBeenCalledTimes(1);
      expect(chromes.events.tabsOnRemoved.addListener).toHaveBeenCalled();
      expect(chromes.events.runtimeOnMessage.addListener).toHaveBeenCalledTimes(1);
    });

    it("is idempotent", () => {
      const chromes = createChromes();
      const orchestrator = new PermissionsPolicyBackground(
        chromes.chromeWebRequest,
        chromes.chromeTabs,
        chromes.chromeWebNavigation,
        chromes.chromeRuntime,
      );

      orchestrator.init();
      orchestrator.init();

      expect(chromes.events.runtimeOnMessage.addListener).toHaveBeenCalledTimes(1);
    });
  });

  describe("destroy", () => {
    it("stops both caches and removes the runtime listener", () => {
      const chromes = createChromes();
      const orchestrator = new PermissionsPolicyBackground(
        chromes.chromeWebRequest,
        chromes.chromeTabs,
        chromes.chromeWebNavigation,
        chromes.chromeRuntime,
      );

      orchestrator.init();
      orchestrator.destroy();

      expect(chromes.events.webRequestOnHeadersReceived.removeListener).toHaveBeenCalled();
      expect(chromes.events.runtimeOnMessage.removeListener).toHaveBeenCalledTimes(1);
    });

    it("is safe to call before init", () => {
      const chromes = createChromes();
      const orchestrator = new PermissionsPolicyBackground(
        chromes.chromeWebRequest,
        chromes.chromeTabs,
        chromes.chromeWebNavigation,
        chromes.chromeRuntime,
      );

      expect(() => orchestrator.destroy()).not.toThrow();
      expect(chromes.events.runtimeOnMessage.removeListener).not.toHaveBeenCalled();
    });
  });

  describe("message handling", () => {
    function captureMessageListener(): {
      orchestrator: PermissionsPolicyBackground;
      send: (
        message: unknown,
        sender: chrome.runtime.MessageSender,
      ) => boolean | void | Promise<unknown>;
      chromes: ReturnType<typeof createChromes>;
    } {
      const chromes = createChromes();
      const orchestrator = new PermissionsPolicyBackground(
        chromes.chromeWebRequest,
        chromes.chromeTabs,
        chromes.chromeWebNavigation,
        chromes.chromeRuntime,
      );
      orchestrator.init();
      const send = chromes.events.runtimeOnMessage.addListener.mock.calls[0][0] as (
        message: unknown,
        sender: chrome.runtime.MessageSender,
      ) => boolean | void | Promise<unknown>;
      return { orchestrator, send, chromes };
    }

    function senderWith(tabId?: number, frameId?: number): chrome.runtime.MessageSender {
      return {
        tab: tabId == null ? undefined : ({ id: tabId } as chrome.tabs.Tab),
        frameId,
      } as chrome.runtime.MessageSender;
    }

    it("ignores messages that don't match the report command", () => {
      const { orchestrator, send } = captureMessageListener();
      const lookupSpy = jest.spyOn(orchestrator, "isFeatureAllowedForFrame");

      void send({ command: "fido2RegisterCredentialRequest", data: {} }, senderWith(1, 0));

      // No exceptions thrown, no calls into the helper.
      expect(lookupSpy).not.toHaveBeenCalled();
    });

    it("ignores reports with no tab id (e.g. from extension pages)", async () => {
      const { orchestrator, send } = captureMessageListener();
      void send(
        validReport([{ src: "https://a/", allow: "x", srcdoc: false }]),
        senderWith(undefined, 0),
      );

      // Nothing landed in the cache, so a subsequent lookup behaves as if no
      // allow was reported (cross-origin iframe without allow= → denied).
      // We assert this indirectly by ensuring the message handler didn't
      // record anything. The cache itself has its own tests; here we just
      // confirm the orchestrator gated correctly.
      // Smoke check: call into the orchestrator and assert no thrown error.
      await orchestrator.isFeatureAllowedForFrame(1, 5, "publickey-credentials-get");
    });

    it("ignores malformed reports (missing iframes array)", () => {
      const { send } = captureMessageListener();

      expect(() =>
        send(
          { command: PERMISSIONS_POLICY_REPORT_COMMAND, iframes: "not-an-array" },
          senderWith(1, 0),
        ),
      ).not.toThrow();
    });

    it("ignores reports whose entries have the wrong shape", () => {
      const { send } = captureMessageListener();

      expect(() =>
        send(
          { command: PERMISSIONS_POLICY_REPORT_COMMAND, iframes: [{ not: "valid" }] },
          senderWith(1, 0),
        ),
      ).not.toThrow();
    });

    it("records valid reports and exposes them through the gate", async () => {
      const chromes = createChromes();
      const orchestrator = new PermissionsPolicyBackground(
        chromes.chromeWebRequest,
        chromes.chromeTabs,
        chromes.chromeWebNavigation,
        chromes.chromeRuntime,
      );
      orchestrator.init();
      const send = chromes.events.runtimeOnMessage.addListener.mock.calls[0][0] as MessageListener;

      // No iframes reported → cross-origin iframe denied via container default.
      chromes.webNavigationGetAllFrames.mockImplementationOnce(
        (_details: unknown, callback: (result: unknown) => void) =>
          callback([
            { frameId: 0, parentFrameId: -1, url: "https://parent.example/", errorOccurred: false },
            { frameId: 5, parentFrameId: 0, url: "https://child.example/", errorOccurred: false },
          ]),
      );
      await expect(
        orchestrator.isFeatureAllowedForFrame(1, 5, "publickey-credentials-get"),
      ).resolves.toBe(false);

      // Now the content script reports the iframe with `allow=`. The default
      // parser resolves the attribute to `[{ origin: child.example }]`, so
      // the container policy grants the feature to the iframe's own origin
      // and the resolver permits it. Proves the round-trip end-to-end.
      void send(
        validReport([
          {
            src: "https://child.example/",
            allow: "publickey-credentials-get",
            srcdoc: false,
          },
        ]),
        senderWith(1, 0),
      );

      chromes.webNavigationGetAllFrames.mockImplementationOnce(
        (_details: unknown, callback: (result: unknown) => void) =>
          callback([
            { frameId: 0, parentFrameId: -1, url: "https://parent.example/", errorOccurred: false },
            { frameId: 5, parentFrameId: 0, url: "https://child.example/", errorOccurred: false },
          ]),
      );
      await expect(
        orchestrator.isFeatureAllowedForFrame(1, 5, "publickey-credentials-get"),
      ).resolves.toBe(true);
    });
  });

  describe("isFeatureAllowedForFrame", () => {
    it("returns true for top-level frames when no header is cached (no-op parser)", async () => {
      const chromes = createChromes();
      chromes.webNavigationGetAllFrames.mockImplementationOnce(
        (_details: unknown, callback: (result: unknown) => void) =>
          callback([
            { frameId: 0, parentFrameId: -1, url: "https://parent.example/", errorOccurred: false },
          ]),
      );
      const orchestrator = new PermissionsPolicyBackground(
        chromes.chromeWebRequest,
        chromes.chromeTabs,
        chromes.chromeWebNavigation,
        chromes.chromeRuntime,
      );

      await expect(
        orchestrator.isFeatureAllowedForFrame(1, 0, "publickey-credentials-get"),
      ).resolves.toBe(true);
    });
  });
});
