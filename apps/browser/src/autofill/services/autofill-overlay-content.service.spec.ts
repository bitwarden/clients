import { mock, MockProxy } from "jest-mock-extended";

import { EVENTS } from "@bitwarden/common/autofill/constants";
import { CipherType } from "@bitwarden/common/vault/enums";

import { ModifyLoginCipherFormData } from "../background/abstractions/overlay-notifications.background";
import AutofillInit from "../content/autofill-init";
import {
  AutofillOverlayElement,
  InlineMenuFillTypes,
  MAX_SUB_FRAME_DEPTH,
  RedirectFocusDirection,
} from "../enums/autofill-overlay.enum";
import AutofillField from "../models/autofill-field";
import AutofillForm from "../models/autofill-form";
import AutofillPageDetails from "../models/autofill-page-details";
import { AutofillInlineMenuContentService } from "../overlay/inline-menu/abstractions/autofill-inline-menu-content.service";
import { createAutofillFieldMock } from "../spec/autofill-mocks";
import {
  flushPromises,
  mockQuerySelectorAllDefinedCall,
  postWindowMessage,
  sendMockExtensionMessage,
} from "../spec/testing-utils";
import { ElementWithOpId, FillableFormFieldElement, FormFieldElement } from "../types";

import { AutoFillConstants } from "./autofill-constants";
import { AutofillOverlayContentService } from "./autofill-overlay-content.service";
import DomElementVisibilityService from "./dom-element-visibility.service";
import { DomQueryService } from "./dom-query.service";
import { InlineMenuFieldQualificationService } from "./inline-menu-field-qualification.service";

const defaultWindowReadyState = document.readyState;
const defaultDocumentVisibilityState = document.visibilityState;
describe("AutofillOverlayContentService", () => {
  let domQueryService: DomQueryService;
  let domElementVisibilityService: DomElementVisibilityService;
  let autofillInit: AutofillInit;
  let inlineMenuFieldQualificationService: InlineMenuFieldQualificationService;
  let inlineMenuContentService: MockProxy<AutofillInlineMenuContentService>;
  let autofillOverlayContentService: AutofillOverlayContentService;
  let sendExtensionMessageSpy: jest.SpyInstance;
  const sendResponseSpy = jest.fn();
  const mockQuerySelectorAll = mockQuerySelectorAllDefinedCall();

  beforeEach(async () => {
    inlineMenuFieldQualificationService = new InlineMenuFieldQualificationService();
    domQueryService = new DomQueryService();
    domElementVisibilityService = new DomElementVisibilityService();
    inlineMenuContentService = mock<AutofillInlineMenuContentService>();
    autofillOverlayContentService = new AutofillOverlayContentService(
      domQueryService,
      domElementVisibilityService,
      inlineMenuFieldQualificationService,
      inlineMenuContentService,
    );
    autofillInit = new AutofillInit(
      domQueryService,
      domElementVisibilityService,
      autofillOverlayContentService,
    );
    autofillInit.init();
    autofillOverlayContentService["showInlineMenuCards"] = true;
    autofillOverlayContentService["showInlineMenuIdentities"] = true;
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
    Object.defineProperty(window, "top", {
      value: window,
      writable: true,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    mockQuerySelectorAll.mockRestore();
  });

  describe("init", () => {
    let setupGlobalEventListenersSpy: jest.SpyInstance;

    beforeEach(() => {
      jest.spyOn(document, "addEventListener");
      jest.spyOn(window, "addEventListener");
      setupGlobalEventListenersSpy = jest.spyOn(
        autofillOverlayContentService as any,
        "setupGlobalEventListeners",
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
      const handleWindowFocusOutEventSpy = jest.spyOn(
        autofillOverlayContentService as any,
        "handleWindowFocusOutEvent",
      );

      autofillOverlayContentService.init();

      expect(window.addEventListener).toHaveBeenCalledWith(
        "focusout",
        handleWindowFocusOutEventSpy,
      );
    });
  });

  describe("setupInlineMenu", () => {
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
      jest.spyOn(autofillFieldElement, "removeEventListener");
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
        autoCompleteType: "current-password",
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

      it("ignores fields that are part of the ExcludedInlineMenuTypes", () => {
        AutoFillConstants.ExcludedInlineMenuTypes.forEach(async (excludedType) => {
          autofillFieldData.type = excludedType;

          await autofillOverlayContentService.setupOverlayListeners(
            autofillFieldElement,
            autofillFieldData,
            pageDetailsMock,
          );

          expect(autofillFieldElement.addEventListener).not.toHaveBeenCalled();
        });
      });

      it("ignores fields that do not appear as a login or card field", async () => {
        autofillFieldData.htmlName = "another-type-of-field";
        autofillFieldData.htmlID = "another-type-of-field";
        autofillFieldData.placeholder = "another-type-of-field";

        await autofillOverlayContentService.setupOverlayListeners(
          autofillFieldElement,
          autofillFieldData,
          pageDetailsMock,
        );

        expect(autofillFieldElement.addEventListener).not.toHaveBeenCalled();
      });
    });

    it("skips setup on fields that have been previously set up", async () => {
      autofillOverlayContentService["formFieldElements"].set(
        autofillFieldElement,
        autofillFieldData,
      );

      await autofillOverlayContentService.setupOverlayListeners(
        autofillFieldElement,
        autofillFieldData,
        pageDetailsMock,
      );

      expect(autofillFieldElement.addEventListener).not.toHaveBeenCalled();
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

        await autofillOverlayContentService.setupOverlayListeners(
          autofillFieldElement,
          autofillFieldData,
          pageDetailsMock,
        );

        expect(autofillFieldElement.removeEventListener).toHaveBeenNthCalledWith(
          1,
          "focus",
          expect.any(Function),
        );
        expect(autofillFieldElement.removeEventListener).toHaveBeenNthCalledWith(
          2,
          "input",
          expect.any(Function),
        );
        expect(autofillFieldElement.removeEventListener).toHaveBeenNthCalledWith(
          3,
          "input",
          inputHandler,
        );
        expect(autofillFieldElement.removeEventListener).toHaveBeenNthCalledWith(
          4,
          "click",
          clickHandler,
        );
        expect(autofillFieldElement.removeEventListener).toHaveBeenNthCalledWith(
          5,
          "focus",
          focusHandler,
        );
      });

      describe("form field blur event listener", () => {
        beforeEach(async () => {
          await autofillOverlayContentService.setupOverlayListeners(
            autofillFieldElement,
            autofillFieldData,
            pageDetailsMock,
          );
        });

        it("sends a message to the background to update the isFieldCurrentlyFocused value to `false`", async () => {
          autofillFieldElement.dispatchEvent(new Event("blur"));

          expect(sendExtensionMessageSpy).toHaveBeenCalledWith("updateIsFieldCurrentlyFocused", {
            isFieldCurrentlyFocused: false,
          });
        });

        it("sends a message to the background to check if the overlay is focused", () => {
          autofillFieldElement.dispatchEvent(new Event("blur"));

          expect(sendExtensionMessageSpy).toHaveBeenCalledWith("checkAutofillInlineMenuFocused");
        });
      });

      describe("form field keyup event listener", () => {
        beforeEach(async () => {
          await autofillOverlayContentService.setupOverlayListeners(
            autofillFieldElement,
            autofillFieldData,
            pageDetailsMock,
          );
          jest.spyOn(globalThis.customElements, "define").mockImplementation();
        });

        it("closes the autofill inline menu when the `Escape` key is pressed", () => {
          autofillFieldElement.dispatchEvent(new KeyboardEvent("keyup", { code: "Escape" }));

          expect(sendExtensionMessageSpy).toHaveBeenCalledWith("closeAutofillInlineMenu", {
            forceCloseInlineMenu: true,
          });
        });

        it("repositions the overlay when autofill is not currently filling and the `Enter` key is pressed", async () => {
          const handleOverlayRepositionEventSpy = jest.spyOn(
            autofillOverlayContentService as any,
            "handleOverlayRepositionEvent",
          );
          jest
            .spyOn(autofillOverlayContentService as any, "isFieldCurrentlyFilling")
            .mockResolvedValue(false);

          autofillFieldElement.dispatchEvent(new KeyboardEvent("keyup", { code: "Enter" }));
          await flushPromises();

          expect(handleOverlayRepositionEventSpy).toHaveBeenCalled();
        });

        it("does not reposition the overlay when autofill is currently filling and the `Enter` key is pressed", async () => {
          const handleOverlayRepositionEventSpy = jest.spyOn(
            autofillOverlayContentService as any,
            "handleOverlayRepositionEvent",
          );
          jest
            .spyOn(autofillOverlayContentService as any, "isFieldCurrentlyFilling")
            .mockResolvedValue(true);

          autofillFieldElement.dispatchEvent(new KeyboardEvent("keyup", { code: "Enter" }));
          await flushPromises();

          expect(handleOverlayRepositionEventSpy).not.toHaveBeenCalled();
        });

        it("opens the overlay list and focuses it after a delay if it is not visible when the `ArrowDown` key is pressed", async () => {
          jest.useFakeTimers();
          autofillOverlayContentService["mostRecentlyFocusedField"] = autofillFieldElement;
          jest
            .spyOn(autofillOverlayContentService as any, "isInlineMenuListVisible")
            .mockResolvedValue(false);

          autofillFieldElement.dispatchEvent(new KeyboardEvent("keyup", { code: "ArrowDown" }));
          await flushPromises();

          expect(sendExtensionMessageSpy).toHaveBeenCalledWith("openAutofillInlineMenu", {
            isOpeningFullInlineMenu: true,
          });
          expect(sendExtensionMessageSpy).not.toHaveBeenCalledWith("focusAutofillInlineMenuList");

          jest.advanceTimersByTime(150);

          expect(sendExtensionMessageSpy).toHaveBeenCalledWith("focusAutofillInlineMenuList");
        });

        it("focuses the overlay list when the `ArrowDown` key is pressed", async () => {
          jest
            .spyOn(autofillOverlayContentService as any, "isInlineMenuListVisible")
            .mockResolvedValue(true);

          autofillFieldElement.dispatchEvent(new KeyboardEvent("keyup", { code: "ArrowDown" }));
          await flushPromises();

          expect(sendExtensionMessageSpy).toHaveBeenCalledWith("focusAutofillInlineMenuList");
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

          await autofillOverlayContentService.setupOverlayListeners(
            spanAutofillFieldElement,
            autofillFieldData,
            pageDetailsMock,
          );

          spanAutofillFieldElement.dispatchEvent(new Event("input"));

          expect(autofillOverlayContentService["storeModifiedFormElement"]).not.toHaveBeenCalled();
        });

        it("skips storing the element if it is not present in the set of qualified autofill fields", () => {
          const randomElement = document.createElement(
            "input",
          ) as ElementWithOpId<FillableFormFieldElement>;
          jest.spyOn(autofillOverlayContentService as any, "qualifyUserFilledField");

          autofillOverlayContentService["storeModifiedFormElement"](randomElement);

          expect(autofillOverlayContentService["qualifyUserFilledField"]).not.toHaveBeenCalled();
        });

        it("sets the field as the most recently focused form field element", async () => {
          autofillOverlayContentService["mostRecentlyFocusedField"] =
            mock<ElementWithOpId<FormFieldElement>>();

          await autofillOverlayContentService.setupOverlayListeners(
            autofillFieldElement,
            autofillFieldData,
            pageDetailsMock,
          );

          autofillFieldElement.dispatchEvent(new Event("input"));
          await flushPromises();

          expect(autofillOverlayContentService["mostRecentlyFocusedField"]).toEqual(
            autofillFieldElement,
          );
        });

        it("stores the field as a user filled field if the form field data indicates that it is for a username", async () => {
          await autofillOverlayContentService.setupOverlayListeners(
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

          const passwordFieldData = createAutofillFieldMock({
            opid: "password-field",
            form: "validFormId",
            elementNumber: 2,
            type: "password",
          });

          await autofillOverlayContentService.setupOverlayListeners(
            passwordFieldElement,
            passwordFieldData,
            pageDetailsMock,
          );
          passwordFieldElement.dispatchEvent(new Event("input"));
          expect(autofillOverlayContentService["userFilledFields"].password).toEqual(
            passwordFieldElement,
          );
        });

        it("Closes the inline menu list and does not re-open the inline menu if the field has a value", async () => {
          (autofillFieldElement as HTMLInputElement).value = "test";

          await autofillOverlayContentService.setupOverlayListeners(
            autofillFieldElement,
            autofillFieldData,
            pageDetailsMock,
          );
          autofillFieldElement.dispatchEvent(new Event("input"));
          await flushPromises();

          expect(sendExtensionMessageSpy).toHaveBeenCalledWith("closeAutofillInlineMenu", {
            overlayElement: AutofillOverlayElement.List,
            forceCloseInlineMenu: true,
          });
          expect(sendExtensionMessageSpy).not.toHaveBeenCalledWith("openAutofillInlineMenu");
        });

        it("opens the inline menu if the field does not have a value", async () => {
          await autofillOverlayContentService.setupOverlayListeners(
            autofillFieldElement,
            autofillFieldData,
            pageDetailsMock,
          );
          autofillFieldElement.dispatchEvent(new Event("input"));
          await flushPromises();

          expect(sendExtensionMessageSpy).toHaveBeenCalledWith("openAutofillInlineMenu");
        });

        describe("input changes on a field filled by a card cipher", () => {
          let inputFieldElement: ElementWithOpId<FillableFormFieldElement>;
          let inputFieldData: AutofillField;
          let selectFieldElement: ElementWithOpId<FillableFormFieldElement>;
          let selectFieldData: AutofillField;

          beforeEach(() => {
            inputFieldElement = document.createElement(
              "input",
            ) as ElementWithOpId<FillableFormFieldElement>;
            inputFieldData = createAutofillFieldMock({
              opid: "input-field",
              form: "validFormId",
              elementNumber: 3,
              autoCompleteType: "cc-number",
              type: "text",
              inlineMenuFillType: CipherType.Card,
              viewable: true,
            });
            selectFieldElement = document.createElement(
              "select",
            ) as ElementWithOpId<FillableFormFieldElement>;
            selectFieldData = createAutofillFieldMock({
              opid: "select-field",
              form: "validFormId",
              elementNumber: 4,
              autoCompleteType: "cc-type",
              type: "select",
              inlineMenuFillType: CipherType.Card,
              viewable: true,
            });
            pageDetailsMock.fields = [inputFieldData, selectFieldData];
          });

          it("only stores the element if the form field is a select element", async () => {
            jest.spyOn(autofillOverlayContentService as any, "storeModifiedFormElement");

            await autofillOverlayContentService.setupOverlayListeners(
              selectFieldElement,
              selectFieldData,
              pageDetailsMock,
            );

            selectFieldElement.dispatchEvent(new Event("input"));

            expect(autofillOverlayContentService["storeModifiedFormElement"]).toHaveBeenCalledWith(
              selectFieldElement,
            );
            expect(sendExtensionMessageSpy).not.toHaveBeenCalledWith(
              "openAutofillInlineMenu",
              expect.any(Object),
            );
          });

          it("stores cardholder name fields", async () => {
            inputFieldData.autoCompleteType = "cc-name";

            await autofillOverlayContentService.setupOverlayListeners(
              inputFieldElement,
              inputFieldData,
              pageDetailsMock,
            );

            inputFieldElement.dispatchEvent(new Event("input"));

            expect(autofillOverlayContentService["userFilledFields"].cardholderName).toEqual(
              inputFieldElement,
            );
          });

          it("stores card number fields", async () => {
            await autofillOverlayContentService.setupOverlayListeners(
              inputFieldElement,
              inputFieldData,
              pageDetailsMock,
            );

            inputFieldElement.dispatchEvent(new Event("input"));

            expect(autofillOverlayContentService["userFilledFields"].cardNumber).toEqual(
              inputFieldElement,
            );
          });

          it("stores card expiration month fields", async () => {
            inputFieldData.autoCompleteType = "cc-exp-month";

            await autofillOverlayContentService.setupOverlayListeners(
              inputFieldElement,
              inputFieldData,
              pageDetailsMock,
            );

            inputFieldElement.dispatchEvent(new Event("input"));

            expect(autofillOverlayContentService["userFilledFields"].cardExpirationMonth).toEqual(
              inputFieldElement,
            );
          });

          it("stores card expiration year fields", async () => {
            inputFieldData.autoCompleteType = "cc-exp-year";

            await autofillOverlayContentService.setupOverlayListeners(
              inputFieldElement,
              inputFieldData,
              pageDetailsMock,
            );

            inputFieldElement.dispatchEvent(new Event("input"));

            expect(autofillOverlayContentService["userFilledFields"].cardExpirationYear).toEqual(
              inputFieldElement,
            );
          });

          it("stores card expiration date fields", async () => {
            inputFieldData.autoCompleteType = "cc-exp";

            await autofillOverlayContentService.setupOverlayListeners(
              inputFieldElement,
              inputFieldData,
              pageDetailsMock,
            );

            inputFieldElement.dispatchEvent(new Event("input"));

            expect(autofillOverlayContentService["userFilledFields"].cardExpirationDate).toEqual(
              inputFieldElement,
            );
          });

          it("stores card cvv fields", async () => {
            inputFieldData.autoCompleteType = "cc-csc";

            await autofillOverlayContentService.setupOverlayListeners(
              inputFieldElement,
              inputFieldData,
              pageDetailsMock,
            );

            inputFieldElement.dispatchEvent(new Event("input"));

            expect(autofillOverlayContentService["userFilledFields"].cardCvv).toEqual(
              inputFieldElement,
            );
          });
        });

        describe("input changes on a field filled by a identity cipher", () => {
          let inputFieldElement: ElementWithOpId<FillableFormFieldElement>;
          let inputFieldData: AutofillField;

          beforeEach(() => {
            inputFieldElement = document.createElement(
              "input",
            ) as ElementWithOpId<FillableFormFieldElement>;
            inputFieldData = createAutofillFieldMock({
              opid: "input-field",
              form: "validFormId",
              elementNumber: 3,
              autoCompleteType: "given-name",
              type: "text",
              inlineMenuFillType: CipherType.Identity,
              viewable: true,
            });
            pageDetailsMock.fields = [inputFieldData];
          });

          it("stores identity title fields", async () => {
            inputFieldData.autoCompleteType = "honorific-prefix";

            await autofillOverlayContentService.setupOverlayListeners(
              inputFieldElement,
              inputFieldData,
              pageDetailsMock,
            );

            inputFieldElement.dispatchEvent(new Event("input"));

            expect(autofillOverlayContentService["userFilledFields"].identityTitle).toEqual(
              inputFieldElement,
            );
          });

          it("stores first name fields", async () => {
            inputFieldData.autoCompleteType = "given-name";

            await autofillOverlayContentService.setupOverlayListeners(
              inputFieldElement,
              inputFieldData,
              pageDetailsMock,
            );

            inputFieldElement.dispatchEvent(new Event("input"));

            expect(autofillOverlayContentService["userFilledFields"].identityFirstName).toEqual(
              inputFieldElement,
            );
          });

          it("stores identity middle name fields", async () => {
            inputFieldData.autoCompleteType = "additional-name";

            await autofillOverlayContentService.setupOverlayListeners(
              inputFieldElement,
              inputFieldData,
              pageDetailsMock,
            );

            inputFieldElement.dispatchEvent(new Event("input"));

            expect(autofillOverlayContentService["userFilledFields"].identityMiddleName).toEqual(
              inputFieldElement,
            );
          });

          it("stores identity last name fields", async () => {
            inputFieldData.autoCompleteType = "family-name";

            await autofillOverlayContentService.setupOverlayListeners(
              inputFieldElement,
              inputFieldData,
              pageDetailsMock,
            );

            inputFieldElement.dispatchEvent(new Event("input"));

            expect(autofillOverlayContentService["userFilledFields"].identityLastName).toEqual(
              inputFieldElement,
            );
          });

          it("stores identity full name fields", async () => {
            inputFieldData.autoCompleteType = "name";

            await autofillOverlayContentService.setupOverlayListeners(
              inputFieldElement,
              inputFieldData,
              pageDetailsMock,
            );

            inputFieldElement.dispatchEvent(new Event("input"));

            expect(autofillOverlayContentService["userFilledFields"].identityFullName).toEqual(
              inputFieldElement,
            );
          });

          it("stores identity address1 fields", async () => {
            inputFieldData.autoCompleteType = "address-line1";

            await autofillOverlayContentService.setupOverlayListeners(
              inputFieldElement,
              inputFieldData,
              pageDetailsMock,
            );

            inputFieldElement.dispatchEvent(new Event("input"));

            expect(autofillOverlayContentService["userFilledFields"].identityAddress1).toEqual(
              inputFieldElement,
            );
          });

          it("stores identity address2 fields", async () => {
            inputFieldData.autoCompleteType = "address-line2";

            await autofillOverlayContentService.setupOverlayListeners(
              inputFieldElement,
              inputFieldData,
              pageDetailsMock,
            );

            inputFieldElement.dispatchEvent(new Event("input"));

            expect(autofillOverlayContentService["userFilledFields"].identityAddress2).toEqual(
              inputFieldElement,
            );
          });

          it("stores identity address3 fields", async () => {
            inputFieldData.autoCompleteType = "address-line3";

            await autofillOverlayContentService.setupOverlayListeners(
              inputFieldElement,
              inputFieldData,
              pageDetailsMock,
            );

            inputFieldElement.dispatchEvent(new Event("input"));

            expect(autofillOverlayContentService["userFilledFields"].identityAddress3).toEqual(
              inputFieldElement,
            );
          });

          it("stores identity city fields", async () => {
            inputFieldData.autoCompleteType = "address-level2";

            await autofillOverlayContentService.setupOverlayListeners(
              inputFieldElement,
              inputFieldData,
              pageDetailsMock,
            );

            inputFieldElement.dispatchEvent(new Event("input"));

            expect(autofillOverlayContentService["userFilledFields"].identityCity).toEqual(
              inputFieldElement,
            );
          });

          it("stores identity state fields", async () => {
            inputFieldData.autoCompleteType = "address-level1";

            await autofillOverlayContentService.setupOverlayListeners(
              inputFieldElement,
              inputFieldData,
              pageDetailsMock,
            );

            inputFieldElement.dispatchEvent(new Event("input"));

            expect(autofillOverlayContentService["userFilledFields"].identityState).toEqual(
              inputFieldElement,
            );
          });

          it("stores identity postal code fields", async () => {
            inputFieldData.autoCompleteType = "postal-code";

            await autofillOverlayContentService.setupOverlayListeners(
              inputFieldElement,
              inputFieldData,
              pageDetailsMock,
            );

            inputFieldElement.dispatchEvent(new Event("input"));

            expect(autofillOverlayContentService["userFilledFields"].identityPostalCode).toEqual(
              inputFieldElement,
            );
          });

          it("stores identity country fields", async () => {
            inputFieldData.autoCompleteType = "country-name";

            await autofillOverlayContentService.setupOverlayListeners(
              inputFieldElement,
              inputFieldData,
              pageDetailsMock,
            );

            inputFieldElement.dispatchEvent(new Event("input"));

            expect(autofillOverlayContentService["userFilledFields"].identityCountry).toEqual(
              inputFieldElement,
            );
          });

          it("stores identity company fields", async () => {
            inputFieldData.autoCompleteType = "organization";

            await autofillOverlayContentService.setupOverlayListeners(
              inputFieldElement,
              inputFieldData,
              pageDetailsMock,
            );

            inputFieldElement.dispatchEvent(new Event("input"));

            expect(autofillOverlayContentService["userFilledFields"].identityCompany).toEqual(
              inputFieldElement,
            );
          });

          it("stores identity phone fields", async () => {
            inputFieldData.autoCompleteType = "tel";

            await autofillOverlayContentService.setupOverlayListeners(
              inputFieldElement,
              inputFieldData,
              pageDetailsMock,
            );

            inputFieldElement.dispatchEvent(new Event("input"));

            expect(autofillOverlayContentService["userFilledFields"].identityPhone).toEqual(
              inputFieldElement,
            );
          });

          it("stores identity email fields", async () => {
            jest
              .spyOn(inlineMenuFieldQualificationService, "isFieldForLoginForm")
              .mockReturnValue(false);
            inputFieldData.autoCompleteType = "email";

            await autofillOverlayContentService.setupOverlayListeners(
              inputFieldElement,
              inputFieldData,
              pageDetailsMock,
            );

            inputFieldElement.dispatchEvent(new Event("input"));

            expect(autofillOverlayContentService["userFilledFields"].identityEmail).toEqual(
              inputFieldElement,
            );
            expect(autofillOverlayContentService["userFilledFields"].username).toEqual(
              inputFieldElement,
            );
          });

          it("stores identity username fields", async () => {
            jest
              .spyOn(inlineMenuFieldQualificationService, "isFieldForLoginForm")
              .mockReturnValue(false);
            inputFieldData.autoCompleteType = "username";

            await autofillOverlayContentService.setupOverlayListeners(
              inputFieldElement,
              inputFieldData,
              pageDetailsMock,
            );

            inputFieldElement.dispatchEvent(new Event("input"));

            expect(autofillOverlayContentService["userFilledFields"].identityUsername).toEqual(
              inputFieldElement,
            );
            expect(autofillOverlayContentService["userFilledFields"].username).toEqual(
              inputFieldElement,
            );
          });
        });

        describe("input changes on a field for an account creation form", () => {
          const inputFieldData = createAutofillFieldMock({
            form: "validFormId",
            autoCompleteType: "username",
            type: "text",
          });
          const passwordFieldData = createAutofillFieldMock({
            type: "password",
            autoCompleteType: "new-password",
            form: "validFormId",
            placeholder: "new password",
          });
          const confirmPasswordFieldData = createAutofillFieldMock({
            type: "password",
            autoCompleteType: "new-password",
            form: "validFormId",
            placeholder: "confirm password",
          });

          beforeEach(() => {
            jest
              .spyOn(inlineMenuFieldQualificationService, "isFieldForLoginForm")
              .mockReturnValue(false);
          });

          it("stores fields account username fields", async () => {
            const inputFieldElement = document.createElement(
              "input",
            ) as ElementWithOpId<FillableFormFieldElement>;

            pageDetailsMock.fields = [inputFieldData, passwordFieldData, confirmPasswordFieldData];
            await autofillOverlayContentService.setupOverlayListeners(
              inputFieldElement,
              inputFieldData,
              pageDetailsMock,
            );

            inputFieldElement.dispatchEvent(new Event("input"));

            expect(autofillOverlayContentService["userFilledFields"].username).toEqual(
              inputFieldElement,
            );
          });

          it("stores new password fields", async () => {
            const inputFieldElement = document.createElement(
              "input",
            ) as ElementWithOpId<FillableFormFieldElement>;

            pageDetailsMock.fields = [inputFieldData, passwordFieldData, confirmPasswordFieldData];
            await autofillOverlayContentService.setupOverlayListeners(
              inputFieldElement,
              passwordFieldData,
              pageDetailsMock,
            );

            inputFieldElement.dispatchEvent(new Event("input"));

            expect(autofillOverlayContentService["userFilledFields"].newPassword).toEqual(
              inputFieldElement,
            );
          });
        });
      });

      describe("form field click event listener", () => {
        beforeEach(async () => {
          jest
            .spyOn(autofillOverlayContentService as any, "triggerFormFieldFocusedAction")
            .mockImplementation();
          await autofillOverlayContentService.setupOverlayListeners(
            autofillFieldElement,
            autofillFieldData,
            pageDetailsMock,
          );
        });

        it("triggers the field focused handler if the overlay is not visible", async () => {
          autofillFieldElement.dispatchEvent(new Event("click"));
          await flushPromises();

          expect(autofillOverlayContentService["triggerFormFieldFocusedAction"]).toHaveBeenCalled();
        });

        it("skips triggering the field focused handler if the overlay list is visible", () => {
          // Mock resolved value from `isInlineMenuButtonVisible` message
          sendExtensionMessageSpy.mockResolvedValueOnce(true);

          autofillFieldElement.dispatchEvent(new Event("click"));

          expect(
            autofillOverlayContentService["triggerFormFieldFocusedAction"],
          ).not.toHaveBeenCalled();
        });

        it("skips triggering the field focused handler if the overlay button is visible", () => {
          // Mock resolved value from `isInlineMenuButtonVisible` message
          sendExtensionMessageSpy.mockResolvedValueOnce(true);

          autofillFieldElement.dispatchEvent(new Event("click"));

          expect(
            autofillOverlayContentService["triggerFormFieldFocusedAction"],
          ).not.toHaveBeenCalled();
        });
      });

      describe("form field focus event listener", () => {
        let updateMostRecentlyFocusedFieldSpy: jest.SpyInstance;
        let isFieldCurrentlyFillingSpy: jest.SpyInstance;

        beforeEach(() => {
          jest.spyOn(globalThis.customElements, "define").mockImplementation();
          updateMostRecentlyFocusedFieldSpy = jest.spyOn(
            autofillOverlayContentService as any,
            "updateMostRecentlyFocusedField",
          );
          isFieldCurrentlyFillingSpy = jest
            .spyOn(autofillOverlayContentService as any, "isFieldCurrentlyFilling")
            .mockResolvedValue(false);
        });

        it("skips triggering the handler logic if autofill is currently filling", async () => {
          isFieldCurrentlyFillingSpy.mockResolvedValue(true);
          autofillOverlayContentService["mostRecentlyFocusedField"] = autofillFieldElement;
          await autofillOverlayContentService.setupOverlayListeners(
            autofillFieldElement,
            autofillFieldData,
            pageDetailsMock,
          );

          autofillFieldElement.dispatchEvent(new Event("focus"));
          await flushPromises();

          expect(updateMostRecentlyFocusedFieldSpy).not.toHaveBeenCalled();
        });

        it("triggers a re-collection of page details when the field is focused if a dom change has occurred", async () => {
          await autofillOverlayContentService.setupOverlayListeners(
            autofillFieldElement,
            autofillFieldData,
            pageDetailsMock,
          );
          autofillOverlayContentService.pageDetailsUpdateRequired = true;

          autofillFieldElement.dispatchEvent(new Event("focus"));
          await flushPromises();

          expect(sendExtensionMessageSpy).toHaveBeenCalledWith("bgCollectPageDetails", {
            sender: "autofillOverlayContentService",
          });
        });

        it("closes the inline menu if the focused element is a select element", async () => {
          const selectFieldElement = document.createElement(
            "select",
          ) as ElementWithOpId<HTMLSelectElement>;
          autofillFieldData.type = "select";
          autofillFieldData.autoCompleteType = "cc-type";
          await autofillOverlayContentService.setupOverlayListeners(
            selectFieldElement,
            autofillFieldData,
            pageDetailsMock,
          );

          selectFieldElement.dispatchEvent(new Event("focus"));
          await flushPromises();

          expect(sendExtensionMessageSpy).toHaveBeenCalledWith("closeAutofillInlineMenu", {
            forceCloseInlineMenu: true,
          });
        });

        it("updates the most recently focused field", async () => {
          await autofillOverlayContentService.setupOverlayListeners(
            autofillFieldElement,
            autofillFieldData,
            pageDetailsMock,
          );

          autofillFieldElement.dispatchEvent(new Event("focus"));
          await flushPromises();

          expect(updateMostRecentlyFocusedFieldSpy).toHaveBeenCalledWith(autofillFieldElement);
          expect(autofillOverlayContentService["mostRecentlyFocusedField"]).toEqual(
            autofillFieldElement,
          );
        });

        it("opens the autofill inline menu ", async () => {
          await autofillOverlayContentService.setupOverlayListeners(
            autofillFieldElement,
            autofillFieldData,
            pageDetailsMock,
          );

          autofillFieldElement.dispatchEvent(new Event("focus"));
          await flushPromises();

          expect(sendExtensionMessageSpy).toHaveBeenCalledWith("openAutofillInlineMenu");
        });
      });

      describe("hidden form field focus event", () => {
        it("sets up the inline menu listeners if the autofill field data is in the cache", async () => {
          autofillFieldData.viewable = false;
          await autofillOverlayContentService.setupOverlayListeners(
            autofillFieldElement,
            autofillFieldData,
            pageDetailsMock,
          );

          autofillFieldElement.dispatchEvent(new Event("focus"));
          await flushPromises();

          expect(autofillFieldElement.addEventListener).toHaveBeenCalledWith(
            EVENTS.BLUR,
            expect.any(Function),
          );
          expect(autofillFieldElement.addEventListener).toHaveBeenCalledWith(
            EVENTS.KEYUP,
            expect.any(Function),
          );
          expect(autofillFieldElement.addEventListener).toHaveBeenCalledWith(
            EVENTS.INPUT,
            expect.any(Function),
          );
          expect(autofillFieldElement.addEventListener).toHaveBeenCalledWith(
            EVENTS.CLICK,
            expect.any(Function),
          );
          expect(autofillFieldElement.addEventListener).toHaveBeenCalledWith(
            EVENTS.FOCUS,
            expect.any(Function),
          );
          expect(autofillFieldElement.removeEventListener).toHaveBeenCalled();
        });

        it("skips setting up the inline menu listeners if the autofill field data is not in the cache", async () => {
          autofillFieldData.viewable = false;
          await autofillOverlayContentService.setupOverlayListeners(
            autofillFieldElement,
            autofillFieldData,
            pageDetailsMock,
          );
          autofillOverlayContentService["hiddenFormFieldElements"].delete(autofillFieldElement);

          autofillFieldElement.dispatchEvent(new Event("focus"));

          expect(autofillFieldElement.addEventListener).not.toHaveBeenCalledWith(
            EVENTS.BLUR,
            expect.any(Function),
          );
          expect(autofillFieldElement.addEventListener).not.toHaveBeenCalledWith(
            EVENTS.KEYUP,
            expect.any(Function),
          );
          expect(autofillFieldElement.addEventListener).not.toHaveBeenCalledWith(
            EVENTS.CLICK,
            expect.any(Function),
          );
          expect(autofillFieldElement.removeEventListener).toHaveBeenCalled();
        });
      });

      describe("hidden form field input event", () => {
        it("sets up the inline menu listeners if the autofill field data is in the cache", async () => {
          autofillFieldData.viewable = false;
          await autofillOverlayContentService.setupOverlayListeners(
            autofillFieldElement,
            autofillFieldData,
            pageDetailsMock,
          );

          autofillFieldElement.dispatchEvent(new Event("input"));
          await flushPromises();

          expect(autofillFieldElement.addEventListener).toHaveBeenCalledWith(
            EVENTS.BLUR,
            expect.any(Function),
          );
          expect(autofillFieldElement.addEventListener).toHaveBeenCalledWith(
            EVENTS.KEYUP,
            expect.any(Function),
          );
          expect(autofillFieldElement.addEventListener).toHaveBeenCalledWith(
            EVENTS.INPUT,
            expect.any(Function),
          );
          expect(autofillFieldElement.addEventListener).toHaveBeenCalledWith(
            EVENTS.CLICK,
            expect.any(Function),
          );
          expect(autofillFieldElement.addEventListener).toHaveBeenCalledWith(
            EVENTS.FOCUS,
            expect.any(Function),
          );
          expect(autofillFieldElement.removeEventListener).toHaveBeenCalled();
        });
      });

      describe("setting up the form field listeners on card fields", () => {
        const inputCardFieldData = createAutofillFieldMock({
          opid: "card-field",
          form: "validFormId",
          elementNumber: 3,
          autoCompleteType: "cc-number",
          type: "text",
        });
        const selectCardFieldData = createAutofillFieldMock({
          opid: "card-field",
          form: "validFormId",
          elementNumber: 3,
          autoCompleteType: "cc-type",
          type: "select-one",
        });

        beforeEach(() => {
          pageDetailsMock.fields = [inputCardFieldData, selectCardFieldData];
        });

        it("sets up the input card field listeners", async () => {
          await autofillOverlayContentService.setupOverlayListeners(
            autofillFieldElement,
            inputCardFieldData,
            pageDetailsMock,
          );
          await flushPromises();

          expect(autofillFieldElement.addEventListener).toHaveBeenCalledWith(
            EVENTS.BLUR,
            expect.any(Function),
          );
          expect(autofillFieldElement.addEventListener).toHaveBeenCalledWith(
            EVENTS.KEYUP,
            expect.any(Function),
          );
          expect(autofillFieldElement.addEventListener).toHaveBeenCalledWith(
            EVENTS.INPUT,
            expect.any(Function),
          );
          expect(autofillFieldElement.addEventListener).toHaveBeenCalledWith(
            EVENTS.CLICK,
            expect.any(Function),
          );
          expect(autofillFieldElement.addEventListener).toHaveBeenCalledWith(
            EVENTS.FOCUS,
            expect.any(Function),
          );
          expect(autofillFieldElement.removeEventListener).toHaveBeenCalled();
        });

        it("sets up the input and focus listeners on a select card field", async () => {
          const selectCardFieldElement = document.createElement(
            "select",
          ) as ElementWithOpId<HTMLSelectElement>;
          selectCardFieldElement.opid = "op-2";
          jest.spyOn(selectCardFieldElement, "addEventListener");

          await autofillOverlayContentService.setupOverlayListeners(
            selectCardFieldElement,
            selectCardFieldData,
            pageDetailsMock,
          );

          expect(selectCardFieldElement.addEventListener).toHaveBeenCalledWith(
            EVENTS.FOCUS,
            expect.any(Function),
          );
          expect(selectCardFieldElement.addEventListener).toHaveBeenCalledWith(
            EVENTS.INPUT,
            expect.any(Function),
          );
          expect(selectCardFieldElement.addEventListener).not.toHaveBeenCalledWith(
            EVENTS.KEYUP,
            expect.any(Function),
          );
        });
      });

      describe("setting up the form field listeners on account creation fields", () => {
        const inputAccountFieldData = createAutofillFieldMock({
          opid: "create-account-field",
          form: "validFormId",
          elementNumber: 3,
          autoCompleteType: "username",
          placeholder: "new username",
          type: "email",
          viewable: true,
        });
        const newPasswordFieldData = createAutofillFieldMock({
          opid: "create-account-password-field",
          form: "validFormId",
          elementNumber: 4,
          autoCompleteType: "new-password",
          placeholder: "new password",
          type: "password",
          viewable: true,
        });

        beforeEach(() => {
          pageDetailsMock.fields = [inputAccountFieldData, newPasswordFieldData];
          jest
            .spyOn(inlineMenuFieldQualificationService, "isFieldForLoginForm")
            .mockReturnValue(false);
        });

        it("sets up the field listeners on a username account creation field", async () => {
          await autofillOverlayContentService.setupOverlayListeners(
            autofillFieldElement,
            inputAccountFieldData,
            pageDetailsMock,
          );
          await flushPromises();

          expect(autofillFieldElement.addEventListener).toHaveBeenCalledWith(
            EVENTS.BLUR,
            expect.any(Function),
          );
          expect(autofillFieldElement.addEventListener).toHaveBeenCalledWith(
            EVENTS.KEYUP,
            expect.any(Function),
          );
          expect(autofillFieldElement.addEventListener).toHaveBeenCalledWith(
            EVENTS.INPUT,
            expect.any(Function),
          );
          expect(autofillFieldElement.addEventListener).toHaveBeenCalledWith(
            EVENTS.CLICK,
            expect.any(Function),
          );
          expect(autofillFieldElement.addEventListener).toHaveBeenCalledWith(
            EVENTS.FOCUS,
            expect.any(Function),
          );
          expect(autofillFieldElement.removeEventListener).toHaveBeenCalled();
          expect(inputAccountFieldData.inlineMenuFillType).toEqual(
            InlineMenuFillTypes.AccountCreationUsername,
          );
        });

        it("sets up field a current password field within an update password form", async () => {
          const currentPasswordFieldData = createAutofillFieldMock({
            opid: "current-password-field",
            form: "validFormId",
            elementNumber: 5,
            autoCompleteType: "current-password",
            placeholder: "current password",
            type: "password",
            viewable: true,
          });
          const confirmNewPasswordFieldData = createAutofillFieldMock({
            opid: "confirm-new-password-field",
            form: "validFormId",
            elementNumber: 6,
            autoCompleteType: "new-password",
            placeholder: "confirm new password",
            type: "password",
            viewable: true,
          });
          pageDetailsMock.fields = [
            currentPasswordFieldData,
            newPasswordFieldData,
            confirmNewPasswordFieldData,
          ];

          await autofillOverlayContentService.setupOverlayListeners(
            autofillFieldElement,
            currentPasswordFieldData,
            pageDetailsMock,
          );
          await flushPromises();

          expect(currentPasswordFieldData.inlineMenuFillType).toEqual(
            InlineMenuFillTypes.CurrentPasswordUpdate,
          );
        });
      });
    });

    describe("sets up form submission event listeners", () => {
      describe("listeners set up on a fields with a form", () => {
        let form: HTMLFormElement;

        beforeEach(() => {
          form = document.getElementById("validFormId") as HTMLFormElement;
        });

        it("sends a `formFieldSubmitted` message to the background on submission of the form", async () => {
          await autofillOverlayContentService.setupOverlayListeners(
            autofillFieldElement,
            autofillFieldData,
            pageDetailsMock,
          );
          form.dispatchEvent(new Event("submit"));

          expect(sendExtensionMessageSpy).toHaveBeenCalledWith("formFieldSubmitted", {
            uri: globalThis.document.URL,
            username: "",
            password: "",
            newPassword: "",
          });
        });

        describe("triggering submission through interaction of a generic input element", () => {
          let genericSubmitElement: HTMLInputElement;

          beforeEach(() => {
            genericSubmitElement = document.createElement("input");
            genericSubmitElement.type = "submit";
            genericSubmitElement.value = "Login In";
            form.appendChild(genericSubmitElement);
          });

          it("ignores keyup events triggered on a generic input element if the key is not `Enter` or `Space`", async () => {
            await autofillOverlayContentService.setupOverlayListeners(
              autofillFieldElement,
              autofillFieldData,
              pageDetailsMock,
            );
            genericSubmitElement.dispatchEvent(new KeyboardEvent("keyup", { code: "Tab" }));

            expect(sendExtensionMessageSpy).not.toHaveBeenCalledWith(
              "formFieldSubmitted",
              expect.any(Object),
            );
          });

          it("sends a `formFieldSubmitted` message to the background on interaction of a generic input element", async () => {
            domElementVisibilityService.isElementViewable = jest.fn().mockReturnValue(true);
            await autofillOverlayContentService.setupOverlayListeners(
              autofillFieldElement,
              autofillFieldData,
              pageDetailsMock,
            );
            await flushPromises();
            genericSubmitElement.dispatchEvent(new KeyboardEvent("keyup", { code: "Enter" }));

            expect(sendExtensionMessageSpy).toHaveBeenCalledWith(
              "formFieldSubmitted",
              expect.any(Object),
            );
          });
        });

        describe("triggering submission trough interaction of a button element", () => {
          let buttonElement: HTMLButtonElement;

          beforeEach(() => {
            buttonElement = document.createElement("button");
            buttonElement.textContent = "Login In";
            buttonElement.type = "button";
            form.appendChild(buttonElement);
          });

          it("sends a `formFieldSubmitted` message to the background on interaction of a button element", async () => {
            domElementVisibilityService.isElementViewable = jest.fn().mockReturnValue(true);
            await autofillOverlayContentService.setupOverlayListeners(
              autofillFieldElement,
              autofillFieldData,
              pageDetailsMock,
            );
            await flushPromises();
            buttonElement.dispatchEvent(new KeyboardEvent("keyup", { code: "Enter" }));

            expect(sendExtensionMessageSpy).toHaveBeenCalledWith(
              "formFieldSubmitted",
              expect.any(Object),
            );
          });
        });

        describe("triggering submission through interaction of an anchor element", () => {
          let anchorElement: HTMLAnchorElement;

          beforeEach(() => {
            anchorElement = document.createElement("a");
            anchorElement.textContent = "Login In";
            form.appendChild(anchorElement);
          });

          it("sends a `formFieldSubmitted` message to the background on interaction of an anchor element", async () => {
            domElementVisibilityService.isElementViewable = jest.fn().mockReturnValue(true);
            await autofillOverlayContentService.setupOverlayListeners(
              autofillFieldElement,
              autofillFieldData,
              pageDetailsMock,
            );
            await flushPromises();
            anchorElement.dispatchEvent(new KeyboardEvent("keyup", { code: "Enter" }));

            expect(sendExtensionMessageSpy).toHaveBeenCalledWith(
              "formFieldSubmitted",
              expect.any(Object),
            );
          });
        });
      });

      describe("listeners set up on a fields without a form", () => {
        let autofillFieldElement: ElementWithOpId<FormFieldElement>;
        let autofillFieldData: AutofillField;
        let pageDetailsMock: AutofillPageDetails;

        beforeEach(() => {
          document.body.innerHTML = `
          <div id="form-div">
            <div>
              <input type="password" id="password-field-1" placeholder="new password" />
            </div>
            <div>
              <input type="password" id="password-field-2" placeholder="confirm new password" />
            </div>
            <button id="button-el">Change Password</button>
          </div>
          `;

          autofillFieldElement = document.getElementById(
            "password-field-1",
          ) as ElementWithOpId<FormFieldElement>;
          autofillFieldElement.opid = "op-1";
          jest.spyOn(autofillFieldElement, "addEventListener");
          jest.spyOn(autofillFieldElement, "removeEventListener");
          autofillFieldData = createAutofillFieldMock({
            opid: "new-password-field",
            placeholder: "new password",
            autoCompleteType: "new-password",
            elementNumber: 1,
            form: "",
          });
          const passwordFieldData = createAutofillFieldMock({
            opid: "confirm-new-password-field",
            elementNumber: 2,
            autoCompleteType: "new-password",
            type: "password",
            form: "",
          });
          pageDetailsMock = mock<AutofillPageDetails>({
            forms: {},
            fields: [autofillFieldData, passwordFieldData],
          });
        });

        it("skips triggering submission if a button is not found", async () => {
          const submitButton = document.querySelector("button");
          submitButton.remove();

          await autofillOverlayContentService.setupOverlayListeners(
            autofillFieldElement,
            autofillFieldData,
            pageDetailsMock,
          );
          submitButton.dispatchEvent(new KeyboardEvent("keyup", { code: "Enter" }));

          expect(sendExtensionMessageSpy).not.toHaveBeenCalledWith(
            "formFieldSubmitted",
            expect.any(Object),
          );
        });

        it("triggers submission through interaction of a submit button", async () => {
          domElementVisibilityService.isElementViewable = jest.fn().mockReturnValue(true);
          const submitButton = document.querySelector("button");
          await autofillOverlayContentService.setupOverlayListeners(
            autofillFieldElement,
            autofillFieldData,
            pageDetailsMock,
          );
          await flushPromises();
          submitButton.dispatchEvent(new KeyboardEvent("keyup", { code: "Enter" }));

          expect(sendExtensionMessageSpy).toHaveBeenCalledWith(
            "formFieldSubmitted",
            expect.any(Object),
          );
        });

        it("captures submit buttons when the field is structured within a shadow DOM", async () => {
          domElementVisibilityService.isElementViewable = jest.fn().mockReturnValue(true);
          document.body.innerHTML = `<div id="form-div">
            <div id="shadow-root"></div>
            <button id="button-el">Change Password</button>
          </div>`;
          const shadowRoot = document.getElementById("shadow-root").attachShadow({ mode: "open" });
          shadowRoot.innerHTML = `
            <input type="password" id="password-field-1" placeholder="new password" />
          `;
          autofillFieldElement = shadowRoot.getElementById(
            "password-field-1",
          ) as ElementWithOpId<FormFieldElement>;
          autofillFieldElement.opid = "op-1";
          autofillFieldData = createAutofillFieldMock({
            opid: "new-password-field",
            placeholder: "new password",
            autoCompleteType: "new-password",
            elementNumber: 1,
            form: "",
          });
          pageDetailsMock = mock<AutofillPageDetails>({
            forms: {},
            fields: [autofillFieldData],
          });
          const buttonElement = document.getElementById("button-el");

          await autofillOverlayContentService.setupOverlayListeners(
            autofillFieldElement,
            autofillFieldData,
            pageDetailsMock,
          );
          await flushPromises();
          buttonElement.dispatchEvent(new KeyboardEvent("keyup", { code: "Enter" }));

          expect(sendExtensionMessageSpy).toHaveBeenCalledWith(
            "formFieldSubmitted",
            expect.any(Object),
          );
        });
      });
    });

    it("skips triggering the form field focused handler if the document is not focused", async () => {
      jest.spyOn(globalThis.document, "hasFocus").mockReturnValue(false);
      const documentRoot = autofillFieldElement.getRootNode() as Document;
      Object.defineProperty(documentRoot, "activeElement", {
        value: autofillFieldElement,
        writable: true,
      });

      await autofillOverlayContentService.setupOverlayListeners(
        autofillFieldElement,
        autofillFieldData,
        pageDetailsMock,
      );

      expect(sendExtensionMessageSpy).not.toHaveBeenCalledWith("openAutofillInlineMenu");
    });

    it("triggers the form field focused handler if the current active element in the document is the passed form field", async () => {
      jest.spyOn(globalThis.document, "hasFocus").mockReturnValue(true);
      const documentRoot = autofillFieldElement.getRootNode() as Document;
      Object.defineProperty(documentRoot, "activeElement", {
        value: autofillFieldElement,
        writable: true,
      });

      await autofillOverlayContentService.setupOverlayListeners(
        autofillFieldElement,
        autofillFieldData,
        pageDetailsMock,
      );

      expect(sendExtensionMessageSpy).toHaveBeenCalledWith("openAutofillInlineMenu");
      expect(autofillOverlayContentService["mostRecentlyFocusedField"]).toEqual(
        autofillFieldElement,
      );
    });
  });

  describe("handleOverlayRepositionEvent", () => {
    const repositionEvents = [EVENTS.SCROLL, EVENTS.RESIZE];
    repositionEvents.forEach((repositionEvent) => {
      it(`sends a message trigger overlay reposition message to the background when a ${repositionEvent} event occurs`, async () => {
        Object.defineProperty(globalThis, "scrollY", {
          value: 10,
          writable: true,
        });
        sendExtensionMessageSpy.mockResolvedValueOnce(true);
        globalThis.dispatchEvent(new Event(repositionEvent));
        await flushPromises();

        expect(sendExtensionMessageSpy).toHaveBeenCalledWith("triggerAutofillOverlayReposition");
      });
    });
  });

  describe("handleVisibilityChangeEvent", () => {
    beforeEach(() => {
      autofillOverlayContentService["mostRecentlyFocusedField"] =
        mock<ElementWithOpId<FormFieldElement>>();
    });

    it("skips removing the overlay if the document is visible", () => {
      autofillOverlayContentService["handleVisibilityChangeEvent"]();

      expect(sendExtensionMessageSpy).not.toHaveBeenCalledWith("closeAutofillInlineMenu", {
        forceCloseInlineMenu: true,
      });
    });

    it("removes the overlay if the document is not visible", () => {
      Object.defineProperty(document, "visibilityState", {
        value: "hidden",
        writable: true,
      });

      autofillOverlayContentService["handleVisibilityChangeEvent"]();

      expect(sendExtensionMessageSpy).toHaveBeenCalledWith("closeAutofillInlineMenu", {
        forceCloseInlineMenu: true,
      });
    });
  });

  describe("extension onMessage handlers", () => {
    describe("generatedPasswordModifyLogin", () => {
      it("relays a message regarding password generation to store modified login data", async () => {
        const formFieldData: ModifyLoginCipherFormData = {
          newPassword: "newPassword",
          password: "password",
          uri: "http://localhost/",
          username: "username",
        };

        jest
          .spyOn(autofillOverlayContentService as any, "getFormFieldData")
          .mockResolvedValue(formFieldData);

        sendMockExtensionMessage({
          command: "generatedPasswordModifyLogin",
        });
        await flushPromises();

        const resolvedValue = await sendExtensionMessageSpy.mock.calls[0][1];
        expect(resolvedValue).toEqual(formFieldData);
      });
    });

    describe("addNewVaultItemFromOverlay message handler", () => {
      it("skips sending the message if the overlay list is not visible", async () => {
        jest
          .spyOn(autofillOverlayContentService as any, "isInlineMenuListVisible")
          .mockResolvedValue(false);

        sendMockExtensionMessage({ command: "addNewVaultItemFromOverlay" });
        await flushPromises();

        expect(sendExtensionMessageSpy).not.toHaveBeenCalled();
      });

      it("sends a message that facilitates adding a new vault item with empty fields", async () => {
        jest
          .spyOn(autofillOverlayContentService as any, "isInlineMenuListVisible")
          .mockResolvedValue(true);

        sendMockExtensionMessage({
          command: "addNewVaultItemFromOverlay",
          addNewCipherType: CipherType.Login,
        });
        await flushPromises();

        expect(sendExtensionMessageSpy).toHaveBeenCalledWith("autofillOverlayAddNewVaultItem", {
          addNewCipherType: CipherType.Login,
          login: {
            username: "",
            password: "",
            uri: "http://localhost/",
            hostname: "localhost",
          },
        });
      });

      it("sends a message that facilitates adding a new vault item with data from user filled fields", async () => {
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
        jest
          .spyOn(autofillOverlayContentService as any, "isInlineMenuListVisible")
          .mockResolvedValue(true);
        autofillOverlayContentService["userFilledFields"] = {
          username: usernameField,
          password: passwordField,
        };

        sendMockExtensionMessage({
          command: "addNewVaultItemFromOverlay",
          addNewCipherType: CipherType.Login,
        });
        await flushPromises();

        expect(sendExtensionMessageSpy).toHaveBeenCalledWith("autofillOverlayAddNewVaultItem", {
          addNewCipherType: CipherType.Login,
          login: {
            username: "test-username",
            password: "test-password",
            uri: "http://localhost/",
            hostname: "localhost",
          },
        });
      });

      it("sends a message that facilitates adding a card cipher vault item", async () => {
        jest
          .spyOn(autofillOverlayContentService as any, "isInlineMenuListVisible")
          .mockResolvedValue(true);

        sendMockExtensionMessage({
          command: "addNewVaultItemFromOverlay",
          addNewCipherType: CipherType.Card,
        });
        await flushPromises();

        expect(sendExtensionMessageSpy).toHaveBeenCalledWith("autofillOverlayAddNewVaultItem", {
          addNewCipherType: CipherType.Card,
          card: {
            cardholderName: "",
            cvv: "",
            expirationDate: "",
            expirationMonth: "",
            expirationYear: "",
            number: "",
          },
        });
      });

      it("sends a message that facilitates adding an identity cipher vault item", async () => {
        jest
          .spyOn(autofillOverlayContentService as any, "isInlineMenuListVisible")
          .mockResolvedValue(true);

        sendMockExtensionMessage({
          command: "addNewVaultItemFromOverlay",
          addNewCipherType: CipherType.Identity,
        });
        await flushPromises();

        expect(sendExtensionMessageSpy).toHaveBeenCalledWith("autofillOverlayAddNewVaultItem", {
          addNewCipherType: CipherType.Identity,
          identity: {
            address1: "",
            address2: "",
            address3: "",
            city: "",
            company: "",
            country: "",
            email: "",
            firstName: "",
            fullName: "",
            lastName: "",
            middleName: "",
            phone: "",
            postalCode: "",
            state: "",
            title: "",
            username: "",
          },
        });
      });
    });

    describe("unsetMostRecentlyFocusedField message handler", () => {
      it("will reset the mostRecentlyFocusedField value to a null value", () => {
        autofillOverlayContentService["mostRecentlyFocusedField"] =
          mock<ElementWithOpId<FormFieldElement>>();

        sendMockExtensionMessage({
          command: "unsetMostRecentlyFocusedField",
        });

        expect(autofillOverlayContentService["mostRecentlyFocusedField"]).toBeNull();
      });
    });

    describe("checkIsMostRecentlyFocusedFieldWithinViewport message handler", () => {
      it("updates the bounding rects of the most recently focused field and returns whether the field is within the viewport", async () => {
        autofillOverlayContentService["mostRecentlyFocusedField"] =
          mock<ElementWithOpId<FormFieldElement>>();
        const updateMostRecentlyFocusedFieldSpy = jest
          .spyOn(autofillOverlayContentService as any, "updateMostRecentlyFocusedField")
          .mockImplementation(() => {
            autofillOverlayContentService["focusedFieldData"] = {
              focusedFieldStyles: { paddingRight: "10", paddingLeft: "10" },
              focusedFieldRects: { width: 10, height: 10, top: 10, left: 10 },
              inlineMenuFillType: CipherType.Login,
            };
          });

        sendMockExtensionMessage(
          {
            command: "checkIsMostRecentlyFocusedFieldWithinViewport",
          },
          mock<chrome.runtime.MessageSender>(),
          sendResponseSpy,
        );
        await flushPromises();

        expect(updateMostRecentlyFocusedFieldSpy).toHaveBeenCalled();
        expect(sendResponseSpy).toHaveBeenCalledWith(true);
      });
    });

    describe("focusMostRecentlyFocusedField message handler", () => {
      it("focuses the most recently focused field", async () => {
        autofillOverlayContentService["mostRecentlyFocusedField"] =
          mock<ElementWithOpId<FormFieldElement>>();

        sendMockExtensionMessage({
          command: "focusMostRecentlyFocusedField",
        });
        await flushPromises();

        expect(autofillOverlayContentService["mostRecentlyFocusedField"].focus).toHaveBeenCalled();
      });
    });

    describe("messages that trigger a blur of the most recently focused field", () => {
      const messages = [
        "blurMostRecentlyFocusedField",
        "blurFieldOnPopoutOpen",
        "bgVaultItemRepromptPopoutOpened",
      ];

      messages.forEach((message, index) => {
        const isClosingInlineMenu = index >= 1;
        it(`will blur the most recently focused field${isClosingInlineMenu ? " and close the inline menu" : ""} when a ${message} message is received`, () => {
          autofillOverlayContentService["mostRecentlyFocusedField"] =
            mock<ElementWithOpId<FormFieldElement>>();

          sendMockExtensionMessage({ command: message });

          expect(autofillOverlayContentService["mostRecentlyFocusedField"].blur).toHaveBeenCalled();

          if (isClosingInlineMenu) {
            expect(sendExtensionMessageSpy).toHaveBeenCalledWith("closeAutofillInlineMenu", {
              forceCloseInlineMenu: true,
            });
          }
        });
      });
    });

    describe("redirectAutofillInlineMenuFocusOut message handler", () => {
      let autofillFieldElement: ElementWithOpId<FormFieldElement>;
      let autofillFieldFocusSpy: jest.SpyInstance;
      let findTabsSpy: jest.SpyInstance;
      let previousFocusableElement: HTMLElement;
      let nextFocusableElement: HTMLElement;
      let isInlineMenuListVisibleSpy: jest.SpyInstance;

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
        isInlineMenuListVisibleSpy = jest
          .spyOn(autofillOverlayContentService as any, "isInlineMenuListVisible")
          .mockResolvedValue(true);
        autofillOverlayContentService["mostRecentlyFocusedField"] = autofillFieldElement;
        autofillOverlayContentService["focusableElements"] = [
          previousFocusableElement,
          autofillFieldElement,
          nextFocusableElement,
        ];
      });

      it("skips focusing an element if the overlay is not visible", async () => {
        isInlineMenuListVisibleSpy.mockResolvedValue(false);

        sendMockExtensionMessage({
          command: "redirectAutofillInlineMenuFocusOut",
          data: { direction: RedirectFocusDirection.Next },
        });

        expect(findTabsSpy).not.toHaveBeenCalled();
      });

      it("skips focusing an element if no recently focused field exists", async () => {
        autofillOverlayContentService["mostRecentlyFocusedField"] = undefined;

        sendMockExtensionMessage({
          command: "redirectAutofillInlineMenuFocusOut",
          data: { direction: RedirectFocusDirection.Next },
        });

        expect(findTabsSpy).not.toHaveBeenCalled();
      });

      it("focuses the most recently focused field if the focus direction is `Current`", async () => {
        sendMockExtensionMessage({
          command: "redirectAutofillInlineMenuFocusOut",
          data: { direction: RedirectFocusDirection.Current },
        });
        await flushPromises();

        expect(findTabsSpy).not.toHaveBeenCalled();
        expect(autofillFieldFocusSpy).toHaveBeenCalled();
      });

      it("removes the overlay if the focus direction is `Current`", async () => {
        jest.useFakeTimers();
        sendMockExtensionMessage({
          command: "redirectAutofillInlineMenuFocusOut",
          data: { direction: RedirectFocusDirection.Current },
        });
        await flushPromises();
        jest.advanceTimersByTime(150);

        expect(sendExtensionMessageSpy).toHaveBeenCalledWith("closeAutofillInlineMenu");
      });

      it("finds all focusable tabs if the focusable elements array is not populated", async () => {
        autofillOverlayContentService["focusableElements"] = [];
        findTabsSpy.mockReturnValue([
          previousFocusableElement,
          autofillFieldElement,
          nextFocusableElement,
        ]);

        sendMockExtensionMessage({
          command: "redirectAutofillInlineMenuFocusOut",
          data: { direction: RedirectFocusDirection.Next },
        });
        await flushPromises();

        expect(findTabsSpy).toHaveBeenCalledWith(globalThis.document.body, { getShadowRoot: true });
      });

      it("focuses the previous focusable element if the focus direction is `Previous`", async () => {
        jest.spyOn(previousFocusableElement, "focus");

        sendMockExtensionMessage({
          command: "redirectAutofillInlineMenuFocusOut",
          data: { direction: RedirectFocusDirection.Previous },
        });
        await flushPromises();

        expect(autofillFieldFocusSpy).not.toHaveBeenCalled();
        expect(previousFocusableElement.focus).toHaveBeenCalled();
      });

      it("focuses the next focusable element if the focus direction is `Next`", async () => {
        jest.spyOn(nextFocusableElement, "focus");

        sendMockExtensionMessage({
          command: "redirectAutofillInlineMenuFocusOut",
          data: { direction: RedirectFocusDirection.Next },
        });
        await flushPromises();

        expect(autofillFieldFocusSpy).not.toHaveBeenCalled();
        expect(nextFocusableElement.focus).toHaveBeenCalled();
      });

      it("focuses the most recently focused input field if no other tabbable elements are found", async () => {
        autofillOverlayContentService["focusableElements"] = [];
        findTabsSpy.mockReturnValue([]);

        sendMockExtensionMessage({
          command: "redirectAutofillInlineMenuFocusOut",
          data: { direction: RedirectFocusDirection.Next },
        });
        await flushPromises();

        expect(autofillFieldFocusSpy).toHaveBeenCalled();
      });
    });

    describe("getSubFrameOffsets message handler", () => {
      const iframeSource = "https://example.com/";
      const originalLocation = globalThis.location;

      beforeEach(() => {
        globalThis.location = originalLocation;
        document.body.innerHTML = `<iframe id="subframe" src="${iframeSource}"></iframe>`;
      });

      it("returns null if the sub frame URL cannot be parsed correctly", async () => {
        delete globalThis.location;
        globalThis.location = { href: "invalid-base" } as Location;
        sendMockExtensionMessage(
          {
            command: "getSubFrameOffsets",
            subFrameUrl: iframeSource,
          },
          mock<chrome.runtime.MessageSender>(),
          sendResponseSpy,
        );
        await flushPromises();

        expect(sendResponseSpy).toHaveBeenCalledWith(null);
      });

      it("calculates the sub frame's offsets if a single frame with the referenced url exists", async () => {
        sendMockExtensionMessage(
          {
            command: "getSubFrameOffsets",
            subFrameUrl: iframeSource,
          },
          mock<chrome.runtime.MessageSender>(),
          sendResponseSpy,
        );
        await flushPromises();

        expect(sendResponseSpy).toHaveBeenCalledWith({
          frameId: undefined,
          left: 2,
          top: 2,
          url: iframeSource,
        });
      });

      it("returns null if a matching iframe is not found", async () => {
        document.body.innerHTML = "<iframe src='https://some-other-source.com/'></iframe>";
        sendMockExtensionMessage(
          {
            command: "getSubFrameOffsets",
            subFrameUrl: iframeSource,
          },
          mock<chrome.runtime.MessageSender>(),
          sendResponseSpy,
        );
        await flushPromises();

        expect(sendResponseSpy).toHaveBeenCalledWith(null);
      });

      it("returns null if two or more iframes are found with the same src", async () => {
        document.body.innerHTML = `
        <iframe src="${iframeSource}"></iframe>
        <iframe src="${iframeSource}"></iframe>
        `;

        sendMockExtensionMessage(
          {
            command: "getSubFrameOffsets",
            subFrameUrl: iframeSource,
          },
          mock<chrome.runtime.MessageSender>(),
          sendResponseSpy,
        );
        await flushPromises();

        expect(sendResponseSpy).toHaveBeenCalledWith(null);
      });
    });

    describe("getSubFrameOffsetsFromWindowMessage", () => {
      it("sends a message to the parent to calculate the sub frame positioning", () => {
        jest.spyOn(globalThis.parent, "postMessage").mockImplementation();
        const subFrameId = 10;

        sendMockExtensionMessage({
          command: "getSubFrameOffsetsFromWindowMessage",
          subFrameId,
        });

        expect(globalThis.parent.postMessage).toHaveBeenCalledWith(
          {
            command: "calculateSubFramePositioning",
            subFrameData: {
              url: window.location.href,
              frameId: subFrameId,
              left: 0,
              top: 0,
              parentFrameIds: [0],
              subFrameDepth: 0,
            },
          },
          "*",
        );
      });

      describe("calculateSubFramePositioning", () => {
        beforeEach(() => {
          autofillOverlayContentService.init();
          jest.spyOn(globalThis.parent, "postMessage");
          document.body.innerHTML = ``;
        });

        it("destroys the inline menu listeners on the origin frame if the depth exceeds the threshold", async () => {
          document.body.innerHTML = `<iframe id="subframe" src="https://example.com/"></iframe>`;
          const iframe = document.querySelector("iframe") as HTMLIFrameElement;
          const subFrameData = {
            url: "https://example.com/",
            frameId: 10,
            left: 0,
            top: 0,
            parentFrameIds: [1, 2, 3],
            subFrameDepth: MAX_SUB_FRAME_DEPTH,
          };
          sendExtensionMessageSpy.mockResolvedValue(4);

          postWindowMessage(
            { command: "calculateSubFramePositioning", subFrameData },
            "*",
            iframe.contentWindow as any,
          );
          await flushPromises();

          expect(globalThis.parent.postMessage).not.toHaveBeenCalled();
        });

        it("calculates the sub frame offset for the current frame and sends those values to the parent if not in the top frame", async () => {
          Object.defineProperty(window, "top", {
            value: null,
            writable: true,
          });
          document.body.innerHTML = `<iframe id="subframe" src="https://example.com/"></iframe>`;
          const iframe = document.querySelector("iframe") as HTMLIFrameElement;
          const subFrameData = {
            url: "https://example.com/",
            frameId: 10,
            left: 0,
            top: 0,
            parentFrameIds: [1, 2, 3],
            subFrameDepth: 0,
          };

          postWindowMessage(
            { command: "calculateSubFramePositioning", subFrameData },
            "*",
            iframe.contentWindow as any,
          );
          await flushPromises();

          expect(globalThis.parent.postMessage).toHaveBeenCalledWith(
            {
              command: "calculateSubFramePositioning",
              subFrameData: {
                frameId: 10,
                left: expect.any(Number),
                parentFrameIds: [1, 2, 3],
                top: expect.any(Number),
                url: "https://example.com/",
                subFrameDepth: expect.any(Number),
              },
            },
            "*",
          );
        });

        it("posts the calculated sub frame data to the background", async () => {
          document.body.innerHTML = `<iframe id="subframe" src="https://example.com/"></iframe>`;
          const iframe = document.querySelector("iframe") as HTMLIFrameElement;
          const subFrameData = {
            url: "https://example.com/",
            frameId: 10,
            left: 0,
            top: 0,
            parentFrameIds: [1, 2, 3],
            subFrameDepth: expect.any(Number),
          };

          postWindowMessage(
            { command: "calculateSubFramePositioning", subFrameData },
            "*",
            iframe.contentWindow as any,
          );
          await flushPromises();

          expect(sendExtensionMessageSpy).toHaveBeenCalledWith("updateSubFrameData", {
            subFrameData: {
              frameId: 10,
              left: expect.any(Number),
              top: expect.any(Number),
              url: "https://example.com/",
              parentFrameIds: [1, 2, 3, 4],
              subFrameDepth: expect.any(Number),
            },
          });
        });
      });
    });

    describe("checkMostRecentlyFocusedFieldHasValue message handler", () => {
      it("returns true if the most recently focused field has a truthy value", async () => {
        autofillOverlayContentService["mostRecentlyFocusedField"] = mock<
          ElementWithOpId<FormFieldElement>
        >({ value: "test" });

        sendMockExtensionMessage(
          {
            command: "checkMostRecentlyFocusedFieldHasValue",
          },
          mock<chrome.runtime.MessageSender>(),
          sendResponseSpy,
        );
        await flushPromises();

        expect(sendResponseSpy).toHaveBeenCalledWith(true);
      });
    });

    describe("setupRebuildSubFrameOffsetsListeners message handler", () => {
      let autofillFieldElement: ElementWithOpId<FormFieldElement>;

      beforeEach(() => {
        Object.defineProperty(window, "top", {
          value: null,
          writable: true,
        });
        jest.spyOn(globalThis, "addEventListener");
        jest.spyOn(globalThis.document.body, "addEventListener");
        document.body.innerHTML = `
      <form id="validFormId">
        <input type="text" id="username-field" placeholder="username" />
        <input type="password" id="password-field" placeholder="password" />
      </form>
      `;
        autofillFieldElement = document.getElementById(
          "username-field",
        ) as ElementWithOpId<FormFieldElement>;
      });

      describe("skipping the setup of the sub frame listeners", () => {
        it('skips setup when the window is the "top" frame', async () => {
          Object.defineProperty(window, "top", {
            value: window,
            writable: true,
          });

          sendMockExtensionMessage({ command: "setupRebuildSubFrameOffsetsListeners" });
          await flushPromises();

          expect(globalThis.addEventListener).not.toHaveBeenCalledWith(
            EVENTS.FOCUS,
            expect.any(Function),
          );
          expect(globalThis.document.body.addEventListener).not.toHaveBeenCalledWith(
            EVENTS.MOUSEENTER,
            expect.any(Function),
          );
        });

        it("skips setup when no form fields exist on the current frame", async () => {
          autofillOverlayContentService["formFieldElements"] = new Map();

          sendMockExtensionMessage({ command: "setupRebuildSubFrameOffsetsListeners" });
          await flushPromises();

          expect(globalThis.addEventListener).not.toHaveBeenCalledWith(
            EVENTS.FOCUS,
            expect.any(Function),
          );
          expect(globalThis.document.body.addEventListener).not.toHaveBeenCalledWith(
            EVENTS.MOUSEENTER,
            expect.any(Function),
          );
        });
      });

      it("sets up the sub frame rebuild listeners when the sub frame contains fields", async () => {
        autofillOverlayContentService["formFieldElements"].set(
          autofillFieldElement,
          createAutofillFieldMock(),
        );

        sendMockExtensionMessage({ command: "setupRebuildSubFrameOffsetsListeners" });
        await flushPromises();

        expect(globalThis.addEventListener).toHaveBeenCalledWith(
          EVENTS.FOCUS,
          expect.any(Function),
        );
        expect(globalThis.document.body.addEventListener).toHaveBeenCalledWith(
          EVENTS.MOUSEENTER,
          expect.any(Function),
        );
      });

      describe("triggering the sub frame listener", () => {
        beforeEach(async () => {
          autofillOverlayContentService["formFieldElements"].set(
            autofillFieldElement,
            createAutofillFieldMock(),
          );
          await sendMockExtensionMessage({ command: "setupRebuildSubFrameOffsetsListeners" });
        });

        it("triggers a rebuild of the sub frame listener when a focus event occurs", async () => {
          globalThis.dispatchEvent(new Event(EVENTS.FOCUS));
          await flushPromises();

          expect(sendExtensionMessageSpy).toHaveBeenCalledWith("triggerSubFrameFocusInRebuild");
        });
      });
    });

    describe("destroyAutofillInlineMenuListeners message handler", () => {
      it("destroys the inline menu listeners", () => {
        jest.spyOn(autofillOverlayContentService, "destroy");

        sendMockExtensionMessage({ command: "destroyAutofillInlineMenuListeners" });

        expect(autofillOverlayContentService.destroy).toHaveBeenCalled();
      });
    });

    describe("getInlineMenuFormFieldData message handler", () => {
      it("returns early if a field is currently focused", async () => {
        jest
          .spyOn(autofillOverlayContentService as any, "isFieldCurrentlyFocused")
          .mockReturnValue(true);

        sendMockExtensionMessage(
          { command: "getInlineMenuFormFieldData" },
          mock<chrome.runtime.MessageSender>(),
          sendResponseSpy,
        );
        await flushPromises();

        expect(sendResponseSpy).toHaveBeenCalledWith(undefined);
      });

      it("returns the form field data for a notification", async () => {
        sendMockExtensionMessage(
          { command: "getInlineMenuFormFieldData" },
          mock<chrome.runtime.MessageSender>(),
          sendResponseSpy,
        );
        await flushPromises();

        expect(sendResponseSpy).toHaveBeenCalledWith({
          uri: globalThis.document.URL,
          username: "",
          password: "",
          newPassword: "",
        });
      });
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
        autoCompleteType: "current-password",
        type: "password",
      });
      pageDetailsMock = mock<AutofillPageDetails>({
        forms: { validFormId: mock<AutofillForm>() },
        fields: [autofillFieldData, passwordFieldData],
      });
      void autofillOverlayContentService.setupOverlayListeners(
        autofillFieldElement,
        autofillFieldData,
        pageDetailsMock,
      );
      autofillOverlayContentService["mostRecentlyFocusedField"] = autofillFieldElement;
      jest.spyOn(globalThis, "clearTimeout");
      jest.spyOn(globalThis.document, "removeEventListener");
      jest.spyOn(globalThis, "removeEventListener");
    });

    it("de-registers all global event listeners", () => {
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

    it("clears all existing timeouts", () => {
      autofillOverlayContentService["focusInlineMenuListTimeout"] = setTimeout(jest.fn(), 100);
      autofillOverlayContentService["closeInlineMenuOnRedirectTimeout"] = setTimeout(
        jest.fn(),
        100,
      );

      autofillOverlayContentService.destroy();

      expect(clearTimeout).toHaveBeenCalledWith(
        autofillOverlayContentService["focusInlineMenuListTimeout"],
      );
      expect(clearTimeout).toHaveBeenCalledWith(
        autofillOverlayContentService["closeInlineMenuOnRedirectTimeout"],
      );
    });

    it("deletes all cached user filled field DOM elements", () => {
      autofillOverlayContentService["userFilledFields"] = {
        username: autofillFieldElement as FillableFormFieldElement,
      };

      autofillOverlayContentService.destroy();

      expect(autofillOverlayContentService["userFilledFields"]).toEqual(null);
    });
  });
});
