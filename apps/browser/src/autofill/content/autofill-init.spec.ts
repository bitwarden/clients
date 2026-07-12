import { mock, MockProxy } from "jest-mock-extended";

import AutofillField from "../models/autofill-field";
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
import { AutofillTriageResponse } from "../types/autofill-triage";
import { EventSecurity } from "../utils/event-security";

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
    it("registers the always-on extension message listener", () => {
      jest.spyOn(chrome.runtime.onMessage, "addListener");

      autofillInit.init();

      expect(chrome.runtime.onMessage.addListener).toHaveBeenCalledWith(
        autofillInit["handleExtensionMessage"],
      );
    });

    it("registers the contextmenu listener", () => {
      jest.spyOn(document, "addEventListener");

      autofillInit.init();

      expect(document.addEventListener).toHaveBeenCalledWith(
        "contextmenu",
        autofillInit["handleContextMenuClick"],
      );
    });

    it("does not start monitoring", () => {
      jest.spyOn(window, "addEventListener");

      autofillInit.init();

      expect(window.addEventListener).not.toHaveBeenCalledWith("load", expect.any(Function));
    });
  });

  describe("startMonitoring", () => {
    it("triggers a collection of page details if the document is in a `complete` ready state", () => {
      jest.useFakeTimers();
      Object.defineProperty(document, "readyState", { value: "complete", writable: true });

      autofillInit.startMonitoring();
      jest.advanceTimersByTime(750);

      expect(sendExtensionMessageSpy).toHaveBeenCalledWith("bgCollectPageDetails", {
        sender: "autofillInit",
      });
    });

    it("registers a window load listener to collect the page details if the document is not in a `complete` ready state", () => {
      jest.spyOn(window, "addEventListener");
      Object.defineProperty(document, "readyState", { value: "loading", writable: true });

      autofillInit.startMonitoring();

      expect(window.addEventListener).toHaveBeenCalledWith("load", expect.any(Function));
    });

    it("is idempotent across repeated calls", () => {
      jest.spyOn(window, "addEventListener");

      autofillInit.startMonitoring();
      autofillInit.startMonitoring();

      const loadCalls = (window.addEventListener as jest.Mock).mock.calls.filter(
        ([eventName]) => eventName === "load",
      );
      expect(loadCalls).toHaveLength(1);
    });
  });

  describe("stopMonitoring", () => {
    it("removes the load listener", () => {
      jest.spyOn(window, "removeEventListener");

      autofillInit.startMonitoring();
      autofillInit.stopMonitoring();

      expect(window.removeEventListener).toHaveBeenCalledWith("load", expect.any(Function));
    });

    it("is idempotent on repeated stop calls", () => {
      jest.spyOn(window, "removeEventListener");

      autofillInit.startMonitoring();
      autofillInit.stopMonitoring();
      autofillInit.stopMonitoring();

      const loadCalls = (window.removeEventListener as jest.Mock).mock.calls.filter(
        ([eventName]) => eventName === "load",
      );
      expect(loadCalls.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("handleContextMenuClick", () => {
    it("stores the target element when the event is trusted", () => {
      const el = document.createElement("input");
      const event = new MouseEvent("contextmenu");
      Object.defineProperty(event, "target", { value: el });
      jest.spyOn(EventSecurity, "isEventTrusted").mockReturnValue(true);

      autofillInit["handleContextMenuClick"](event);

      expect(autofillInit["lastContextMenuClickedElement"]).toBe(el);
    });

    it("does not store the target element when the event is not trusted", () => {
      const el = document.createElement("input");
      const event = new MouseEvent("contextmenu");
      Object.defineProperty(event, "target", { value: el });
      jest.spyOn(EventSecurity, "isEventTrusted").mockReturnValue(false);

      autofillInit["handleContextMenuClick"](event);

      expect(autofillInit["lastContextMenuClickedElement"]).toBeNull();
    });
  });

  describe("handleExtensionMessage", () => {
    let message: AutofillExtensionMessage;
    let sender: chrome.runtime.MessageSender;
    const sendResponse = jest.fn();

    beforeEach(() => {
      autofillInit.startMonitoring();
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

    describe("monitoring gate", () => {
      it("drops operational commands when monitoring is stopped", async () => {
        autofillInit.stopMonitoring();
        const getPageDetailsSpy = jest.spyOn(
          autofillInit["collectAutofillContentService"],
          "getPageDetails",
        );
        message.command = "collectPageDetails";

        const response = autofillInit["handleExtensionMessage"](message, sender, sendResponse);
        await flushPromises();

        expect(response).toBe(null);
        expect(getPageDetailsSpy).not.toHaveBeenCalled();
      });

      it("routes lifecycle commands while stopped, then routes operational commands again after start", async () => {
        autofillInit.stopMonitoring();
        const getPageDetailsSpy = jest
          .spyOn(autofillInit["collectAutofillContentService"], "getPageDetails")
          .mockResolvedValue({
            title: "",
            url: "",
            documentUrl: "",
            forms: {},
            fields: [],
            collectedTimestamp: 0,
          });

        autofillInit["handleExtensionMessage"](
          { command: "startAutofillMonitors" } as AutofillExtensionMessage,
          sender,
          sendResponse,
        );
        autofillInit["handleExtensionMessage"](
          { ...message, command: "collectPageDetails" },
          sender,
          sendResponse,
        );
        await flushPromises();

        expect(getPageDetailsSpy).toHaveBeenCalledTimes(1);
      });

      it("drops applyTargetedFields when monitoring is stopped", async () => {
        autofillInit.stopMonitoring();
        const applyExternalTargetedFieldsSpy = jest.spyOn(
          autofillInit["collectAutofillContentService"],
          "applyExternalTargetedFields",
        );

        const response = autofillInit["handleExtensionMessage"](
          {
            ...message,
            command: "applyTargetedFields",
            iframeTargetedFields: [{ selector: "#username", fieldType: "username" }],
          },
          sender,
          sendResponse,
        );
        await flushPromises();

        expect(response).toBe(null);
        expect(applyExternalTargetedFieldsSpy).not.toHaveBeenCalled();
      });

      it("drops operational commands again after stopAutofillMonitors", async () => {
        const getPageDetailsSpy = jest.spyOn(
          autofillInit["collectAutofillContentService"],
          "getPageDetails",
        );

        autofillInit["handleExtensionMessage"](
          { command: "stopAutofillMonitors" } as AutofillExtensionMessage,
          sender,
          sendResponse,
        );
        const response = autofillInit["handleExtensionMessage"](
          { ...message, command: "collectPageDetails" },
          sender,
          sendResponse,
        );
        await flushPromises();

        expect(response).toBe(null);
        expect(getPageDetailsSpy).not.toHaveBeenCalled();
      });
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
          expect(sendResponse).toHaveBeenCalledWith(pageDetails);
          expect(chrome.runtime.sendMessage).not.toHaveBeenCalledWith({
            command: "collectPageDetailsResponse",
            tab: message.tab,
            details: pageDetails,
            sender: message.sender,
          });
        });
      });

      describe("applyTargetedFields", () => {
        it("delegates to applyExternalTargetedFields with the message's iframeTargetedFields", async () => {
          const iframeTargetedFields = [{ selector: "#username", fieldType: "username" }];
          jest
            .spyOn(autofillInit["collectAutofillContentService"], "applyExternalTargetedFields")
            .mockResolvedValue(undefined);

          sendMockExtensionMessage({ command: "applyTargetedFields", iframeTargetedFields });
          await flushPromises();

          expect(
            autofillInit["collectAutofillContentService"].applyExternalTargetedFields,
          ).toHaveBeenCalledWith(iframeTargetedFields);
        });

        it("passes an empty array when iframeTargetedFields is not present", async () => {
          jest
            .spyOn(autofillInit["collectAutofillContentService"], "applyExternalTargetedFields")
            .mockResolvedValue(undefined);

          sendMockExtensionMessage({ command: "applyTargetedFields" });
          await flushPromises();

          expect(
            autofillInit["collectAutofillContentService"].applyExternalTargetedFields,
          ).toHaveBeenCalledWith([]);
        });
      });

      describe("clearTargetingRulesCache", () => {
        let collectPageDetailsSpy: jest.SpyInstance;

        beforeEach(() => {
          jest
            .spyOn(autofillInit["collectAutofillContentService"], "clearCachedTargetingRules")
            .mockImplementation();
          collectPageDetailsSpy = jest
            .spyOn(autofillInit as any, "collectPageDetails")
            .mockResolvedValue(undefined);
        });

        it("delegates to CollectAutofillContentService.clearCachedTargetingRules", () => {
          sendMockExtensionMessage({ command: "clearTargetingRulesCache" });

          expect(
            autofillInit["collectAutofillContentService"].clearCachedTargetingRules,
          ).toHaveBeenCalled();
        });

        it("re-collects page details so the background cache is repopulated", () => {
          sendMockExtensionMessage({ command: "clearTargetingRulesCache" });

          expect(collectPageDetailsSpy).toHaveBeenCalledWith({
            command: "collectPageDetails",
            sender: "autofillInit",
          });
        });
      });

      describe("collectAutofillTriage", () => {
        const pageDetails: AutofillPageDetails = {
          title: "title",
          url: "http://example.com",
          documentUrl: "documentUrl",
          forms: {},
          fields: [],
          collectedTimestamp: 0,
        };

        beforeEach(() => {
          jest
            .spyOn(autofillInit["collectAutofillContentService"], "getPageDetails")
            .mockResolvedValue(pageDetails);
        });

        it("returns page details with no targetFieldRef when no element was right-clicked", async () => {
          const sendResponse = jest.fn();
          sendMockExtensionMessage({ command: "collectAutofillTriage" }, sender, sendResponse);
          await flushPromises();

          expect(sendResponse).toHaveBeenCalledWith<[AutofillTriageResponse]>({
            pageDetails,
            targetFieldRef: undefined,
          });
        });

        it("returns targetFieldRef matching the right-clicked field's htmlID", async () => {
          const field = mock<AutofillField>({ htmlID: "username", htmlName: null });
          const detailsWithField = { ...pageDetails, fields: [field] };
          jest
            .spyOn(autofillInit["collectAutofillContentService"], "getPageDetails")
            .mockResolvedValue(detailsWithField);

          const clickedEl = Object.assign(document.createElement("input"), { id: "username" });
          Object.defineProperty(clickedEl, "isTrusted", { value: true });
          document.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
          autofillInit["lastContextMenuClickedElement"] = clickedEl;

          const sendResponse = jest.fn();
          sendMockExtensionMessage({ command: "collectAutofillTriage" }, sender, sendResponse);
          await flushPromises();

          expect(sendResponse).toHaveBeenCalledWith<[AutofillTriageResponse]>({
            pageDetails: detailsWithField,
            targetFieldRef: "username",
          });
        });

        it("returns targetFieldRef matching the right-clicked field's htmlName when htmlID does not match", async () => {
          const field = mock<AutofillField>({ htmlID: null, htmlName: "email" });
          const detailsWithField = { ...pageDetails, fields: [field] };
          jest
            .spyOn(autofillInit["collectAutofillContentService"], "getPageDetails")
            .mockResolvedValue(detailsWithField);

          const clickedEl = Object.assign(document.createElement("input"), { name: "email" });
          autofillInit["lastContextMenuClickedElement"] = clickedEl;

          const sendResponse = jest.fn();
          sendMockExtensionMessage({ command: "collectAutofillTriage" }, sender, sendResponse);
          await flushPromises();

          expect(sendResponse).toHaveBeenCalledWith<[AutofillTriageResponse]>({
            pageDetails: detailsWithField,
            targetFieldRef: "email",
          });
        });

        it("returns targetFieldRef as undefined when the clicked element does not match any field", async () => {
          const field = mock<AutofillField>({ htmlID: "password", htmlName: "password" });
          const detailsWithField = { ...pageDetails, fields: [field] };
          jest
            .spyOn(autofillInit["collectAutofillContentService"], "getPageDetails")
            .mockResolvedValue(detailsWithField);

          const clickedEl = Object.assign(document.createElement("input"), {
            id: "unrelated-field",
          });
          autofillInit["lastContextMenuClickedElement"] = clickedEl;

          const sendResponse = jest.fn();
          sendMockExtensionMessage({ command: "collectAutofillTriage" }, sender, sendResponse);
          await flushPromises();

          expect(sendResponse).toHaveBeenCalledWith<[AutofillTriageResponse]>({
            pageDetails: detailsWithField,
            targetFieldRef: undefined,
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
            true,
          );
        });

        it("calls the InsertAutofillContentService to fill the form with the showAnimations flag set to `true`", async () => {
          sendMockExtensionMessage({
            command: "fillForm",
            fillScript,
            pageDetailsUrl: window.location.href,
            showAnimations: true,
          });
          await flushPromises();

          expect(autofillInit["insertAutofillContentService"].fillForm).toHaveBeenCalledWith(
            fillScript,
            true,
          );
        });

        it("calls the InsertAutofillContentService to fill the form with the showAnimations flag set to `false`", async () => {
          sendMockExtensionMessage({
            command: "fillForm",
            fillScript,
            pageDetailsUrl: window.location.href,
            showAnimations: false,
          });
          await flushPromises();

          expect(autofillInit["insertAutofillContentService"].fillForm).toHaveBeenCalledWith(
            fillScript,
            false,
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
            true,
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
    it("stops monitoring and clears the LOAD timeout", () => {
      jest.spyOn(window, "clearTimeout");

      autofillInit.init();
      autofillInit.startMonitoring();
      autofillInit.destroy();

      expect(window.clearTimeout).toHaveBeenCalledWith(
        autofillInit["collectPageDetailsOnLoadTimeout"],
      );
    });

    it("removes the LOAD event listener", () => {
      jest.spyOn(window, "removeEventListener");

      autofillInit.init();
      autofillInit.startMonitoring();
      autofillInit.destroy();

      expect(window.removeEventListener).toHaveBeenCalledWith(
        "load",
        autofillInit["sendCollectDetailsMessage"],
      );
    });

    it("removes the extension message listeners", () => {
      autofillInit.destroy();

      expect(chrome.runtime.onMessage.removeListener).toHaveBeenCalledWith(
        autofillInit["handleExtensionMessage"],
      );
    });

    it("stops collectAutofillContentService monitoring", () => {
      jest.spyOn(autofillInit["collectAutofillContentService"], "stopMonitoring");

      autofillInit.destroy();

      expect(autofillInit["collectAutofillContentService"].stopMonitoring).toHaveBeenCalled();
    });
  });
});
