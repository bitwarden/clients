import { mock, MockProxy } from "jest-mock-extended";

import AutofillInit from "../../../content/autofill-init";
import { AutofillOverlayElement } from "../../../enums/autofill-overlay.enum";
import { DomQueryService } from "../../../services/abstractions/dom-query.service";
import DomElementVisibilityService from "../../../services/dom-element-visibility.service";
import { createMutationRecordMock } from "../../../spec/autofill-mocks";
import { flushPromises, sendMockExtensionMessage } from "../../../spec/testing-utils";
import { ElementWithOpId } from "../../../types";

import { AutofillInlineMenuContentService } from "./autofill-inline-menu-content.service";

describe("AutofillInlineMenuContentService", () => {
  let domQueryService: MockProxy<DomQueryService>;
  let domElementVisibilityService: DomElementVisibilityService;
  let autofillInlineMenuContentService: AutofillInlineMenuContentService;
  let autofillInit: AutofillInit;
  let sendExtensionMessageSpy: jest.SpyInstance;
  let observeContainerMutationsSpy: jest.SpyInstance;
  const waitForIdleCallback = () =>
    new Promise((resolve) => globalThis.requestIdleCallback(resolve));

  beforeEach(() => {
    globalThis.document.body.innerHTML = "";
    globalThis.requestIdleCallback = jest.fn((cb, options) => setTimeout(cb, 100));
    domQueryService = mock<DomQueryService>();
    domElementVisibilityService = new DomElementVisibilityService();
    autofillInlineMenuContentService = new AutofillInlineMenuContentService();
    autofillInit = new AutofillInit(
      domQueryService,
      domElementVisibilityService,
      undefined,
      autofillInlineMenuContentService,
    );
    autofillInit.init();
    observeContainerMutationsSpy = jest.spyOn(
      autofillInlineMenuContentService["containerElementMutationObserver"] as any,
      "observe",
    );
    sendExtensionMessageSpy = jest.spyOn(
      autofillInlineMenuContentService as any,
      "sendExtensionMessage",
    );
    jest.spyOn(autofillInlineMenuContentService as any, "getPageIsOpaque");
  });

  afterEach(() => {
    jest.clearAllMocks();

    Object.defineProperty(document, "activeElement", {
      value: null,
      writable: true,
    });
  });

  describe("messageHandlers", () => {
    it("returns the extension message handlers", () => {
      const handlers = autofillInlineMenuContentService.messageHandlers;

      expect(handlers).toHaveProperty("closeAutofillInlineMenu");
      expect(handlers).toHaveProperty("appendAutofillInlineMenuToDom");
    });
  });

  describe("isElementInlineMenu", () => {
    it("returns true if the passed element is the inline menu list", () => {
      const element = document.createElement("div");
      autofillInlineMenuContentService["listElement"] = element;

      expect(autofillInlineMenuContentService.isElementInlineMenu(element)).toBe(true);
    });

    it("returns true if the passed element is the inline menu button", () => {
      const element = document.createElement("div");
      autofillInlineMenuContentService["buttonElement"] = element;

      expect(autofillInlineMenuContentService.isElementInlineMenu(element)).toBe(true);
    });

    it("returns false if the passed element is not the inline menu", () => {
      const element = document.createElement("div");

      expect(autofillInlineMenuContentService.isElementInlineMenu(element)).toBe(false);
    });
  });

  describe("extension message handlers", () => {
    describe("closeAutofillInlineMenu message handler", () => {
      beforeEach(() => {
        observeContainerMutationsSpy.mockImplementation();
      });

      it("closes the inline menu button", async () => {
        sendMockExtensionMessage({
          command: "appendAutofillInlineMenuToDom",
          overlayElement: AutofillOverlayElement.Button,
        });

        sendMockExtensionMessage({
          command: "closeAutofillInlineMenu",
          overlayElement: AutofillOverlayElement.Button,
        });

        expect(sendExtensionMessageSpy).toHaveBeenCalledWith("autofillOverlayElementClosed", {
          overlayElement: AutofillOverlayElement.Button,
        });
      });

      it("closes the inline menu list", async () => {
        sendMockExtensionMessage({
          command: "appendAutofillInlineMenuToDom",
          overlayElement: AutofillOverlayElement.List,
        });

        sendMockExtensionMessage({
          command: "closeAutofillInlineMenu",
          overlayElement: AutofillOverlayElement.List,
        });

        expect(sendExtensionMessageSpy).toHaveBeenCalledWith("autofillOverlayElementClosed", {
          overlayElement: AutofillOverlayElement.List,
        });
      });

      it("closes both inline menu elements and removes the body element mutation observer", async () => {
        const unobserveContainerElementSpy = jest.spyOn(
          autofillInlineMenuContentService as any,
          "unobserveContainerElement",
        );
        sendMockExtensionMessage({
          command: "appendAutofillInlineMenuToDom",
          overlayElement: AutofillOverlayElement.Button,
        });
        sendMockExtensionMessage({
          command: "appendAutofillInlineMenuToDom",
          overlayElement: AutofillOverlayElement.List,
        });

        sendMockExtensionMessage({
          command: "closeAutofillInlineMenu",
        });

        expect(unobserveContainerElementSpy).toHaveBeenCalled();
        expect(sendExtensionMessageSpy).toHaveBeenCalledWith("autofillOverlayElementClosed", {
          overlayElement: AutofillOverlayElement.Button,
        });

        expect(sendExtensionMessageSpy).toHaveBeenCalledWith("autofillOverlayElementClosed", {
          overlayElement: AutofillOverlayElement.List,
        });
      });
    });

    describe("appendAutofillInlineMenuToDom message handler", () => {
      let isInlineMenuButtonVisibleSpy: jest.SpyInstance;
      let isInlineMenuListVisibleSpy: jest.SpyInstance;

      beforeEach(() => {
        isInlineMenuButtonVisibleSpy = jest
          .spyOn(autofillInlineMenuContentService as any, "isInlineMenuButtonVisible")
          .mockResolvedValue(true);
        isInlineMenuListVisibleSpy = jest
          .spyOn(autofillInlineMenuContentService as any, "isInlineMenuListVisible")
          .mockResolvedValue(true);
        jest.spyOn(globalThis.document.body, "appendChild");
        observeContainerMutationsSpy.mockImplementation();
      });

      describe("creating the inline menu button", () => {
        it("creates a `div` button element if the user browser is Firefox", () => {
          autofillInlineMenuContentService["isFirefoxBrowser"] = true;

          sendMockExtensionMessage({
            command: "appendAutofillInlineMenuToDom",
            overlayElement: AutofillOverlayElement.Button,
          });

          expect(autofillInlineMenuContentService["buttonElement"]).toBeInstanceOf(HTMLDivElement);
        });

        it("appends the inline menu button to the DOM if the button is not visible", async () => {
          isInlineMenuButtonVisibleSpy.mockResolvedValue(false);

          sendMockExtensionMessage({
            command: "appendAutofillInlineMenuToDom",
            overlayElement: AutofillOverlayElement.Button,
          });
          await flushPromises();

          expect(globalThis.document.body.appendChild).toHaveBeenCalledWith(
            autofillInlineMenuContentService["buttonElement"],
          );
          expect(sendExtensionMessageSpy).toHaveBeenCalledWith(
            "updateAutofillInlineMenuElementIsVisibleStatus",
            {
              overlayElement: AutofillOverlayElement.Button,
              isVisible: true,
            },
          );
        });
      });

      describe("creating the inline menu list", () => {
        it("creates a `div` list element if the user browser is Firefox", () => {
          autofillInlineMenuContentService["isFirefoxBrowser"] = true;

          sendMockExtensionMessage({
            command: "appendAutofillInlineMenuToDom",
            overlayElement: AutofillOverlayElement.List,
          });

          expect(autofillInlineMenuContentService["listElement"]).toBeInstanceOf(HTMLDivElement);
        });

        it("appends the inline menu list to the DOM if the button is not visible", async () => {
          isInlineMenuListVisibleSpy.mockResolvedValue(false);

          sendMockExtensionMessage({
            command: "appendAutofillInlineMenuToDom",
            overlayElement: AutofillOverlayElement.List,
          });
          await flushPromises();

          expect(globalThis.document.body.appendChild).toHaveBeenCalledWith(
            autofillInlineMenuContentService["listElement"],
          );
          expect(sendExtensionMessageSpy).toHaveBeenCalledWith(
            "updateAutofillInlineMenuElementIsVisibleStatus",
            {
              overlayElement: AutofillOverlayElement.List,
              isVisible: true,
            },
          );
        });
      });

      it("appends the inline menu element to a containing `dialog` element if the element is a modal", async () => {
        isInlineMenuButtonVisibleSpy.mockResolvedValue(false);
        const dialogElement = document.createElement("dialog");
        dialogElement.setAttribute("open", "true");
        jest.spyOn(dialogElement, "matches").mockReturnValue(true);
        const dialogAppendSpy = jest.spyOn(dialogElement, "appendChild");
        const inputElement = document.createElement("input");
        dialogElement.appendChild(inputElement);
        document.body.appendChild(dialogElement);
        Object.defineProperty(document, "activeElement", {
          value: inputElement,
          writable: true,
        });

        sendMockExtensionMessage({
          command: "appendAutofillInlineMenuToDom",
          overlayElement: AutofillOverlayElement.Button,
        });
        await flushPromises();

        expect(dialogAppendSpy).toHaveBeenCalledWith(
          autofillInlineMenuContentService["buttonElement"],
        );
      });
    });
  });

  describe("handleInlineMenuElementMutationObserverUpdate", () => {
    let usernameField: ElementWithOpId<HTMLInputElement>;

    beforeEach(() => {
      document.body.innerHTML = `
    <form id="validFormId">
      <input type="text" id="username-field" placeholder="username" />
      <input type="password" id="password-field" placeholder="password" />
    </form>
    `;
      usernameField = document.getElementById(
        "username-field",
      ) as ElementWithOpId<HTMLInputElement>;
      usernameField.style.setProperty("display", "block", "important");
      jest.spyOn(usernameField, "removeAttribute");
      jest.spyOn(usernameField.style, "setProperty");
      jest
        .spyOn(
          autofillInlineMenuContentService as any,
          "isTriggeringExcessiveMutationObserverIterations",
        )
        .mockReturnValue(false);
    });

    it("skips handling the mutation if excessive mutation observer events are triggered", () => {
      jest
        .spyOn(
          autofillInlineMenuContentService as any,
          "isTriggeringExcessiveMutationObserverIterations",
        )
        .mockReturnValue(true);

      autofillInlineMenuContentService["handleInlineMenuElementMutationObserverUpdate"]([
        createMutationRecordMock({ target: usernameField }),
      ]);

      expect(usernameField.removeAttribute).not.toHaveBeenCalled();
    });

    it("skips handling the mutation if the record type is not for `attributes`", () => {
      autofillInlineMenuContentService["handleInlineMenuElementMutationObserverUpdate"]([
        createMutationRecordMock({ target: usernameField, type: "childList" }),
      ]);

      expect(usernameField.removeAttribute).not.toHaveBeenCalled();
    });

    it("removes all element attributes that are not the style attribute", () => {
      autofillInlineMenuContentService["handleInlineMenuElementMutationObserverUpdate"]([
        createMutationRecordMock({
          target: usernameField,
          type: "attributes",
          attributeName: "placeholder",
        }),
      ]);

      expect(usernameField.removeAttribute).toHaveBeenCalledWith("placeholder");
    });

    it("removes all attached style attributes and sets the default styles", () => {
      autofillInlineMenuContentService["handleInlineMenuElementMutationObserverUpdate"]([
        createMutationRecordMock({
          target: usernameField,
          type: "attributes",
          attributeName: "style",
        }),
      ]);

      expect(usernameField.removeAttribute).toHaveBeenCalledWith("style");
      expect(usernameField.style.setProperty).toHaveBeenCalledWith("all", "initial", "important");
      expect(usernameField.style.setProperty).toHaveBeenCalledWith(
        "position",
        "fixed",
        "important",
      );
      expect(usernameField.style.setProperty).toHaveBeenCalledWith("display", "block", "important");
    });
  });

  describe("handleContainerElementMutationObserverUpdate", () => {
    let mockMutationRecord: MockProxy<MutationRecord>;
    let mockBodyMutationRecord: MockProxy<MutationRecord>;
    let mockHTMLMutationRecord: MockProxy<MutationRecord>;
    let buttonElement: HTMLElement;
    let listElement: HTMLElement;
    let isInlineMenuListVisibleSpy: jest.SpyInstance;

    beforeEach(() => {
      document.body.innerHTML = `
      <div class="overlay-button"></div>
      <div class="overlay-list"></div>
      `;
      mockMutationRecord = mock<MutationRecord>({ target: globalThis.document.body } as any);
      mockHTMLMutationRecord = mock<MutationRecord>({
        target: globalThis.document.body.parentElement,
        attributeName: "style",
        type: "attributes",
      } as any);
      mockBodyMutationRecord = mock<MutationRecord>({
        target: globalThis.document.body,
        attributeName: "style",
        type: "attributes",
      } as any);
      buttonElement = document.querySelector(".overlay-button") as HTMLElement;
      listElement = document.querySelector(".overlay-list") as HTMLElement;
      autofillInlineMenuContentService["buttonElement"] = buttonElement;
      autofillInlineMenuContentService["listElement"] = listElement;
      isInlineMenuListVisibleSpy = jest
        .spyOn(autofillInlineMenuContentService as any, "isInlineMenuListVisible")
        .mockResolvedValue(true);
      jest.spyOn(globalThis.document.body, "insertBefore");
      jest
        .spyOn(
          autofillInlineMenuContentService as any,
          "isTriggeringExcessiveMutationObserverIterations",
        )
        .mockReturnValue(false);
      jest.spyOn(autofillInlineMenuContentService as any, "closeInlineMenu");
    });

    it("skips handling the mutation if the overlay elements are not present in the DOM", async () => {
      autofillInlineMenuContentService["buttonElement"] = undefined;
      autofillInlineMenuContentService["listElement"] = undefined;

      autofillInlineMenuContentService["handleContainerElementMutationObserverUpdate"]([
        mockMutationRecord,
      ]);
      await waitForIdleCallback();

      expect(globalThis.document.body.insertBefore).not.toHaveBeenCalled();
    });

    it("skips handling the mutation if excessive mutations are being triggered", async () => {
      jest
        .spyOn(
          autofillInlineMenuContentService as any,
          "isTriggeringExcessiveMutationObserverIterations",
        )
        .mockReturnValue(true);

      autofillInlineMenuContentService["handleContainerElementMutationObserverUpdate"]([
        mockMutationRecord,
      ]);
      await waitForIdleCallback();

      expect(globalThis.document.body.insertBefore).not.toHaveBeenCalled();
    });

    it("closes the inline menu if the page body is not sufficiently opaque", async () => {
      document.documentElement.style.opacity = "0.9";
      document.body.style.opacity = "0";
      await autofillInlineMenuContentService["handlePageMutations"]([mockBodyMutationRecord]);

      expect(autofillInlineMenuContentService["getPageIsOpaque"]).toHaveReturnedWith(false);
      expect(autofillInlineMenuContentService["closeInlineMenu"]).toHaveBeenCalled();
    });

    it("closes the inline menu if the page html is not sufficiently opaque", async () => {
      document.documentElement.style.opacity = "0.3";
      document.body.style.opacity = "0.7";
      await autofillInlineMenuContentService["handlePageMutations"]([mockHTMLMutationRecord]);

      expect(autofillInlineMenuContentService["getPageIsOpaque"]).toHaveReturnedWith(false);
      expect(autofillInlineMenuContentService["closeInlineMenu"]).toHaveBeenCalled();
    });

    it("does not close the inline menu if the page html and body is sufficiently opaque", async () => {
      document.documentElement.style.opacity = "0.9";
      document.body.style.opacity = "1";
      await autofillInlineMenuContentService["handlePageMutations"]([mockBodyMutationRecord]);
      await waitForIdleCallback();

      expect(autofillInlineMenuContentService["getPageIsOpaque"]).toHaveReturnedWith(true);
      expect(autofillInlineMenuContentService["closeInlineMenu"]).not.toHaveBeenCalled();
    });

    it("skips re-arranging the DOM elements if the last child of the body is non-existent", async () => {
      document.body.innerHTML = "";

      autofillInlineMenuContentService["handleContainerElementMutationObserverUpdate"]([
        mockMutationRecord,
      ]);
      await waitForIdleCallback();

      expect(globalThis.document.body.insertBefore).not.toHaveBeenCalled();
    });

    it("skips re-arranging the DOM elements if the last child of the body is the overlay list and the second to last child of the body is the overlay button", async () => {
      autofillInlineMenuContentService["handleContainerElementMutationObserverUpdate"]([
        mockMutationRecord,
      ]);
      await waitForIdleCallback();

      expect(globalThis.document.body.insertBefore).not.toHaveBeenCalled();
    });

    it("skips re-arranging the DOM elements if the last child is the overlay button and the overlay list is not visible", async () => {
      listElement.remove();
      isInlineMenuListVisibleSpy.mockResolvedValue(false);

      autofillInlineMenuContentService["handleContainerElementMutationObserverUpdate"]([
        mockMutationRecord,
      ]);
      await waitForIdleCallback();

      expect(globalThis.document.body.insertBefore).not.toHaveBeenCalled();
    });

    it("positions the overlay button before the overlay list if an element has inserted itself after the button element", async () => {
      const injectedElement = document.createElement("div");
      document.body.insertBefore(injectedElement, listElement);

      autofillInlineMenuContentService["handleContainerElementMutationObserverUpdate"]([
        mockMutationRecord,
      ]);
      await waitForIdleCallback();

      expect(globalThis.document.body.insertBefore).toHaveBeenCalledWith(
        buttonElement,
        listElement,
      );
    });

    it("positions the overlay button before the overlay list if the elements have inserted in incorrect order", async () => {
      document.body.appendChild(buttonElement);

      autofillInlineMenuContentService["handleContainerElementMutationObserverUpdate"]([
        mockMutationRecord,
      ]);
      await waitForIdleCallback();

      expect(globalThis.document.body.insertBefore).toHaveBeenCalledWith(
        buttonElement,
        listElement,
      );
    });

    it("positions the last child before the overlay button if it is not the overlay list", async () => {
      const injectedElement = document.createElement("div");
      document.body.appendChild(injectedElement);

      autofillInlineMenuContentService["handleContainerElementMutationObserverUpdate"]([
        mockMutationRecord,
      ]);
      await waitForIdleCallback();

      expect(globalThis.document.body.insertBefore).toHaveBeenCalledWith(
        injectedElement,
        buttonElement,
      );
    });

    describe("handling an element that attempts to force itself as the last child", () => {
      let persistentLastChild: HTMLElement;

      beforeEach(() => {
        persistentLastChild = document.createElement("div");
        persistentLastChild.style.setProperty("z-index", "2147483647");
        document.body.appendChild(persistentLastChild);
        autofillInlineMenuContentService["lastElementOverrides"].set(persistentLastChild, 3);
      });

      it("sets the z-index of to a lower value", async () => {
        autofillInlineMenuContentService["handlePersistentLastChildOverrideTimeout"] = setTimeout(
          jest.fn(),
          1000,
        );

        autofillInlineMenuContentService["handleContainerElementMutationObserverUpdate"]([
          mockMutationRecord,
        ]);
        await waitForIdleCallback();

        expect(persistentLastChild.style.getPropertyValue("z-index")).toBe("2147483646");
      });

      it("closes the inline menu if the persistent last child overlays the inline menu button", async () => {
        sendExtensionMessageSpy.mockResolvedValue({
          button: { top: 0, left: 0, width: 0, height: 0 },
        });
        globalThis.document.elementFromPoint = jest.fn(() => persistentLastChild);

        await autofillInlineMenuContentService["verifyInlineMenuIsNotObscured"](
          persistentLastChild,
        );

        expect(sendExtensionMessageSpy).toHaveBeenCalledWith("autofillOverlayElementClosed", {
          overlayElement: AutofillOverlayElement.Button,
        });
      });

      it("closes the inline menu if the persistent last child overlays the inline menu list", async () => {
        sendExtensionMessageSpy.mockResolvedValue({
          list: { top: 0, left: 0, width: 0, height: 0 },
        });
        globalThis.document.elementFromPoint = jest.fn(() => persistentLastChild);

        await autofillInlineMenuContentService["verifyInlineMenuIsNotObscured"](
          persistentLastChild,
        );

        expect(sendExtensionMessageSpy).toHaveBeenCalledWith("autofillOverlayElementClosed", {
          overlayElement: AutofillOverlayElement.List,
        });
      });
    });
  });

  describe("isTriggeringExcessiveMutationObserverIterations", () => {
    it("clears any existing reset timeout", () => {
      jest.useFakeTimers();
      const clearTimeoutSpy = jest.spyOn(globalThis, "clearTimeout");
      autofillInlineMenuContentService["mutationObserverIterationsResetTimeout"] = setTimeout(
        jest.fn(),
        123,
      );

      autofillInlineMenuContentService["isTriggeringExcessiveMutationObserverIterations"]();

      expect(clearTimeoutSpy).toHaveBeenCalledWith(expect.anything());
    });

    it("will reset the number of mutationObserverIterations after two seconds", () => {
      jest.useFakeTimers();
      autofillInlineMenuContentService["mutationObserverIterations"] = 10;

      autofillInlineMenuContentService["isTriggeringExcessiveMutationObserverIterations"]();
      jest.advanceTimersByTime(2000);

      expect(autofillInlineMenuContentService["mutationObserverIterations"]).toEqual(0);
    });

    it("will blur the overlay field and remove the autofill overlay if excessive mutation observer iterations are triggering", async () => {
      autofillInlineMenuContentService["mutationObserverIterations"] = 101;
      const closeInlineMenuSpy = jest.spyOn(
        autofillInlineMenuContentService as any,
        "closeInlineMenu",
      );

      autofillInlineMenuContentService["isTriggeringExcessiveMutationObserverIterations"]();
      await flushPromises();

      expect(closeInlineMenuSpy).toHaveBeenCalled();
    });
  });

  describe("destroy", () => {
    it("closes the inline menu", () => {
      autofillInlineMenuContentService["buttonElement"] = document.createElement("div");
      autofillInlineMenuContentService["listElement"] = document.createElement("div");

      autofillInlineMenuContentService.destroy();

      expect(sendExtensionMessageSpy).toHaveBeenCalledWith("autofillOverlayElementClosed", {
        overlayElement: AutofillOverlayElement.Button,
      });
      expect(sendExtensionMessageSpy).toHaveBeenCalledWith("autofillOverlayElementClosed", {
        overlayElement: AutofillOverlayElement.List,
      });
    });

    it("clears the persistent last child override timeout", () => {
      jest.useFakeTimers();
      const clearTimeoutSpy = jest.spyOn(globalThis, "clearTimeout");
      autofillInlineMenuContentService["handlePersistentLastChildOverrideTimeout"] = setTimeout(
        jest.fn(),
        500,
      );

      autofillInlineMenuContentService.destroy();

      expect(clearTimeoutSpy).toHaveBeenCalled();
    });

    it("unobserves page attributes", () => {
      const disconnectSpy = jest.spyOn(
        autofillInlineMenuContentService["htmlMutationObserver"],
        "disconnect",
      );

      autofillInlineMenuContentService.destroy();

      expect(disconnectSpy).toHaveBeenCalled();
    });
  });

  describe("getOwnedTagNames", () => {
    it("returns an empty array when no elements are created", () => {
      expect(autofillInlineMenuContentService.getOwnedTagNames()).toEqual([]);
    });

    it("returns the button element tag name", () => {
      const buttonElement = document.createElement("div");
      autofillInlineMenuContentService["buttonElement"] = buttonElement;

      const tagNames = autofillInlineMenuContentService.getOwnedTagNames();

      expect(tagNames).toContain("DIV");
    });

    it("returns both button and list element tag names", () => {
      const buttonElement = document.createElement("div");
      const listElement = document.createElement("span");
      autofillInlineMenuContentService["buttonElement"] = buttonElement;
      autofillInlineMenuContentService["listElement"] = listElement;

      const tagNames = autofillInlineMenuContentService.getOwnedTagNames();

      expect(tagNames).toEqual(["DIV", "SPAN"]);
    });
  });

  describe("getUnownedTopLayerItems", () => {
    beforeEach(() => {
      document.body.innerHTML = "";
    });

    it("returns the tag names from button and list elements", () => {
      const buttonElement = document.createElement("div");
      buttonElement.setAttribute("popover", "manual");
      autofillInlineMenuContentService["buttonElement"] = buttonElement;

      const listElement = document.createElement("span");
      listElement.setAttribute("popover", "manual");
      autofillInlineMenuContentService["listElement"] = listElement;

      /** Mock querySelectorAll to avoid :modal selector issues in jsdom */
      const querySelectorAllSpy = jest
        .spyOn(globalThis.document, "querySelectorAll")
        .mockReturnValue([] as any);

      const items = autofillInlineMenuContentService.getUnownedTopLayerItems();

      expect(querySelectorAllSpy).toHaveBeenCalled();
      expect(items.length).toBe(0);
    });

    it("calls querySelectorAll with correct selector when includeCandidates is false", () => {
      /** Mock querySelectorAll to avoid :modal selector issues in jsdom */
      const querySelectorAllSpy = jest
        .spyOn(globalThis.document, "querySelectorAll")
        .mockReturnValue([] as any);

      autofillInlineMenuContentService.getUnownedTopLayerItems(false);

      const calledSelector = querySelectorAllSpy.mock.calls[0][0];
      expect(calledSelector).toContain(":modal");
      expect(calledSelector).toContain(":popover-open");
    });

    it("includes candidates selector when requested", () => {
      /** Mock querySelectorAll to avoid :modal selector issues in jsdom */
      const querySelectorAllSpy = jest
        .spyOn(globalThis.document, "querySelectorAll")
        .mockReturnValue([] as any);

      autofillInlineMenuContentService.getUnownedTopLayerItems(true);

      const calledSelector = querySelectorAllSpy.mock.calls[0][0];
      expect(calledSelector).toContain("[popover], dialog");
    });
  });

  describe("refreshTopLayerPosition", () => {
    it("does nothing when inline menu is disabled", () => {
      const getUnownedTopLayerItemsSpy = jest.spyOn(
        autofillInlineMenuContentService,
        "getUnownedTopLayerItems",
      );

      autofillInlineMenuContentService["inlineMenuEnabled"] = false;
      const buttonElement = document.createElement("div");
      autofillInlineMenuContentService["buttonElement"] = buttonElement;

      autofillInlineMenuContentService.refreshTopLayerPosition();

      // Should exit early and not call `getUnownedTopLayerItems`
      expect(getUnownedTopLayerItemsSpy).not.toHaveBeenCalled();
    });

    it("does nothing when no other top layer items exist", () => {
      const buttonElement = document.createElement("div");
      autofillInlineMenuContentService["buttonElement"] = buttonElement;
      jest
        .spyOn(autofillInlineMenuContentService, "getUnownedTopLayerItems")
        .mockReturnValue([] as any);

      const getElementsByTagSpy = jest.spyOn(globalThis.document, "getElementsByTagName");

      autofillInlineMenuContentService.refreshTopLayerPosition();

      // Should exit early and not get inline elements to refresh
      expect(getElementsByTagSpy).not.toHaveBeenCalled();
    });

    it("refreshes button popover when button is in document", () => {
      jest
        .spyOn(autofillInlineMenuContentService, "getUnownedTopLayerItems")
        .mockReturnValue([document.createElement("div")] as any);

      const buttonElement = document.createElement("div");
      buttonElement.setAttribute("popover", "manual");
      buttonElement.showPopover = jest.fn();
      buttonElement.hidePopover = jest.fn();
      document.body.appendChild(buttonElement);
      autofillInlineMenuContentService["buttonElement"] = buttonElement;

      autofillInlineMenuContentService.refreshTopLayerPosition();

      expect(buttonElement.hidePopover).toHaveBeenCalled();
      expect(buttonElement.showPopover).toHaveBeenCalled();
    });

    it("refreshes list popover when list is in document", () => {
      jest
        .spyOn(autofillInlineMenuContentService, "getUnownedTopLayerItems")
        .mockReturnValue([document.createElement("div")] as any);

      const listElement = document.createElement("div");
      listElement.setAttribute("popover", "manual");
      listElement.showPopover = jest.fn();
      listElement.hidePopover = jest.fn();
      document.body.appendChild(listElement);
      autofillInlineMenuContentService["listElement"] = listElement;

      autofillInlineMenuContentService.refreshTopLayerPosition();

      expect(listElement.hidePopover).toHaveBeenCalled();
      expect(listElement.showPopover).toHaveBeenCalled();
    });
  });

  describe("checkAndUpdateRefreshCount", () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date("2023-01-01T00:00:00.000Z"));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("does nothing when inline menu is disabled", () => {
      autofillInlineMenuContentService["inlineMenuEnabled"] = false;

      autofillInlineMenuContentService["checkAndUpdateRefreshCount"]("topLayer");

      expect(autofillInlineMenuContentService["refreshCountWithinTimeThreshold"].topLayer).toBe(0);
    });

    it("increments refresh count when within time threshold", () => {
      autofillInlineMenuContentService["lastTrackedTimestamp"].topLayer = Date.now() - 1000;

      autofillInlineMenuContentService["checkAndUpdateRefreshCount"]("topLayer");

      expect(autofillInlineMenuContentService["refreshCountWithinTimeThreshold"].topLayer).toBe(1);
    });

    it("resets count when outside time threshold", () => {
      autofillInlineMenuContentService["lastTrackedTimestamp"].topLayer = Date.now() - 6000;
      autofillInlineMenuContentService["refreshCountWithinTimeThreshold"].topLayer = 5;

      autofillInlineMenuContentService["checkAndUpdateRefreshCount"]("topLayer");

      expect(autofillInlineMenuContentService["refreshCountWithinTimeThreshold"].topLayer).toBe(0);
    });

    it("disables inline menu and shows alert when count exceeds threshold", () => {
      const alertSpy = jest.spyOn(globalThis.window, "alert").mockImplementation();
      const checkPageRisksSpy = jest.spyOn(
        autofillInlineMenuContentService as any,
        "checkPageRisks",
      );
      autofillInlineMenuContentService["lastTrackedTimestamp"].topLayer = Date.now() - 1000;
      autofillInlineMenuContentService["refreshCountWithinTimeThreshold"].topLayer = 6;

      autofillInlineMenuContentService["checkAndUpdateRefreshCount"]("topLayer");

      expect(autofillInlineMenuContentService["inlineMenuEnabled"]).toBe(false);
      expect(alertSpy).toHaveBeenCalled();
      expect(checkPageRisksSpy).toHaveBeenCalled();
    });
  });

  describe("refreshPopoverAttribute", () => {
    it("calls checkAndUpdateRefreshCount with popoverAttribute type", () => {
      const checkSpy = jest.spyOn(
        autofillInlineMenuContentService as any,
        "checkAndUpdateRefreshCount",
      );
      const element = document.createElement("div");
      element.setAttribute("popover", "auto");
      element.showPopover = jest.fn();

      autofillInlineMenuContentService["refreshPopoverAttribute"](element);

      expect(checkSpy).toHaveBeenCalledWith("popoverAttribute");
      expect(element.getAttribute("popover")).toBe("manual");
      expect(element.showPopover).toHaveBeenCalled();
    });
  });

  describe("handleInlineMenuElementMutationObserverUpdate - popover attribute", () => {
    it("refreshes popover attribute when changed from manual", () => {
      const element = document.createElement("div");
      element.setAttribute("popover", "auto");
      element.showPopover = jest.fn();
      const refreshSpy = jest.spyOn(
        autofillInlineMenuContentService as any,
        "refreshPopoverAttribute",
      );
      autofillInlineMenuContentService["buttonElement"] = element;

      const mockMutation = createMutationRecordMock({
        target: element,
        type: "attributes",
        attributeName: "popover",
      });

      autofillInlineMenuContentService["handleInlineMenuElementMutationObserverUpdate"]([
        mockMutation,
      ]);

      expect(refreshSpy).toHaveBeenCalledWith(element);
    });

    it("does not refresh popover attribute when already manual", () => {
      const element = document.createElement("div");
      element.setAttribute("popover", "manual");
      const refreshSpy = jest.spyOn(
        autofillInlineMenuContentService as any,
        "refreshPopoverAttribute",
      );
      autofillInlineMenuContentService["buttonElement"] = element;

      const mockMutation = createMutationRecordMock({
        target: element,
        type: "attributes",
        attributeName: "popover",
      });

      autofillInlineMenuContentService["handleInlineMenuElementMutationObserverUpdate"]([
        mockMutation,
      ]);

      expect(refreshSpy).not.toHaveBeenCalled();
    });
  });

  describe("appendInlineMenuElements when disabled", () => {
    beforeEach(() => {
      observeContainerMutationsSpy.mockImplementation();
    });

    it("does not append button when inline menu is disabled", async () => {
      autofillInlineMenuContentService["inlineMenuEnabled"] = false;
      jest.spyOn(globalThis.document.body, "appendChild");

      sendMockExtensionMessage({
        command: "appendAutofillInlineMenuToDom",
        overlayElement: AutofillOverlayElement.Button,
      });
      await flushPromises();

      expect(globalThis.document.body.appendChild).not.toHaveBeenCalled();
    });

    it("does not append list when inline menu is disabled", async () => {
      autofillInlineMenuContentService["inlineMenuEnabled"] = false;
      jest.spyOn(globalThis.document.body, "appendChild");

      sendMockExtensionMessage({
        command: "appendAutofillInlineMenuToDom",
        overlayElement: AutofillOverlayElement.List,
      });
      await flushPromises();

      expect(globalThis.document.body.appendChild).not.toHaveBeenCalled();
    });
  });

  describe("custom element creation for non-Firefox browsers", () => {
    beforeEach(() => {
      autofillInlineMenuContentService["isFirefoxBrowser"] = false;
      observeContainerMutationsSpy.mockImplementation();
    });

    it("creates a custom element for button in non-Firefox browsers", () => {
      const definespy = jest.spyOn(globalThis.customElements, "define");

      sendMockExtensionMessage({
        command: "appendAutofillInlineMenuToDom",
        overlayElement: AutofillOverlayElement.Button,
      });

      expect(definespy).toHaveBeenCalled();
      expect(autofillInlineMenuContentService["buttonElement"]).toBeDefined();
      expect(autofillInlineMenuContentService["buttonElement"]?.tagName).not.toBe("DIV");
    });

    it("creates a custom element for list in non-Firefox browsers", () => {
      const defineSpy = jest.spyOn(globalThis.customElements, "define");

      sendMockExtensionMessage({
        command: "appendAutofillInlineMenuToDom",
        overlayElement: AutofillOverlayElement.List,
      });

      expect(defineSpy).toHaveBeenCalled();
      expect(autofillInlineMenuContentService["listElement"]).toBeDefined();
      expect(autofillInlineMenuContentService["listElement"]?.tagName).not.toBe("DIV");
    });
  });

  describe("getPageIsOpaque", () => {
    it("returns false when no page elements exist", () => {
      jest.spyOn(globalThis.document, "querySelectorAll").mockReturnValue([] as any);

      const result = autofillInlineMenuContentService["getPageIsOpaque"]();

      expect(result).toBe(false);
    });

    it("returns true when all html and body nodes have sufficient opacity", () => {
      jest
        .spyOn(globalThis.document, "querySelectorAll")
        .mockReturnValue([document.documentElement, document.body] as any);
      jest
        .spyOn(globalThis.window, "getComputedStyle")
        .mockImplementation(() => ({ opacity: "1" }) as CSSStyleDeclaration);

      const result = autofillInlineMenuContentService["getPageIsOpaque"]();

      expect(result).toBe(true);
    });

    it("returns false when html opacity is below threshold", () => {
      jest
        .spyOn(globalThis.document, "querySelectorAll")
        .mockReturnValue([document.documentElement, document.body] as any);
      let callCount = 0;
      jest.spyOn(globalThis.window, "getComputedStyle").mockImplementation(() => {
        callCount++;
        return { opacity: callCount === 1 ? "0.5" : "1" } as CSSStyleDeclaration;
      });

      const result = autofillInlineMenuContentService["getPageIsOpaque"]();

      expect(result).toBe(false);
    });

    it("returns false when body opacity is below threshold", () => {
      jest
        .spyOn(globalThis.document, "querySelectorAll")
        .mockReturnValue([document.documentElement, document.body] as any);
      let callCount = 0;
      jest.spyOn(globalThis.window, "getComputedStyle").mockImplementation(() => {
        callCount++;
        return { opacity: callCount === 1 ? "1" : "0.5" } as CSSStyleDeclaration;
      });

      const result = autofillInlineMenuContentService["getPageIsOpaque"]();

      expect(result).toBe(false);
    });

    it("returns false when opacity of at least one duplicate body is below threshold", () => {
      const duplicateBody = document.createElement("body");
      jest
        .spyOn(globalThis.document, "querySelectorAll")
        .mockReturnValue([document.documentElement, document.body, duplicateBody] as any);
      let callCount = 0;
      jest.spyOn(globalThis.window, "getComputedStyle").mockImplementation(() => {
        callCount++;

        let opacityValue = "0.5";
        switch (callCount) {
          case 1:
            opacityValue = "1";
            break;
          case 2:
            opacityValue = "0.7";
            break;
          default:
            break;
        }

        return { opacity: opacityValue } as CSSStyleDeclaration;
      });

      const result = autofillInlineMenuContentService["getPageIsOpaque"]();

      expect(result).toBe(false);
    });

    it("returns true when opacity is above threshold", () => {
      jest
        .spyOn(globalThis.document, "querySelectorAll")
        .mockReturnValue([document.documentElement, document.body] as any);
      jest
        .spyOn(globalThis.window, "getComputedStyle")
        .mockImplementation(() => ({ opacity: "0.7" }) as CSSStyleDeclaration);

      const result = autofillInlineMenuContentService["getPageIsOpaque"]();

      expect(result).toBe(true);
    });

    it("returns false when opacity is at threshold", () => {
      jest
        .spyOn(globalThis.document, "querySelectorAll")
        .mockReturnValue([document.documentElement, document.body] as any);
      jest
        .spyOn(globalThis.window, "getComputedStyle")
        .mockImplementation(() => ({ opacity: "0.6" }) as CSSStyleDeclaration);

      const result = autofillInlineMenuContentService["getPageIsOpaque"]();

      expect(result).toBe(false);
    });
  });
});
