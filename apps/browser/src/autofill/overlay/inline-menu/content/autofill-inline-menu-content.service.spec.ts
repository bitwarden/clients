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
  });

  afterEach(() => {
    jest.clearAllMocks();

    Object.defineProperty(document, "activeElement", {
      value: null,
      writable: true,
    });
  });

  describe("isElementInlineMenu", () => {
    it("returns true if the passed element is the inline menu", () => {
      const element = document.createElement("div");
      autofillInlineMenuContentService["listElement"] = element;

      expect(autofillInlineMenuContentService.isElementInlineMenu(element)).toBe(true);
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
    let buttonElement: HTMLElement;
    let listElement: HTMLElement;
    let spyContainerAncestryIsOpaque: jest.SpyInstance;
    let isInlineMenuListVisibleSpy: jest.SpyInstance;

    beforeEach(() => {
      document.body.innerHTML = `
      <div class="overlay-button"></div>
      <div class="overlay-list"></div>
      `;
      mockMutationRecord = mock<MutationRecord>({ target: globalThis.document.body } as any);
      buttonElement = document.querySelector(".overlay-button") as HTMLElement;
      listElement = document.querySelector(".overlay-list") as HTMLElement;
      autofillInlineMenuContentService["buttonElement"] = buttonElement;
      autofillInlineMenuContentService["listElement"] = listElement;
      spyContainerAncestryIsOpaque = jest
        .spyOn(autofillInlineMenuContentService as any, "containerAncestryIsOpaque")
        .mockResolvedValue(true);
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

    it("skips handling the mutation if the container or container parent is not fully opaque", async () => {
      spyContainerAncestryIsOpaque.mockResolvedValue(false);

      document.body.appendChild(buttonElement);

      autofillInlineMenuContentService["handleContainerElementMutationObserverUpdate"]([
        mockMutationRecord,
      ]);
      await waitForIdleCallback();

      expect(globalThis.document.body.insertBefore).not.toHaveBeenCalled();
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
  });
});
