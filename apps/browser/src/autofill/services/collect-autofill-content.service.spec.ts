import {
  ElementWithOpId,
  FillableFormFieldElement,
  FormFieldElement,
  FormElementWithAttribute,
} from "../types";

import CollectAutofillContentService from "./collect-autofill-content.service";
import DomElementVisibilityService from "./dom-element-visibility.service";

const mockLoginForm = `
  <div id="root">
    <form>
      <input type="text" id="username" />
      <input type="password" />
    </form>
  </div>
`;

describe("CollectAutofillContentService", () => {
  const domElementVisibilityService = new DomElementVisibilityService();
  let collectAutofillContentService: CollectAutofillContentService;

  beforeEach(() => {
    document.body.innerHTML = mockLoginForm;
    collectAutofillContentService = new CollectAutofillContentService(domElementVisibilityService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = "";
  });

  describe("getPageDetails", () => {
    it("returns an object containing information about the curren page as well as autofill data for the forms and fields of the page", async () => {
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
        .spyOn(collectAutofillContentService["domElementVisibilityService"], "isFormFieldViewable")
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
          },
        ],
        collectedTimestamp: expect.any(Number),
      });
    });
  });

  describe("getAutofillFieldElementByOpid", () => {
    it("returns the element with the opid property value matching the passed value", () => {
      const textInput = document.querySelector('input[type="text"]') as FormElementWithAttribute;
      const passwordInput = document.querySelector(
        'input[type="password"]'
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
        'input[type="password"]'
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
        'input[type="password"]'
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

      const autofillFormsData = collectAutofillContentService["buildAutofillFormsData"]();

      expect(autofillFormsData).toStrictEqual({
        __form__0: {
          opid: "__form__0",
          htmlAction: formAction1,
          htmlName: formName1,
          htmlID: formId1,
          htmlMethod: formMethod1,
        },
        __form__1: {
          opid: "__form__1",
          htmlAction: formAction2,
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
        .spyOn(collectAutofillContentService["domElementVisibilityService"], "isFormFieldViewable")
        .mockResolvedValue(true);

      const autofillFieldsPromise = collectAutofillContentService["buildAutofillFieldsData"]();
      const autofillFieldsData = await Promise.resolve(autofillFieldsPromise);

      expect(collectAutofillContentService["getAutofillFieldElements"]).toHaveBeenCalledWith(50);
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

      expect(document.querySelectorAll).toHaveBeenCalledWith(
        'input:not([type="hidden"]):not([type="submit"]):not([type="reset"]):not([type="button"]):not([type="image"]):not([type="file"]):not([data-bwignore]), textarea:not([data-bwignore]), select:not([data-bwignore]), span[data-bwautofill]'
      );
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
        "type"
      );
      expect(collectAutofillContentService["getPropertyOrAttribute"]).toHaveBeenNthCalledWith(
        2,
        textAreaInput,
        "type"
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
        spanElementId
      ) as ElementWithOpId<FormFieldElement>;
      jest.spyOn(collectAutofillContentService as any, "getAutofillFieldMaxLength");
      jest
        .spyOn(collectAutofillContentService["domElementVisibilityService"], "isFormFieldViewable")
        .mockResolvedValue(true);
      jest.spyOn(collectAutofillContentService as any, "getPropertyOrAttribute");
      jest.spyOn(collectAutofillContentService as any, "getElementValue");

      const autofillFieldItem = await collectAutofillContentService["buildAutofillFieldItem"](
        spanElement,
        index
      );

      expect(collectAutofillContentService["getAutofillFieldMaxLength"]).toHaveBeenCalledWith(
        spanElement
      );
      expect(
        collectAutofillContentService["domElementVisibilityService"].isFormFieldViewable
      ).toHaveBeenCalledWith(spanElement);
      expect(collectAutofillContentService["getPropertyOrAttribute"]).toHaveBeenNthCalledWith(
        1,
        spanElement,
        "id"
      );
      expect(collectAutofillContentService["getPropertyOrAttribute"]).toHaveBeenNthCalledWith(
        2,
        spanElement,
        "name"
      );
      expect(collectAutofillContentService["getPropertyOrAttribute"]).toHaveBeenNthCalledWith(
        3,
        spanElement,
        "class"
      );
      expect(collectAutofillContentService["getPropertyOrAttribute"]).toHaveBeenNthCalledWith(
        4,
        spanElement,
        "tabindex"
      );
      expect(collectAutofillContentService["getPropertyOrAttribute"]).toHaveBeenNthCalledWith(
        5,
        spanElement,
        "title"
      );
      expect(collectAutofillContentService["getPropertyOrAttribute"]).toHaveBeenNthCalledWith(
        6,
        spanElement,
        "tagName"
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
        usernameField.id
      ) as ElementWithOpId<FillableFormFieldElement>;
      jest.spyOn(collectAutofillContentService as any, "getAutofillFieldMaxLength");
      jest
        .spyOn(collectAutofillContentService["domElementVisibilityService"], "isFormFieldViewable")
        .mockResolvedValue(true);
      jest.spyOn(collectAutofillContentService as any, "getPropertyOrAttribute");
      jest.spyOn(collectAutofillContentService as any, "getElementValue");

      const autofillFieldItem = await collectAutofillContentService["buildAutofillFieldItem"](
        usernameInput,
        index
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
        hiddenField.id
      ) as ElementWithOpId<FillableFormFieldElement>;
      jest.spyOn(collectAutofillContentService as any, "getAutofillFieldMaxLength");
      jest
        .spyOn(collectAutofillContentService["domElementVisibilityService"], "isFormFieldViewable")
        .mockResolvedValue(true);
      jest.spyOn(collectAutofillContentService as any, "getPropertyOrAttribute");
      jest.spyOn(collectAutofillContentService as any, "getElementValue");

      const autofillFieldItem = await collectAutofillContentService["buildAutofillFieldItem"](
        hiddenInput,
        index
      );

      expect(autofillFieldItem).toEqual({
        "aria-disabled": false,
        "aria-haspopup": false,
        "aria-hidden": false,
        autoCompleteType: null,
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
        new Set(element.labels)
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
        new Set([elementLabel])
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
        new Set([elementLabel])
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
        `label[for="${element.id}"], label[for="${element.name}"]`
      );
      expect(collectAutofillContentService["createLabelElementsTag"]).toHaveBeenCalledWith(
        new Set([elementLabel])
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
        new Set([elementLabel])
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
        new Set([elementLabel])
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
        collectAutofillContentService["trimAndRemoveNonPrintableText"]
      ).toHaveBeenNthCalledWith(1, firstLabelText);
      expect(
        collectAutofillContentService["trimAndRemoveNonPrintableText"]
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
        'input[name="password"]'
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
        'input[name="auth-code"]'
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
        'input[name="password"]'
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
        'input[name="password"]'
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
        'input[name="auth-code"]'
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
        textNode.nodeValue
      );
      jest.spyOn(collectAutofillContentService as any, "trimAndRemoveNonPrintableText");

      const textContent = collectAutofillContentService["getTextContentFromElement"](textNode);

      expect(textNode.nodeType).toEqual(Node.TEXT_NODE);
      expect(collectAutofillContentService["trimAndRemoveNonPrintableText"]).toHaveBeenCalledWith(
        textNode.nodeValue
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
        element.textContent
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
        "value"
      );
      const textInputId = collectAutofillContentService["getPropertyOrAttribute"](textInput, "id");
      const textInputBaseURI = collectAutofillContentService["getPropertyOrAttribute"](
        textInput,
        "baseURI"
      );
      const textInputAutofocus = collectAutofillContentService["getPropertyOrAttribute"](
        textInput,
        "autofocus"
      );
      const checkboxInputChecked = collectAutofillContentService["getPropertyOrAttribute"](
        checkboxInput,
        "checked"
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
        "data-unique-attribute"
      );

      expect(textInputUniqueAttribute).toEqual("unique-value");
      expect(textInput.getAttribute).toHaveBeenCalledWith("data-unique-attribute");
    });

    it("returns a null value if the element does not contain the passed attribute name as either a property or attribute value", () => {
      const textInput = document.querySelector("#username") as HTMLInputElement;
      jest.spyOn(textInput, "getAttribute");

      const textInputNonExistentAttribute = collectAutofillContentService["getPropertyOrAttribute"](
        textInput,
        "non-existent-attribute"
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
        "#long-value-hidden-input"
      ) as HTMLInputElement;

      const longHiddenValue =
        collectAutofillContentService["getElementValue"](longValueHiddenInput);

      expect(longHiddenValue).toEqual(
        "’Twas brillig, and the slithy toves | Did gyre and gimble in the wabe: | All mimsy were the borogoves, | And the mome raths outgrabe. | “Beware the Jabberwock, my son! | The jaws that bite, the claws that catch! | Beware the Jubjub bird, and shun | The f...SNIPPED"
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
        "#select-without-options"
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
});
