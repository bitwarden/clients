import { mock } from "jest-mock-extended";

import { LogService } from "@bitwarden/logging";

import { ContextMenuClickedHandler } from "../browser/context-menu-clicked-handler";
import { sendMockExtensionMessage } from "../spec/testing-utils";

import ContextMenusBackground from "./context-menus.background";

describe("ContextMenusBackground", () => {
  const logService = mock<LogService>();
  const contextMenuClickedHandler = mock<ContextMenuClickedHandler>();

  let contextMenusBackground: ContextMenusBackground;

  beforeEach(() => {
    // The global test setup doesn't include onClicked on contextMenus
    (chrome.contextMenus as any).onClicked = { addListener: jest.fn() };

    contextMenusBackground = new ContextMenusBackground(contextMenuClickedHandler, logService);
    contextMenusBackground.init();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("getAutofillTriageResult", () => {
    const extensionId = "test-extension-id";
    const tabId = 42;

    beforeEach(() => {
       
      (chrome.runtime as any).id = extensionId;
      contextMenuClickedHandler.triageResult = {
        tabId,
        pageUrl: "https://example.com",
        analyzedAt: "2026-01-01T00:00:00.000Z",
        fields: [],
      };
    });

    it("returns the triage result when sender is own extension, has no tab, and tabId matches", () => {
      const sendResponse = jest.fn();
      sendMockExtensionMessage(
        { command: "getAutofillTriageResult", tabId },
        { id: extensionId, tab: undefined },
        sendResponse,
      );

      expect(sendResponse).toHaveBeenCalledWith(contextMenuClickedHandler.triageResult);
    });

    it("returns null when the tabId does not match the stored result", () => {
      const sendResponse = jest.fn();
      sendMockExtensionMessage(
        { command: "getAutofillTriageResult", tabId: 999 },
        { id: extensionId, tab: undefined },
        sendResponse,
      );

      expect(sendResponse).toHaveBeenCalledWith(null);
    });

    it("returns null when the message has no tabId", () => {
      const sendResponse = jest.fn();
      sendMockExtensionMessage(
        { command: "getAutofillTriageResult" },
        { id: extensionId, tab: undefined },
        sendResponse,
      );

      expect(sendResponse).toHaveBeenCalledWith(null);
    });

    it("returns null when sender.tab is defined (content script caller)", () => {
      const sendResponse = jest.fn();
      sendMockExtensionMessage(
        { command: "getAutofillTriageResult", tabId },
        { id: extensionId, tab: mock<chrome.tabs.Tab>() },
        sendResponse,
      );

      expect(sendResponse).toHaveBeenCalledWith(null);
    });

    it("returns null when sender.id does not match the extension id", () => {
      const sendResponse = jest.fn();
      sendMockExtensionMessage(
        { command: "getAutofillTriageResult", tabId },
        { id: "foreign-extension-id", tab: undefined },
        sendResponse,
      );

      expect(sendResponse).toHaveBeenCalledWith(null);
    });

    it("returns null when triageResult is undefined", () => {
      contextMenuClickedHandler.triageResult = undefined;
      const sendResponse = jest.fn();
      sendMockExtensionMessage(
        { command: "getAutofillTriageResult", tabId },
        { id: extensionId, tab: undefined },
        sendResponse,
      );

      expect(sendResponse).toHaveBeenCalledWith(null);
    });
  });

  describe("unlockCompleted", () => {
    it("triggers cipherAction when onClickData and senderTab are present", async () => {
      const onClickData = mock<chrome.contextMenus.OnClickData>();
      const senderTab = mock<chrome.tabs.Tab>();
      contextMenuClickedHandler.cipherAction.mockResolvedValue(undefined);

      sendMockExtensionMessage(
        {
          command: "unlockCompleted",
          data: {
            target: "contextmenus.background",
            commandToRetry: {
              message: { command: "autofill_login", contextMenuOnClickData: onClickData },
              sender: { tab: senderTab },
            },
          },
        },
        { id: chrome.runtime.id },
      );

      await new Promise(process.nextTick);

      expect(contextMenuClickedHandler.cipherAction).toHaveBeenCalledWith(onClickData, senderTab);
    });
  });

  describe("unrecognized command", () => {
    it("logs a warning for unknown commands", () => {
      sendMockExtensionMessage({ command: "unknownCommand" }, { id: chrome.runtime.id });

      expect(logService.warning).toHaveBeenCalledWith("Unrecognized message command.");
    });
  });
});
