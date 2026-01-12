import { flushPromises, sendMockExtensionMessage } from "../../autofill/spec/testing-utils";
import { BrowserApi } from "../browser/browser-api";
import BrowserClipboardService from "../services/browser-clipboard.service";

describe("OffscreenDocument", () => {
  let browserClipboardServiceCopySpy: jest.SpyInstance;
  let browserClipboardServiceReadSpy: jest.SpyInstance;
  let browserApiMessageListenerSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(async () => {
    browserApiMessageListenerSpy = jest.spyOn(BrowserApi, "messageListener");
    browserClipboardServiceCopySpy = jest.spyOn(BrowserClipboardService, "copy");
    browserClipboardServiceReadSpy = jest.spyOn(BrowserClipboardService, "read");
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

    await import("./offscreen-document");
  });

  describe("init", () => {
    it("sets up a `chrome.runtime.onMessage` listener", () => {
      expect(browserApiMessageListenerSpy).toHaveBeenCalledWith(
        "offscreen-document",
        expect.any(Function),
      );
    });
  });

  describe("extension message handlers", () => {
    it("ignores messages that do not have a handler registered with the corresponding command", () => {
      sendMockExtensionMessage({ command: "notAValidCommand" });

      expect(browserClipboardServiceCopySpy).not.toHaveBeenCalled();
      expect(browserClipboardServiceReadSpy).not.toHaveBeenCalled();
    });

    it("shows a console message if the handler throws an error", async () => {
      const error = new Error("test error");
      browserClipboardServiceCopySpy.mockRejectedValueOnce(new Error("test error"));

      sendMockExtensionMessage({ command: "offscreenCopyToClipboard", text: "test" });
      await flushPromises();

      expect(browserClipboardServiceCopySpy).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error resolving extension message response",
        error,
      );
    });

    describe("handleOffscreenCopyToClipboard", () => {
      it("copies the message text", async () => {
        const text = "test";

        browserClipboardServiceCopySpy.mockResolvedValueOnce(undefined);
        sendMockExtensionMessage({ command: "offscreenCopyToClipboard", text });
        await flushPromises();

        expect(browserClipboardServiceCopySpy).toHaveBeenCalledWith(window, text);
      });
    });

    describe("handleOffscreenReadFromClipboard", () => {
      it("reads the value from the clipboard service", async () => {
        browserClipboardServiceReadSpy.mockResolvedValueOnce("");
        sendMockExtensionMessage({ command: "offscreenReadFromClipboard" });
        await flushPromises();

        expect(browserClipboardServiceReadSpy).toHaveBeenCalledWith(window);
      });
    });
  });
});
