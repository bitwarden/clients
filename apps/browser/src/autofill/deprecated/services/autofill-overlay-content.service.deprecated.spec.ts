import { mock } from "jest-mock-extended";

import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { EVENTS, AutofillOverlayVisibility } from "@bitwarden/common/autofill/constants";

import { AutofillOverlayElement, RedirectFocusDirection } from "../../enums/autofill-overlay.enum";
import AutofillField from "../../models/autofill-field";
import AutofillForm from "../../models/autofill-form";
import AutofillPageDetails from "../../models/autofill-page-details";
import { AutoFillConstants } from "../../services/autofill-constants";
import { createAutofillFieldMock } from "../../spec/autofill-mocks";
import { flushPromises } from "../../spec/testing-utils";
import { ElementWithOpId, FormFieldElement } from "../../types";

import AutofillOverlayContentServiceDeprecated from "./autofill-overlay-content.service.deprecated";

function createMutationRecordMock(customFields = {}): MutationRecord {
  return {
    addedNodes: mock<NodeList>(),
    attributeName: "default-attributeName",
    attributeNamespace: "default-attributeNamespace",
    nextSibling: null,
    oldValue: "default-oldValue",
    previousSibling: null,
    removedNodes: mock<NodeList>(),
    target: null,
    type: "attributes",
    ...customFields,
  };
}

const defaultWindowReadyState = document.readyState;
const defaultDocumentVisibilityState = document.visibilityState;
describe("AutofillOverlayContentService", () => {
  let autofillOverlayContentService: AutofillOverlayContentServiceDeprecated;
  let sendExtensionMessageSpy: jest.SpyInstance;

  beforeEach(() => {
    autofillOverlayContentService = new AutofillOverlayContentServiceDeprecated();
    sendExtensionMessageSpy = jest
      .spyOn(autofillOverlayContentService as any, "sendExtensionMessage")
      .mockResolvedValue(undefined);
    Object.defineProperty(document, "readyState", {
      value: defaultWindowReadyState,
      writable: true,
    });
    Object.defineProperty(document, "visibilityState", {
      value: defaultDocumentVisibilityState,
      writable: true,
    });
    Object.defineProperty(document, "activeElement", {
      value: null,
      writable: true,
    });
    Object.defineProperty(window, "innerHeight", {
      value: 1080,
      writable: true,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("init", () => {
    let setupGlobalEventListenersSpy: jest.SpyInstance;
    let setupMutationObserverSpy: jest.SpyInstance;

    beforeEach(() => {
      jest.spyOn(document, "addEventListener");
      jest.spyOn(window, "addEventListener");
      setupGlobalEventListenersSpy = jest.spyOn(
        autofillOverlayContentService as any,
        "setupGlobalEventListeners",
      );
      setupMutationObserverSpy = jest.spyOn(
        autofillOverlayContentService as any,
        "setupMutationObserver",
      );
    });

    it("sets up a DOMContentLoaded event listener that triggers setting up the mutation observers", () => {
      Object.defineProperty(document, "readyState", {
        value: "loading",
        writable: true,
      });

      autofillOverlayContentService.init();

      expect(document.addEventListener).toHaveBeenCalledWith(
        "DOMContentLoaded",
        setupGlobalEventListenersSpy,
      );
      expect(setupGlobalEventListenersSpy).not.toHaveBeenCalled();
    });

    it("sets up a visibility change listener for the DOM", () => {
      const handleVisibilityChangeEventSpy = jest.spyOn(
        autofillOverlayContentService as any,
        "handleVisibilityChangeEvent",
      );

      autofillOverlayContentService.init();

      expect(document.addEventListener).toHaveBeenCalledWith(
        "visibilitychange",
        handleVisibilityChangeEventSpy,
      );
    });

    it("sets up a focus out listener for the window", () => {
      const handleFormFieldBlurEventSpy = jest.spyOn(
        autofillOverlayContentService as any,
        "handleFormFieldBlurEvent",
      );

      autofillOverlayContentService.init();

      expect(window.addEventListener).toHaveBeenCalledWith("focusout", handleFormFieldBlurEventSpy);
    });

    it("sets up mutation observers for the body element", () => {
      jest
        .spyOn(globalThis, "MutationObserver")
        .mockImplementation(() => mock<MutationObserver>({ observe: jest.fn() }));
      const handleOverlayElementMutationObserverUpdateSpy = jest.spyOn(
        autofillOverlayContentService as any,
        "handleOverlayElementMutationObserverUpdate",
      );
      const handleBodyElementMutationObserverUpdateSpy = jest.spyOn(
        autofillOverlayContentService as any,
        "handleBodyElementMutationObserverUpdate",
      );
      autofillOverlayContentService.init();

      expect(setupMutationObserverSpy).toHaveBeenCalledTimes(1);
      expect(globalThis.MutationObserver).toHaveBeenNthCalledWith(
        1,
        handleOverlayElementMutationObserverUpdateSpy,
      );
      expect(globalThis.MutationObserver).toHaveBeenNthCalledWith(
        2,
        handleBodyElementMutationObserverUpdateSpy,
      );
    });
  });

  describe("setupAutofillOverlayListenerOnField", () => {
    let autofillFieldElement: ElementWithOpId<FormFieldElement>;
    let autofillFieldData: AutofillField;
    let pageDetailsMock: AutofillPageDetails;

    beforeEach(() => {
      document.body.innerHTML = `
      <form id="validFormId">
        <input type="text" id="username-field" placeholder="username" />
        <input type="password" id="password-field" placeholder="password" />
      </form>
      `;

      autofillFieldElement = document.getElementById(
        "username-field",
      ) as ElementWithOpId<FormFieldElement>;
      autofillFieldElement.opid = "op-1";
      jest.spyOn(autofillFieldElement, "addEventListener");
      autofillFieldData = createAutofillFieldMock({
        opid: "username-field",
        form: "validFormId",
        placeholder: "username",
        elementNumber: 1,
      });
      const passwordFieldData = createAutofillFieldMock({
        opid: "password-field",
        form: "validFormId",
        elementNumber: 2,
        autocompleteType: "current-password",
        type: "password",
      });
      pageDetailsMock = mock<AutofillPageDetails>({
        forms: { validFormId: mock<AutofillForm>() },
        fields: [autofillFieldData, passwordFieldData],
      });
    });

    describe("skips setup for ignored form fields", () => {
      beforeEach(() => {
        autofillFieldData = mock<AutofillField>({
          type: "text",
          htmlName: "username",
          htmlID: "username",
          placeholder: "username",
        });
      });

      it("ignores fields that are readonly", async () => {
        autofillFieldData.readonly = true;

        await autofillOverlayContentService.setupAutofillOverlayListenerOnField(
          autofillFieldElement,
          autofillFieldData,
          pageDetailsMock,
        );

        expect(autofillFieldElement.addEventListener).not.toHaveBeenCalled();
      });

      it("ignores fields that contain a disabled attribute", async () => {
        autofillFieldData.disabled = true;

        await autofillOverlayContentService.setupAutofillOverlayListenerOnField(
          autofillFieldElement,
          autofillFieldData,
          pageDetailsMock,
        );

        expect(autofillFieldElement.addEventListener).not.toHaveBeenCalled();
      });

      it("ignores fields that are not viewable", async () => {
        autofillFieldData.viewable = false;

        await autofillOverlayContentService.setupAutofillOverlayListenerOnField(
          autofillFieldElement,
          autofillFieldData,
          pageDetailsMock,
        );

        expect(autofillFieldElement.addEventListener).not.toHaveBeenCalled();
      });

      it("ignores fields that are part of the ExcludedOverlayTypes", () => {
        AutoFillConstants.ExcludedInlineMenuTypes.forEach(async (excludedType) => {
          autofillFieldData.type = excludedType;

          await autofillOverlayContentService.setupAutofillOverlayListenerOnField(
            autofillFieldElement,
            autofillFieldData,
            pageDetailsMock,
          );

          expect(autofillFieldElement.addEventListener).not.toHaveBeenCalled();
        });
      });

      it("ignores fields that contain the keyword `search`", async () => {
        autofillFieldData.placeholder = "search";

        await autofillOverlayContentService.setupAutofillOverlayListenerOnField(
          autofillFieldElement,
          autofillFieldData,
          pageDetailsMock,
        );

        expect(autofillFieldElement.addEventListener).not.toHaveBeenCalled();
      });

      it("ignores fields that contain the keyword `captcha` ", async () => {
        autofillFieldData.placeholder = "captcha";

        await autofillOverlayContentService.setupAutofillOverlayListenerOnField(
          autofillFieldElement,
          autofillFieldData,
          pageDetailsMock,
        );

        expect(autofillFieldElement.addEventListener).not.toHaveBeenCalled();
      });

      it("ignores fields that do not appear as a login field", async () => {
        autofillFieldData.placeholder = "not-a-login-field";

        await autofillOverlayContentService.setupAutofillOverlayListenerOnField(
          autofillFieldElement,
          autofillFieldData,
          pageDetailsMock,
        );

        expect(autofillFieldElement.addEventListener).not.toHaveBeenCalled();
      });
    });

    it("skips setup on fields that have been previously set up", async () => {
      autofillOverlayContentService["formFieldElements"].add(autofillFieldElement);

      await autofillOverlayContentService.setupAutofillOverlayListenerOnField(
        autofillFieldElement,
        autofillFieldData,
        pageDetailsMock,
      );

      expect(autofillFieldElement.addEventListener).not.toHaveBeenCalled();
    });

    describe("identifies the overlay visibility setting", () => {
      it("defaults the overlay visibility setting to `OnFieldFocus` if a value is not set", async () => {
        sendExtensionMessageSpy.mockResolvedValueOnce(undefined);
        autofillOverlayContentService["autofillOverlayVisibility"] = undefined;

        await autofillOverlayContentService.setupAutofillOverlayListenerOnField(
          autofillFieldElement,
          autofillFieldData,
          pageDetailsMock,
        );

        expect(sendExtensionMessageSpy).toHaveBeenCalledWith("getAutofillOverlayVisibility");
        expect(autofillOverlayContentService["autofillOverlayVisibility"]).toEqual(
          AutofillOverlayVisibility.OnFieldFocus,
        );
      });

      it("sets the overlay visibility setting to the value returned from the background script", async () => {
        sendExtensionMessageSpy.mockResolvedValueOnce(AutofillOverlayVisibility.OnFieldFocus);
        autofillOverlayContentService["autofillOverlayVisibility"] = undefined;

        await autofillOverlayContentService.setupAutofillOverlayListenerOnField(
          autofillFieldElement,
          autofillFieldData,
          pageDetailsMock,
        );

        expect(autofillOverlayContentService["autofillOverlayVisibility"]).toEqual(
          AutofillOverlayVisibility.OnFieldFocus,
        );
      });
    });

    describe("sets up form field element listeners", () => {
      it("removes all cached event listeners from the form field element", async () => {
        jest.spyOn(autofillFieldElement, "removeEventListener");
        const inputHandler = jest.fn();
        const clickHandler = jest.fn();
        const focusHandler = jest.fn();
        autofillOverlayContentService["eventHandlersMemo"] = {
          "op-1-username-field-input-handler": inputHandler,
          "op-1-username-field-click-handler": clickHandler,
          "op-1-username-field-focus-handler": focusHandler,
        };

        await autofillOverlayContentService.setupAutofillOverlayListenerOnField(
          autofillFieldElement,
          autofillFieldData,
          pageDetailsMock,
        );

        expect(autofillFieldElement.removeEventListener).toHaveBeenNthCalledWith(
          1,
          "input",
          inputHandler,
        );
        expect(autofillFieldElement.removeEventListener).toHaveBeenNthCalledWith(
          2,
          "click",
          clickHandler,
        );
        expect(autofillFieldElement.removeEventListener).toHaveBeenNthCalledWith(
          3,
          "focus",
          focusHandler,
        );
      });

      describe("form field blur event listener", () => {
        beforeEach(async () => {
          await autofillOverlayContentService.setupAutofillOverlayListenerOnField(
            autofillFieldElement,
            autofillFieldData,
            pageDetailsMock,
          );
        });

        it("updates the isFieldCurrentlyFocused value to false", async () => {
          autofillOverlayContentService["isFieldCurrentlyFocused"] = true;

          autofillFieldElement.dispatchEvent(new Event("blur"));

          expect(autofillOverlayContentService["isFieldCurrentlyFocused"]).toEqual(false);
        });

        it("sends a message to the background to check if the overlay is focused", () => {
          autofillFieldElement.dispatchEvent(new Event("blur"));

          expect(sendExtensionMessageSpy).toHaveBeenCalledWith("checkAutofillOverlayFocused");
        });
      });

      describe("form field keyup event listener", () => {
        beforeEach(async () => {
          await autofillOverlayContentService.setupAutofillOverlayListenerOnField(
            autofillFieldElement,
            autofillFieldData,
            pageDetailsMock,
          );
          jest.spyOn(globalThis.customElements, "define").mockImplementation();
        });

        it("removes the autofill overlay when the `Escape` key is pressed", () => {
          jest.spyOn(autofillOverlayContentService as any, "removeAutofillOverlay");

          autofillFieldElement.dispatchEvent(new KeyboardEvent("keyup", { code: "Escape" }));

          expect(autofillOverlayContentService.removeAutofillOverlay).toHaveBeenCalled();
        });

        it("repositions the overlay if autofill is not currently filling when the `Enter` key is pressed", () => {
          const handleOverlayRepositionEventSpy = jest.spyOn(
            autofillOverlayContentService as any,
            "handleOverlayRepositionEvent",
          );
          autofillOverlayContentService["isCurrentlyFilling"] = false;

          autofillFieldElement.dispatchEvent(new KeyboardEvent("keyup", { code: "Enter" }));

          expect(handleOverlayRepositionEventSpy).toHaveBeenCalled();
        });

        it("skips repositioning the overlay if autofill is currently filling when the `Enter` key is pressed", () => {
          const handleOverlayRepositionEventSpy = jest.spyOn(
            autofillOverlayContentService as any,
            "handleOverlayRepositionEvent",
          );
          autofillOverlayContentService["isCurrentlyFilling"] = true;

          autofillFieldElement.dispatchEvent(new KeyboardEvent("keyup", { code: "Enter" }));

          expect(handleOverlayRepositionEventSpy).not.toHaveBeenCalled();
        });

        it("opens the overlay list and focuses it after a delay if it is not visible when the `ArrowDown` key is pressed", async () => {
          jest.useFakeTimers();
          const updateMostRecentlyFocusedFieldSpy = jest.spyOn(
            autofillOverlayContentService as any,
            "updateMostRecentlyFocusedField",
          );
          const openAutofillOverlaySpy = jest.spyOn(
            autofillOverlayContentService as any,
            "openAutofillOverlay",
          );
          autofillOverlayContentService["isOverlayListVisible"] = false;

          autofillFieldElement.dispatchEvent(new KeyboardEvent("keyup", { code: "ArrowDown" }));
          await flushPromises();

          expect(updateMostRecentlyFocusedFieldSpy).toHaveBeenCalledWith(autofillFieldElement);
          expect(openAutofillOverlaySpy).toHaveBeenCalledWith({ isOpeningFullOverlay: true });
          expect(sendExtensionMessageSpy).not.toHaveBeenCalledWith("focusAutofillOverlayList");

          jest.advanceTimersByTime(150);

          expect(sendExtensionMessageSpy).toHaveBeenCalledWith("focusAutofillOverlayList");
        });

        it("focuses the overlay list when the `ArrowDown` key is pressed", () => {
          autofillOverlayContentService["isOverlayListVisible"] = true;

          autofillFieldElement.dispatchEvent(new KeyboardEvent("keyup", { code: "ArrowDown" }));

          expect(sendExtensionMessageSpy).toHaveBeenCalledWith("focusAutofillOverlayList");
        });
      });

      describe("form field input change event listener", () => {
        beforeEach(() => {
          jest.spyOn(globalThis.customElements, "define").mockImplementation();
        });

        it("ignores span elements that trigger the listener", async () => {
          const spanAutofillFieldElement = document.createElement(
            "span",
          ) as ElementWithOpId<HTMLSpanElement>;
          jest.spyOn(autofillOverlayContentService as any, "storeModifiedFormElement");

          await autofillOverlayContentService.setupAutofillOverlayListenerOnField(
            spanAutofillFieldElement,
            autofillFieldData,
            pageDetailsMock,
          );

          spanAutofillFieldElement.dispatchEvent(new Event("input"));

          expect(autofillOverlayContentService["storeModifiedFormElement"]).not.toHaveBeenCalled();
        });

        it("stores the field as a user filled field if the form field data indicates that it is for a username", async () => {
          await autofillOverlayContentService.setupAutofillOverlayListenerOnField(
            autofillFieldElement,
            autofillFieldData,
            pageDetailsMock,
          );
          autofillFieldElement.dispatchEvent(new Event("input"));

          expect(autofillOverlayContentService["userFilledFields"].username).toEqual(
            autofillFieldElement,
          );
        });

        it("stores the field as a user filled field if the form field is of type password", async () => {
          const passwordFieldElement = document.getElementById(
            "password-field",
          ) as ElementWithOpId<FormFieldElement>;

          await autofillOverlayContentService.setupAutofillOverlayListenerOnField(
            passwordFieldElement,
            autofillFieldData,
            pageDetailsMock,
          );
          passwordFieldElement.dispatchEvent(new Event("input"));

          expect(autofillOverlayContentService["userFilledFields"].password).toEqual(
            passwordFieldElement,
          );
        });

        it("removes the overlay if the form field element has a value and the user is not authed", async () => {
          jest.spyOn(autofillOverlayContentService as any, "isUserAuthed").mockReturnValue(false);
          const removeAutofillOverlayListSpy = jest.spyOn(
            autofillOverlayContentService as any,
            "removeAutofillOverlayList",
          );
          (autofillFieldElement as HTMLInputElement).value = "test";

          await autofillOverlayContentService.setupAutofillOverlayListenerOnField(
            autofillFieldElement,
            autofillFieldData,
            pageDetailsMock,
          );
          autofillFieldElement.dispatchEvent(new Event("input"));

          expect(removeAutofillOverlayListSpy).toHaveBeenCalled();
        });

        it("removes the overlay if the form field element has a value and the overlay ciphers are populated", async () => {
          jest.spyOn(autofillOverlayContentService as any, "isUserAuthed").mockReturnValue(true);
          autofillOverlayContentService["isOverlayCiphersPopulated"] = true;
          const removeAutofillOverlayListSpy = jest.spyOn(
            autofillOverlayContentService as any,
            "removeAutofillOverlayList",
          );
          (autofillFieldElement as HTMLInputElement).value = "test";

          await autofillOverlayContentService.setupAutofillOverlayListenerOnField(
            autofillFieldElement,
            autofillFieldData,
            pageDetailsMock,
          );
          autofillFieldElement.dispatchEvent(new Event("input"));

          expect(removeAutofillOverlayListSpy).toHaveBeenCalled();
        });

        it("opens the autofill overlay if the form field is empty", async () => {
          jest.spyOn(autofillOverlayContentService as any, "openAutofillOverlay");
          (autofillFieldElement as HTMLInputElement).value = "";

          await autofillOverlayContentService.setupAutofillOverlayListenerOnField(
            autofillFieldElement,
            autofillFieldData,
            pageDetailsMock,
          );
          autofillFieldElement.dispatchEvent(new Event("input"));

          expect(autofillOverlayContentService["openAutofillOverlay"]).toHaveBeenCalled();
        });

        it("opens the autofill overlay if the form field is empty and the user is authed", async () => {
          jest.spyOn(autofillOverlayContentService as any, "isUserAuthed").mockReturnValue(true);
          jest.spyOn(autofillOverlayContentService as any, "openAutofillOverlay");
          (autofillFieldElement as HTMLInputElement).value = "";

          await autofillOverlayContentService.setupAutofillOverlayListenerOnField(
            autofillFieldElement,
            autofillFieldData,
            pageDetailsMock,
          );
          autofillFieldElement.dispatchEvent(new Event("input"));

          expect(autofillOverlayContentService["openAutofillOverlay"]).toHaveBeenCalled();
        });

        it("opens the autofill overlay if the form field is empty and the overlay ciphers are not populated", async () => {
          jest.spyOn(autofillOverlayContentService as any, "isUserAuthed").mockReturnValue(false);
          autofillOverlayContentService["isOverlayCiphersPopulated"] = false;
          jest.spyOn(autofillOverlayContentService as any, "openAutofillOverlay");
          (autofillFieldElement as HTMLInputElement).value = "";

          await autofillOverlayContentService.setupAutofillOverlayListenerOnField(
            autofillFieldElement,
            autofillFieldData,
            pageDetailsMock,
          );
          autofillFieldElement.dispatchEvent(new Event("input"));

          expect(autofillOverlayContentService["openAutofillOverlay"]).toHaveBeenCalled();
        });
      });

      describe("form field click event listener", () => {
        beforeEach(async () => {
          jest
            .spyOn(autofillOverlayContentService as any, "triggerFormFieldFocusedAction")
            .mockImplementation();
          autofillOverlayContentService["isOverlayListVisible"] = false;
          autofillOverlayContentService["isOverlayListVisible"] = false;
          await autofillOverlayContentService.setupAutofillOverlayListenerOnField(
            autofillFieldElement,
            autofillFieldData,
            pageDetailsMock,
          );
        });

        it("triggers the field focused handler if the overlay is not visible", async () => {
          autofillFieldElement.dispatchEvent(new Event("click"));

          expect(autofillOverlayContentService["triggerFormFieldFocusedAction"]).toHaveBeenCalled();
        });

        it("skips triggering the field focused handler if the overlay list is visible", () => {
          autofillOverlayContentService["isOverlayListVisible"] = true;

          autofillFieldElement.dispatchEvent(new Event("click"));

          expect(
            autofillOverlayContentService["triggerFormFieldFocusedAction"],
          ).not.toHaveBeenCalled();
        });

        it("skips triggering the field focused handler if the overlay button is visible", () => {
          autofillOverlayContentService["isOverlayButtonVisible"] = true;

          autofillFieldElement.dispatchEvent(new Event("click"));

          expect(
            autofillOverlayContentService["triggerFormFieldFocusedAction"],
          ).not.toHaveBeenCalled();
        });
      });

      describe("form field focus event listener", () => {
        let updateMostRecentlyFocusedFieldSpy: jest.SpyInstance;

        beforeEach(() => {
          jest.spyOn(globalThis.customElements, "define").mockImplementation();
          updateMostRecentlyFocusedFieldSpy = jest.spyOn(
            autofillOverlayContentService as any,
            "updateMostRecentlyFocusedField",
          );
          autofillOverlayContentService["isCurrentlyFilling"] = false;
        });

        it("skips triggering the handler logic if autofill is currently filling", async () => {
          autofillOverlayContentService["isCurrentlyFilling"] = true;
          autofillOverlayContentService["mostRecentlyFocusedField"] = autofillFieldElement;
          autofillOverlayContentService["autofillOverlayVisibility"] =
            AutofillOverlayVisibility.OnFieldFocus;
          await autofillOverlayContentService.setupAutofillOverlayListenerOnField(
            autofillFieldElement,
            autofillFieldData,
            pageDetailsMock,
          );

          autofillFieldElement.dispatchEvent(new Event("focus"));

          expect(updateMostRecentlyFocusedFieldSpy).not.toHaveBeenCalled();
        });

        it("updates the most recently focused field", async () => {
          await autofillOverlayContentService.setupAutofillOverlayListenerOnField(
            autofillFieldElement,
            autofillFieldData,
            pageDetailsMock,
          );

          autofillFieldElement.dispatchEvent(new Event("focus"));

          expect(updateMostRecentlyFocusedFieldSpy).toHaveBeenCalledWith(autofillFieldElement);
          expect(autofillOverlayContentService["mostRecentlyFocusedField"]).toEqual(
            autofillFieldElement,
          );
        });

        it("removes the overlay list if the autofill visibility is set to onClick", async () => {
          autofillOverlayContentService["overlayListElement"] = document.createElement("div");
          autofillOverlayContentService["autofillOverlayVisibility"] =
            AutofillOverlayVisibility.OnButtonClick;
          await autofillOverlayContentService.setupAutofillOverlayListenerOnField(
            autofillFieldElement,
            autofillFieldData,
            pageDetailsMock,
          );

          autofillFieldElement.dispatchEvent(new Event("focus"));
          await flushPromises();

          expect(sendExtensionMessageSpy).toHaveBeenCalledWith("autofillOverlayElementClosed", {
            overlayElement: AutofillOverlayElement.List,
          });
        });

        it("removes the overlay list if the form element has a value and the focused field is newly focused", async () => {
          autofillOverlayContentService["overlayListElement"] = document.createElement("div");
          autofillOverlayContentService["mostRecentlyFocusedField"] = document.createElement(
            "input",
          ) as ElementWithOpId<HTMLInputElement>;
          (autofillFieldElement as HTMLInputElement).value = "test";
          await autofillOverlayContentService.setupAutofillOverlayListenerOnField(
            autofillFieldElement,
            autofillFieldData,
            pageDetailsMock,
          );

          autofillFieldElement.dispatchEvent(new Event("focus"));
          await flushPromises();

          expect(sendExtensionMessageSpy).toHaveBeenCalledWith("autofillOverlayElementClosed", {
            overlayElement: AutofillOverlayElement.List,
          });
        });

        it("opens the autofill overlay if the form element has no value", async () => {
          autofillOverlayContentService["overlayListElement"] = document.createElement("div");
          (autofillFieldElement as HTMLInputElement).value = "";
          autofillOverlayContentService["autofillOverlayVisibility"] =
            AutofillOverlayVisibility.OnFieldFocus;
          await autofillOverlayContentService.setupAutofillOverlayListenerOnField(
            autofillFieldElement,
            autofillFieldData,
            pageDetailsMock,
          );

          autofillFieldElement.dispatchEvent(new Event("focus"));
          await flushPromises();

          expect(sendExtensionMessageSpy).toHaveBeenCalledWith("openAutofillOverlay");
        });

        it("opens the autofill overlay if the overlay ciphers are not populated and the user is authed", async () => {
          autofillOverlayContentService["overlayListElement"] = document.createElement("div");
          (autofillFieldElement as HTMLInputElement).value = "";
          autofillOverlayContentService["autofillOverlayVisibility"] =
            AutofillOverlayVisibility.OnFieldFocus;
          jest.spyOn(autofillOverlayContentService as any, "isUserAuthed").mockReturnValue(true);
          await autofillOverlayContentService.setupAutofillOverlayListenerOnField(
            autofillFieldElement,
            autofillFieldData,
            pageDetailsMock,
          );

          autofillFieldElement.dispatchEvent(new Event("focus"));
          await flushPromises();

          expect(sendExtensionMessageSpy).toHaveBeenCalledWith("openAutofillOverlay");
        });

        it("updates the overlay button position if the focus event is not opening the overlay", async () => {
          autofillOverlayContentService["autofillOverlayVisibility"] =
            AutofillOverlayVisibility.OnFieldFocus;
          (autofillFieldElement as HTMLInputElement).value = "test";
          autofillOverlayContentService["isOverlayCiphersPopulated"] = true;
          await autofillOverlayContentService.setupAutofillOverlayListenerOnField(
            autofillFieldElement,
            autofillFieldData,
            pageDetailsMock,
          );

          autofillFieldElement.dispatchEvent(new Event("focus"));
          await flushPromises();

          expect(sendExtensionMessageSpy).toHaveBeenCalledWith("updateAutofillOverlayPosition", {
            overlayElement: AutofillOverlayElement.Button,
          });
        });
      });
    });

    it("triggers the form field focused handler if the current active element in the document is the passed form field", async () => {
      const documentRoot = autofillFieldElement.getRootNode() as Document;
      Object.defineProperty(documentRoot, "activeElement", {
        value: autofillFieldElement,
        writable: true,
      });

      await autofillOverlayContentService.setupAutofillOverlayListenerOnField(
        autofillFieldElement,
        autofillFieldData,
        pageDetailsMock,
      );

      expect(sendExtensionMessageSpy).toHaveBeenCalledWith("openAutofillOverlay");
      expect(autofillOverlayContentService["mostRecentlyFocusedField"]).toEqual(
        autofillFieldElement,
      );
    });

    it("sets the most recently focused field to the passed form field element if the value is not set", async () => {
      autofillOverlayContentService["mostRecentlyFocusedField"] = undefined;

      await autofillOverlayContentService.setupAutofillOverlayListenerOnField(
        autofillFieldElement,
        autofillFieldData,
        pageDetailsMock,
      );

      expect(autofillOverlayContentService["mostRecentlyFocusedField"]).toEqual(
        autofillFieldElement,
      );
    });
  });

  describe("openAutofillOverlay", () => {
    let autofillFieldElement: ElementWithOpId<FormFieldElement>;

    beforeEach(() => {
      document.body.innerHTML = `
      <form id="validFormId">
        <input type="text" id="username-field" placeholder="username" />
        <input type="password" id="password-field" placeholder="password" />
      </form>
      `;

      autofillFieldElement = document.getElementById(
        "username-field",
      ) as ElementWithOpId<FormFieldElement>;
      autofillFieldElement.opid = "op-1";
      autofillOverlayContentService["mostRecentlyFocusedField"] = autofillFieldElement;
    });

    it("skips opening the overlay if a field has not been recently focused", () => {
      autofillOverlayContentService["mostRecentlyFocusedField"] = undefined;

      autofillOverlayContentService["openAutofillOverlay"]();

      expect(sendExtensionMessageSpy).not.toHaveBeenCalled();
    });

    it("focuses the most recent overlay field if the field is not focused", () => {
      jest.spyOn(autofillFieldElement, "getRootNode").mockReturnValue(document);
      Object.defineProperty(document, "activeElement", {
        value: document.createElement("div"),
        writable: true,
      });
      const focusMostRecentOverlayFieldSpy = jest.spyOn(
        autofillOverlayContentService as any,
        "focusMostRecentOverlayField",
      );

      autofillOverlayContentService["openAutofillOverlay"]({ isFocusingFieldElement: true });

      expect(focusMostRecentOverlayFieldSpy).toHaveBeenCalled();
    });

    it("skips focusing the most recent overlay field if the field is already focused", () => {
      jest.spyOn(autofillFieldElement, "getRootNode").mockReturnValue(document);
      Object.defineProperty(document, "activeElement", {
        value: autofillFieldElement,
        writable: true,
      });
      const focusMostRecentOverlayFieldSpy = jest.spyOn(
        autofillOverlayContentService as any,
        "focusMostRecentOverlayField",
      );

      autofillOverlayContentService["openAutofillOverlay"]({ isFocusingFieldElement: true });

      expect(focusMostRecentOverlayFieldSpy).not.toHaveBeenCalled();
    });

    it("stores the user's auth status", () => {
      autofillOverlayContentService["authStatus"] = undefined;

      autofillOverlayContentService["openAutofillOverlay"]({
        authStatus: AuthenticationStatus.Unlocked,
      });

      expect(autofillOverlayContentService["authStatus"]).toEqual(AuthenticationStatus.Unlocked);
    });

    it("opens both autofill overlay elements", () => {
      autofillOverlayContentService["mostRecentlyFocusedField"] = autofillFieldElement;

      autofillOverlayContentService["openAutofillOverlay"]();

      expect(sendExtensionMessageSpy).toHaveBeenCalledWith("updateAutofillOverlayPosition", {
        overlayElement: AutofillOverlayElement.Button,
      });
      expect(sendExtensionMessageSpy).toHaveBeenCalledWith("updateAutofillOverlayPosition", {
        overlayElement: AutofillOverlayElement.List,
      });
    });

    it("opens the autofill overlay button only if overlay visibility is set for onButtonClick", () => {
      autofillOverlayContentService["autofillOverlayVisibility"] =
        AutofillOverlayVisibility.OnButtonClick;

      autofillOverlayContentService["openAutofillOverlay"]({ isOpeningFullOverlay: false });

      expect(sendExtensionMessageSpy).toHaveBeenCalledWith("updateAutofillOverlayPosition", {
        overlayElement: AutofillOverlayElement.Button,
      });
      expect(sendExtensionMessageSpy).not.toHaveBeenCalledWith("updateAutofillOverlayPosition", {
        overlayElement: AutofillOverlayElement.List,
      });
    });

    it("overrides the onButtonClick visibility setting to open both overlay elements", () => {
      autofillOverlayContentService["autofillOverlayVisibility"] =
        AutofillOverlayVisibility.OnButtonClick;

      autofillOverlayContentService["openAutofillOverlay"]({ isOpeningFullOverlay: true });

      expect(sendExtensionMessageSpy).toHaveBeenCalledWith("updateAutofillOverlayPosition", {
        overlayElement: AutofillOverlayElement.Button,
      });
      expect(sendExtensionMessageSpy).toHaveBeenCalledWith("updateAutofillOverlayPosition", {
        overlayElement: AutofillOverlayElement.List,
      });
    });

    it("sends an extension message requesting an re-collection of page details if they need to update", () => {
      jest.spyOn(autofillOverlayContentService as any, "sendExtensionMessage");
      autofillOverlayContentService.pageDetailsUpdateRequired = true;

      autofillOverlayContentService["openAutofillOverlay"]();

      expect(sendExtensionMessageSpy).toHaveBeenCalledWith("bgCollectPageDetails", {
        sender: "autofillOverlayContentService",
      });
    });

    it("builds the overlay elements as custom web components if the user's browser is not Firefox", () => {
      let namesIndex = 0;
      const customNames = ["op-autofill-overlay-button", "op-autofill-overlay-list"];

      jest
        .spyOn(autofillOverlayContentService as any, "generateRandomCustomElementName")
        .mockImplementation(() => {
          if (namesIndex > 1) {
            return "";
          }
          const customName = customNames[namesIndex];
          namesIndex++;

          return customName;
        });
      autofillOverlayContentService["isFirefoxBrowser"] = false;

      autofillOverlayContentService.openAutofillOverlay();

      expect(autofillOverlayContentService["overlayButtonElement"]).toBeInstanceOf(HTMLElement);
      expect(autofillOverlayContentService["overlayButtonElement"].tagName).toEqual(
        customNames[0].toUpperCase(),
      );
      expect(autofillOverlayContentService["overlayListElement"]).toBeInstanceOf(HTMLElement);
      expect(autofillOverlayContentService["overlayListElement"].tagName).toEqual(
        customNames[1].toUpperCase(),
      );
    });

    it("builds the overlay elements as `div` elements if the user's browser is Firefox", () => {
      autofillOverlayContentService["isFirefoxBrowser"] = true;

      autofillOverlayContentService.openAutofillOverlay();

      expect(autofillOverlayContentService["overlayButtonElement"]).toBeInstanceOf(HTMLDivElement);
      expect(autofillOverlayContentService["overlayListElement"]).toBeInstanceOf(HTMLDivElement);
    });
  });

  describe("focusMostRecentOverlayField", () => {
    it("focuses the most recently focused overlay field", () => {
      const mostRecentlyFocusedField = document.createElement(
        "input",
      ) as ElementWithOpId<HTMLInputElement>;
      autofillOverlayContentService["mostRecentlyFocusedField"] = mostRecentlyFocusedField;
      jest.spyOn(mostRecentlyFocusedField, "focus");

      autofillOverlayContentService["focusMostRecentOverlayField"]();

      expect(mostRecentlyFocusedField.focus).toHaveBeenCalled();
    });
  });

  describe("blurMostRecentOverlayField", () => {
    it("removes focus from the most recently focused overlay field", () => {
      const mostRecentlyFocusedField = document.createElement(
        "input",
      ) as ElementWithOpId<HTMLInputElement>;
      autofillOverlayContentService["mostRecentlyFocusedField"] = mostRecentlyFocusedField;
      jest.spyOn(mostRecentlyFocusedField, "blur");

      autofillOverlayContentService["blurMostRecentOverlayField"]();

      expect(mostRecentlyFocusedField.blur).toHaveBeenCalled();
    });
  });

  describe("removeAutofillOverlay", () => {
    it("disconnects the body's mutation observer", () => {
      const bodyMutationObserver = mock<MutationObserver>();
      autofillOverlayContentService["bodyElementMutationObserver"] = bodyMutationObserver;

      autofillOverlayContentService.removeAutofillOverlay();

      expect(bodyMutationObserver.disconnect).toHaveBeenCalled();
    });
  });

  describe("removeAutofillOverlayButton", () => {
    beforeEach(() => {
      document.body.innerHTML = `<div class="overlay-button"></div>`;
      autofillOverlayContentService["overlayButtonElement"] = document.querySelector(
        ".overlay-button",
      ) as HTMLElement;
    });

    it("removes the overlay button from the DOM", () => {
      const overlayButtonElement = document.querySelector(".overlay-button") as HTMLElement;
      autofillOverlayContentService["isOverlayButtonVisible"] = true;

      autofillOverlayContentService.removeAutofillOverlay();

      expect(autofillOverlayContentService["isOverlayButtonVisible"]).toEqual(false);
      expect(document.body.contains(overlayButtonElement)).toEqual(false);
    });

    it("sends a message to the background indicating that the overlay button has been closed", () => {
      autofillOverlayContentService.removeAutofillOverlay();

      expect(sendExtensionMessageSpy).toHaveBeenCalledWith("autofillOverlayElementClosed", {
        overlayElement: AutofillOverlayElement.Button,
      });
    });

    it("removes the overlay reposition event listeners", () => {
      jest.spyOn(globalThis.document.body, "removeEventListener");
      jest.spyOn(globalThis, "removeEventListener");
      const handleOverlayRepositionEventSpy = jest.spyOn(
        autofillOverlayContentService as any,
        "handleOverlayRepositionEvent",
      );

      autofillOverlayContentService.removeAutofillOverlay();

      expect(globalThis.removeEventListener).toHaveBeenCalledWith(
        EVENTS.SCROLL,
        handleOverlayRepositionEventSpy,
        {
          capture: true,
        },
      );
      expect(globalThis.removeEventListener).toHaveBeenCalledWith(
        EVENTS.RESIZE,
        handleOverlayRepositionEventSpy,
      );
    });
  });

  describe("removeAutofillOverlayList", () => {
    beforeEach(() => {
      document.body.innerHTML = `<div class="overlay-list"></div>`;
      autofillOverlayContentService["overlayListElement"] = document.querySelector(
        ".overlay-list",
      ) as HTMLElement;
    });

    it("removes the overlay list element from the dom", () => {
      const overlayListElement = document.querySelector(".overlay-list") as HTMLElement;
      autofillOverlayContentService["isOverlayListVisible"] = true;

      autofillOverlayContentService.removeAutofillOverlay();

      expect(autofillOverlayContentService["isOverlayListVisible"]).toEqual(false);
      expect(document.body.contains(overlayListElement)).toEqual(false);
    });

    it("sends a message to the extension background indicating that the overlay list has closed", () => {
      autofillOverlayContentService.removeAutofillOverlay();

      expect(sendExtensionMessageSpy).toHaveBeenCalledWith("autofillOverlayElementClosed", {
        overlayElement: AutofillOverlayElement.List,
      });
    });
  });

  describe("addNewVaultItem", () => {
    it("skips sending the message if the overlay list is not visible", () => {
      autofillOverlayContentService["isOverlayListVisible"] = false;

      autofillOverlayContentService.addNewVaultItem();

      expect(sendExtensionMessageSpy).not.toHaveBeenCalled();
    });

    it("sends a message that facilitates adding a new vault item with empty fields", () => {
      autofillOverlayContentService["isOverlayListVisible"] = true;

      autofillOverlayContentService.addNewVaultItem();

      expect(sendExtensionMessageSpy).toHaveBeenCalledWith("autofillOverlayAddNewVaultItem", {
        login: {
          username: "",
          password: "",
          uri: "http://localhost/",
          hostname: "localhost",
        },
      });
    });

    it("sends a message that facilitates adding a new vault item with data from user filled fields", () => {
      document.body.innerHTML = `
      <form id="validFormId">
        <input type="text" id="username-field" placeholder="username" />
        <input type="password" id="password-field" placeholder="password" />
      </form>
      `;
      const usernameField = document.getElementById(
        "username-field",
      ) as ElementWithOpId<HTMLInputElement>;
      const passwordField = document.getElementById(
        "password-field",
      ) as ElementWithOpId<HTMLInputElement>;
      usernameField.value = "test-username";
      passwordField.value = "test-password";
      autofillOverlayContentService["isOverlayListVisible"] = true;
      autofillOverlayContentService["userFilledFields"] = {
        username: usernameField,
        password: passwordField,
      };

      autofillOverlayContentService.addNewVaultItem();

      expect(sendExtensionMessageSpy).toHaveBeenCalledWith("autofillOverlayAddNewVaultItem", {
        login: {
          username: "test-username",
          password: "test-password",
          uri: "http://localhost/",
          hostname: "localhost",
        },
      });
    });
  });

  describe("redirectOverlayFocusOut", () => {
    let autofillFieldElement: ElementWithOpId<FormFieldElement>;
    let autofillFieldFocusSpy: jest.SpyInstance;
    let findTabsSpy: jest.SpyInstance;
    let previousFocusableElement: HTMLElement;
    let nextFocusableElement: HTMLElement;

    beforeEach(() => {
      document.body.innerHTML = `
      <div class="previous-focusable-element" tabindex="0"></div>
      <form id="validFormId">
        <input type="text" id="username-field" placeholder="username" />
        <input type="password" id="password-field" placeholder="password" />
      </form>
      <div class="next-focusable-element" tabindex="0"></div>
      `;
      autofillFieldElement = document.getElementById(
        "username-field",
      ) as ElementWithOpId<FormFieldElement>;
      autofillFieldElement.opid = "op-1";
      previousFocusableElement = document.querySelector(
        ".previous-focusable-element",
      ) as HTMLElement;
      nextFocusableElement = document.querySelector(".next-focusable-element") as HTMLElement;
      autofillFieldFocusSpy = jest.spyOn(autofillFieldElement, "focus");
      findTabsSpy = jest.spyOn(autofillOverlayContentService as any, "findTabs");
      autofillOverlayContentService["isOverlayListVisible"] = true;
      autofillOverlayContentService["mostRecentlyFocusedField"] = autofillFieldElement;
      autofillOverlayContentService["focusableElements"] = [
        previousFocusableElement,
        autofillFieldElement,
        nextFocusableElement,
      ];
    });

    it("skips focusing an element if the overlay is not visible", () => {
      autofillOverlayContentService["isOverlayListVisible"] = false;

      autofillOverlayContentService.redirectOverlayFocusOut(RedirectFocusDirection.Next);

      expect(findTabsSpy).not.toHaveBeenCalled();
    });

    it("skips focusing an element if no recently focused field exists", () => {
      autofillOverlayContentService["mostRecentlyFocusedField"] = undefined;

      autofillOverlayContentService.redirectOverlayFocusOut(RedirectFocusDirection.Next);

      expect(findTabsSpy).not.toHaveBeenCalled();
    });

    it("focuses the most recently focused field if the focus direction is `Current`", () => {
      autofillOverlayContentService.redirectOverlayFocusOut(RedirectFocusDirection.Current);

      expect(findTabsSpy).not.toHaveBeenCalled();
      expect(autofillFieldFocusSpy).toHaveBeenCalled();
    });

    it("removes the overlay if the focus direction is `Current`", () => {
      jest.useFakeTimers();
      const removeAutofillOverlaySpy = jest.spyOn(
        autofillOverlayContentService as any,
        "removeAutofillOverlay",
      );

      autofillOverlayContentService.redirectOverlayFocusOut(RedirectFocusDirection.Current);
      jest.advanceTimersByTime(150);

      expect(removeAutofillOverlaySpy).toHaveBeenCalled();
    });

    it("finds all focusable tabs if the focusable elements array is not populated", () => {
      autofillOverlayContentService["focusableElements"] = [];
      findTabsSpy.mockReturnValue([
        previousFocusableElement,
        autofillFieldElement,
        nextFocusableElement,
      ]);

      autofillOverlayContentService.redirectOverlayFocusOut(RedirectFocusDirection.Next);

      expect(findTabsSpy).toHaveBeenCalledWith(globalThis.document.body, { getShadowRoot: true });
    });

    it("focuses the previous focusable element if the focus direction is `Previous`", () => {
      jest.spyOn(previousFocusableElement, "focus");

      autofillOverlayContentService.redirectOverlayFocusOut(RedirectFocusDirection.Previous);

      expect(autofillFieldFocusSpy).not.toHaveBeenCalled();
      expect(previousFocusableElement.focus).toHaveBeenCalled();
    });

    it("focuses the next focusable element if the focus direction is `Next`", () => {
      jest.spyOn(nextFocusableElement, "focus");

      autofillOverlayContentService.redirectOverlayFocusOut(RedirectFocusDirection.Next);

      expect(autofillFieldFocusSpy).not.toHaveBeenCalled();
      expect(nextFocusableElement.focus).toHaveBeenCalled();
    });
  });

  describe("handleOverlayRepositionEvent", () => {
    beforeEach(() => {
      document.body.innerHTML = `
      <form id="validFormId">
        <input type="text" id="username-field" placeholder="username" />
        <input type="password" id="password-field" placeholder="password" />
      </form>
      `;
      const usernameField = document.getElementById(
        "username-field",
      ) as ElementWithOpId<HTMLInputElement>;
      autofillOverlayContentService["mostRecentlyFocusedField"] = usernameField;
      autofillOverlayContentService["setOverlayRepositionEventListeners"]();
      autofillOverlayContentService["isOverlayButtonVisible"] = true;
      autofillOverlayContentService["isOverlayListVisible"] = true;
      jest
        .spyOn(autofillOverlayContentService as any, "recentlyFocusedFieldIsCurrentlyFocused")
        .mockReturnValue(true);
    });

    it("skips handling the overlay reposition event if the overlay button and list elements are not visible", () => {
      autofillOverlayContentService["isOverlayButtonVisible"] = false;
      autofillOverlayContentService["isOverlayListVisible"] = false;

      globalThis.dispatchEvent(new Event(EVENTS.RESIZE));

      expect(sendExtensionMessageSpy).not.toHaveBeenCalled();
    });

    it("hides the overlay elements", () => {
      globalThis.dispatchEvent(new Event(EVENTS.SCROLL));

      expect(sendExtensionMessageSpy).toHaveBeenCalledWith("updateAutofillOverlayHidden", {
        display: "none",
      });
      expect(autofillOverlayContentService["isOverlayButtonVisible"]).toEqual(false);
      expect(autofillOverlayContentService["isOverlayListVisible"]).toEqual(false);
    });

    it("clears the user interaction timeout", () => {
      jest.useFakeTimers();
      const clearTimeoutSpy = jest.spyOn(globalThis, "clearTimeout");
      autofillOverlayContentService["userInteractionEventTimeout"] = setTimeout(jest.fn(), 123);

      globalThis.dispatchEvent(new Event(EVENTS.SCROLL));

      expect(clearTimeoutSpy).toHaveBeenCalledWith(expect.anything());
    });

    it("removes the overlay completely if the field is not focused", () => {
      jest.useFakeTimers();
      jest
        .spyOn(autofillOverlayContentService as any, "recentlyFocusedFieldIsCurrentlyFocused")
        .mockReturnValue(false);
      const removeAutofillOverlaySpy = jest.spyOn(
        autofillOverlayContentService as any,
        "removeAutofillOverlay",
      );

      autofillOverlayContentService["mostRecentlyFocusedField"] = undefined;
      autofillOverlayContentService["overlayButtonElement"] = document.createElement("div");
      autofillOverlayContentService["overlayListElement"] = document.createElement("div");

      globalThis.dispatchEvent(new Event(EVENTS.SCROLL));
      jest.advanceTimersByTime(800);

      expect(sendExtensionMessageSpy).toHaveBeenCalledWith("updateAutofillOverlayHidden", {
        display: "block",
      });
      expect(autofillOverlayContentService["isOverlayButtonVisible"]).toEqual(false);
      expect(autofillOverlayContentService["isOverlayListVisible"]).toEqual(false);
      expect(removeAutofillOverlaySpy).toHaveBeenCalled();
    });

    it("updates the overlay position if the most recently focused field is still within the viewport", async () => {
      jest.useFakeTimers();
      jest
        .spyOn(autofillOverlayContentService as any, "updateMostRecentlyFocusedField")
        .mockImplementation(() => {
          autofillOverlayContentService["focusedFieldData"] = {
            focusedFieldRects: {
              top: 100,
            },
            focusedFieldStyles: {},
          };
        });
      const clearUserInteractionEventTimeoutSpy = jest.spyOn(
        autofillOverlayContentService as any,
        "clearUserInteractionEventTimeout",
      );

      globalThis.dispatchEvent(new Event(EVENTS.SCROLL));
      jest.advanceTimersByTime(800);
      await flushPromises();

      expect(sendExtensionMessageSpy).toHaveBeenCalledWith("updateAutofillOverlayPosition", {
        overlayElement: AutofillOverlayElement.Button,
      });
      expect(sendExtensionMessageSpy).toHaveBeenCalledWith("updateAutofillOverlayPosition", {
        overlayElement: AutofillOverlayElement.List,
      });
      expect(clearUserInteractionEventTimeoutSpy).toHaveBeenCalled();
    });

    it("removes the autofill overlay if the focused field is outside of the viewport", async () => {
      jest.useFakeTimers();
      jest
        .spyOn(autofillOverlayContentService as any, "updateMostRecentlyFocusedField")
        .mockImplementation(() => {
          autofillOverlayContentService["focusedFieldData"] = {
            focusedFieldRects: {
              top: 4000,
            },
            focusedFieldStyles: {},
          };
        });
      const removeAutofillOverlaySpy = jest.spyOn(
        autofillOverlayContentService as any,
        "removeAutofillOverlay",
      );

      globalThis.dispatchEvent(new Event(EVENTS.SCROLL));
      jest.advanceTimersByTime(800);
      await flushPromises();

      expect(removeAutofillOverlaySpy).toHaveBeenCalled();
    });

    it("defaults overlay elements to a visibility of `false` if the element is not rendered on the page", async () => {
      jest.useFakeTimers();
      jest
        .spyOn(autofillOverlayContentService as any, "updateMostRecentlyFocusedField")
        .mockImplementation(() => {
          autofillOverlayContentService["focusedFieldData"] = {
            focusedFieldRects: {
              top: 100,
            },
            focusedFieldStyles: {},
          };
        });
      jest
        .spyOn(autofillOverlayContentService as any, "updateOverlayElementsPosition")
        .mockImplementation();
      autofillOverlayContentService["overlayButtonElement"] = document.createElement("div");
      autofillOverlayContentService["overlayListElement"] = undefined;

      globalThis.dispatchEvent(new Event(EVENTS.SCROLL));
      jest.advanceTimersByTime(800);
      await flushPromises();

      expect(autofillOverlayContentService["isOverlayButtonVisible"]).toEqual(true);
      expect(autofillOverlayContentService["isOverlayListVisible"]).toEqual(false);
    });
  });

  describe("handleOverlayElementMutationObserverUpdate", () => {
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
          autofillOverlayContentService as any,
          "isTriggeringExcessiveMutationObserverIterations",
        )
        .mockReturnValue(false);
    });

    it("skips handling the mutation if excessive mutation observer events are triggered", () => {
      jest
        .spyOn(
          autofillOverlayContentService as any,
          "isTriggeringExcessiveMutationObserverIterations",
        )
        .mockReturnValue(true);

      autofillOverlayContentService["handleOverlayElementMutationObserverUpdate"]([
        createMutationRecordMock({ target: usernameField }),
      ]);

      expect(usernameField.removeAttribute).not.toHaveBeenCalled();
    });

    it("skips handling the mutation if the record type is not for `attributes`", () => {
      autofillOverlayContentService["handleOverlayElementMutationObserverUpdate"]([
        createMutationRecordMock({ target: usernameField, type: "childList" }),
      ]);

      expect(usernameField.removeAttribute).not.toHaveBeenCalled();
    });

    it("removes all element attributes that are not the style attribute", () => {
      autofillOverlayContentService["handleOverlayElementMutationObserverUpdate"]([
        createMutationRecordMock({
          target: usernameField,
          type: "attributes",
          attributeName: "placeholder",
        }),
      ]);

      expect(usernameField.removeAttribute).toHaveBeenCalledWith("placeholder");
    });

    it("removes all attached style attributes and sets the default styles", () => {
      autofillOverlayContentService["handleOverlayElementMutationObserverUpdate"]([
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

  describe("handleBodyElementMutationObserverUpdate", () => {
    let overlayButtonElement: HTMLElement;
    let overlayListElement: HTMLElement;

    beforeEach(() => {
      document.body.innerHTML = `
      <div class="overlay-button"></div>
      <div class="overlay-list"></div>
      `;
      overlayButtonElement = document.querySelector(".overlay-button") as HTMLElement;
      overlayListElement = document.querySelector(".overlay-list") as HTMLElement;
      autofillOverlayContentService["overlayButtonElement"] = overlayButtonElement;
      autofillOverlayContentService["overlayListElement"] = overlayListElement;
      autofillOverlayContentService["isOverlayListVisible"] = true;
      jest.spyOn(globalThis.document.body, "insertBefore");
      jest
        .spyOn(
          autofillOverlayContentService as any,
          "isTriggeringExcessiveMutationObserverIterations",
        )
        .mockReturnValue(false);
    });

    it("skips handling the mutation if the overlay elements are not present in the DOM", () => {
      autofillOverlayContentService["overlayButtonElement"] = undefined;
      autofillOverlayContentService["overlayListElement"] = undefined;

      autofillOverlayContentService["handleBodyElementMutationObserverUpdate"]();

      expect(globalThis.document.body.insertBefore).not.toHaveBeenCalled();
    });

    it("skips handling the mutation if excessive mutations are being triggered", () => {
      jest
        .spyOn(
          autofillOverlayContentService as any,
          "isTriggeringExcessiveMutationObserverIterations",
        )
        .mockReturnValue(true);

      autofillOverlayContentService["handleBodyElementMutationObserverUpdate"]();

      expect(globalThis.document.body.insertBefore).not.toHaveBeenCalled();
    });

    it("skips re-arranging the DOM elements if the last child of the body is the overlay list and the second to last child of the body is the overlay button", () => {
      autofillOverlayContentService["handleBodyElementMutationObserverUpdate"]();

      expect(globalThis.document.body.insertBefore).not.toHaveBeenCalled();
    });

    it("skips re-arranging the DOM elements if the last child is the overlay button and the overlay list is not visible", () => {
      overlayListElement.remove();
      autofillOverlayContentService["isOverlayListVisible"] = false;

      autofillOverlayContentService["handleBodyElementMutationObserverUpdate"]();

      expect(globalThis.document.body.insertBefore).not.toHaveBeenCalled();
    });

    it("positions the overlay button before the overlay list if an element has inserted itself after the button element", () => {
      const injectedElement = document.createElement("div");
      document.body.insertBefore(injectedElement, overlayListElement);

      autofillOverlayContentService["handleBodyElementMutationObserverUpdate"]();

      expect(globalThis.document.body.insertBefore).toHaveBeenCalledWith(
        overlayButtonElement,
        overlayListElement,
      );
    });

    it("positions the overlay button before the overlay list if the elements have inserted in incorrect order", () => {
      document.body.appendChild(overlayButtonElement);

      autofillOverlayContentService["handleBodyElementMutationObserverUpdate"]();

      expect(globalThis.document.body.insertBefore).toHaveBeenCalledWith(
        overlayButtonElement,
        overlayListElement,
      );
    });

    it("positions the last child before the overlay button if it is not the overlay list", () => {
      const injectedElement = document.createElement("div");
      document.body.appendChild(injectedElement);

      autofillOverlayContentService["handleBodyElementMutationObserverUpdate"]();

      expect(globalThis.document.body.insertBefore).toHaveBeenCalledWith(
        injectedElement,
        overlayButtonElement,
      );
    });
  });

  describe("isTriggeringExcessiveMutationObserverIterations", () => {
    it("clears any existing reset timeout", () => {
      jest.useFakeTimers();
      const clearTimeoutSpy = jest.spyOn(globalThis, "clearTimeout");
      autofillOverlayContentService["mutationObserverIterationsResetTimeout"] = setTimeout(
        jest.fn(),
        123,
      );

      autofillOverlayContentService["isTriggeringExcessiveMutationObserverIterations"]();

      expect(clearTimeoutSpy).toHaveBeenCalledWith(expect.anything());
    });

    it("will reset the number of mutationObserverIterations after two seconds", () => {
      jest.useFakeTimers();
      autofillOverlayContentService["mutationObserverIterations"] = 10;

      autofillOverlayContentService["isTriggeringExcessiveMutationObserverIterations"]();
      jest.advanceTimersByTime(2000);

      expect(autofillOverlayContentService["mutationObserverIterations"]).toEqual(0);
    });

    it("will blur the overlay field and remove the autofill overlay if excessive mutation observer iterations are triggering", async () => {
      autofillOverlayContentService["mutationObserverIterations"] = 101;
      const blurMostRecentOverlayFieldSpy = jest.spyOn(
        autofillOverlayContentService as any,
        "blurMostRecentOverlayField",
      );
      const removeAutofillOverlaySpy = jest.spyOn(
        autofillOverlayContentService as any,
        "removeAutofillOverlay",
      );

      autofillOverlayContentService["isTriggeringExcessiveMutationObserverIterations"]();
      await flushPromises();

      expect(blurMostRecentOverlayFieldSpy).toHaveBeenCalled();
      expect(removeAutofillOverlaySpy).toHaveBeenCalled();
    });
  });

  describe("handleVisibilityChangeEvent", () => {
    it("skips removing the overlay if the document is visible", () => {
      jest.spyOn(autofillOverlayContentService as any, "removeAutofillOverlay");

      autofillOverlayContentService["handleVisibilityChangeEvent"]();

      expect(autofillOverlayContentService["removeAutofillOverlay"]).not.toHaveBeenCalled();
    });

    it("removes the overlay if the document is not visible", () => {
      Object.defineProperty(document, "visibilityState", {
        value: "hidden",
        writable: true,
      });
      jest.spyOn(autofillOverlayContentService as any, "removeAutofillOverlay");

      autofillOverlayContentService["handleVisibilityChangeEvent"]();

      expect(autofillOverlayContentService["removeAutofillOverlay"]).toHaveBeenCalled();
    });
  });

  describe("destroy", () => {
    let autofillFieldElement: ElementWithOpId<FormFieldElement>;
    let autofillFieldData: AutofillField;
    let pageDetailsMock: AutofillPageDetails;

    beforeEach(() => {
      document.body.innerHTML = `
      <form id="validFormId">
        <input type="text" id="username-field" placeholder="username" />
        <input type="password" id="password-field" placeholder="password" />
      </form>
      `;

      autofillFieldElement = document.getElementById(
        "username-field",
      ) as ElementWithOpId<FormFieldElement>;
      autofillFieldElement.opid = "op-1";
      autofillFieldData = createAutofillFieldMock({
        opid: "username-field",
        form: "validFormId",
        placeholder: "username",
        elementNumber: 1,
      });
      const passwordFieldData = createAutofillFieldMock({
        opid: "password-field",
        form: "validFormId",
        elementNumber: 2,
        autocompleteType: "current-password",
        type: "password",
      });
      pageDetailsMock = mock<AutofillPageDetails>({
        forms: { validFormId: mock<AutofillForm>() },
        fields: [autofillFieldData, passwordFieldData],
      });
      void autofillOverlayContentService.setupAutofillOverlayListenerOnField(
        autofillFieldElement,
        autofillFieldData,
        pageDetailsMock,
      );
      autofillOverlayContentService["mostRecentlyFocusedField"] = autofillFieldElement;
    });

    it("disconnects all mutation observers", () => {
      autofillOverlayContentService["setupMutationObserver"]();
      jest.spyOn(autofillOverlayContentService["bodyElementMutationObserver"], "disconnect");

      autofillOverlayContentService.destroy();

      expect(
        autofillOverlayContentService["bodyElementMutationObserver"].disconnect,
      ).toHaveBeenCalled();
    });

    it("clears the user interaction event timeout", () => {
      jest.spyOn(autofillOverlayContentService as any, "clearUserInteractionEventTimeout");

      autofillOverlayContentService.destroy();

      expect(autofillOverlayContentService["clearUserInteractionEventTimeout"]).toHaveBeenCalled();
    });

    it("de-registers all global event listeners", () => {
      jest.spyOn(globalThis.document, "removeEventListener");
      jest.spyOn(globalThis, "removeEventListener");
      jest.spyOn(autofillOverlayContentService as any, "removeOverlayRepositionEventListeners");

      autofillOverlayContentService.destroy();

      expect(globalThis.document.removeEventListener).toHaveBeenCalledWith(
        EVENTS.VISIBILITYCHANGE,
        autofillOverlayContentService["handleVisibilityChangeEvent"],
      );
      expect(globalThis.removeEventListener).toHaveBeenCalledWith(
        EVENTS.FOCUSOUT,
        autofillOverlayContentService["handleFormFieldBlurEvent"],
      );
      expect(
        autofillOverlayContentService["removeOverlayRepositionEventListeners"],
      ).toHaveBeenCalled();
    });

    it("de-registers any event listeners that are attached to the form field elements", () => {
      jest.spyOn(autofillOverlayContentService as any, "removeCachedFormFieldEventListeners");
      jest.spyOn(autofillFieldElement, "removeEventListener");
      jest.spyOn(autofillOverlayContentService["formFieldElements"], "delete");

      autofillOverlayContentService.destroy();

      expect(
        autofillOverlayContentService["removeCachedFormFieldEventListeners"],
      ).toHaveBeenCalledWith(autofillFieldElement);
      expect(autofillFieldElement.removeEventListener).toHaveBeenCalledWith(
        EVENTS.BLUR,
        autofillOverlayContentService["handleFormFieldBlurEvent"],
      );
      expect(autofillFieldElement.removeEventListener).toHaveBeenCalledWith(
        EVENTS.KEYUP,
        autofillOverlayContentService["handleFormFieldKeyupEvent"],
      );
      expect(autofillOverlayContentService["formFieldElements"].delete).toHaveBeenCalledWith(
        autofillFieldElement,
      );
    });
  });
});
