import { AutofillOverlayPort } from "../../../../enums/autofill-overlay.enum";
import { createPortSpyMock } from "../../../../spec/autofill-mocks";
import { postWindowMessage } from "../../../../spec/testing-utils";

import { AutofillInlineMenuContainer } from "./autofill-inline-menu-container";

describe("AutofillInlineMenuContainer", () => {
  const portKey = "testPortKey";
  const iframeUrl = "https://example.com";
  const pageTitle = "Example";
  let autofillInlineMenuContainer: AutofillInlineMenuContainer;

  beforeEach(() => {
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

      postWindowMessage(message);

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

      postWindowMessage(message);

      jest.spyOn(autofillInlineMenuContainer["inlineMenuPageIframe"].contentWindow, "postMessage");
      autofillInlineMenuContainer["inlineMenuPageIframe"].dispatchEvent(new Event("load"));

      expect(chrome.runtime.connect).toHaveBeenCalledWith({ name: message.portName });
      expect(
        autofillInlineMenuContainer["inlineMenuPageIframe"].contentWindow.postMessage,
      ).toHaveBeenCalledWith(message, "*");
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

      postWindowMessage(message);

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
      const message = { command: "checkInlineMenuButtonFocused", portKey };

      postWindowMessage(message, "null", iframe.contentWindow as any);

      expect(port.postMessage).toHaveBeenCalledWith(message);
    });

    it("posts a message to the inline menu iframe from the parent", () => {
      const message = { command: "checkInlineMenuButtonFocused", portKey };

      postWindowMessage(message);

      expect(iframe.contentWindow.postMessage).toHaveBeenCalledWith(message, "*");
    });
  });
});
