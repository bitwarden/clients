import { mock } from "jest-mock-extended";

import AutofillField from "../models/autofill-field";
import AutofillForm from "../models/autofill-form";
import { createAutofillFieldMock, createAutofillFormMock } from "../spec/autofill-mocks";
import { mockQuerySelectorAllDefinedCall } from "../spec/testing-utils";
import {
  ElementWithOpId,
  FillableFormFieldElement,
  FormFieldElement,
  FormElementWithAttribute,
} from "../types";

import { InlineMenuFieldQualificationService } from "./abstractions/inline-menu-field-qualifications.service";
import { AutofillOverlayContentService } from "./autofill-overlay-content.service";
import { CollectAutofillContentService } from "./collect-autofill-content.service";
import DomElementVisibilityService from "./dom-element-visibility.service";
import { DomQueryService } from "./dom-query.service";

jest.mock("../utils", () => {
  const utils = jest.requireActual("../utils");
  return {
    ...utils,
    debounce: jest.fn((fn) => fn),
  };
});

const mockLoginForm = `
  <div id="root">
    <form>
      <input type="text" id="username" />
      <input type="password" />
    </form>
  </div>
`;

const waitForIdleCallback = () => new Promise((resolve) => globalThis.requestIdleCallback(resolve));

describe("CollectAutofillContentService", () => {
  const mockQuerySelectorAll = mockQuerySelectorAllDefinedCall();
  const domElementVisibilityService = new DomElementVisibilityService();
  const inlineMenuFieldQualificationService = mock<InlineMenuFieldQualificationService>();
  const domQueryService = new DomQueryService();
  const autofillOverlayContentService = new AutofillOverlayContentService(
    domQueryService,
    domElementVisibilityService,
    inlineMenuFieldQualificationService,
  );
  let collectAutofillContentService: CollectAutofillContentService;
  const mockIntersectionObserver = mock<IntersectionObserver>();

  beforeEach(() => {
    globalThis.requestIdleCallback = jest.fn((cb, options) => setTimeout(cb, 100));
    globalThis.cancelIdleCallback = jest.fn((id) => clearTimeout(id));
    document.body.innerHTML = mockLoginForm;
    collectAutofillContentService = new CollectAutofillContentService(
      domElementVisibilityService,
      domQueryService,
      autofillOverlayContentService,
    );
    window.IntersectionObserver = jest.fn(() => mockIntersectionObserver);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    jest.clearAllTimers();
    document.body.innerHTML = "";
  });

  afterAll(() => {
    mockQuerySelectorAll.mockRestore();
  });

  describe("getPageDetails", () => {
    beforeEach(() => {
      jest
        .spyOn(collectAutofillContentService as any, "setupMutationObserver")
        .mockImplementationOnce(() => {
          collectAutofillContentService["mutationObserver"] = mock<MutationObserver>();
        });
    });

    it("sets up the mutation observer the first time getPageDetails is called", async () => {
      await collectAutofillContentService.getPageDetails();
      await collectAutofillContentService.getPageDetails();

      expect(collectAutofillContentService["setupMutationObserver"]).toHaveBeenCalledTimes(1);
    });

    it("returns an object with empty forms and fields if no fields were found on a previous iteration", async () => {
      collectAutofillContentService["domRecentlyMutated"] = false;
      collectAutofillContentService["noFieldsFound"] = true;
      jest.spyOn(collectAutofillContentService as any, "getFormattedPageDetails");
      jest.spyOn(collectAutofillContentService as any, "queryAutofillFormAndFieldElements");
      jest.spyOn(collectAutofillContentService as any, "buildAutofillFormsData");
      jest.spyOn(collectAutofillContentService as any, "buildAutofillFieldsData");

      await collectAutofillContentService.getPageDetails();

      expect(collectAutofillContentService["getFormattedPageDetails"]).toHaveBeenCalledWith({}, []);
      expect(
        collectAutofillContentService["queryAutofillFormAndFieldElements"],
      ).not.toHaveBeenCalled();
      expect(collectAutofillContentService["buildAutofillFormsData"]).not.toHaveBeenCalled();
      expect(collectAutofillContentService["buildAutofillFieldsData"]).not.toHaveBeenCalled();
    });

    it("returns an object with cached form and field data values", async () => {
      const formId = "validFormId";
      const formAction = "https://example.com/";
      const formMethod = "post";
      const formName = "validFormName";
      const usernameFieldId = "usernameField";
      const usernameFieldName = "username";
      const usernameFieldLabel = "User Name";
      const passwordFieldId = "passwordField";
      const passwordFieldName = "password";
      const passwordFieldLabel = "Password";
      document.body.innerHTML = `
        <form id="${formId}" action="${formAction}" method="${formMethod}" name="${formName}">
            <label for="${usernameFieldId}">${usernameFieldLabel}</label>
            <input type="text" id="${usernameFieldId}" name="${usernameFieldName}" />
            <label for="${passwordFieldId}">${passwordFieldLabel}</label>
            <input type="password" id="${passwordFieldId}" name="${passwordFieldName}" />
        </form>
      `;
      const formElement = document.getElementById(formId) as ElementWithOpId<HTMLFormElement>;
      const autofillForm: AutofillForm = {
        opid: "__form__0",
        htmlAction: formAction,
        htmlName: formName,
        htmlID: formId,
        htmlMethod: formMethod,
      };
      const fieldElement = document.getElementById(
        usernameFieldId,
      ) as ElementWithOpId<FormFieldElement>;
      const autofillField: AutofillField = {
        opid: "__0",
        elementNumber: 0,
        maxLength: 999,
        viewable: true,
        htmlID: usernameFieldId,
        htmlName: usernameFieldName,
        htmlClass: null,
        tabindex: null,
        title: "",
        tagName: "input",
        "label-tag": usernameFieldLabel,
        "label-data": null,
        "label-aria": null,
        "label-top": null,
        "label-right": passwordFieldLabel,
        "label-left": usernameFieldLabel,
        placeholder: "",
        rel: null,
        type: "text",
        value: "",
        checked: false,
        autoCompleteType: "",
        disabled: false,
        readonly: false,
        selectInfo: null,
        form: "__form__0",
        "aria-hidden": false,
        "aria-disabled": false,
        "aria-haspopup": false,
        "data-stripe": null,
      };
      collectAutofillContentService["domRecentlyMutated"] = false;
      collectAutofillContentService["_autofillFormElements"] = new Map([
        [formElement, autofillForm],
      ]);
      collectAutofillContentService["autofillFieldElements"] = new Map([
        [fieldElement, autofillField],
      ]);
      jest.spyOn(collectAutofillContentService as any, "getFormattedPageDetails");
      jest.spyOn(collectAutofillContentService as any, "getFormattedAutofillFormsData");
      jest.spyOn(collectAutofillContentService as any, "getFormattedAutofillFieldsData");
      jest.spyOn(collectAutofillContentService as any, "queryAutofillFormAndFieldElements");
      jest.spyOn(collectAutofillContentService as any, "buildAutofillFormsData");
      jest.spyOn(collectAutofillContentService as any, "buildAutofillFieldsData");

      await collectAutofillContentService.getPageDetails();

      expect(collectAutofillContentService["getFormattedPageDetails"]).toHaveBeenCalled();
      expect(collectAutofillContentService["getFormattedAutofillFormsData"]).toHaveBeenCalled();
      expect(collectAutofillContentService["getFormattedAutofillFieldsData"]).toHaveBeenCalled();
      expect(
        collectAutofillContentService["queryAutofillFormAndFieldElements"],
      ).not.toHaveBeenCalled();
      expect(collectAutofillContentService["buildAutofillFormsData"]).not.toHaveBeenCalled();
      expect(collectAutofillContentService["buildAutofillFieldsData"]).not.toHaveBeenCalled();
    });

    it("updates the visibility for cached autofill fields", async () => {
      const formId = "validFormId";
      const formAction = "https://example.com/";
      const formMethod = "post";
      const formName = "validFormName";
      const usernameFieldId = "usernameField";
      const usernameFieldName = "username";
      const usernameFieldLabel = "User Name";
      const passwordFieldId = "passwordField";
      const passwordFieldName = "password";
      const passwordFieldLabel = "Password";
      document.body.innerHTML = `
        <form id="${formId}" action="${formAction}" method="${formMethod}" name="${formName}">
            <label for="${usernameFieldId}">${usernameFieldLabel}</label>
            <input type="text" id="${usernameFieldId}" name="${usernameFieldName}" />
            <label for="${passwordFieldId}">${passwordFieldLabel}</label>
            <input type="password" id="${passwordFieldId}" name="${passwordFieldName}" />
        </form>
      `;
      const formElement = document.getElementById(formId) as ElementWithOpId<HTMLFormElement>;
      const autofillForm: AutofillForm = {
        opid: "__form__0",
        htmlAction: formAction,
        htmlName: formName,
        htmlID: formId,
        htmlMethod: formMethod,
      };
      const fieldElement = document.getElementById(
        usernameFieldId,
      ) as ElementWithOpId<FormFieldElement>;
      const autofillField: AutofillField = {
        opid: "__0",
        elementNumber: 0,
        maxLength: 999,
        viewable: false,
        htmlID: usernameFieldId,
        htmlName: usernameFieldName,
        htmlClass: null,
        tabindex: null,
        title: "",
        tagName: "input",
        "label-tag": usernameFieldLabel,
        "label-data": null,
        "label-aria": null,
        "label-top": null,
        "label-right": passwordFieldLabel,
        "label-left": usernameFieldLabel,
        placeholder: "",
        rel: null,
        type: "text",
        value: "",
        checked: false,
        autoCompleteType: "",
        disabled: false,
        readonly: false,
        selectInfo: null,
        form: "__form__0",
        "aria-hidden": false,
        "aria-disabled": false,
        "aria-haspopup": false,
        "data-stripe": null,
      };
      collectAutofillContentService["domRecentlyMutated"] = false;
      collectAutofillContentService["_autofillFormElements"] = new Map([
        [formElement, autofillForm],
      ]);
      collectAutofillContentService["autofillFieldElements"] = new Map([
        [fieldElement, autofillField],
      ]);
      const isElementViewableSpy = jest
        .spyOn(collectAutofillContentService["domElementVisibilityService"], "isElementViewable")
        .mockResolvedValue(true);
      const setupAutofillOverlayListenerOnFieldSpy = jest.spyOn(
        collectAutofillContentService["autofillOverlayContentService"],
        "setupOverlayListeners",
      );

      await collectAutofillContentService.getPageDetails();

      expect(autofillField.viewable).toBe(true);
      expect(isElementViewableSpy).toHaveBeenCalledWith(fieldElement);
      expect(setupAutofillOverlayListenerOnFieldSpy).toHaveBeenCalled();
    });

    it("returns an object containing information about the current page as well as autofill data for the forms and fields of the page", async () => {
      const documentTitle = "Test Page";
      const formId = "validFormId";
      const formAction = "https://example.com/";
      const formMethod = "post";
      const formName = "validFormName";
      const usernameFieldId = "usernameField";
      const usernameFieldName = "username";
      const usernameFieldLabel = "User Name";
      const passwordFieldId = "passwordField";
      const passwordFieldName = "password";
      const passwordFieldLabel = "Password";
      document.title = documentTitle;
      document.body.innerHTML = `
        <form id="${formId}" action="${formAction}" method="${formMethod}" name="${formName}">
            <label for="${usernameFieldId}">${usernameFieldLabel}</label>
            <input type="text" id="${usernameFieldId}" name="${usernameFieldName}" />
            <label for="${passwordFieldId}">${passwordFieldLabel}</label>
            <input type="password" id="${passwordFieldId}" name="${passwordFieldName}" />
        </form>
      `;
      jest.spyOn(collectAutofillContentService as any, "buildAutofillFormsData");
      jest.spyOn(collectAutofillContentService as any, "buildAutofillFieldsData");
      jest
        .spyOn(collectAutofillContentService["domElementVisibilityService"], "isElementViewable")
        .mockResolvedValue(true);

      const pageDetails = await collectAutofillContentService.getPageDetails();

      expect(collectAutofillContentService["buildAutofillFormsData"]).toHaveBeenCalled();
      expect(collectAutofillContentService["buildAutofillFieldsData"]).toHaveBeenCalled();
      expect(pageDetails).toStrictEqual({
        title: documentTitle,
        url: window.location.href,
        documentUrl: document.location.href,
        forms: {
          __form__0: {
            opid: "__form__0",
            htmlAction: formAction,
            htmlClass: null,
            htmlName: formName,
            htmlID: formId,
            htmlMethod: formMethod,
          },
        },
        fields: [
          {
            opid: "__0",
            elementNumber: 0,
            maxLength: 999,
            viewable: true,
            htmlID: usernameFieldId,
            htmlName: usernameFieldName,
            htmlClass: null,
            tabindex: null,
            title: "",
            tagName: "input",
            "label-tag": usernameFieldLabel,
            "label-data": null,
            "label-aria": null,
            "label-top": null,
            "label-right": passwordFieldLabel,
            "label-left": usernameFieldLabel,
            placeholder: "",
            rel: null,
            type: "text",
            value: "",
            checked: false,
            autoCompleteType: "",
            disabled: false,
            readonly: false,
            selectInfo: null,
            form: "__form__0",
            "aria-hidden": false,
            "aria-disabled": false,
            "aria-haspopup": false,
            "data-stripe": null,
            dataSetValues: "",
          },
          {
            opid: "__1",
            elementNumber: 1,
            maxLength: 999,
            viewable: true,
            htmlID: passwordFieldId,
            htmlName: passwordFieldName,
            htmlClass: null,
            tabindex: null,
            title: "",
            tagName: "input",
            "label-tag": passwordFieldLabel,
            "label-data": null,
            "label-aria": null,
            "label-top": null,
            "label-right": "",
            "label-left": passwordFieldLabel,
            placeholder: "",
            rel: null,
            type: "password",
            value: "",
            checked: false,
            autoCompleteType: "",
            disabled: false,
            readonly: false,
            selectInfo: null,
            form: "__form__0",
            "aria-hidden": false,
            "aria-disabled": false,
            "aria-haspopup": false,
            "data-stripe": null,
            dataSetValues: "",
          },
        ],
        collectedTimestamp: expect.any(Number),
      });
    });

    it("sets the noFieldsFound property to true if the page has no forms or fields", async function () {
      document.body.innerHTML = "";
      collectAutofillContentService["noFieldsFound"] = false;
      jest.spyOn(collectAutofillContentService as any, "buildAutofillFormsData");
      jest.spyOn(collectAutofillContentService as any, "buildAutofillFieldsData");

      await collectAutofillContentService.getPageDetails();

      expect(collectAutofillContentService["buildAutofillFormsData"]).toHaveBeenCalled();
      expect(collectAutofillContentService["buildAutofillFieldsData"]).toHaveBeenCalled();
      expect(collectAutofillContentService["noFieldsFound"]).toBe(true);
    });
  });

  describe("getAutofillFieldElementByOpid", () => {
    it("returns the element with the opid property value matching the passed value", () => {
      const textInput = document.querySelector('input[type="text"]') as FormElementWithAttribute;
      const passwordInput = document.querySelector(
        'input[type="password"]',
      ) as FormElementWithAttribute;
      textInput.opid = "__0";
      passwordInput.opid = "__1";

      const textInputWithOpid = collectAutofillContentService.getAutofillFieldElementByOpid("__0");
      const passwordInputWithOpid =
        collectAutofillContentService.getAutofillFieldElementByOpid("__1");

      expect(textInputWithOpid).toEqual(textInput);
      expect(textInputWithOpid).not.toEqual(passwordInput);
      expect(passwordInputWithOpid).toEqual(passwordInput);
    });

    it("returns the first of the element with an `opid` value matching the passed value and emits a console warning if multiple fields contain the same `opid`", () => {
      const textInput = document.querySelector('input[type="text"]') as FormElementWithAttribute;
      const passwordInput = document.querySelector(
        'input[type="password"]',
      ) as FormElementWithAttribute;
      jest.spyOn(console, "warn").mockImplementationOnce(jest.fn());
      textInput.opid = "__1";
      passwordInput.opid = "__1";

      const elementWithOpid0 = collectAutofillContentService.getAutofillFieldElementByOpid("__0");
      const elementWithOpid1 = collectAutofillContentService.getAutofillFieldElementByOpid("__1");

      expect(elementWithOpid0).toEqual(textInput);
      expect(elementWithOpid1).toEqual(textInput);
      expect(elementWithOpid1).not.toEqual(passwordInput);
      // eslint-disable-next-line no-console
      expect(console.warn).toHaveBeenCalledWith("More than one element found with opid __1");
    });

    it("returns the element at the index position (parsed from passed opid) of all AutofillField elements when the passed opid value cannot be found", () => {
      const textInput = document.querySelector('input[type="text"]') as FormElementWithAttribute;
      const passwordInput = document.querySelector(
        'input[type="password"]',
      ) as FormElementWithAttribute;
      textInput.opid = undefined;
      passwordInput.opid = "__1";

      const elementWithOpid0 = collectAutofillContentService.getAutofillFieldElementByOpid("__0");
      const elementWithOpid2 = collectAutofillContentService.getAutofillFieldElementByOpid("__2");

      expect(textInput.opid).toBeUndefined();
      expect(elementWithOpid0).toEqual(textInput);
      expect(elementWithOpid0).not.toEqual(passwordInput);
      expect(elementWithOpid2).toBeNull();
    });

    it("returns null if no element can be found", () => {
      const textInput = document.querySelector('input[type="text"]') as FormElementWithAttribute;
      textInput.opid = "__0";

      const foundElementWithOpid =
        collectAutofillContentService.getAutofillFieldElementByOpid("__999");

      expect(foundElementWithOpid).toBeNull();
    });
  });

  describe("buildAutofillFormsData", () => {
    it("will not attempt to gather data from a cached form element", () => {
      const documentTitle = "Test Page";
      const formId = "validFormId";
      const formAction = "https://example.com/";
      const formMethod = "post";
      const formName = "validFormName";
      document.title = documentTitle;
      document.body.innerHTML = `
        <form id="${formId}" action="${formAction}" method="${formMethod}" name="${formName}">
            <label for="usernameFieldId">usernameFieldLabel</label>
            <input type="text" id="usernameFieldId" name="usernameFieldName" />
            <label for="passwordFieldId">passwordFieldLabel</label>
            <input type="password" id="passwordFieldId" name="passwordFieldName" />
        </form>

      `;
      const formElement = document.getElementById(formId) as ElementWithOpId<HTMLFormElement>;
      const existingAutofillForm: AutofillForm = {
        opid: "__form__0",
        htmlAction: formAction,
        htmlName: formName,
        htmlID: formId,
        htmlMethod: formMethod,
      };
      collectAutofillContentService["_autofillFormElements"] = new Map([
        [formElement, existingAutofillForm],
      ]);
      const formElements = Array.from(document.querySelectorAll("form"));
      jest.spyOn(collectAutofillContentService as any, "getFormActionAttribute");

      const autofillFormsData = collectAutofillContentService["buildAutofillFormsData"](
        formElements as Node[],
      );

      expect(collectAutofillContentService["getFormActionAttribute"]).not.toHaveBeenCalled();
      expect(autofillFormsData).toStrictEqual({ __form__0: existingAutofillForm });
    });

    it("returns an object of AutofillForm objects with the form id as a key", () => {
      const documentTitle = "Test Page";
      const formId1 = "validFormId";
      const formAction1 = "https://example.com/";
      const formMethod1 = "post";
      const formName1 = "validFormName";
      const formId2 = "validFormId2";
      const formAction2 = "https://example2.com/";
      const formMethod2 = "get";
      const formName2 = "validFormName2";
      document.title = documentTitle;
      document.body.innerHTML = `
        <form id="${formId1}" action="${formAction1}" method="${formMethod1}" name="${formName1}">
            <label for="usernameFieldId">usernameFieldLabel</label>
            <input type="text" id="usernameFieldId" name="usernameFieldName" />
            <label for="passwordFieldId">passwordFieldLabel</label>
            <input type="password" id="passwordFieldId" name="passwordFieldName" />
        </form>
        <form id="${formId2}" action="${formAction2}" method="${formMethod2}" name="${formName2}">
            <label for="searchField">searchFieldLabel</label>
            <input type="search" id="searchField" name="searchFieldName" />
        </form>
      `;

      const { formElements } = collectAutofillContentService["queryAutofillFormAndFieldElements"]();
      const autofillFormsData =
        collectAutofillContentService["buildAutofillFormsData"](formElements);

      expect(autofillFormsData).toStrictEqual({
        __form__0: {
          opid: "__form__0",
          htmlAction: formAction1,
          htmlClass: null,
          htmlName: formName1,
          htmlID: formId1,
          htmlMethod: formMethod1,
        },
        __form__1: {
          opid: "__form__1",
          htmlAction: formAction2,
          htmlClass: null,
          htmlName: formName2,
          htmlID: formId2,
          htmlMethod: formMethod2,
        },
      });
    });
  });

  describe("buildAutofillFieldsData", () => {
    it("returns a promise containing an array of AutofillField objects", async () => {
      jest.spyOn(collectAutofillContentService as any, "getAutofillFieldElements");
      jest.spyOn(collectAutofillContentService as any, "buildAutofillFieldItem");
      jest
        .spyOn(collectAutofillContentService["domElementVisibilityService"], "isElementViewable")
        .mockResolvedValue(true);

      const { formFieldElements } =
        collectAutofillContentService["queryAutofillFormAndFieldElements"]();
      const autofillFieldsPromise = collectAutofillContentService["buildAutofillFieldsData"](
        formFieldElements as FormFieldElement[],
      );
      const autofillFieldsData = await Promise.resolve(autofillFieldsPromise);

      expect(collectAutofillContentService["getAutofillFieldElements"]).toHaveBeenCalledWith(
        200,
        formFieldElements,
      );
      expect(collectAutofillContentService["buildAutofillFieldItem"]).toHaveBeenCalledTimes(2);
      expect(autofillFieldsPromise).toBeInstanceOf(Promise);
      expect(autofillFieldsData).toStrictEqual([
        {
          "aria-disabled": false,
          "aria-haspopup": false,
          "aria-hidden": false,
          autoCompleteType: "",
          checked: false,
          "data-stripe": null,
          disabled: false,
          elementNumber: 0,
          form: null,
          htmlClass: null,
          htmlID: "username",
          htmlName: "",
          "label-aria": null,
          "label-data": null,
          "label-left": "",
          "label-right": "",
          "label-tag": "",
          "label-top": null,
          maxLength: 999,
          opid: "__0",
          placeholder: "",
          readonly: false,
          rel: null,
          selectInfo: null,
          tabindex: null,
          tagName: "input",
          title: "",
          type: "text",
          value: "",
          viewable: true,
          dataSetValues: "",
        },
        {
          "aria-disabled": false,
          "aria-haspopup": false,
          "aria-hidden": false,
          autoCompleteType: "",
          checked: false,
          "data-stripe": null,
          disabled: false,
          elementNumber: 1,
          form: null,
          htmlClass: null,
          htmlID: "",
          htmlName: "",
          "label-aria": null,
          "label-data": null,
          "label-left": "",
          "label-right": "",
          "label-tag": "",
          "label-top": null,
          maxLength: 999,
          opid: "__1",
          placeholder: "",
          readonly: false,
          rel: null,
          selectInfo: null,
          tabindex: null,
          tagName: "input",
          title: "",
          type: "password",
          value: "",
          viewable: true,
          dataSetValues: "",
        },
      ]);
    });
  });

  describe("getAutofillFieldElements", () => {
    it("returns all form elements from the targeted document if no limit is set", () => {
      document.body.innerHTML = `
      <div id="root">
        <form>
          <label for="username">Username</label>
          <input type="text" id="username" />
          <label for="password">Password</label>
          <input type="password" />
          <label for="comments">Comments</label>
          <textarea id="comments"></textarea>
          <label for="select">Select</label>
          <select id="select">
            <option value="1">1</option>
            <option value="2">2</option>
          </select>
          <span data-bwautofill="true">Span Element</span>
        </form>
      </div>
      `;
      const usernameInput = document.getElementById("username");
      const passwordInput = document.querySelector('input[type="password"]');
      const commentsTextarea = document.getElementById("comments");
      const selectElement = document.getElementById("select");
      const spanElement = document.querySelector('span[data-bwautofill="true"]');
      jest.spyOn(document, "querySelectorAll");
      jest.spyOn(collectAutofillContentService as any, "getPropertyOrAttribute");

      const formElements: FormFieldElement[] =
        collectAutofillContentService["getAutofillFieldElements"]();

      expect(collectAutofillContentService["getPropertyOrAttribute"]).not.toHaveBeenCalled();
      expect(formElements).toEqual([
        usernameInput,
        passwordInput,
        commentsTextarea,
        selectElement,
        spanElement,
      ]);
    });

    it("returns up to 2 (passed as `limit`) form elements from the targeted document with more than 2 form elements", () => {
      document.body.innerHTML = `
        <div>
          <span data-bwautofill="true">included span</span>
          <textarea name="user-bio" rows="10" cols="42">Tell us about yourself...</textarea>
          <span>ignored span</span>
          <select><option value="1">Option 1</option></select>
          <label for="username">username</label>
          <input type="text" id="username" />
          <input type="password" />
          <span data-bwautofill="true">another included span</span>
        </div>
      `;
      const spanElement = document.querySelector("span[data-bwautofill='true']");
      const textAreaInput = document.querySelector("textarea");
      jest.spyOn(collectAutofillContentService as any, "getPropertyOrAttribute");

      const formElements: FormFieldElement[] =
        collectAutofillContentService["getAutofillFieldElements"](2);

      expect(collectAutofillContentService["getPropertyOrAttribute"]).toHaveBeenNthCalledWith(
        1,
        spanElement,
        "type",
      );
      expect(collectAutofillContentService["getPropertyOrAttribute"]).toHaveBeenNthCalledWith(
        2,
        textAreaInput,
        "type",
      );
      expect(formElements).toEqual([spanElement, textAreaInput]);
    });

    it("returns form elements from the targeted document, ignoring input types `hidden`, `submit`, `reset`, `button`, `image`, `file`, and inputs tagged with `data-bwignore`, while giving lower order priority to `checkbox` and `radio` inputs if the returned list is truncated by `limit", () => {
      document.body.innerHTML = `
        <div>
          <fieldset>
            <legend>Select an option:</legend>
            <div>
              <input type="radio" value="option-a" />
              <label for="option-a">Option A: Options B & C</label>
            </div>
            <div>
              <input type="radio" value="option-b" />
              <label for="option-b">Option B: Options A & C</label>
            </div>
            <div>
              <input type="radio" value="option-c" />
              <label for="option-c">Option C: Options A & B</label>
            </div>
          </fieldset>
          <span data-bwautofill="true" id="first-span">included span</span>
          <textarea name="user-bio" rows="10" cols="42">Tell us about yourself...</textarea>
          <span>ignored span</span>
          <input type="checkbox" name="doYouWantToCheck" />
          <label for="doYouWantToCheck">Do you want to skip checking this box?</label>
          <select><option value="1">Option 1</option></select>
          <label for="username">username</label>
          <input type="text" data-bwignore value="None" />
          <input type="hidden" value="of" />
          <input type="submit" value="these" />
          <input type="reset" value="inputs" />
          <input type="button" value="should" />
          <input type="image" src="be" />
          <input type="file" multiple id="returned" />
          <input type="text" id="username" />
          <input type="password" />
          <span data-bwautofill="true" id="second-span">another included span</span>
        </div>
      `;
      const inputRadioA = document.querySelector('input[type="radio"][value="option-a"]');
      const inputRadioB = document.querySelector('input[type="radio"][value="option-b"]');
      const inputRadioC = document.querySelector('input[type="radio"][value="option-c"]');
      const firstSpan = document.getElementById("first-span");
      const textAreaInput = document.querySelector("textarea");
      const checkboxInput = document.querySelector('input[type="checkbox"]');
      const selectElement = document.querySelector("select");
      const usernameInput = document.getElementById("username");
      const passwordInput = document.querySelector('input[type="password"]');
      const secondSpan = document.getElementById("second-span");

      const formElements: FormFieldElement[] =
        collectAutofillContentService["getAutofillFieldElements"]();

      expect(formElements).toEqual([
        inputRadioA,
        inputRadioB,
        inputRadioC,
        firstSpan,
        textAreaInput,
        checkboxInput,
        selectElement,
        usernameInput,
        passwordInput,
        secondSpan,
      ]);
    });

    it("returns form elements from the targeted document while giving lower order priority to `checkbox` and `radio` inputs if the returned list is truncated by `limit`", () => {
      document.body.innerHTML = `
        <div>
          <input type="checkbox" name="doYouWantToCheck" />
          <label for="doYouWantToCheck">Do you want to skip checking this box?</label>
          <textarea name="user-bio" rows="10" cols="42">Tell us about yourself...</textarea>
          <span>ignored span</span>
          <fieldset>
            <legend>Select an option:</legend>
            <div>
              <input type="radio" value="option-a" />
              <label for="option-a">Option A: Options B & C</label>
            </div>
            <div>
              <input type="radio" value="option-b" />
              <label for="option-b">Option B: Options A & C</label>
            </div>
            <div>
              <input type="radio" value="option-c" />
              <label for="option-c">Option C: Options A & B</label>
            </div>
          </fieldset>
          <select><option value="1">Option 1</option></select>
          <label for="username">username</label>
          <input type="text" id="username" />
          <input type="password" />
          <span data-bwautofill="true">another included span</span>
        </div>
      `;
      const textAreaInput = document.querySelector("textarea");
      const selectElement = document.querySelector("select");
      const usernameInput = document.getElementById("username");
      const passwordInput = document.querySelector('input[type="password"]');
      const includedSpan = document.querySelector('span[data-bwautofill="true"]');
      const checkboxInput = document.querySelector('input[type="checkbox"]');
      const inputRadioA = document.querySelector('input[type="radio"][value="option-a"]');
      const inputRadioB = document.querySelector('input[type="radio"][value="option-b"]');

      const truncatedFormElements: FormFieldElement[] =
        collectAutofillContentService["getAutofillFieldElements"](8);

      expect(truncatedFormElements).toEqual([
        textAreaInput,
        selectElement,
        usernameInput,
        passwordInput,
        includedSpan,
        checkboxInput,
        inputRadioA,
        inputRadioB,
      ]);
    });
  });

  describe("buildAutofillFieldItem", () => {
    it("returns a `null` value if the field is a child of a `button[type='submit']`", async () => {
      const usernameField = {
        labelText: "Username",
        id: "username-id",
        type: "text",
      };
      document.body.innerHTML = `
        <form>
          <div>
            <div>
              <label for="${usernameField.id}">${usernameField.labelText}</label>
              <button type="submit">
                <input id="${usernameField.id}" type="${usernameField.type}" />
              </button>
            </div>
          </div>
        </form>
      `;
      const usernameInput = document.getElementById(
        usernameField.id,
      ) as ElementWithOpId<FillableFormFieldElement>;

      const autofillFieldItem = await collectAutofillContentService["buildAutofillFieldItem"](
        usernameInput,
        0,
      );

      expect(autofillFieldItem).toBeNull();
    });

    it("returns an existing autofill field item if it exists", async () => {
      const index = 0;
      const usernameField = {
        labelText: "Username",
        id: "username-id",
        classes: "username input classes",
        name: "username",
        type: "text",
        maxLength: 42,
        tabIndex: 0,
        title: "Username Input Title",
        autocomplete: "username-autocomplete",
        dataLabel: "username-data-label",
        ariaLabel: "username-aria-label",
        placeholder: "username-placeholder",
        rel: "username-rel",
        value: "username-value",
        dataStripe: "data-stripe",
      };
      document.body.innerHTML = `
        <form>
          <label for="${usernameField.id}">${usernameField.labelText}</label>
          <input
            id="${usernameField.id}"
            class="${usernameField.classes}"
            name="${usernameField.name}"
            type="${usernameField.type}"
            maxlength="${usernameField.maxLength}"
            tabindex="${usernameField.tabIndex}"
            title="${usernameField.title}"
            autocomplete="${usernameField.autocomplete}"
            data-label="${usernameField.dataLabel}"
            aria-label="${usernameField.ariaLabel}"
            placeholder="${usernameField.placeholder}"
            rel="${usernameField.rel}"
            value="${usernameField.value}"
            data-stripe="${usernameField.dataStripe}"
          />
        </form>
      `;
      const existingFieldData: AutofillField = {
        elementNumber: index,
        htmlClass: usernameField.classes,
        htmlID: usernameField.id,
        htmlName: usernameField.name,
        maxLength: usernameField.maxLength,
        opid: `__${index}`,
        tabindex: String(usernameField.tabIndex),
        tagName: "input",
        title: usernameField.title,
        viewable: true,
      };
      const usernameInput = document.getElementById(
        usernameField.id,
      ) as ElementWithOpId<FillableFormFieldElement>;
      usernameInput.opid = "__0";
      collectAutofillContentService["autofillFieldElements"].set(usernameInput, existingFieldData);
      jest.spyOn(collectAutofillContentService as any, "getAutofillFieldMaxLength");
      jest
        .spyOn(collectAutofillContentService["domElementVisibilityService"], "isElementViewable")
        .mockResolvedValue(true);
      jest.spyOn(collectAutofillContentService as any, "getPropertyOrAttribute");
      jest.spyOn(collectAutofillContentService as any, "getElementValue");

      const autofillFieldItem = await collectAutofillContentService["buildAutofillFieldItem"](
        usernameInput,
        0,
      );

      expect(collectAutofillContentService["getAutofillFieldMaxLength"]).not.toHaveBeenCalled();
      expect(
        collectAutofillContentService["domElementVisibilityService"].isElementViewable,
      ).not.toHaveBeenCalled();
      expect(collectAutofillContentService["getPropertyOrAttribute"]).not.toHaveBeenCalled();
      expect(collectAutofillContentService["getElementValue"]).not.toHaveBeenCalled();
      expect(autofillFieldItem).toEqual(existingFieldData);
    });

    it("returns the AutofillField base data values without the field labels or input values if the passed element is a span element", async () => {
      const index = 0;
      const spanElementId = "span-element";
      const spanElementClasses = "span element classes";
      const spanElementTabIndex = 0;
      const spanElementTitle = "Span Element Title";
      document.body.innerHTML = `
        <span id="${spanElementId}" class="${spanElementClasses}" tabindex="${spanElementTabIndex}" title="${spanElementTitle}">Span Element</span>
      `;
      const spanElement = document.getElementById(
        spanElementId,
      ) as ElementWithOpId<FormFieldElement>;
      jest.spyOn(collectAutofillContentService as any, "getAutofillFieldMaxLength");
      jest
        .spyOn(collectAutofillContentService["domElementVisibilityService"], "isElementViewable")
        .mockResolvedValue(true);
      jest.spyOn(collectAutofillContentService as any, "getPropertyOrAttribute");
      jest.spyOn(collectAutofillContentService as any, "getElementValue");

      const autofillFieldItem = await collectAutofillContentService["buildAutofillFieldItem"](
        spanElement,
        index,
      );

      expect(collectAutofillContentService["getAutofillFieldMaxLength"]).toHaveBeenCalledWith(
        spanElement,
      );
      expect(
        collectAutofillContentService["domElementVisibilityService"].isElementViewable,
      ).toHaveBeenCalledWith(spanElement);
      expect(collectAutofillContentService["getPropertyOrAttribute"]).toHaveBeenNthCalledWith(
        1,
        spanElement,
        "id",
      );
      expect(collectAutofillContentService["getPropertyOrAttribute"]).toHaveBeenNthCalledWith(
        2,
        spanElement,
        "name",
      );
      expect(collectAutofillContentService["getPropertyOrAttribute"]).toHaveBeenNthCalledWith(
        3,
        spanElement,
        "class",
      );
      expect(collectAutofillContentService["getPropertyOrAttribute"]).toHaveBeenNthCalledWith(
        4,
        spanElement,
        "tabindex",
      );
      expect(collectAutofillContentService["getPropertyOrAttribute"]).toHaveBeenNthCalledWith(
        5,
        spanElement,
        "title",
      );
      expect(collectAutofillContentService["getPropertyOrAttribute"]).toHaveBeenNthCalledWith(
        6,
        spanElement,
        "tagName",
      );
      expect(collectAutofillContentService["getElementValue"]).not.toHaveBeenCalled();
      expect(autofillFieldItem).toEqual({
        elementNumber: index,
        htmlClass: spanElementClasses,
        htmlID: spanElementId,
        htmlName: null,
        maxLength: null,
        opid: `__${index}`,
        tabindex: String(spanElementTabIndex),
        tagName: spanElement.tagName.toLowerCase(),
        title: spanElementTitle,
        viewable: true,
        dataSetValues: "",
      });
    });

    it("returns the AutofillField base data, label data, and input element data", async () => {
      const index = 0;
      const usernameField = {
        labelText: "Username",
        id: "username-id",
        classes: "username input classes",
        name: "username",
        type: "text",
        maxLength: 42,
        tabIndex: 0,
        title: "Username Input Title",
        autocomplete: "username-autocomplete",
        dataLabel: "username-data-label",
        ariaLabel: "username-aria-label",
        placeholder: "username-placeholder",
        rel: "username-rel",
        value: "username-value",
        dataStripe: "data-stripe",
      };
      document.body.innerHTML = `
        <form>
          <label for="${usernameField.id}">${usernameField.labelText}</label>
          <input
            id="${usernameField.id}"
            class="${usernameField.classes}"
            name="${usernameField.name}"
            type="${usernameField.type}"
            maxlength="${usernameField.maxLength}"
            tabindex="${usernameField.tabIndex}"
            title="${usernameField.title}"
            autocomplete="${usernameField.autocomplete}"
            data-label="${usernameField.dataLabel}"
            aria-label="${usernameField.ariaLabel}"
            placeholder="${usernameField.placeholder}"
            rel="${usernameField.rel}"
            value="${usernameField.value}"
            data-stripe="${usernameField.dataStripe}"
          />
        </form>
      `;
      const formElement = document.querySelector("form");
      formElement.opid = "form-opid";
      const usernameInput = document.getElementById(
        usernameField.id,
      ) as ElementWithOpId<FillableFormFieldElement>;
      jest.spyOn(collectAutofillContentService as any, "getAutofillFieldMaxLength");
      jest
        .spyOn(collectAutofillContentService["domElementVisibilityService"], "isElementViewable")
        .mockResolvedValue(true);
      jest.spyOn(collectAutofillContentService as any, "getPropertyOrAttribute");
      jest.spyOn(collectAutofillContentService as any, "getElementValue");

      const autofillFieldItem = await collectAutofillContentService["buildAutofillFieldItem"](
        usernameInput,
        index,
      );

      expect(autofillFieldItem).toEqual({
        "aria-disabled": false,
        "aria-haspopup": false,
        "aria-hidden": false,
        autoCompleteType: usernameField.autocomplete,
        checked: false,
        "data-stripe": usernameField.dataStripe,
        disabled: false,
        elementNumber: index,
        form: formElement.opid,
        htmlClass: usernameField.classes,
        htmlID: usernameField.id,
        htmlName: usernameField.name,
        "label-aria": usernameField.ariaLabel,
        "label-data": usernameField.dataLabel,
        "label-left": usernameField.labelText,
        "label-right": "",
        "label-tag": usernameField.labelText,
        "label-top": null,
        maxLength: usernameField.maxLength,
        opid: `__${index}`,
        placeholder: usernameField.placeholder,
        readonly: false,
        rel: usernameField.rel,
        selectInfo: null,
        tabindex: String(usernameField.tabIndex),
        tagName: usernameInput.tagName.toLowerCase(),
        title: usernameField.title,
        type: usernameField.type,
        value: usernameField.value,
        viewable: true,
        dataSetValues: "label: username-data-label, stripe: data-stripe, ",
      });
    });

    it("returns the AutofillField base data and input element data, but not the label data if the input element is of type `hidden`", async () => {
      const index = 0;
      const hiddenField = {
        labelText: "Hidden Field",
        id: "hidden-id",
        classes: "hidden input classes",
        name: "hidden",
        type: "hidden",
        maxLength: 42,
        tabIndex: 0,
        title: "Hidden Input Title",
        autocomplete: "off",
        rel: "hidden-rel",
        value: "hidden-value",
        dataStripe: "data-stripe",
      };
      document.body.innerHTML = `
        <form>
          <label for="${hiddenField.id}">${hiddenField.labelText}</label>
          <input
            id="${hiddenField.id}"
            class="${hiddenField.classes}"
            name="${hiddenField.name}"
            type="${hiddenField.type}"
            maxlength="${hiddenField.maxLength}"
            tabindex="${hiddenField.tabIndex}"
            title="${hiddenField.title}"
            autocomplete="${hiddenField.autocomplete}"
            rel="${hiddenField.rel}"
            value="${hiddenField.value}"
            data-stripe="${hiddenField.dataStripe}"
          />
        </form>
      `;
      const formElement = document.querySelector("form");
      formElement.opid = "form-opid";
      const hiddenInput = document.getElementById(
        hiddenField.id,
      ) as ElementWithOpId<FillableFormFieldElement>;
      jest.spyOn(collectAutofillContentService as any, "getAutofillFieldMaxLength");
      jest
        .spyOn(collectAutofillContentService["domElementVisibilityService"], "isElementViewable")
        .mockResolvedValue(true);
      jest.spyOn(collectAutofillContentService as any, "getPropertyOrAttribute");
      jest.spyOn(collectAutofillContentService as any, "getElementValue");

      const autofillFieldItem = await collectAutofillContentService["buildAutofillFieldItem"](
        hiddenInput,
        index,
      );

      expect(autofillFieldItem).toEqual({
        "aria-disabled": false,
        "aria-haspopup": false,
        "aria-hidden": false,
        autoCompleteType: "off",
        checked: false,
        "data-stripe": hiddenField.dataStripe,
        disabled: false,
        elementNumber: index,
        form: formElement.opid,
        htmlClass: hiddenField.classes,
        htmlID: hiddenField.id,
        htmlName: hiddenField.name,
        maxLength: hiddenField.maxLength,
        opid: `__${index}`,
        readonly: false,
        rel: hiddenField.rel,
        selectInfo: null,
        tabindex: String(hiddenField.tabIndex),
        tagName: hiddenInput.tagName.toLowerCase(),
        title: hiddenField.title,
        type: hiddenField.type,
        value: hiddenField.value,
        viewable: true,
        dataSetValues: "stripe: data-stripe, ",
      });
    });
  });

  describe("createAutofillFieldLabelTag", () => {
    beforeEach(() => {
      jest.spyOn(collectAutofillContentService as any, "createLabelElementsTag");
      jest.spyOn(document, "querySelectorAll");
    });

    it("returns the label tag early if the passed element contains any labels", () => {
      document.body.innerHTML = `
        <label for="username-id">Username</label>
        <input type="text" id="username-id" name="username" />

      `;
      const element = document.querySelector("#username-id") as FillableFormFieldElement;

      const labelTag = collectAutofillContentService["createAutofillFieldLabelTag"](element);

      expect(collectAutofillContentService["createLabelElementsTag"]).toHaveBeenCalledWith(
        new Set(element.labels),
      );
      expect(document.querySelectorAll).not.toHaveBeenCalled();
      expect(labelTag).toEqual("Username");
    });

    it("queries all labels associated with the element's id", () => {
      document.body.innerHTML = `
        <label for="country-id">Country</label>
        <span id="country-id"></span>
      `;
      const element = document.querySelector("#country-id") as FillableFormFieldElement;
      const elementLabel = document.querySelector("label[for='country-id']");

      const labelTag = collectAutofillContentService["createAutofillFieldLabelTag"](element);

      expect(document.querySelectorAll).toHaveBeenCalledWith(`label[for="${element.id}"]`);
      expect(collectAutofillContentService["createLabelElementsTag"]).toHaveBeenCalledWith(
        new Set([elementLabel]),
      );
      expect(labelTag).toEqual("Country");
    });

    it("queries all labels associated with the element's name", () => {
      document.body.innerHTML = `
        <label for="country-name">Country</label>
        <select name="country-name"></select>
      `;
      const element = document.querySelector("select") as FillableFormFieldElement;
      const elementLabel = document.querySelector("label[for='country-name']");

      const labelTag = collectAutofillContentService["createAutofillFieldLabelTag"](element);

      expect(document.querySelectorAll).not.toHaveBeenCalledWith(`label[for="${element.id}"]`);
      expect(document.querySelectorAll).toHaveBeenCalledWith(`label[for="${element.name}"]`);
      expect(collectAutofillContentService["createLabelElementsTag"]).toHaveBeenCalledWith(
        new Set([elementLabel]),
      );
      expect(labelTag).toEqual("Country");
    });

    it("will not add duplicate labels that are found to the label tag", () => {
      document.body.innerHTML = `
        <label for="country-name">Country</label>
        <div id="country-name" name="country-name"></div>
      `;
      const element = document.querySelector("#country-name") as FillableFormFieldElement;
      element.name = "country-name";
      const elementLabel = document.querySelector("label[for='country-name']");

      const labelTag = collectAutofillContentService["createAutofillFieldLabelTag"](element);

      expect(document.querySelectorAll).toHaveBeenCalledWith(
        `label[for="${element.id}"], label[for="${element.name}"]`,
      );
      expect(collectAutofillContentService["createLabelElementsTag"]).toHaveBeenCalledWith(
        new Set([elementLabel]),
      );
      expect(labelTag).toEqual("Country");
    });

    it("will attempt to identify the label of an element from its parent element", () => {
      document.body.innerHTML = `<label>
        Username
        <input type="text" id="username-id">
      </label>`;
      const element = document.querySelector("#username-id") as FillableFormFieldElement;
      const elementLabel = element.parentElement;

      const labelTag = collectAutofillContentService["createAutofillFieldLabelTag"](element);

      expect(collectAutofillContentService["createLabelElementsTag"]).toHaveBeenCalledWith(
        new Set([elementLabel]),
      );
      expect(labelTag).toEqual("Username");
    });

    it("will attempt to identify the label of an element from a `dt` element associated with the element's parent", () => {
      document.body.innerHTML = `
        <dl>
          <dt id="label-element">Username</dt>
          <dd>
            <input type="text" id="username-id">
          </dd>
        </dl>
      `;
      const element = document.querySelector("#username-id") as FillableFormFieldElement;
      const elementLabel = document.querySelector("#label-element");

      const labelTag = collectAutofillContentService["createAutofillFieldLabelTag"](element);

      expect(collectAutofillContentService["createLabelElementsTag"]).toHaveBeenCalledWith(
        new Set([elementLabel]),
      );
      expect(labelTag).toEqual("Username");
    });

    it("will return an empty string value if no labels can be found for an element", () => {
      document.body.innerHTML = `
        <input type="text" id="username-id">
      `;
      const element = document.querySelector("#username-id") as FillableFormFieldElement;

      const labelTag = collectAutofillContentService["createAutofillFieldLabelTag"](element);

      expect(labelTag).toEqual("");
    });
  });

  describe("queryElementLabels", () => {
    it("returns null if the passed element has no id or name", () => {
      document.body.innerHTML = `
        <label for="username-id">
          Username
          <input type="text">
        </label>
      `;
      const element = document.querySelector("input") as FillableFormFieldElement;

      const labels = collectAutofillContentService["queryElementLabels"](element);

      expect(labels).toBeNull();
    });

    it("returns an empty NodeList if the passed element has no label", () => {
      document.body.innerHTML = `
        <input type="text" id="username-id">
      `;
      const element = document.querySelector("input") as FillableFormFieldElement;

      const labels = collectAutofillContentService["queryElementLabels"](element);

      expect(labels).toEqual(document.querySelectorAll("label"));
    });

    it("returns the label of an element associated with its ID value", () => {
      document.body.innerHTML = `
        <label for="username-id">Username</label>
        <input type="text" id="username-id">
      `;
      const element = document.querySelector("input") as FillableFormFieldElement;

      const labels = collectAutofillContentService["queryElementLabels"](element);

      expect(labels).toEqual(document.querySelectorAll("label[for='username-id']"));
    });

    it("returns the label of an element associated with its name value", () => {
      document.body.innerHTML = `
        <label for="username">Username</label>
        <input type="text" name="username" id="username-id">
      `;
      const element = document.querySelector("input") as FillableFormFieldElement;

      const labels = collectAutofillContentService["queryElementLabels"](element);

      expect(labels).toEqual(document.querySelectorAll("label[for='username']"));
    });

    it("removes any new lines generated for the query selector", () => {
      document.body.innerHTML = `
        <label for="username-
        id">Username</label>
        <input type="text" id="username-
        id">
      `;
      const element = document.querySelector("input") as FillableFormFieldElement;

      const labels = collectAutofillContentService["queryElementLabels"](element);

      expect(labels).toEqual(document.querySelectorAll("label[for='username-id']"));
    });
  });

  describe("createLabelElementsTag", () => {
    it("returns a string containing all the labels associated with a given input element", () => {
      const firstLabelText = "Username by name";
      const secondLabelText = "Username by ID";
      document.body.innerHTML = `
        <label for="username">${firstLabelText}</label>
        <label for="username-id">${secondLabelText}</label>
        <input type="text" name="username" id="username-id">
      `;
      const labels = document.querySelectorAll("label");
      jest.spyOn(collectAutofillContentService as any, "trimAndRemoveNonPrintableText");

      const labelTag = collectAutofillContentService["createLabelElementsTag"](new Set(labels));

      expect(
        collectAutofillContentService["trimAndRemoveNonPrintableText"],
      ).toHaveBeenNthCalledWith(1, firstLabelText);
      expect(
        collectAutofillContentService["trimAndRemoveNonPrintableText"],
      ).toHaveBeenNthCalledWith(2, secondLabelText);
      expect(labelTag).toEqual(`${firstLabelText}${secondLabelText}`);
    });
  });

  describe("getAutofillFieldMaxLength", () => {
    it("returns null if the passed FormFieldElement is not an element type that has a max length property", () => {
      document.body.innerHTML = `
        <select name="country">
          <option value="US">United States</option>
          <option value="CA">Canada</option>
        </select>
      `;
      const element = document.querySelector("select") as FillableFormFieldElement;

      const maxLength = collectAutofillContentService["getAutofillFieldMaxLength"](element);

      expect(maxLength).toBeNull();
    });

    it("returns a value of 999 if the passed FormFieldElement has no set maxLength value", () => {
      document.body.innerHTML = `
        <input type="text" name="username">
      `;
      const element = document.querySelector("input") as FillableFormFieldElement;

      const maxLength = collectAutofillContentService["getAutofillFieldMaxLength"](element);

      expect(maxLength).toEqual(999);
    });

    it("returns a value of 999 if the passed FormFieldElement has a maxLength value higher than 999", () => {
      document.body.innerHTML = `
        <input type="text" name="username" maxlength="1000">
      `;
      const element = document.querySelector("input") as FillableFormFieldElement;

      const maxLength = collectAutofillContentService["getAutofillFieldMaxLength"](element);

      expect(maxLength).toEqual(999);
    });

    it("returns the maxLength property of a passed FormFieldElement", () => {
      document.body.innerHTML = `
        <input type="text" name="username" maxlength="10">
      `;
      const element = document.querySelector("input") as FillableFormFieldElement;

      const maxLength = collectAutofillContentService["getAutofillFieldMaxLength"](element);

      expect(maxLength).toEqual(10);
    });
  });

  describe("createAutofillFieldRightLabel", () => {
    it("returns an empty string if no siblings are found", () => {
      document.body.innerHTML = `
        <input type="text" name="username">
      `;
      const element = document.querySelector("input") as FillableFormFieldElement;

      const labelTag = collectAutofillContentService["createAutofillFieldRightLabel"](element);

      expect(labelTag).toEqual("");
    });

    it("returns the text content of the element's next sibling element", () => {
      document.body.innerHTML = `
        <input type="text" name="username" id="username-id">
        <label for="username-id">Username</label>
      `;
      const element = document.querySelector("input") as FillableFormFieldElement;

      const labelTag = collectAutofillContentService["createAutofillFieldRightLabel"](element);

      expect(labelTag).toEqual("Username");
    });

    it("returns the text content of the element's next sibling textNode", () => {
      document.body.innerHTML = `
        <input type="text" name="username" id="username-id">
        Username
      `;
      const element = document.querySelector("input") as FillableFormFieldElement;

      const labelTag = collectAutofillContentService["createAutofillFieldRightLabel"](element);

      expect(labelTag).toEqual("Username");
    });
  });

  describe("createAutofillFieldLeftLabel", () => {
    it("returns a string value of the text content associated with the previous siblings of the passed element", () => {
      document.body.innerHTML = `
        <div>
          <span>Text Content</span>
          <label for="username">Username</label>
          <input type="text" name="username" id="username-id">
        </div>
      `;
      const element = document.querySelector("input") as FillableFormFieldElement;

      const labelTag = collectAutofillContentService["createAutofillFieldLeftLabel"](element);

      expect(labelTag).toEqual("Text ContentUsername");
    });
  });

  describe("createAutofillFieldTopLabel", () => {
    it("returns the table column header value for the passed table element", () => {
      document.body.innerHTML = `
        <table>
          <tbody>
            <tr>
              <th>Username</th>
              <th>Password</th>
              <th>Login code</th>
            </tr>
            <tr>
              <td><input type="text" name="username" /></td>
              <td><input type="password" name="password" /></td>
              <td><input type="text" name="auth-code" /></td>
            </tr>
          </tbody>
        </table>
      `;
      const targetTableCellInput = document.querySelector(
        'input[name="password"]',
      ) as HTMLInputElement;

      const targetTableCellLabel =
        collectAutofillContentService["createAutofillFieldTopLabel"](targetTableCellInput);

      expect(targetTableCellLabel).toEqual("Password");
    });

    it("will attempt to return the value for the previous sibling row as the label if a `th` cell is not found", () => {
      document.body.innerHTML = `
        <table>
          <tbody>
            <tr>
              <td>Username</td>
              <td>Password</td>
              <td>Login code</td>
            </tr>
            <tr>
              <td><input type="text" name="username" /></td>
              <td><input type="password" name="password" /></td>
              <td><input type="text" name="auth-code" /></td>
            </tr>
          </tbody>
        </table>
      `;
      const targetTableCellInput = document.querySelector(
        'input[name="auth-code"]',
      ) as HTMLInputElement;

      const targetTableCellLabel =
        collectAutofillContentService["createAutofillFieldTopLabel"](targetTableCellInput);

      expect(targetTableCellLabel).toEqual("Login code");
    });

    it("returns null for the passed table element it's parent row has no previous sibling row", () => {
      document.body.innerHTML = `
        <table>
          <tbody>
            <tr>
              <td><input type="text" name="username" /></td>
              <td><input type="password" name="password" /></td>
              <td><input type="text" name="auth-code" /></td>
            </tr>
          </tbody>
        </table>
      `;
      const targetTableCellInput = document.querySelector(
        'input[name="password"]',
      ) as HTMLInputElement;

      const targetTableCellLabel =
        collectAutofillContentService["createAutofillFieldTopLabel"](targetTableCellInput);

      expect(targetTableCellLabel).toEqual(null);
    });

    it("returns null if the input element is not structured within a `td` element", () => {
      document.body.innerHTML = `
        <table>
          <tbody>
            <tr>
              <td>Username</td>
              <td>Password</td>
              <td>Login code</td>
            </tr>
            <tr>
              <td><input type="text" name="username" /></td>
              <div><input type="password" name="password" /></div>
              <td><input type="text" name="auth-code" /></td>
            </tr>
          </tbody>
        </table>
      `;
      const targetTableCellInput = document.querySelector(
        'input[name="password"]',
      ) as HTMLInputElement;

      const targetTableCellLabel =
        collectAutofillContentService["createAutofillFieldTopLabel"](targetTableCellInput);

      expect(targetTableCellLabel).toEqual(null);
    });

    it("returns null if the index of the `td` element is larger than the length of cells in the sibling row", () => {
      document.body.innerHTML = `
        <table>
          <tbody>
            <tr>
              <td>Username</td>
              <td>Password</td>
            </tr>
            <tr>
              <td><input type="text" name="username" /></td>
              <td><input type="password" name="password" /></td>
              <td><input type="text" name="auth-code" /></td>
            </tr>
          </tbody>
        </table>
      `;
      const targetTableCellInput = document.querySelector(
        'input[name="auth-code"]',
      ) as HTMLInputElement;

      const targetTableCellLabel =
        collectAutofillContentService["createAutofillFieldTopLabel"](targetTableCellInput);

      expect(targetTableCellLabel).toEqual(null);
    });
  });

  describe("isNewSectionElement", () => {
    const validElementTags = [
      "html",
      "body",
      "button",
      "form",
      "head",
      "iframe",
      "input",
      "option",
      "script",
      "select",
      "table",
      "textarea",
    ];
    const invalidElementTags = ["div", "span"];

    describe("given a transitional element", () => {
      validElementTags.forEach((tag) => {
        const element = document.createElement(tag);

        it(`returns true if the element tag is a ${tag}`, () => {
          expect(collectAutofillContentService["isNewSectionElement"](element)).toEqual(true);
        });
      });
    });

    describe("given an non-transitional element", () => {
      invalidElementTags.forEach((tag) => {
        const element = document.createElement(tag);

        it(`returns false if the element tag is a ${tag}`, () => {
          expect(collectAutofillContentService["isNewSectionElement"](element)).toEqual(false);
        });
      });
    });

    it(`returns true if the provided element is falsy`, () => {
      expect(collectAutofillContentService["isNewSectionElement"](undefined)).toEqual(true);
    });
  });

  describe("getTextContentFromElement", () => {
    it("returns the node value for a text node", () => {
      document.body.innerHTML = `
        <div>
          <label>
            Username Label
            <input type="text" id="username-id">
          </label>
        </div>
      `;
      const element = document.querySelector("#username-id");
      const textNode = element.previousSibling;
      const parsedTextContent = collectAutofillContentService["trimAndRemoveNonPrintableText"](
        textNode.nodeValue,
      );
      jest.spyOn(collectAutofillContentService as any, "trimAndRemoveNonPrintableText");

      const textContent = collectAutofillContentService["getTextContentFromElement"](textNode);

      expect(textNode.nodeType).toEqual(Node.TEXT_NODE);
      expect(collectAutofillContentService["trimAndRemoveNonPrintableText"]).toHaveBeenCalledWith(
        textNode.nodeValue,
      );
      expect(textContent).toEqual(parsedTextContent);
    });

    it("returns the text content for an element node", () => {
      document.body.innerHTML = `
        <div>
          <label for="username-id">Username Label</label>
          <input type="text" id="username-id">
        </div>
      `;
      const element = document.querySelector('label[for="username-id"]');
      jest.spyOn(collectAutofillContentService as any, "trimAndRemoveNonPrintableText");

      const textContent = collectAutofillContentService["getTextContentFromElement"](element);

      expect(element.nodeType).toEqual(Node.ELEMENT_NODE);
      expect(collectAutofillContentService["trimAndRemoveNonPrintableText"]).toHaveBeenCalledWith(
        element.textContent,
      );
      expect(textContent).toEqual(element.textContent);
    });
  });

  describe("trimAndRemoveNonPrintableText", () => {
    it("returns an empty string if no text content is passed", () => {
      const textContent = collectAutofillContentService["trimAndRemoveNonPrintableText"](undefined);

      expect(textContent).toEqual("");
    });

    it("returns a trimmed string with all non-printable text removed", () => {
      const nonParsedText = `Hello!\nThis is a \t
      test   string.\x0B\x08`;

      const parsedText =
        collectAutofillContentService["trimAndRemoveNonPrintableText"](nonParsedText);

      expect(parsedText).toEqual("Hello! This is a test string.");
    });

    it("preserves extended Latin letters like Š and ć", () => {
      const text = "Šifra   ćevapčići  korisnika";
      const result = collectAutofillContentService["trimAndRemoveNonPrintableText"](text);
      expect(result).toEqual("Šifra ćevapčići korisnika");
    });

    it("removes zero-width and control characters", () => {
      const text = "Hello\u200B\u200C\u200D\u2060World\x00\x1F!";
      const result = collectAutofillContentService["trimAndRemoveNonPrintableText"](text);
      expect(result).toEqual("Hello World !");
    });

    it("removes leading and trailing whitespace", () => {
      const text = "   padded text with spaces   ";
      const result = collectAutofillContentService["trimAndRemoveNonPrintableText"](text);
      expect(result).toEqual("padded text with spaces");
    });

    it("replaces multiple whitespaces (tabs, newlines, spaces) with one space", () => {
      const text = "one\t\ntwo  \n  three\t\tfour";
      const result = collectAutofillContentService["trimAndRemoveNonPrintableText"](text);
      expect(result).toEqual("one two three four");
    });

    it("preserves emoji and symbols", () => {
      const text = "Text with emoji 🐍🚀 and ©®✓ symbols";
      const result = collectAutofillContentService["trimAndRemoveNonPrintableText"](text);
      expect(result).toEqual("Text with emoji 🐍🚀 and ©®✓ symbols");
    });

    it("handles RTL and LTR marks", () => {
      const text = "abc\u200F\u202Edеf";
      const result = collectAutofillContentService["trimAndRemoveNonPrintableText"](text);
      expect(result).toEqual("abc dеf");
    });

    it("handles mathematical unicode letters", () => {
      const text = "Unicode math: 𝒜𝒷𝒸𝒹";
      const result = collectAutofillContentService["trimAndRemoveNonPrintableText"](text);
      expect(result).toEqual("Unicode math: 𝒜𝒷𝒸𝒹");
    });

    it("removes only invisible non-printables, keeps Japanese", () => {
      const text = "これは\u200Bテストです";
      const result = collectAutofillContentService["trimAndRemoveNonPrintableText"](text);
      expect(result).toEqual("これは テストです");
    });
  });

  describe("recursivelyGetTextFromPreviousSiblings", () => {
    it("should find text adjacent to the target element likely to be a label", () => {
      document.body.innerHTML = `
        <div>
          Text about things
          <div>some things</div>
          <div>
            <h3>Stuff Section Header</h3>
            Other things which are also stuff
            <div style="display:none;"> Not visible text </div>
            <label for="input-tag">something else</label>
            <input id="input-tag" type="text" value="something" />
          </div>
        </div>
      `;
      const textInput = document.querySelector("#input-tag") as FormElementWithAttribute;

      const elementList: string[] =
        collectAutofillContentService["recursivelyGetTextFromPreviousSiblings"](textInput);

      expect(elementList).toEqual([
        "something else",
        "Not visible text",
        "Other things which are also stuff",
        "Stuff Section Header",
      ]);
    });

    it("should stop looking at siblings for label values when a 'new section' element is seen", () => {
      document.body.innerHTML = `
        <div>
          Text about things
          <div>some things</div>
          <div>
            <h3>Stuff Section Header</h3>
            Other things which are also stuff
            <div style="display:none;">Not a label</div>
            <input type=text />
            <label for="input-tag">something else</label>
            <input id="input-tag" type="text" value="something" />
          </div>
        </div>
      `;

      const textInput = document.querySelector("#input-tag") as FormElementWithAttribute;
      const elementList: string[] =
        collectAutofillContentService["recursivelyGetTextFromPreviousSiblings"](textInput);

      expect(elementList).toEqual(["something else"]);
    });

    it("should keep looking for labels in parents when there are no siblings of the target element", () => {
      document.body.innerHTML = `
        <div>
          Text about things
          <input type="text" />
          <div>some things</div>
          <div>
            <input id="input-tag" type="text" value="something" />
          </div>
        </div>
      `;

      const textInput = document.querySelector("#input-tag") as FormElementWithAttribute;
      const elementList: string[] =
        collectAutofillContentService["recursivelyGetTextFromPreviousSiblings"](textInput);

      expect(elementList).toEqual(["some things"]);
    });

    it("should find label in parent sibling last child if no other label candidates have been encountered and there are no text nodes along the way", () => {
      document.body.innerHTML = `
        <div>
          <div>
            <div>not the most relevant things</div>
            <div>some nested things</div>
            <div>
              <input id="input-tag" type="text" value="something" />
            </div>
          </div>
        </div>
      `;

      const textInput = document.querySelector("#input-tag") as FormElementWithAttribute;
      const elementList: string[] =
        collectAutofillContentService["recursivelyGetTextFromPreviousSiblings"](textInput);

      expect(elementList).toEqual(["some nested things"]);
    });

    it("should exit early if the target element has no parent element/node", () => {
      const textInput = document.querySelector("html") as HTMLHtmlElement;

      const elementList: string[] =
        collectAutofillContentService["recursivelyGetTextFromPreviousSiblings"](textInput);

      expect(elementList).toEqual([]);
    });
  });

  describe("getPropertyOrAttribute", () => {
    it("returns the value of the named property of the target element if the property exists within the element", () => {
      document.body.innerHTML += '<input type="checkbox" value="userWouldLikeToCheck" checked />';
      const textInput = document.querySelector("#username") as HTMLInputElement;
      textInput.setAttribute("value", "jsmith");
      const checkboxInput = document.querySelector('input[type="checkbox"]') as HTMLInputElement;
      jest.spyOn(textInput, "getAttribute");
      jest.spyOn(checkboxInput, "getAttribute");

      const textInputValue = collectAutofillContentService["getPropertyOrAttribute"](
        textInput,
        "value",
      );
      const textInputId = collectAutofillContentService["getPropertyOrAttribute"](textInput, "id");
      const textInputBaseURI = collectAutofillContentService["getPropertyOrAttribute"](
        textInput,
        "baseURI",
      );
      const textInputAutofocus = collectAutofillContentService["getPropertyOrAttribute"](
        textInput,
        "autofocus",
      );
      const checkboxInputChecked = collectAutofillContentService["getPropertyOrAttribute"](
        checkboxInput,
        "checked",
      );

      expect(textInput.getAttribute).not.toHaveBeenCalled();
      expect(checkboxInput.getAttribute).not.toHaveBeenCalled();
      expect(textInputValue).toEqual("jsmith");
      expect(textInputId).toEqual("username");
      expect(textInputBaseURI).toEqual("http://localhost/");
      expect(textInputAutofocus).toEqual(false);
      expect(checkboxInputChecked).toEqual(true);
    });

    it("returns the value of the named attribute of the element if it does not exist as a property within the element", () => {
      const textInput = document.querySelector("#username") as HTMLInputElement;
      textInput.setAttribute("data-unique-attribute", "unique-value");
      jest.spyOn(textInput, "getAttribute");

      const textInputUniqueAttribute = collectAutofillContentService["getPropertyOrAttribute"](
        textInput,
        "data-unique-attribute",
      );

      expect(textInputUniqueAttribute).toEqual("unique-value");
      expect(textInput.getAttribute).toHaveBeenCalledWith("data-unique-attribute");
    });

    it("returns a null value if the element does not contain the passed attribute name as either a property or attribute value", () => {
      const textInput = document.querySelector("#username") as HTMLInputElement;
      jest.spyOn(textInput, "getAttribute");

      const textInputNonExistentAttribute = collectAutofillContentService["getPropertyOrAttribute"](
        textInput,
        "non-existent-attribute",
      );

      expect(textInputNonExistentAttribute).toEqual(null);
      expect(textInput.getAttribute).toHaveBeenCalledWith("non-existent-attribute");
    });
  });

  describe("getElementValue", () => {
    it("returns an empty string of passed input elements whose value is not set", () => {
      document.body.innerHTML += `
        <input type="checkbox" value="aTestValue" />
        <input id="hidden-input" type="hidden" />
        <span id="span-input"></span>
      `;
      const textInput = document.querySelector("#username") as HTMLInputElement;
      const checkboxInput = document.querySelector('input[type="checkbox"]') as HTMLInputElement;
      const hiddenInput = document.querySelector("#hidden-input") as HTMLInputElement;
      const spanInput = document.querySelector("#span-input") as HTMLInputElement;

      const textInputValue = collectAutofillContentService["getElementValue"](textInput);
      const checkboxInputValue = collectAutofillContentService["getElementValue"](checkboxInput);
      const hiddenInputValue = collectAutofillContentService["getElementValue"](hiddenInput);
      const spanInputValue = collectAutofillContentService["getElementValue"](spanInput);

      expect(textInputValue).toEqual("");
      expect(checkboxInputValue).toEqual("");
      expect(hiddenInputValue).toEqual("");
      expect(spanInputValue).toEqual("");
    });

    it("returns the value of the passed input element", () => {
      document.body.innerHTML += `
        <input type="checkbox" value="aTestValue" />
        <input id="hidden-input" type="hidden" />
        <span id="span-input">A span input value</span>
      `;
      const textInput = document.querySelector("#username") as HTMLInputElement;
      textInput.value = "jsmith";
      const checkboxInput = document.querySelector('input[type="checkbox"]') as HTMLInputElement;
      checkboxInput.checked = true;
      const hiddenInput = document.querySelector("#hidden-input") as HTMLInputElement;
      hiddenInput.value = "aHiddenInputValue";
      const spanInput = document.querySelector("#span-input") as HTMLInputElement;

      const textInputValue = collectAutofillContentService["getElementValue"](textInput);
      const checkboxInputValue = collectAutofillContentService["getElementValue"](checkboxInput);
      const hiddenInputValue = collectAutofillContentService["getElementValue"](hiddenInput);
      const spanInputValue = collectAutofillContentService["getElementValue"](spanInput);

      expect(textInputValue).toEqual("jsmith");
      expect(checkboxInputValue).toEqual("✓");
      expect(hiddenInputValue).toEqual("aHiddenInputValue");
      expect(spanInputValue).toEqual("A span input value");
    });

    it("return the truncated value of the passed hidden input type if the value length exceeds 256 characters", () => {
      document.body.innerHTML += `
        <input id="long-value-hidden-input" type="hidden" value="’Twas brillig, and the slithy toves | Did gyre and gimble in the wabe: | All mimsy were the borogoves, | And the mome raths outgrabe. | “Beware the Jabberwock, my son! | The jaws that bite, the claws that catch! | Beware the Jubjub bird, and shun | The frumious Bandersnatch!” | He took his vorpal sword in hand; | Long time the manxome foe he sought— | So rested he by the Tumtum tree | And stood awhile in thought. | And, as in uffish thought he stood, | The Jabberwock, with eyes of flame, | Came whiffling through the tulgey wood, | And burbled as it came! | One, two! One, two! And through and through | The vorpal blade went snicker-snack! | He left it dead, and with its head | He went galumphing back. | “And hast thou slain the Jabberwock? | Come to my arms, my beamish boy! | O frabjous day! Callooh! Callay!” | He chortled in his joy. | ’Twas brillig, and the slithy toves | Did gyre and gimble in the wabe: | All mimsy were the borogoves, | And the mome raths outgrabe." />
      `;
      const longValueHiddenInput = document.querySelector(
        "#long-value-hidden-input",
      ) as HTMLInputElement;

      const longHiddenValue =
        collectAutofillContentService["getElementValue"](longValueHiddenInput);

      expect(longHiddenValue).toEqual(
        "’Twas brillig, and the slithy toves | Did gyre and gimble in the wabe: | All mimsy were the borogoves, | And the mome raths outgrabe. | “Beware the Jabberwock, my son! | The jaws that bite, the claws that catch! | Beware the Jubjub bird, and shun | The f...SNIPPED",
      );
    });
  });

  describe("getSelectElementOptions", () => {
    it("returns the inner text and values of each `option` within the passed `select`", () => {
      document.body.innerHTML = `
        <select id="select-without-options"></select>
        <select id="select-with-options">
          <option value="1">Option: 1</option>
          <option value="b">Option - B</option>
          <option value="iii">Option III.</option>
          <option value="four"></option>
        </select>
      `;
      const selectWithOptions = document.querySelector("#select-with-options") as HTMLSelectElement;
      const selectWithoutOptions = document.querySelector(
        "#select-without-options",
      ) as HTMLSelectElement;

      const selectWithOptionsOptions =
        collectAutofillContentService["getSelectElementOptions"](selectWithOptions);
      const selectWithoutOptionsOptions =
        collectAutofillContentService["getSelectElementOptions"](selectWithoutOptions);

      expect(selectWithOptionsOptions).toEqual({
        options: [
          ["option1", "1"],
          ["optionb", "b"],
          ["optioniii", "iii"],
          [null, "four"],
        ],
      });
      expect(selectWithoutOptionsOptions).toEqual({ options: [] });
    });
  });

  describe("setupMutationObserver", () => {
    it("sets up a mutation observer and observes the document element", () => {
      jest.spyOn(MutationObserver.prototype, "observe");

      collectAutofillContentService["setupMutationObserver"]();

      expect(collectAutofillContentService["mutationObserver"]).toBeInstanceOf(MutationObserver);
      expect(collectAutofillContentService["mutationObserver"].observe).toHaveBeenCalled();
    });
  });

  describe("handleMutationObserverMutation", () => {
    const waitForAllMutationsToComplete = async () => {
      await waitForIdleCallback();
      await waitForIdleCallback();
      await waitForIdleCallback();
    };

    it("will set the domRecentlyMutated value to true and the noFieldsFound value to false if a form or field node has been added ", async () => {
      const form = document.createElement("form");
      document.body.appendChild(form);
      const addedNodes = document.querySelectorAll("form");
      const removedNodes = document.querySelectorAll("li");

      const mutationRecord: MutationRecord = {
        type: "childList",
        addedNodes: addedNodes,
        attributeName: null,
        attributeNamespace: null,
        nextSibling: null,
        oldValue: null,
        previousSibling: null,
        removedNodes: removedNodes,
        target: document.body,
      };
      collectAutofillContentService["domRecentlyMutated"] = false;
      collectAutofillContentService["noFieldsFound"] = true;
      collectAutofillContentService["currentLocationHref"] = window.location.href;
      jest.spyOn(collectAutofillContentService as any, "isAutofillElementNodeMutated");

      collectAutofillContentService["handleMutationObserverMutation"]([mutationRecord]);
      await waitForAllMutationsToComplete();

      expect(collectAutofillContentService["domRecentlyMutated"]).toEqual(true);
      expect(collectAutofillContentService["noFieldsFound"]).toEqual(false);
      expect(collectAutofillContentService["isAutofillElementNodeMutated"]).toHaveBeenCalledWith(
        removedNodes,
        true,
      );
      expect(collectAutofillContentService["isAutofillElementNodeMutated"]).toHaveBeenCalledWith(
        addedNodes,
      );
    });

    it("removes cached autofill elements that are nested within a removed node", async () => {
      const form = document.createElement("form") as ElementWithOpId<HTMLFormElement>;
      const usernameInput = document.createElement("input") as ElementWithOpId<FormFieldElement>;
      usernameInput.setAttribute("type", "text");
      usernameInput.setAttribute("name", "username");
      form.appendChild(usernameInput);
      document.body.appendChild(form);
      const removedNodes = document.querySelectorAll("form");
      const autofillForm: AutofillForm = createAutofillFormMock({});
      const autofillField: AutofillField = createAutofillFieldMock({});
      collectAutofillContentService["_autofillFormElements"] = new Map([[form, autofillForm]]);
      collectAutofillContentService["autofillFieldElements"] = new Map([
        [usernameInput, autofillField],
      ]);
      collectAutofillContentService["domRecentlyMutated"] = false;
      collectAutofillContentService["noFieldsFound"] = true;
      collectAutofillContentService["currentLocationHref"] = window.location.href;

      collectAutofillContentService["handleMutationObserverMutation"]([
        {
          type: "childList",
          addedNodes: null,
          attributeName: null,
          attributeNamespace: null,
          nextSibling: null,
          oldValue: null,
          previousSibling: null,
          removedNodes: removedNodes,
          target: document.body,
        },
      ]);
      await waitForAllMutationsToComplete();

      expect(collectAutofillContentService["_autofillFormElements"].size).toEqual(0);
      expect(collectAutofillContentService["autofillFieldElements"].size).toEqual(0);
    });

    it("will handle updating the autofill element if any attribute mutations are encountered", async () => {
      const mutationRecord: MutationRecord = {
        type: "attributes",
        addedNodes: null,
        attributeName: "value",
        attributeNamespace: null,
        nextSibling: null,
        oldValue: null,
        previousSibling: null,
        removedNodes: null,
        target: document.body,
      };
      collectAutofillContentService["domRecentlyMutated"] = false;
      collectAutofillContentService["noFieldsFound"] = true;
      collectAutofillContentService["currentLocationHref"] = window.location.href;
      jest.spyOn(collectAutofillContentService as any, "isAutofillElementNodeMutated");
      jest.spyOn(collectAutofillContentService as any, "handleAutofillElementAttributeMutation");

      collectAutofillContentService["handleMutationObserverMutation"]([mutationRecord]);
      await waitForAllMutationsToComplete();

      expect(collectAutofillContentService["domRecentlyMutated"]).toEqual(false);
      expect(collectAutofillContentService["noFieldsFound"]).toEqual(true);
      expect(collectAutofillContentService["isAutofillElementNodeMutated"]).not.toHaveBeenCalled();
      expect(
        collectAutofillContentService["handleAutofillElementAttributeMutation"],
      ).toHaveBeenCalled();
    });

    it("will handle window location mutations", () => {
      const mutationRecord: MutationRecord = {
        type: "attributes",
        addedNodes: null,
        attributeName: "value",
        attributeNamespace: null,
        nextSibling: null,
        oldValue: null,
        previousSibling: null,
        removedNodes: null,
        target: document.body,
      };
      collectAutofillContentService["currentLocationHref"] = "https://someotherurl.com";
      jest.spyOn(collectAutofillContentService as any, "handleWindowLocationMutation");
      jest.spyOn(collectAutofillContentService as any, "isAutofillElementNodeMutated");
      jest.spyOn(collectAutofillContentService as any, "handleAutofillElementAttributeMutation");

      collectAutofillContentService["handleMutationObserverMutation"]([mutationRecord]);

      expect(collectAutofillContentService["handleWindowLocationMutation"]).toHaveBeenCalled();
      expect(collectAutofillContentService["isAutofillElementNodeMutated"]).not.toHaveBeenCalled();
      expect(
        collectAutofillContentService["handleAutofillElementAttributeMutation"],
      ).not.toHaveBeenCalled();
    });

    it("will setup the overlay listeners on mutated elements", async () => {
      jest.useFakeTimers();
      const form = document.createElement("form");
      document.body.appendChild(form);
      const addedNodes = document.querySelectorAll("form");
      const removedNodes = document.querySelectorAll("li");
      const mutationRecord: MutationRecord = {
        type: "childList",
        addedNodes: addedNodes,
        attributeName: null,
        attributeNamespace: null,
        nextSibling: null,
        oldValue: null,
        previousSibling: null,
        removedNodes: removedNodes,
        target: document.body,
      };
      collectAutofillContentService["domRecentlyMutated"] = false;
      collectAutofillContentService["noFieldsFound"] = true;
      collectAutofillContentService["currentLocationHref"] = window.location.href;
      jest.spyOn(collectAutofillContentService as any, "setupOverlayListenersOnMutatedElements");

      collectAutofillContentService["handleMutationObserverMutation"]([mutationRecord]);
      jest.runAllTimers();

      expect(
        collectAutofillContentService["setupOverlayListenersOnMutatedElements"],
      ).toHaveBeenCalled();
    });
  });

  describe("setupOverlayListenersOnMutatedElements", () => {
    it("skips building the autofill field item if the node is not a form field element", () => {
      const divElement = document.createElement("div");
      const nodes = [divElement];
      jest.spyOn(collectAutofillContentService as any, "buildAutofillFieldItem");

      collectAutofillContentService["setupOverlayListenersOnMutatedElements"](nodes);

      expect(collectAutofillContentService["buildAutofillFieldItem"]).not.toHaveBeenCalled();
    });

    it("skips building the autofill field item if the node is already a field element", () => {
      const inputElement = document.createElement("input") as ElementWithOpId<HTMLInputElement>;
      inputElement.setAttribute("type", "password");
      const nodes = [inputElement];
      collectAutofillContentService["autofillFieldElements"].set(inputElement, {
        opid: "1234",
      } as AutofillField);
      jest.spyOn(collectAutofillContentService as any, "buildAutofillFieldItem");

      collectAutofillContentService["setupOverlayListenersOnMutatedElements"](nodes);

      expect(collectAutofillContentService["buildAutofillFieldItem"]).not.toHaveBeenCalled();
    });
  });

  describe("deleteCachedAutofillElement", () => {
    it("removes the autofill form element from the map of elements", () => {
      const formElement = document.createElement("form") as ElementWithOpId<HTMLFormElement>;
      const autofillForm: AutofillForm = {
        opid: "1234",
        htmlName: "formEl",
        htmlID: "formEl-id",
        htmlAction: "https://example.com",
        htmlMethod: "POST",
      };
      collectAutofillContentService["_autofillFormElements"] = new Map([
        [formElement, autofillForm],
      ]);

      collectAutofillContentService["deleteCachedAutofillElement"](formElement);

      expect(collectAutofillContentService["_autofillFormElements"].size).toEqual(0);
    });

    it("removes the autofill field element form the map of elements", () => {
      const fieldElement = document.createElement("input") as ElementWithOpId<HTMLInputElement>;
      const autofillField: AutofillField = {
        elementNumber: 0,
        htmlClass: "",
        tabindex: "",
        title: "",
        viewable: false,
        opid: "1234",
        htmlName: "username",
        htmlID: "username-id",
        htmlType: "text",
        htmlAutocomplete: "username",
        htmlAutofocus: false,
        htmlDisabled: false,
        htmlMaxLength: 999,
        htmlReadonly: false,
        htmlRequired: false,
        htmlValue: "jsmith",
      };
      collectAutofillContentService["autofillFieldElements"] = new Map([
        [fieldElement, autofillField],
      ]);

      collectAutofillContentService["deleteCachedAutofillElement"](fieldElement);

      expect(collectAutofillContentService["autofillFieldElements"].size).toEqual(0);
    });
  });

  describe("handleWindowLocationMutation", () => {
    it("will set the current location to the global location href, set the dom recently mutated flag and the no fields found flag, clear out the autofill form and field maps, and update the autofill elements after mutation", () => {
      collectAutofillContentService["currentLocationHref"] = "https://example.com/login";
      collectAutofillContentService["domRecentlyMutated"] = false;
      collectAutofillContentService["noFieldsFound"] = true;
      jest.spyOn(collectAutofillContentService as any, "updateAutofillElementsAfterMutation");

      collectAutofillContentService["handleWindowLocationMutation"]();

      expect(collectAutofillContentService["currentLocationHref"]).toEqual(window.location.href);
      expect(collectAutofillContentService["domRecentlyMutated"]).toEqual(true);
      expect(collectAutofillContentService["noFieldsFound"]).toEqual(false);
      expect(
        collectAutofillContentService["updateAutofillElementsAfterMutation"],
      ).toHaveBeenCalled();
      expect(collectAutofillContentService["_autofillFormElements"].size).toEqual(0);
      expect(collectAutofillContentService["autofillFieldElements"].size).toEqual(0);
    });
  });

  describe("handleAutofillElementAttributeMutation", () => {
    it("returns early if the target node is not an HTMLElement instance", () => {
      const mutationRecord: MutationRecord = {
        type: "attributes",
        addedNodes: null,
        attributeName: "value",
        attributeNamespace: null,
        nextSibling: null,
        oldValue: null,
        previousSibling: null,
        removedNodes: null,
        target: document.createTextNode("Hello, world!"),
      };
      jest.spyOn(collectAutofillContentService as any, "isAutofillElementNodeMutated");

      collectAutofillContentService["handleAutofillElementAttributeMutation"](mutationRecord);

      expect(collectAutofillContentService["isAutofillElementNodeMutated"]).not.toHaveBeenCalled();
    });

    it("will update the autofill form element data if the target node can be found in the autofillFormElements map", () => {
      const targetNode = document.createElement("form") as ElementWithOpId<HTMLFormElement>;
      targetNode.setAttribute("name", "username");
      targetNode.setAttribute("value", "jsmith");
      const autofillForm: AutofillForm = {
        opid: "1234",
        htmlName: "formEl",
        htmlID: "formEl-id",
        htmlAction: "https://example.com",
        htmlMethod: "POST",
      };
      const mutationRecord: MutationRecord = {
        type: "attributes",
        addedNodes: null,
        attributeName: "id",
        attributeNamespace: null,
        nextSibling: null,
        oldValue: null,
        previousSibling: null,
        removedNodes: null,
        target: targetNode,
      };
      collectAutofillContentService["_autofillFormElements"] = new Map([
        [targetNode, autofillForm],
      ]);
      jest.spyOn(collectAutofillContentService as any, "updateAutofillFormElementData");

      collectAutofillContentService["handleAutofillElementAttributeMutation"](mutationRecord);

      expect(collectAutofillContentService["updateAutofillFormElementData"]).toHaveBeenCalledWith(
        mutationRecord.attributeName,
        mutationRecord.target,
        autofillForm,
      );
    });

    it("will update the autofill field element data if the target node can be found in the autofillFieldElements map", () => {
      const targetNode = document.createElement("input") as ElementWithOpId<HTMLInputElement>;
      targetNode.setAttribute("name", "username");
      targetNode.setAttribute("value", "jsmith");
      const autofillField: AutofillField = {
        elementNumber: 0,
        htmlClass: "",
        tabindex: "",
        title: "",
        viewable: false,
        opid: "1234",
        htmlName: "username",
        htmlID: "username-id",
        htmlType: "text",
        htmlAutocomplete: "username",
        htmlAutofocus: false,
        htmlDisabled: false,
        htmlMaxLength: 999,
        htmlReadonly: false,
        htmlRequired: false,
        htmlValue: "jsmith",
      };
      const mutationRecord: MutationRecord = {
        type: "attributes",
        addedNodes: null,
        attributeName: "id",
        attributeNamespace: null,
        nextSibling: null,
        oldValue: null,
        previousSibling: null,
        removedNodes: null,
        target: targetNode,
      };
      collectAutofillContentService["autofillFieldElements"] = new Map([
        [targetNode, autofillField],
      ]);
      jest.spyOn(collectAutofillContentService as any, "updateAutofillFieldElementData");

      collectAutofillContentService["handleAutofillElementAttributeMutation"](mutationRecord);

      expect(collectAutofillContentService["updateAutofillFieldElementData"]).toHaveBeenCalledWith(
        mutationRecord.attributeName,
        mutationRecord.target,
        autofillField,
      );
    });
  });

  describe("updateAutofillFormElementData", () => {
    const formElement = document.createElement("form") as ElementWithOpId<HTMLFormElement>;
    const autofillForm: AutofillForm = {
      opid: "1234",
      htmlName: "formEl",
      htmlID: "formEl-id",
      htmlAction: "https://example.com",
      htmlMethod: "POST",
    };
    const updatedAttributes = ["action", "name", "id", "method"];

    beforeEach(() => {
      collectAutofillContentService["_autofillFormElements"] = new Map([
        [formElement, autofillForm],
      ]);
    });

    updatedAttributes.forEach((attribute) => {
      it(`will update the ${attribute} value for the form element`, () => {
        jest.spyOn(collectAutofillContentService["_autofillFormElements"], "set");

        collectAutofillContentService["updateAutofillFormElementData"](
          attribute,
          formElement,
          autofillForm,
        );

        expect(collectAutofillContentService["_autofillFormElements"].set).toHaveBeenCalledWith(
          formElement,
          autofillForm,
        );
      });
    });

    it("will not update an attribute value if it is not present in the updateActions object", () => {
      jest.spyOn(collectAutofillContentService["_autofillFormElements"], "set");

      collectAutofillContentService["updateAutofillFormElementData"](
        "aria-label",
        formElement,
        autofillForm,
      );

      expect(collectAutofillContentService["_autofillFormElements"].set).not.toHaveBeenCalled();
    });
  });

  describe("updateAutofillFieldElementData", () => {
    const fieldElement = document.createElement("input") as ElementWithOpId<HTMLInputElement>;
    const autofillField: AutofillField = {
      htmlClass: "value",
      htmlID: "",
      htmlName: "",
      opid: "",
      tabindex: "",
      title: "",
      viewable: false,
      elementNumber: 0,
    };
    const updatedAttributes = [
      "maxlength",
      "name",
      "id",
      "type",
      "autocomplete",
      "class",
      "tabindex",
      "title",
      "value",
      "rel",
      "tagname",
      "checked",
      "disabled",
      "readonly",
      "data-label",
      "aria-label",
      "aria-hidden",
      "aria-disabled",
      "aria-haspopup",
      "data-stripe",
    ];

    beforeEach(() => {
      collectAutofillContentService["autofillFieldElements"] = new Map([
        [fieldElement, autofillField],
      ]);
    });

    updatedAttributes.forEach((attribute) => {
      it(`will update the ${attribute} value for the field element`, () => {
        jest.spyOn(collectAutofillContentService["autofillFieldElements"], "set");

        collectAutofillContentService["updateAutofillFieldElementData"](
          attribute,
          fieldElement,
          autofillField,
        );

        expect(collectAutofillContentService["autofillFieldElements"].set).toHaveBeenCalledWith(
          fieldElement,
          autofillField,
        );
      });
    });

    it("will not update an attribute value if it is not present in the updateActions object", () => {
      jest.spyOn(collectAutofillContentService["autofillFieldElements"], "set");

      collectAutofillContentService["updateAutofillFieldElementData"](
        "random-attribute",
        fieldElement,
        autofillField,
      );

      expect(collectAutofillContentService["autofillFieldElements"].set).not.toHaveBeenCalled();
    });
  });

  describe("handleFormElementIntersection", () => {
    let isElementViewableSpy: jest.SpyInstance;
    let setupAutofillOverlayListenerOnFieldSpy: jest.SpyInstance;

    beforeEach(() => {
      isElementViewableSpy = jest.spyOn(
        collectAutofillContentService["domElementVisibilityService"],
        "isElementViewable",
      );
      setupAutofillOverlayListenerOnFieldSpy = jest.spyOn(
        collectAutofillContentService["autofillOverlayContentService"],
        "setupOverlayListeners",
      );
    });

    it("skips the initial intersection event for an observed element", async () => {
      const formFieldElement = document.createElement("input") as ElementWithOpId<FormFieldElement>;
      collectAutofillContentService["elementInitializingIntersectionObserver"].add(
        formFieldElement,
      );
      const entries = [
        { target: formFieldElement, isIntersecting: true },
      ] as unknown as IntersectionObserverEntry[];

      await collectAutofillContentService["handleFormElementIntersection"](entries);

      expect(isElementViewableSpy).not.toHaveBeenCalled();
      expect(setupAutofillOverlayListenerOnFieldSpy).not.toHaveBeenCalled();
    });

    it("skips setting up the overlay listeners on a field that is not viewable", async () => {
      const formFieldElement = document.createElement("input") as ElementWithOpId<FormFieldElement>;
      const autofillField = mock<AutofillField>();
      const entries = [
        { target: formFieldElement, isIntersecting: true },
      ] as unknown as IntersectionObserverEntry[];
      collectAutofillContentService["autofillFieldElements"].set(formFieldElement, autofillField);
      isElementViewableSpy.mockReturnValueOnce(false);

      await collectAutofillContentService["handleFormElementIntersection"](entries);

      expect(isElementViewableSpy).toHaveBeenCalledWith(formFieldElement);
      expect(setupAutofillOverlayListenerOnFieldSpy).not.toHaveBeenCalled();
    });

    it("skips setting up the inline menu listeners if the observed form field is not present in the cache", async () => {
      const formFieldElement = document.createElement("input") as ElementWithOpId<FormFieldElement>;
      const entries = [
        { target: formFieldElement, isIntersecting: true },
      ] as unknown as IntersectionObserverEntry[];
      isElementViewableSpy.mockReturnValueOnce(true);
      collectAutofillContentService["intersectionObserver"] = mockIntersectionObserver;

      await collectAutofillContentService["handleFormElementIntersection"](entries);

      expect(isElementViewableSpy).not.toHaveBeenCalled();
      expect(setupAutofillOverlayListenerOnFieldSpy).not.toHaveBeenCalled();
    });

    it("sets up the inline menu listeners on a viewable field", async () => {
      const formFieldElement = document.createElement("input") as ElementWithOpId<FormFieldElement>;
      const autofillField = mock<AutofillField>();
      const entries = [
        { target: formFieldElement, isIntersecting: true },
      ] as unknown as IntersectionObserverEntry[];
      isElementViewableSpy.mockReturnValueOnce(true);
      collectAutofillContentService["autofillFieldElements"].set(formFieldElement, autofillField);
      collectAutofillContentService["intersectionObserver"] = mockIntersectionObserver;

      await collectAutofillContentService["handleFormElementIntersection"](entries);

      expect(isElementViewableSpy).toHaveBeenCalledWith(formFieldElement);
      expect(setupAutofillOverlayListenerOnFieldSpy).toHaveBeenCalledWith(
        formFieldElement,
        autofillField,
        expect.anything(),
      );
    });
  });

  describe("destroy", () => {
    it("clears the updateAfterMutationIdleCallback", () => {
      jest.spyOn(window, "clearTimeout");
      collectAutofillContentService["updateAfterMutationIdleCallback"] = setTimeout(jest.fn, 100);

      collectAutofillContentService.destroy();

      expect(clearTimeout).toHaveBeenCalledWith(
        collectAutofillContentService["updateAfterMutationIdleCallback"],
      );
    });
  });

  describe("processMutations", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.runOnlyPendingTimers();
      jest.useRealTimers();
    });

    it("will require an update to page details if shadow DOM is present", () => {
      jest
        .spyOn(domQueryService as any, "checkPageContainsShadowDom")
        .mockImplementationOnce(() => true);

      collectAutofillContentService["requirePageDetailsUpdate"] = jest.fn();

      collectAutofillContentService["mutationsQueue"] = [[], []];

      collectAutofillContentService["processMutations"]();

      jest.runOnlyPendingTimers();

      expect(domQueryService.checkPageContainsShadowDom).toHaveBeenCalled();
      expect(collectAutofillContentService["mutationsQueue"]).toHaveLength(0);
      expect(collectAutofillContentService["requirePageDetailsUpdate"]).toHaveBeenCalled();
    });
  });
});
