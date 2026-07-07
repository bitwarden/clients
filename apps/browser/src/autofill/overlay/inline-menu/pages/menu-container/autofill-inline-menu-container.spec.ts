import { AutofillOverlayPort } from "../../../../enums/autofill-overlay.enum";
import { createPortSpyMock } from "../../../../spec/autofill-mocks";
import { postWindowMessage } from "../../../../spec/testing-utils";

import { AutofillInlineMenuContainer } from "./autofill-inline-menu-container";

describe("AutofillInlineMenuContainer", () => {
  const portKey = "testPortKey";
  const extensionOrigin = "chrome-extension://test-extension-id";
  const iframeUrl = `${extensionOrigin}/overlay/menu-list.html`;
  const pageTitle = "Example";
  let autofillInlineMenuContainer: AutofillInlineMenuContainer;

  beforeEach(() => {
    jest.spyOn(chrome.runtime, "getURL").mockReturnValue(`${extensionOrigin}/`);
    autofillInlineMenuContainer = new AutofillInlineMenuContainer();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("initializing the inline menu iframe", () => {
    it("sets the default iframe attributes to the message values", () => {
      const message = {
        command: "initAutofillInlineMenuList",
        iframeUrl,
        pageTitle,
        portKey,
        portName: AutofillOverlayPort.List,
      };

      postWindowMessage(message, extensionOrigin);

      expect(autofillInlineMenuContainer["defaultIframeAttributes"].src).toBe(message.iframeUrl);
      expect(autofillInlineMenuContainer["defaultIframeAttributes"].title).toBe(message.pageTitle);
      expect(autofillInlineMenuContainer["portName"]).toBe(message.portName);
    });

    it("sets up a onLoad listener on the iframe that sets up the background port message listener", async () => {
      const message = {
        command: "initAutofillInlineMenuButton",
        iframeUrl,
        pageTitle,
        portKey,
        portName: AutofillOverlayPort.Button,
      };

      postWindowMessage(message, extensionOrigin);

      jest.spyOn(autofillInlineMenuContainer["inlineMenuPageIframe"].contentWindow, "postMessage");
      autofillInlineMenuContainer["inlineMenuPageIframe"].dispatchEvent(new Event("load"));

      expect(chrome.runtime.connect).toHaveBeenCalledWith({ name: message.portName });
      const expectedMessage = expect.objectContaining({
        ...message,
        token: expect.any(String),
      });
      expect(
        autofillInlineMenuContainer["inlineMenuPageIframe"].contentWindow.postMessage,
      ).toHaveBeenCalledWith(expectedMessage, "*");
    });

    it("ignores initialization when URLs are not from extension origin", () => {
      const invalidIframeUrlMessage = {
        command: "initAutofillInlineMenuList",
        iframeUrl: "https://malicious.com/overlay/menu-list.html",
        pageTitle,
        portKey,
        portName: AutofillOverlayPort.List,
      };

      postWindowMessage(invalidIframeUrlMessage, extensionOrigin);
      expect(autofillInlineMenuContainer["inlineMenuPageIframe"]).toBeUndefined();
      expect(autofillInlineMenuContainer["isInitialized"]).toBe(false);

      autofillInlineMenuContainer = new AutofillInlineMenuContainer();

      const invalidStyleSheetUrlMessage = {
        command: "initAutofillInlineMenuList",
        iframeUrl,
        pageTitle,
        portKey,
        portName: AutofillOverlayPort.List,
        styleSheetUrl: "https://malicious.com/styles.css",
      };

      postWindowMessage(invalidStyleSheetUrlMessage, extensionOrigin);
      expect(autofillInlineMenuContainer["inlineMenuPageIframe"]).toBeUndefined();
      expect(autofillInlineMenuContainer["isInitialized"]).toBe(false);
    });
  });

  describe("handling window messages", () => {
    let iframe: HTMLIFrameElement;
    let port: chrome.runtime.Port;

    beforeEach(() => {
      const message = {
        command: "initAutofillInlineMenuButton",
        iframeUrl,
        pageTitle,
        portKey,
        portName: AutofillOverlayPort.Button,
      };

      postWindowMessage(message, extensionOrigin);

      iframe = autofillInlineMenuContainer["inlineMenuPageIframe"];
      jest.spyOn(iframe.contentWindow, "postMessage");
      port = createPortSpyMock(AutofillOverlayPort.Button);
      autofillInlineMenuContainer["port"] = port;
    });

    it("ignores messages that do not contain a portKey", () => {
      const message = { command: "checkInlineMenuButtonFocused" };

      postWindowMessage(message, "*", iframe.contentWindow as any);

      expect(port.postMessage).not.toHaveBeenCalled();
    });

    it("ignores messages if the inline menu iframe has not been created", () => {
      autofillInlineMenuContainer["inlineMenuPageIframe"] = null;
      const message = { command: "checkInlineMenuButtonFocused", portKey };

      postWindowMessage(message, "*", iframe.contentWindow as any);

      expect(port.postMessage).not.toHaveBeenCalled();
    });

    it("ignores messages that do not come from either the parent frame or the inline menu iframe", () => {
      const randomIframe = document.createElement("iframe");
      const message = { command: "checkInlineMenuButtonFocused", portKey };

      postWindowMessage(message, "*", randomIframe.contentWindow as any);

      expect(port.postMessage).not.toHaveBeenCalled();
    });

    it("ignores messages that come from an invalid origin", () => {
      const message = { command: "checkInlineMenuButtonFocused", portKey };

      postWindowMessage(message, "https://example.com", iframe.contentWindow as any);

      expect(port.postMessage).not.toHaveBeenCalled();
    });

    it("posts a message to the background from the inline menu iframe", () => {
      const token = autofillInlineMenuContainer["token"];
      const message = { command: "checkInlineMenuButtonFocused", portKey, token };

      postWindowMessage(message, "null", iframe.contentWindow as any);

      expect(port.postMessage).toHaveBeenCalledWith(message);
    });

    it("posts a message to the inline menu iframe from the parent", () => {
      const message = { command: "checkInlineMenuButtonFocused", portKey };

      postWindowMessage(message);

      const expectedMessage = expect.objectContaining({
        ...message,
        token: expect.any(String),
      });
      expect(iframe.contentWindow.postMessage).toHaveBeenCalledWith(expectedMessage, "*");
    });

    it("ignores messages from iframe with invalid token", () => {
      const message = { command: "checkInlineMenuButtonFocused", portKey, token: "invalid-token" };

      postWindowMessage(message, "null", iframe.contentWindow as any);

      expect(port.postMessage).not.toHaveBeenCalled();
    });

    it("ignores messages from iframe with commands not in the allowlist", () => {
      const token = autofillInlineMenuContainer["token"];
      const message = { command: "maliciousCommand", portKey, token };

      postWindowMessage(message, "null", iframe.contentWindow as any);

      expect(port.postMessage).not.toHaveBeenCalled();
    });
  });

  describe("isExtensionUrlWithOrigin", () => {
    it("validates extension URLs with matching origin", () => {
      const url = "chrome-extension://test-id/path/to/file.html";
      const origin = "chrome-extension://test-id";

      expect(autofillInlineMenuContainer["isExtensionUrlWithOrigin"](url, origin)).toBe(true);
    });

    it("rejects extension URLs with mismatched origin", () => {
      const url = "chrome-extension://test-id/path/to/file.html";
      const origin = "chrome-extension://different-id";

      expect(autofillInlineMenuContainer["isExtensionUrlWithOrigin"](url, origin)).toBe(false);
    });

    it("validates extension URL against its own origin when no expectedOrigin provided", () => {
      const url = "moz-extension://test-id/path/to/file.html";

      expect(autofillInlineMenuContainer["isExtensionUrlWithOrigin"](url)).toBe(true);
    });

    it("rejects non-extension protocols", () => {
      const url = "https://example.com/path";
      const origin = "https://example.com";

      expect(autofillInlineMenuContainer["isExtensionUrlWithOrigin"](url, origin)).toBe(false);
    });

    it("rejects empty or invalid URLs", () => {
      expect(autofillInlineMenuContainer["isExtensionUrlWithOrigin"]("")).toBe(false);
      expect(autofillInlineMenuContainer["isExtensionUrlWithOrigin"]("not-a-url")).toBe(false);
    });
  });
});
