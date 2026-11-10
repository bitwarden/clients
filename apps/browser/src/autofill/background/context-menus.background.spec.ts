import { mock } from "jest-mock-extended";
import { Subject } from "rxjs";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import {
  IntraprocessMessageSender,
  Message,
  MessageListener,
} from "@bitwarden/common/platform/messaging";

import { BrowserApi } from "../../platform/browser/browser-api";
import { ContextMenuClickedHandler } from "../browser/context-menu-clicked-handler";
import { createChromeTabMock } from "../spec/autofill-mocks";
import {
  crossContextBoundary,
  flushPromises,
  sendMockExtensionMessage,
} from "../spec/testing-utils";
import { AutofillTriagePageResult } from "../types/autofill-triage";

import {
  LockedVaultPendingNotificationsData,
  RETRY_SENDER,
  RETRY_WHEN_UNLOCK_COMPLETED,
} from "./abstractions/notification.background";
import ContextMenusBackground from "./context-menus.background";

describe("ContextMenusBackground", () => {
  const contextMenuClickedHandler = mock<ContextMenuClickedHandler>();
  const logService = mock<LogService>();

  // A real channel rather than a mock: what is under test is that the class distinguishes the
  // channel's own messages from the blended external ones, which no mocked listener would show.
  let intraprocessMessageSender: IntraprocessMessageSender;
  let externalMessages: Subject<Message<Record<string, unknown>>>;
  let contextMenusBackground: ContextMenusBackground;

  beforeEach(() => {
    // The global test setup doesn't include onClicked on contextMenus
    (chrome.contextMenus as any).onClicked = { addListener: jest.fn() };
    intraprocessMessageSender = new IntraprocessMessageSender();
    externalMessages = new Subject<Message<Record<string, unknown>>>();

    contextMenusBackground = new ContextMenusBackground(
      contextMenuClickedHandler,
      // Wired as `MainBackground` wires it, so ingest tagging is exercised rather than faked.
      new MessageListener(intraprocessMessageSender.messages$({ external$: externalMessages })),
      logService,
    );
    contextMenusBackground.init();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("getAutofillTriageResult", () => {
    const extensionId = "test-extension-id";
    const tabId = 42;

    const mockResult: AutofillTriagePageResult = {
      tabId,
      pageUrl: "https://example.com",
      analyzedAt: new Date("2026-01-01T00:00:00.000Z"),
      extensionVersion: "2024.1.0",
      browserInfo: { name: "Chrome", version: "120.0" },
      fields: [],
    };

    beforeEach(() => {
      (chrome.runtime as any).id = extensionId;
    });

    it("returns the triage result when sender is own extension, has no tab, and tabId matches", () => {
      contextMenuClickedHandler.consumeTriageResult.mockReturnValue(mockResult);

      const sendResponse = jest.fn();
      sendMockExtensionMessage(
        { command: "getAutofillTriageResult", tabId },
        { id: extensionId, tab: undefined },
        sendResponse,
      );

      expect(contextMenuClickedHandler.consumeTriageResult).toHaveBeenCalledWith(tabId);
      expect(sendResponse).toHaveBeenCalledWith(mockResult);
    });

    it("returns null when consumeTriageResult returns undefined (tabId mismatch or no result)", () => {
      contextMenuClickedHandler.consumeTriageResult.mockReturnValue(undefined);

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

    it("security: returns null when sender.tab is defined (content script caller)", () => {
      const sendResponse = jest.fn();
      sendMockExtensionMessage(
        { command: "getAutofillTriageResult", tabId },
        { id: extensionId, tab: mock<chrome.tabs.Tab>() },
        sendResponse,
      );

      expect(sendResponse).toHaveBeenCalledWith(null);
    });

    it("security: returns null when sender.id does not match the extension id", () => {
      const sendResponse = jest.fn();
      sendMockExtensionMessage(
        { command: "getAutofillTriageResult", tabId },
        { id: "foreign-extension-id", tab: undefined },
        sendResponse,
      );

      expect(sendResponse).toHaveBeenCalledWith(null);
    });
  });

  describe("unlockCompleted", () => {
    // Built per call rather than shared across the describe, so one test cannot observe another's
    // fixture. Plain values rather than mocks, so it survives `crossContextBoundary`.
    const retainedRetry = (): LockedVaultPendingNotificationsData => ({
      target: "contextmenus.background",
      commandToRetry: {
        message: {
          command: "autofill_login",
          contextMenuOnClickData: {
            menuItemId: "copy-username",
          } as chrome.contextMenus.OnClickData,
        },
        [RETRY_SENDER]: { tab: createChromeTabMock({ id: 4 }) },
      },
    });

    let tabSendMessageDataSpy: jest.SpyInstance;

    beforeEach(() => {
      contextMenuClickedHandler.cipherAction.mockResolvedValue(undefined);
      tabSendMessageDataSpy = jest.spyOn(BrowserApi, "tabSendMessageData").mockImplementation();
    });

    afterEach(() => {
      tabSendMessageDataSpy.mockRestore();
    });

    it("triggers cipherAction with the retained click data and tab", async () => {
      const data = retainedRetry();

      intraprocessMessageSender.send(RETRY_WHEN_UNLOCK_COMPLETED, { data });
      await flushPromises();

      expect(contextMenuClickedHandler.cipherAction).toHaveBeenCalledWith(
        data.commandToRetry.message.contextMenuOnClickData,
        data.commandToRetry[RETRY_SENDER].tab,
      );
    });

    it("closes the notification bar in the tab the retry was retained for", async () => {
      // An intraprocess message carries no chrome sender to fall back on, so the retained tab is
      // the only tab available — and the only correct one.
      const data = retainedRetry();

      intraprocessMessageSender.send(RETRY_WHEN_UNLOCK_COMPLETED, { data });
      await flushPromises();

      expect(tabSendMessageDataSpy).toHaveBeenCalledWith(
        data.commandToRetry[RETRY_SENDER].tab,
        "closeNotificationBar",
      );
    });

    it("does nothing when another target owns the retry", async () => {
      intraprocessMessageSender.send(RETRY_WHEN_UNLOCK_COMPLETED, {
        data: { ...retainedRetry(), target: "commands.background" },
      });
      await flushPromises();

      expect(contextMenuClickedHandler.cipherAction).not.toHaveBeenCalled();
    });

    it("does nothing when the retry carries no click data", async () => {
      const data = retainedRetry();
      data.commandToRetry.message.contextMenuOnClickData = undefined;

      intraprocessMessageSender.send(RETRY_WHEN_UNLOCK_COMPLETED, { data });
      await flushPromises();

      expect(contextMenuClickedHandler.cipherAction).not.toHaveBeenCalled();
    });

    it("security: drops a retry whose sender did not survive leaving this context", async () => {
      // The click data and target both make the trip, so the sender is the only thing missing:
      // there is no tab to fill, and none can be supplied over the wire.
      const data = crossContextBoundary(retainedRetry());

      intraprocessMessageSender.send(RETRY_WHEN_UNLOCK_COMPLETED, { data });
      await flushPromises();

      expect(contextMenuClickedHandler.cipherAction).not.toHaveBeenCalled();
      expect(tabSendMessageDataSpy).not.toHaveBeenCalled();
    });

    it("security: ignores a retry that arrived from another context", async () => {
      // The application listener blends chrome runtime messages in and tags them at ingest. A
      // retry names the tab that receives the autofill, so only the background may author one.
      externalMessages.next({
        command: RETRY_WHEN_UNLOCK_COMPLETED.command,
        data: retainedRetry(),
      } as unknown as Message<Record<string, unknown>>);
      await flushPromises();

      expect(contextMenuClickedHandler.cipherAction).not.toHaveBeenCalled();
    });
  });
});
