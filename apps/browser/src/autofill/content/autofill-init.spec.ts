import { mock, MockProxy } from "jest-mock-extended";

import AutofillPageDetails from "../models/autofill-page-details";
import AutofillScript from "../models/autofill-script";
import { AutofillInlineMenuContentService } from "../overlay/inline-menu/content/autofill-inline-menu-content.service";
import { OverlayNotificationsContentService } from "../overlay/notifications/abstractions/overlay-notifications-content.service";
import { DomElementVisibilityService } from "../services/abstractions/dom-element-visibility.service";
import { DomQueryService } from "../services/abstractions/dom-query.service";
import { AutofillOverlayContentService } from "../services/autofill-overlay-content.service";
import {
  flushPromises,
  mockQuerySelectorAllDefinedCall,
  sendMockExtensionMessage,
} from "../spec/testing-utils";

import { AutofillExtensionMessage } from "./abstractions/autofill-init";
import AutofillInit from "./autofill-init";

describe("AutofillInit", () => {
  let domQueryService: MockProxy<DomQueryService>;
  let domElementVisibilityService: MockProxy<DomElementVisibilityService>;
  let overlayNotificationsContentService: MockProxy<OverlayNotificationsContentService>;
  let inlineMenuElements: MockProxy<AutofillInlineMenuContentService>;
  let autofillOverlayContentService: MockProxy<AutofillOverlayContentService>;
  let autofillInit: AutofillInit;
  const originalDocumentReadyState = document.readyState;
  const mockQuerySelectorAll = mockQuerySelectorAllDefinedCall();
  let sendExtensionMessageSpy: jest.SpyInstance;

  beforeEach(() => {
    chrome.runtime.connect = jest.fn().mockReturnValue({
      onDisconnect: {
        addListener: jest.fn(),
      },
    });
    domQueryService = mock<DomQueryService>();
    domElementVisibilityService = mock<DomElementVisibilityService>();
    overlayNotificationsContentService = mock<OverlayNotificationsContentService>();
    inlineMenuElements = mock<AutofillInlineMenuContentService>();
    autofillOverlayContentService = mock<AutofillOverlayContentService>();
    autofillInit = new AutofillInit(
      domQueryService,
      domElementVisibilityService,
      autofillOverlayContentService,
      inlineMenuElements,
      overlayNotificationsContentService,
    );
    sendExtensionMessageSpy = jest
      .spyOn(autofillInit as any, "sendExtensionMessage")
      .mockImplementation();
    window.IntersectionObserver = jest.fn(() => mock<IntersectionObserver>());
  });

  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    Object.defineProperty(document, "readyState", {
      value: originalDocumentReadyState,
      writable: true,
    });
  });

  afterAll(() => {
    mockQuerySelectorAll.mockRestore();
  });

  describe("init", () => {
    it("sets up the extension message listeners", () => {
      jest.spyOn(autofillInit as any, "setupExtensionMessageListeners");

      autofillInit.init();

      expect(autofillInit["setupExtensionMessageListeners"]).toHaveBeenCalled();
    });

    it("triggers a collection of page details if the document is in a `complete` ready state", () => {
      jest.useFakeTimers();
      Object.defineProperty(document, "readyState", { value: "complete", writable: true });

      autofillInit.init();
      jest.advanceTimersByTime(750);

      expect(sendExtensionMessageSpy).toHaveBeenCalledWith("bgCollectPageDetails", {
        sender: "autofillInit",
      });
    });

    it("registers a window load listener to collect the page details if the document is not in a `complete` ready state", () => {
      jest.spyOn(window, "addEventListener");
      Object.defineProperty(document, "readyState", { value: "loading", writable: true });

      autofillInit.init();

      expect(window.addEventListener).toHaveBeenCalledWith("load", expect.any(Function));
    });
  });

  describe("setupExtensionMessageListeners", () => {
    it("sets up a chrome runtime on message listener", () => {
      jest.spyOn(chrome.runtime.onMessage, "addListener");

      autofillInit["setupExtensionMessageListeners"]();

      expect(chrome.runtime.onMessage.addListener).toHaveBeenCalledWith(
        autofillInit["handleExtensionMessage"],
      );
    });
  });

  describe("handleExtensionMessage", () => {
    let message: AutofillExtensionMessage;
    let sender: chrome.runtime.MessageSender;
    const sendResponse = jest.fn();

    beforeEach(() => {
      message = {
        command: "collectPageDetails",
        tab: mock<chrome.tabs.Tab>(),
        sender: "sender",
      };
      sender = mock<chrome.runtime.MessageSender>();
    });

    it("returns a null value if a extension message handler is not found with the given message command", () => {
      message.command = "unknownCommand";

      const response = autofillInit["handleExtensionMessage"](message, sender, sendResponse);

      expect(response).toBe(null);
    });

    it("returns a null value if the message handler does not return a response", async () => {
      const response1 = await autofillInit["handleExtensionMessage"](message, sender, sendResponse);
      await flushPromises();

      expect(response1).not.toBe(false);

      message.command = "removeAutofillOverlay";
      message.fillScript = mock<AutofillScript>();

      const response2 = autofillInit["handleExtensionMessage"](message, sender, sendResponse);
      await flushPromises();

      expect(response2).toBe(null);
    });

    it("returns a true value and calls sendResponse if the message handler returns a response", async () => {
      message.command = "collectPageDetailsImmediately";
      const pageDetails: AutofillPageDetails = {
        title: "title",
        url: "http://example.com",
        documentUrl: "documentUrl",
        forms: {},
        fields: [],
        collectedTimestamp: 0,
      };
      jest
        .spyOn(autofillInit["collectAutofillContentService"], "getPageDetails")
        .mockResolvedValue(pageDetails);

      const response = await autofillInit["handleExtensionMessage"](message, sender, sendResponse);
      await flushPromises();

      expect(response).toBe(true);
      expect(sendResponse).toHaveBeenCalledWith(pageDetails);
    });

    describe("extension message handlers", () => {
      beforeEach(() => {
        autofillInit.init();
      });

      it("triggers extension message handlers from the AutofillOverlayContentService", () => {
        autofillOverlayContentService.messageHandlers.messageHandler = jest.fn();

        sendMockExtensionMessage({ command: "messageHandler" }, sender, sendResponse);

        expect(autofillOverlayContentService.messageHandlers.messageHandler).toHaveBeenCalled();
      });

      it("triggers extension message handlers from the AutofillInlineMenuContentService", () => {
        inlineMenuElements.messageHandlers.messageHandler = jest.fn();

        sendMockExtensionMessage({ command: "messageHandler" }, sender, sendResponse);

        expect(inlineMenuElements.messageHandlers.messageHandler).toHaveBeenCalled();
      });

      it("triggers extension message handlers from the OverlayNotificationsContentService", () => {
        overlayNotificationsContentService.messageHandlers.messageHandler = jest.fn();

        sendMockExtensionMessage({ command: "messageHandler" }, sender, sendResponse);

        expect(
          overlayNotificationsContentService.messageHandlers.messageHandler,
        ).toHaveBeenCalled();
      });

      describe("collectPageDetails", () => {
        it("sends the collected page details for autofill using a background script message", async () => {
          const pageDetails: AutofillPageDetails = {
            title: "title",
            url: "http://example.com",
            documentUrl: "documentUrl",
            forms: {},
            fields: [],
            collectedTimestamp: 0,
          };
          const message = {
            command: "collectPageDetails",
            sender: "sender",
            tab: mock<chrome.tabs.Tab>(),
          };
          jest
            .spyOn(autofillInit["collectAutofillContentService"], "getPageDetails")
            .mockResolvedValue(pageDetails);

          sendMockExtensionMessage(message, sender, sendResponse);
          await flushPromises();

          expect(sendExtensionMessageSpy).toHaveBeenCalledWith("collectPageDetailsResponse", {
            tab: message.tab,
            details: pageDetails,
            sender: message.sender,
          });
        });
      });

      describe("collectPageDetailsImmediately", () => {
        it("returns collected page details for autofill if set to send the details in the response", async () => {
          const pageDetails: AutofillPageDetails = {
            title: "title",
            url: "http://example.com",
            documentUrl: "documentUrl",
            forms: {},
            fields: [],
            collectedTimestamp: 0,
          };
          jest
            .spyOn(autofillInit["collectAutofillContentService"], "getPageDetails")
            .mockResolvedValue(pageDetails);

          sendMockExtensionMessage(
            { command: "collectPageDetailsImmediately" },
            sender,
            sendResponse,
          );
          await flushPromises();

          expect(autofillInit["collectAutofillContentService"].getPageDetails).toHaveBeenCalled();
          expect(sendResponse).toBeCalledWith(pageDetails);
          expect(chrome.runtime.sendMessage).not.toHaveBeenCalledWith({
            command: "collectPageDetailsResponse",
            tab: message.tab,
            details: pageDetails,
            sender: message.sender,
          });
        });
      });

      describe("fillForm", () => {
        let fillScript: AutofillScript;
        beforeEach(() => {
          fillScript = mock<AutofillScript>();
          jest.spyOn(autofillInit["insertAutofillContentService"], "fillForm").mockImplementation();
        });

        it("skips calling the InsertAutofillContentService and does not fill the form if the url to fill is not equal to the current tab url", async () => {
          sendMockExtensionMessage({
            command: "fillForm",
            fillScript,
            pageDetailsUrl: "https://a-different-url.com",
          });
          await flushPromises();

          expect(autofillInit["insertAutofillContentService"].fillForm).not.toHaveBeenCalledWith(
            fillScript,
          );
        });

        it("calls the InsertAutofillContentService to fill the form", async () => {
          sendMockExtensionMessage({
            command: "fillForm",
            fillScript,
            pageDetailsUrl: window.location.href,
          });
          await flushPromises();

          expect(autofillInit["insertAutofillContentService"].fillForm).toHaveBeenCalledWith(
            fillScript,
          );
        });

        it("removes the overlay when filling the form", async () => {
          const blurAndRemoveOverlaySpy = jest.spyOn(
            autofillInit as any,
            "blurFocusedFieldAndCloseInlineMenu",
          );
          sendMockExtensionMessage({
            command: "fillForm",
            fillScript,
            pageDetailsUrl: window.location.href,
          });
          await flushPromises();

          expect(blurAndRemoveOverlaySpy).toHaveBeenCalled();
        });

        it("updates the isCurrentlyFilling property of the overlay to true after filling", async () => {
          jest.useFakeTimers();

          sendMockExtensionMessage({
            command: "fillForm",
            fillScript,
            pageDetailsUrl: window.location.href,
          });
          await flushPromises();
          jest.advanceTimersByTime(300);

          expect(sendExtensionMessageSpy).toHaveBeenNthCalledWith(
            1,
            "updateIsFieldCurrentlyFilling",
            { isFieldCurrentlyFilling: true },
          );
          expect(autofillInit["insertAutofillContentService"].fillForm).toHaveBeenCalledWith(
            fillScript,
          );
          expect(sendExtensionMessageSpy).toHaveBeenNthCalledWith(
            2,
            "updateIsFieldCurrentlyFilling",
            { isFieldCurrentlyFilling: false },
          );
        });
      });
    });
  });

  describe("destroy", () => {
    it("clears the timeout used to collect page details on load", () => {
      jest.spyOn(window, "clearTimeout");

      autofillInit.init();
      autofillInit.destroy();

      expect(window.clearTimeout).toHaveBeenCalledWith(
        autofillInit["collectPageDetailsOnLoadTimeout"],
      );
    });

    it("removes the extension message listeners", () => {
      autofillInit.destroy();

      expect(chrome.runtime.onMessage.removeListener).toHaveBeenCalledWith(
        autofillInit["handleExtensionMessage"],
      );
    });

    it("destroys the collectAutofillContentService", () => {
      jest.spyOn(autofillInit["collectAutofillContentService"], "destroy");

      autofillInit.destroy();

      expect(autofillInit["collectAutofillContentService"].destroy).toHaveBeenCalled();
    });
  });
});
