import { mock } from "jest-mock-extended";

import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { AutofillOverlayVisibility } from "@bitwarden/common/autofill/constants";

import AutofillPageDetails from "../models/autofill-page-details";
import AutofillScript from "../models/autofill-script";
import AutofillOverlayContentService from "../services/autofill-overlay-content.service";
import { flushPromises, sendExtensionRuntimeMessage } from "../spec/testing-utils";
import { RedirectFocusDirection } from "../utils/autofill-overlay.enum";

import { AutofillExtensionMessage } from "./abstractions/autofill-init";
import AutofillInit from "./autofill-init";

describe("AutofillInit", () => {
  let autofillInit: AutofillInit;
  const autofillOverlayContentService = mock<AutofillOverlayContentService>();
  const originalDocumentReadyState = document.readyState;

  beforeEach(() => {
    chrome.runtime.connect = jest.fn().mockReturnValue({
      onDisconnect: {
        addListener: jest.fn(),
      },
    });
    autofillInit = new AutofillInit(autofillOverlayContentService);
  });

  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    Object.defineProperty(document, "readyState", {
      value: originalDocumentReadyState,
      writable: true,
    });
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
      jest.advanceTimersByTime(250);

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        {
          command: "bgCollectPageDetails",
          sender: "autofillInit",
        },
        expect.any(Function),
      );
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

    it("returns a undefined value if a extension message handler is not found with the given message command", () => {
      message.command = "unknownCommand";

      const response = autofillInit["handleExtensionMessage"](message, sender, sendResponse);

      expect(response).toBe(undefined);
    });

    it("returns a undefined value if the message handler does not return a response", async () => {
      const response1 = await autofillInit["handleExtensionMessage"](message, sender, sendResponse);
      await flushPromises();

      expect(response1).not.toBe(false);

      message.command = "removeAutofillOverlay";
      message.fillScript = mock<AutofillScript>();

      const response2 = autofillInit["handleExtensionMessage"](message, sender, sendResponse);
      await flushPromises();

      expect(response2).toBe(undefined);
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
      await Promise.resolve(response);

      expect(response).toBe(true);
      expect(sendResponse).toHaveBeenCalledWith(pageDetails);
    });

    describe("extension message handlers", () => {
      beforeEach(() => {
        autofillInit.init();
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

          sendExtensionRuntimeMessage(message, sender, sendResponse);
          await flushPromises();

          expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
            command: "collectPageDetailsResponse",
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

          sendExtensionRuntimeMessage(
            { command: "collectPageDetailsImmediately" },
            sender,
            sendResponse,
          );
          await flushPromises();

          expect(autofillInit["collectAutofillContentService"].getPageDetails).toHaveBeenCalled();
          expect(sendResponse).toBeCalledWith(pageDetails);
          expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
        });
      });

      describe("fillForm", () => {
        let fillScript: AutofillScript;
        beforeEach(() => {
          fillScript = mock<AutofillScript>();
          jest.spyOn(autofillInit["insertAutofillContentService"], "fillForm").mockImplementation();
        });

        it("skips calling the InsertAutofillContentService and does not fill the form if the url to fill is not equal to the current tab url", async () => {
          const fillScript = mock<AutofillScript>();
          const message = {
            command: "fillForm",
            fillScript,
            pageDetailsUrl: "https://a-different-url.com",
          };

          sendExtensionRuntimeMessage(message);
          await flushPromises();

          expect(autofillInit["insertAutofillContentService"].fillForm).not.toHaveBeenCalledWith(
            fillScript,
          );
        });

        it("calls the InsertAutofillContentService to fill the form", async () => {
          sendExtensionRuntimeMessage({
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
          const blurAndRemoveOverlaySpy = jest.spyOn(autofillInit as any, "blurAndRemoveOverlay");
          sendExtensionRuntimeMessage({
            command: "fillForm",
            fillScript,
            pageDetailsUrl: window.location.href,
          });
          await flushPromises();

          expect(blurAndRemoveOverlaySpy).toHaveBeenCalled();
        });

        it("updates the isCurrentlyFilling property of the overlay to true after filling", async () => {
          jest.useFakeTimers();
          jest.spyOn(autofillInit as any, "updateOverlayIsCurrentlyFilling");
          jest
            .spyOn(autofillInit["autofillOverlayContentService"], "focusMostRecentOverlayField")
            .mockImplementation();

          sendExtensionRuntimeMessage({
            command: "fillForm",
            fillScript,
            pageDetailsUrl: window.location.href,
          });
          await flushPromises();
          jest.advanceTimersByTime(300);

          expect(autofillInit["updateOverlayIsCurrentlyFilling"]).toHaveBeenNthCalledWith(1, true);
          expect(autofillInit["insertAutofillContentService"].fillForm).toHaveBeenCalledWith(
            fillScript,
          );
          expect(autofillInit["updateOverlayIsCurrentlyFilling"]).toHaveBeenNthCalledWith(2, false);
        });

        it("skips attempting to focus the most recent field if the autofillOverlayContentService is not present", async () => {
          jest.useFakeTimers();
          const newAutofillInit = new AutofillInit(undefined);
          newAutofillInit.init();
          jest.spyOn(newAutofillInit as any, "updateOverlayIsCurrentlyFilling");
          jest
            .spyOn(newAutofillInit["insertAutofillContentService"], "fillForm")
            .mockImplementation();

          sendExtensionRuntimeMessage({
            command: "fillForm",
            fillScript,
            pageDetailsUrl: window.location.href,
          });
          await flushPromises();
          jest.advanceTimersByTime(300);

          expect(newAutofillInit["updateOverlayIsCurrentlyFilling"]).toHaveBeenNthCalledWith(
            1,
            true,
          );
          expect(newAutofillInit["insertAutofillContentService"].fillForm).toHaveBeenCalledWith(
            fillScript,
          );
          expect(newAutofillInit["updateOverlayIsCurrentlyFilling"]).not.toHaveBeenNthCalledWith(
            2,
            false,
          );
        });
      });

      describe("openAutofillOverlay", () => {
        const message = {
          command: "openAutofillOverlay",
          data: {
            isFocusingFieldElement: true,
            isOpeningFullOverlay: true,
            authStatus: AuthenticationStatus.Unlocked,
          },
        };

        it("skips attempting to open the autofill overlay if the autofillOverlayContentService is not present", () => {
          const newAutofillInit = new AutofillInit(undefined);
          newAutofillInit.init();

          sendExtensionRuntimeMessage(message);

          expect(newAutofillInit["autofillOverlayContentService"]).toBe(undefined);
        });

        it("opens the autofill overlay", () => {
          sendExtensionRuntimeMessage(message);

          expect(
            autofillInit["autofillOverlayContentService"].openAutofillOverlay,
          ).toHaveBeenCalledWith({
            isFocusingFieldElement: message.data.isFocusingFieldElement,
            isOpeningFullOverlay: message.data.isOpeningFullOverlay,
            authStatus: message.data.authStatus,
          });
        });
      });

      describe("closeAutofillOverlay", () => {
        beforeEach(() => {
          autofillInit["autofillOverlayContentService"].isFieldCurrentlyFocused = false;
          autofillInit["autofillOverlayContentService"].isCurrentlyFilling = false;
        });

        it("skips attempting to remove the overlay if the autofillOverlayContentService is not present", () => {
          const newAutofillInit = new AutofillInit(undefined);
          newAutofillInit.init();
          jest.spyOn(newAutofillInit as any, "removeAutofillOverlay");

          sendExtensionRuntimeMessage({
            command: "closeAutofillOverlay",
            data: { forceCloseOverlay: false },
          });

          expect(newAutofillInit["autofillOverlayContentService"]).toBe(undefined);
        });

        it("removes the autofill overlay if the message flags a forced closure", () => {
          sendExtensionRuntimeMessage({
            command: "closeAutofillOverlay",
            data: { forceCloseOverlay: true },
          });

          expect(
            autofillInit["autofillOverlayContentService"].removeAutofillOverlay,
          ).toHaveBeenCalled();
        });

        it("ignores the message if a field is currently focused", () => {
          autofillInit["autofillOverlayContentService"].isFieldCurrentlyFocused = true;

          sendExtensionRuntimeMessage({ command: "closeAutofillOverlay" });

          expect(
            autofillInit["autofillOverlayContentService"].removeAutofillOverlayList,
          ).not.toHaveBeenCalled();
          expect(
            autofillInit["autofillOverlayContentService"].removeAutofillOverlay,
          ).not.toHaveBeenCalled();
        });

        it("removes the autofill overlay list if the overlay is currently filling", () => {
          autofillInit["autofillOverlayContentService"].isCurrentlyFilling = true;

          sendExtensionRuntimeMessage({ command: "closeAutofillOverlay" });

          expect(
            autofillInit["autofillOverlayContentService"].removeAutofillOverlayList,
          ).toHaveBeenCalled();
          expect(
            autofillInit["autofillOverlayContentService"].removeAutofillOverlay,
          ).not.toHaveBeenCalled();
        });

        it("removes the entire overlay if the overlay is not currently filling", () => {
          sendExtensionRuntimeMessage({ command: "closeAutofillOverlay" });

          expect(
            autofillInit["autofillOverlayContentService"].removeAutofillOverlayList,
          ).not.toHaveBeenCalled();
          expect(
            autofillInit["autofillOverlayContentService"].removeAutofillOverlay,
          ).toHaveBeenCalled();
        });
      });

      describe("addNewVaultItemFromOverlay", () => {
        it("will not add a new vault item if the autofillOverlayContentService is not present", () => {
          const newAutofillInit = new AutofillInit(undefined);
          newAutofillInit.init();

          sendExtensionRuntimeMessage({ command: "addNewVaultItemFromOverlay" });

          expect(newAutofillInit["autofillOverlayContentService"]).toBe(undefined);
        });

        it("will add a new vault item", () => {
          sendExtensionRuntimeMessage({ command: "addNewVaultItemFromOverlay" });

          expect(autofillInit["autofillOverlayContentService"].addNewVaultItem).toHaveBeenCalled();
        });
      });

      describe("redirectOverlayFocusOut", () => {
        const message = {
          command: "redirectOverlayFocusOut",
          data: {
            direction: RedirectFocusDirection.Next,
          },
        };

        it("ignores the message to redirect focus if the autofillOverlayContentService does not exist", () => {
          const newAutofillInit = new AutofillInit(undefined);
          newAutofillInit.init();

          sendExtensionRuntimeMessage(message);

          expect(newAutofillInit["autofillOverlayContentService"]).toBe(undefined);
        });

        it("redirects the overlay focus", () => {
          sendExtensionRuntimeMessage(message);

          expect(
            autofillInit["autofillOverlayContentService"].redirectOverlayFocusOut,
          ).toHaveBeenCalledWith(message.data.direction);
        });
      });

      describe("updateIsOverlayCiphersPopulated", () => {
        const message = {
          command: "updateIsOverlayCiphersPopulated",
          data: {
            isOverlayCiphersPopulated: true,
          },
        };

        it("skips updating whether the ciphers are populated if the autofillOverlayContentService does note exist", () => {
          const newAutofillInit = new AutofillInit(undefined);
          newAutofillInit.init();

          sendExtensionRuntimeMessage(message);

          expect(newAutofillInit["autofillOverlayContentService"]).toBe(undefined);
        });

        it("updates whether the overlay ciphers are populated", () => {
          sendExtensionRuntimeMessage(message);

          expect(autofillInit["autofillOverlayContentService"].isOverlayCiphersPopulated).toEqual(
            message.data.isOverlayCiphersPopulated,
          );
        });
      });

      describe("bgUnlockPopoutOpened", () => {
        it("skips attempting to blur and remove the overlay if the autofillOverlayContentService is not present", () => {
          const newAutofillInit = new AutofillInit(undefined);
          newAutofillInit.init();
          jest.spyOn(newAutofillInit as any, "removeAutofillOverlay");

          sendExtensionRuntimeMessage({ command: "bgUnlockPopoutOpened" });

          expect(newAutofillInit["autofillOverlayContentService"]).toBe(undefined);
          expect(newAutofillInit["removeAutofillOverlay"]).not.toHaveBeenCalled();
        });

        it("blurs the most recently focused feel and remove the autofill overlay", () => {
          jest.spyOn(autofillInit["autofillOverlayContentService"], "blurMostRecentOverlayField");
          jest.spyOn(autofillInit as any, "removeAutofillOverlay");

          sendExtensionRuntimeMessage({ command: "bgUnlockPopoutOpened" });

          expect(
            autofillInit["autofillOverlayContentService"].blurMostRecentOverlayField,
          ).toHaveBeenCalled();
          expect(autofillInit["removeAutofillOverlay"]).toHaveBeenCalled();
        });
      });

      describe("bgVaultItemRepromptPopoutOpened", () => {
        it("skips attempting to blur and remove the overlay if the autofillOverlayContentService is not present", () => {
          const newAutofillInit = new AutofillInit(undefined);
          newAutofillInit.init();
          jest.spyOn(newAutofillInit as any, "removeAutofillOverlay");

          sendExtensionRuntimeMessage({ command: "bgVaultItemRepromptPopoutOpened" });

          expect(newAutofillInit["autofillOverlayContentService"]).toBe(undefined);
          expect(newAutofillInit["removeAutofillOverlay"]).not.toHaveBeenCalled();
        });

        it("blurs the most recently focused feel and remove the autofill overlay", () => {
          jest.spyOn(autofillInit["autofillOverlayContentService"], "blurMostRecentOverlayField");
          jest.spyOn(autofillInit as any, "removeAutofillOverlay");

          sendExtensionRuntimeMessage({ command: "bgVaultItemRepromptPopoutOpened" });

          expect(
            autofillInit["autofillOverlayContentService"].blurMostRecentOverlayField,
          ).toHaveBeenCalled();
          expect(autofillInit["removeAutofillOverlay"]).toHaveBeenCalled();
        });
      });

      describe("updateAutofillOverlayVisibility", () => {
        beforeEach(() => {
          autofillInit["autofillOverlayContentService"].autofillOverlayVisibility =
            AutofillOverlayVisibility.OnButtonClick;
        });

        it("skips attempting to update the overlay visibility if the autofillOverlayVisibility data value is not present", () => {
          sendExtensionRuntimeMessage({
            command: "updateAutofillOverlayVisibility",
            data: {},
          });

          expect(autofillInit["autofillOverlayContentService"].autofillOverlayVisibility).toEqual(
            AutofillOverlayVisibility.OnButtonClick,
          );
        });

        it("updates the overlay visibility value", () => {
          const message = {
            command: "updateAutofillOverlayVisibility",
            data: {
              autofillOverlayVisibility: AutofillOverlayVisibility.Off,
            },
          };

          sendExtensionRuntimeMessage(message);

          expect(autofillInit["autofillOverlayContentService"].autofillOverlayVisibility).toEqual(
            message.data.autofillOverlayVisibility,
          );
        });
      });
    });
  });

  describe("destroy", () => {
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
