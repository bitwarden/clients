// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import AutofillField from "../models/autofill-field";
import AutofillForm from "../models/autofill-form";
import AutofillPageDetails from "../models/autofill-page-details";
import { ElementWithOpId, FillableFormFieldElement, FormFieldElement } from "../types";
import {
  elementIsDescriptionDetailsElement,
  elementIsDescriptionTermElement,
  elementIsFillableFormField,
  elementIsFormElement,
  elementIsInputElement,
  elementIsLabelElement,
  elementIsSelectElement,
  elementIsSpanElement,
  nodeIsElement,
  elementIsTextAreaElement,
  nodeIsFormElement,
  nodeIsInputElement,
  sendExtensionMessage,
  getAttributeBoolean,
  getPropertyOrAttribute,
  requestIdleCallbackPolyfill,
  cancelIdleCallbackPolyfill,
  debounce,
} from "../utils";

import { AutofillOverlayContentService } from "./abstractions/autofill-overlay-content.service";
import {
  AutofillFieldElements,
  AutofillFormElements,
  CollectAutofillContentService as CollectAutofillContentServiceInterface,
  UpdateAutofillDataAttributeParams,
} from "./abstractions/collect-autofill-content.service";
import { DomElementVisibilityService } from "./abstractions/dom-element-visibility.service";
import { DomQueryService } from "./abstractions/dom-query.service";

export class CollectAutofillContentService implements CollectAutofillContentServiceInterface {
  private readonly sendExtensionMessage = sendExtensionMessage;
  private readonly getAttributeBoolean = getAttributeBoolean;
  private readonly getPropertyOrAttribute = getPropertyOrAttribute;
  private noFieldsFound = false;
  private domRecentlyMutated = true;
  private _autofillFormElements: AutofillFormElements = new Map();
  private autofillFieldElements: AutofillFieldElements = new Map();
  private currentLocationHref = "";
  private intersectionObserver: IntersectionObserver;
  private elementInitializingIntersectionObserver: Set<Element> = new Set();
  private mutationObserver: MutationObserver;
  private mutationsQueue: MutationRecord[][] = [];
  private updateAfterMutationIdleCallback: NodeJS.Timeout | number;
  private ownedExperienceTagNames: string[] = [];
  private readonly updateAfterMutationTimeout = 1000;
  private readonly formFieldQueryString;
  private readonly nonInputFormFieldTags = new Set(["textarea", "select"]);
  private readonly ignoredInputTypes = new Set([
    "hidden",
    "submit",
    "reset",
    "button",
    "image",
    "file",
  ]);

  constructor(
    private domElementVisibilityService: DomElementVisibilityService,
    private domQueryService: DomQueryService,
    private autofillOverlayContentService?: AutofillOverlayContentService,
  ) {
    let inputQuery = "input:not([data-bwignore])";
    for (const type of this.ignoredInputTypes) {
      inputQuery += `:not([type="${type}"])`;
    }
    this.formFieldQueryString = `${inputQuery}, textarea:not([data-bwignore]), select:not([data-bwignore]), span[data-bwautofill]`;
  }

  get autofillFormElements(): AutofillFormElements {
    return this._autofillFormElements;
  }

  /**
   * Builds the data for all forms and fields found within the page DOM.
   * Sets up a mutation observer to verify DOM changes and returns early
   * with cached data if no changes are detected.
   * @returns {Promise<AutofillPageDetails>}
   * @public
   */
  async getPageDetails(): Promise<AutofillPageDetails> {
    // Set up listeners on top-layer candidates that predate Mutation Observer setup
    this.setupInitialTopLayerListeners();

    if (!this.mutationObserver) {
      this.setupMutationObserver();
    }

    if (!this.intersectionObserver) {
      this.setupIntersectionObserver();
    }

    if (!this.domRecentlyMutated && this.noFieldsFound) {
      return this.getFormattedPageDetails({}, []);
    }

    if (!this.domRecentlyMutated && this.autofillFieldElements.size) {
      this.updateCachedAutofillFieldVisibility();

      return this.getFormattedPageDetails(
        this.getFormattedAutofillFormsData(),
        this.getFormattedAutofillFieldsData(),
      );
    }

    const { formElements, formFieldElements } = this.queryAutofillFormAndFieldElements();
    const autofillFormsData: Record<string, AutofillForm> =
      this.buildAutofillFormsData(formElements);
    const autofillFieldsData: AutofillField[] = (
      await this.buildAutofillFieldsData(formFieldElements as FormFieldElement[])
    ).filter((field) => !!field);
    this.sortAutofillFieldElementsMap();

    if (!autofillFieldsData.length) {
      this.noFieldsFound = true;
    }

    this.domRecentlyMutated = false;
    const pageDetails = this.getFormattedPageDetails(autofillFormsData, autofillFieldsData);
    this.setupOverlayListeners(pageDetails);

    return pageDetails;
  }

  /**
   * Find an AutofillField element by its opid, will only return the first
   * element if there are multiple elements with the same opid. If no
   * element is found, null will be returned.
   * @param {string} opid
   * @returns {FormFieldElement | null}
   */
  getAutofillFieldElementByOpid(opid: string): FormFieldElement | null {
    const cachedFormFieldElements = Array.from(this.autofillFieldElements.keys());
    const formFieldElements = cachedFormFieldElements?.length
      ? cachedFormFieldElements
      : this.getAutofillFieldElements();
    const fieldElementsWithOpid = formFieldElements.filter(
      (fieldElement) => (fieldElement as ElementWithOpId<FormFieldElement>).opid === opid,
    ) as ElementWithOpId<FormFieldElement>[];

    if (!fieldElementsWithOpid.length) {
      const elementIndex = parseInt(opid.split("__")[1], 10);

      return formFieldElements[elementIndex] || null;
    }

    if (fieldElementsWithOpid.length > 1) {
      // eslint-disable-next-line no-console
      console.warn(`More than one element found with opid ${opid}`);
    }

    return fieldElementsWithOpid[0];
  }

  /**
   * Sorts the AutofillFieldElements map by the elementNumber property.
   * @private
   */
  private sortAutofillFieldElementsMap() {
    if (!this.autofillFieldElements.size) {
      return;
    }

    this.autofillFieldElements = new Map(
      [...this.autofillFieldElements].sort((a, b) => a[1].elementNumber - b[1].elementNumber),
    );
  }

  /**
   * Formats and returns the AutofillPageDetails object
   *
   * @param autofillFormsData - The data for all the forms found in the page
   * @param autofillFieldsData - The data for all the fields found in the page
   */
  private getFormattedPageDetails(
    autofillFormsData: Record<string, AutofillForm>,
    autofillFieldsData: AutofillField[],
  ): AutofillPageDetails {
    return {
      title: document.title,
      url: (document.defaultView || globalThis).location.href,
      documentUrl: document.location.href,
      forms: autofillFormsData,
      fields: autofillFieldsData,
      collectedTimestamp: Date.now(),
    };
  }

  /**
   * Re-checks the visibility for all form fields and updates the
   * cached data to reflect the most recent visibility state.
   *
   * @private
   */
  private updateCachedAutofillFieldVisibility() {
    this.autofillFieldElements.forEach(async (autofillField, element) => {
      const previouslyViewable = autofillField.viewable;
      autofillField.viewable = await this.domElementVisibilityService.isElementViewable(element);

      if (!previouslyViewable && autofillField.viewable) {
        this.setupOverlayOnField(element, autofillField);
      }
    });
  }

  /**
   * Queries the DOM for all the forms elements and
   * returns a collection of AutofillForm objects.
   * @returns {Record<string, AutofillForm>}
   * @private
   */
  private buildAutofillFormsData(formElements: Node[]): Record<string, AutofillForm> {
    for (let index = 0; index < formElements.length; index++) {
      const formElement = formElements[index] as ElementWithOpId<HTMLFormElement>;
      formElement.opid = `__form__${index}`;

      const existingAutofillForm = this._autofillFormElements.get(formElement);
      if (existingAutofillForm) {
        existingAutofillForm.opid = formElement.opid;
        this._autofillFormElements.set(formElement, existingAutofillForm);
        continue;
      }

      this._autofillFormElements.set(formElement, {
        opid: formElement.opid,
        htmlAction: this.getFormActionAttribute(formElement),
        htmlName: this.getPropertyOrAttribute(formElement, "name"),
        htmlClass: this.getPropertyOrAttribute(formElement, "class"),
        htmlID: this.getPropertyOrAttribute(formElement, "id"),
        htmlMethod: this.getPropertyOrAttribute(formElement, "method"),
      });
    }

    return this.getFormattedAutofillFormsData();
  }

  /**
   * Returns the action attribute of the form element. If the action attribute
   * is a relative path, it will be converted to an absolute path.
   * @param {ElementWithOpId<HTMLFormElement>} element
   * @returns {string}
   * @private
   */
  private getFormActionAttribute(element: ElementWithOpId<HTMLFormElement>): string {
    return new URL(this.getPropertyOrAttribute(element, "action"), globalThis.location.href).href;
  }

  /**
   * Iterates over all known form elements and returns an AutofillForm object
   * containing a key value pair of the form element's opid and the form data.
   * @returns {Record<string, AutofillForm>}
   * @private
   */
  private getFormattedAutofillFormsData(): Record<string, AutofillForm> {
    const autofillForms: Record<string, AutofillForm> = {};
    const autofillFormElements = Array.from(this._autofillFormElements);
    for (let index = 0; index < autofillFormElements.length; index++) {
      const [formElement, autofillForm] = autofillFormElements[index];
      autofillForms[formElement.opid] = autofillForm;
    }

    return autofillForms;
  }

  /**
   * Queries the DOM for all the field elements and
   * returns a list of AutofillField objects.
   * @returns {Promise<AutofillField[]>}
   * @private
   */
  private async buildAutofillFieldsData(
    formFieldElements: FormFieldElement[],
  ): Promise<AutofillField[]> {
    const autofillFieldElements = this.getAutofillFieldElements(100, formFieldElements);
    const autofillFieldDataPromises = autofillFieldElements.map(this.buildAutofillFieldItem);

    return Promise.all(autofillFieldDataPromises);
  }

  /**
   * Queries the DOM for all the field elements that can be autofilled,
   * and returns a list limited to the given `fieldsLimit` number that
   * is ordered by priority.
   * @param {number} fieldsLimit - The maximum number of fields to return
   * @param {FormFieldElement[]} previouslyFoundFormFieldElements - The list of all the field elements
   * @returns {FormFieldElement[]}
   * @private
   */
  private getAutofillFieldElements(
    fieldsLimit?: number,
    previouslyFoundFormFieldElements?: FormFieldElement[],
  ): FormFieldElement[] {
    let formFieldElements = previouslyFoundFormFieldElements;
    if (!formFieldElements) {
      formFieldElements = this.domQueryService.query<FormFieldElement>(
        globalThis.document.documentElement,
        this.formFieldQueryString,
        (node: Node) => this.isNodeFormFieldElement(node),
        this.mutationObserver,
      );
    }

    if (!fieldsLimit || formFieldElements.length <= fieldsLimit) {
      return formFieldElements;
    }

    const priorityFormFields: FormFieldElement[] = [];
    const unimportantFormFields: FormFieldElement[] = [];
    const unimportantFieldTypesSet = new Set(["checkbox", "radio"]);
    for (const element of formFieldElements) {
      if (priorityFormFields.length >= fieldsLimit) {
        return priorityFormFields;
      }

      const fieldType = this.getPropertyOrAttribute(element, "type")?.toLowerCase();
      if (unimportantFieldTypesSet.has(fieldType)) {
        unimportantFormFields.push(element);
        continue;
      }

      priorityFormFields.push(element);
    }

    const numberUnimportantFieldsToInclude = fieldsLimit - priorityFormFields.length;
    for (let index = 0; index < numberUnimportantFieldsToInclude; index++) {
      priorityFormFields.push(unimportantFormFields[index]);
    }

    return priorityFormFields;
  }

  /**
   * Builds an AutofillField object from the given form element. Will only return
   * shared field values if the element is a span element. Will not return any label
   * values if the element is a hidden input element.
   *
   * @param element - The form field element to build the AutofillField object from
   * @param index - The index of the form field element
   */
  private buildAutofillFieldItem = async (
    element: ElementWithOpId<FormFieldElement>,
    index: number,
  ): Promise<AutofillField | null> => {
    if (element.closest("button[type='submit']")) {
      return null;
    }

    element.opid = `__${index}`;

    const existingAutofillField = this.autofillFieldElements.get(element);
    if (index >= 0 && existingAutofillField) {
      existingAutofillField.opid = element.opid;
      existingAutofillField.elementNumber = index;
      this.autofillFieldElements.set(element, existingAutofillField);

      return existingAutofillField;
    }

    const autofillFieldBase = {
      opid: element.opid,
      elementNumber: index,
      maxLength: this.getAutofillFieldMaxLength(element),
      viewable: await this.domElementVisibilityService.isElementViewable(element),
      htmlID: this.getPropertyOrAttribute(element, "id"),
      htmlName: this.getPropertyOrAttribute(element, "name"),
      htmlClass: this.getPropertyOrAttribute(element, "class"),
      tabindex: this.getPropertyOrAttribute(element, "tabindex"),
      title: this.getPropertyOrAttribute(element, "title"),
      tagName: this.getAttributeLowerCase(element, "tagName"),
      dataSetValues: this.getDataSetValues(element),
    };

    if (!autofillFieldBase.viewable) {
      this.elementInitializingIntersectionObserver.add(element);
      this.intersectionObserver?.observe(element);
    }

    if (elementIsSpanElement(element)) {
      this.cacheAutofillFieldElement(index, element, autofillFieldBase);
      return autofillFieldBase;
    }

    let autofillFieldLabels = {};
    const elementType = this.getAttributeLowerCase(element, "type");
    if (elementType !== "hidden") {
      autofillFieldLabels = {
        "label-tag": this.createAutofillFieldLabelTag(element as FillableFormFieldElement),
        "label-data": this.getPropertyOrAttribute(element, "data-label"),
        "label-aria": this.getPropertyOrAttribute(element, "aria-label"),
        "label-top": this.createAutofillFieldTopLabel(element),
        "label-right": this.createAutofillFieldRightLabel(element),
        "label-left": this.createAutofillFieldLeftLabel(element),
        placeholder: this.getPropertyOrAttribute(element, "placeholder"),
      };
    }

    const fieldFormElement = (element as ElementWithOpId<FillableFormFieldElement>).form;
    const autofillField = {
      ...autofillFieldBase,
      ...autofillFieldLabels,
      rel: this.getPropertyOrAttribute(element, "rel"),
      type: elementType,
      value: this.getElementValue(element),
      checked: this.getAttributeBoolean(element, "checked"),
      autoCompleteType: this.getAutoCompleteAttribute(element),
      disabled: this.getAttributeBoolean(element, "disabled"),
      readonly: this.getAttributeBoolean(element, "readonly"),
      selectInfo: elementIsSelectElement(element)
        ? this.getSelectElementOptions(element as HTMLSelectElement)
        : null,
      form: fieldFormElement ? this.getPropertyOrAttribute(fieldFormElement, "opid") : null,
      "aria-hidden": this.getAttributeBoolean(element, "aria-hidden", true),
      "aria-disabled": this.getAttributeBoolean(element, "aria-disabled", true),
      "aria-haspopup": this.getAttributeBoolean(element, "aria-haspopup", true),
      "data-stripe": this.getPropertyOrAttribute(element, "data-stripe"),
    };

    this.cacheAutofillFieldElement(index, element, autofillField);
    return autofillField;
  };

  /**
   * Caches the autofill field element and its data.
   * Will not cache the element if the index is less than 0.
   *
   * @param index - The index of the autofill field element
   * @param element - The autofill field element to cache
   * @param autofillFieldData - The autofill field data to cache
   */
  private cacheAutofillFieldElement(
    index: number,
    element: ElementWithOpId<FormFieldElement>,
    autofillFieldData: AutofillField,
  ) {
    if (index < 0) {
      return;
    }

    this.autofillFieldElements.set(element, autofillFieldData);
  }

  /**
   * Identifies the autocomplete attribute associated with an element and returns
   * the value of the attribute if it is not set to "off".
   * @param {ElementWithOpId<FormFieldElement>} element
   * @returns {string}
   * @private
   */
  private getAutoCompleteAttribute(element: ElementWithOpId<FormFieldElement>): string {
    return (
      this.getPropertyOrAttribute(element, "x-autocompletetype") ||
      this.getPropertyOrAttribute(element, "autocompletetype") ||
      this.getPropertyOrAttribute(element, "autocomplete")
    );
  }

  /**
   * Returns the attribute of an element as a lowercase value.
   * @param {ElementWithOpId<FormFieldElement>} element
   * @param {string} attributeName
   * @returns {string}
   * @private
   */
  private getAttributeLowerCase(
    element: ElementWithOpId<FormFieldElement>,
    attributeName: string,
  ): string {
    return this.getPropertyOrAttribute(element, attributeName)?.toLowerCase();
  }

  /**
   * Returns the value of an element's property or attribute.
   * @returns {AutofillField[]}
   * @private
   */
  private getFormattedAutofillFieldsData(): AutofillField[] {
    return Array.from(this.autofillFieldElements.values());
  }

  /**
   * Creates a label tag used to autofill the element pulled from a label
   * associated with the element's id, name, parent element or from an
   * associated description term element if no other labels can be found.
   * Returns a string containing all the `textContent` or `innerText`
   * values of the label elements.
   * @param {FillableFormFieldElement} element
   * @returns {string}
   * @private
   */
  private createAutofillFieldLabelTag(element: FillableFormFieldElement): string {
    const labelElementsSet: Set<HTMLElement> = new Set(element.labels);
    if (labelElementsSet.size) {
      return this.createLabelElementsTag(labelElementsSet);
    }

    const labelElements: NodeListOf<HTMLLabelElement> | null = this.queryElementLabels(element);
    for (let labelIndex = 0; labelIndex < labelElements?.length; labelIndex++) {
      labelElementsSet.add(labelElements[labelIndex]);
    }

    let currentElement: HTMLElement | null = element;
    while (currentElement && currentElement !== document.documentElement) {
      if (elementIsLabelElement(currentElement)) {
        labelElementsSet.add(currentElement);
      }

      currentElement = currentElement.parentElement?.closest("label");
    }

    if (
      !labelElementsSet.size &&
      elementIsDescriptionDetailsElement(element.parentElement) &&
      elementIsDescriptionTermElement(element.parentElement.previousElementSibling)
    ) {
      labelElementsSet.add(element.parentElement.previousElementSibling);
    }

    return this.createLabelElementsTag(labelElementsSet);
  }

  /**
   * Queries the DOM for label elements associated with the given element
   * by id or name. Returns a NodeList of label elements or null if none
   * are found.
   * @param {FillableFormFieldElement} element
   * @returns {NodeListOf<HTMLLabelElement> | null}
   * @private
   */
  private queryElementLabels(
    element: FillableFormFieldElement,
  ): NodeListOf<HTMLLabelElement> | null {
    let labelQuerySelectors = element.id ? `label[for="${element.id}"]` : "";
    if (element.name) {
      const forElementNameSelector = `label[for="${element.name}"]`;
      labelQuerySelectors = labelQuerySelectors
        ? `${labelQuerySelectors}, ${forElementNameSelector}`
        : forElementNameSelector;
    }

    if (!labelQuerySelectors) {
      return null;
    }

    return (element.getRootNode() as Document | ShadowRoot).querySelectorAll(
      labelQuerySelectors.replace(/\n/g, ""),
    );
  }

  /**
   * Map over all the label elements and creates a
   * string of the text content of each label element.
   * @param {Set<HTMLElement>} labelElementsSet
   * @returns {string}
   * @private
   */
  private createLabelElementsTag = (labelElementsSet: Set<HTMLElement>): string => {
    return Array.from(labelElementsSet)
      .map((labelElement) => {
        const textContent: string | null = labelElement
          ? labelElement.textContent || labelElement.innerText
          : null;

        return this.trimAndRemoveNonPrintableText(textContent || "");
      })
      .join("");
  };

  /**
   * Gets the maxLength property of the passed FormFieldElement and
   * returns the value or null if the element does not have a
   * maxLength property. If the element has a maxLength property
   * greater than 999, it will return 999.
   * @param {FormFieldElement} element
   * @returns {number | null}
   * @private
   */
  private getAutofillFieldMaxLength(element: FormFieldElement): number | null {
    const elementHasMaxLengthProperty =
      elementIsInputElement(element) || elementIsTextAreaElement(element);
    const elementMaxLength =
      elementHasMaxLengthProperty && element.maxLength > -1 ? element.maxLength : 999;

    return elementHasMaxLengthProperty ? Math.min(elementMaxLength, 999) : null;
  }

  /**
   * Iterates over the next siblings of the passed element and
   * returns a string of the text content of each element. Will
   * stop iterating if it encounters a new section element.
   * @param {FormFieldElement} element
   * @returns {string}
   * @private
   */
  private createAutofillFieldRightLabel(element: FormFieldElement): string {
    const labelTextContent: string[] = [];
    let currentElement: ChildNode = element;

    while (currentElement && currentElement.nextSibling) {
      currentElement = currentElement.nextSibling;
      if (this.isNewSectionElement(currentElement)) {
        break;
      }

      const textContent = this.getTextContentFromElement(currentElement);
      if (textContent) {
        labelTextContent.push(textContent);
      }
    }

    return labelTextContent.join("");
  }

  /**
   * Recursively gets the text content from an element's previous siblings
   * and returns a string of the text content of each element.
   * @param {FormFieldElement} element
   * @returns {string}
   * @private
   */
  private createAutofillFieldLeftLabel(element: FormFieldElement): string {
    const labelTextContent: string[] = this.recursivelyGetTextFromPreviousSiblings(element);

    return labelTextContent.reverse().join("");
  }

  /**
   * Assumes that the input elements that are to be autofilled are within a
   * table structure. Queries the previous sibling of the parent row that
   * the input element is in and returns the text content of the cell that
   * is in the same column as the input element.
   * @param {FormFieldElement} element
   * @returns {string | null}
   * @private
   */
  private createAutofillFieldTopLabel(element: FormFieldElement): string | null {
    const tableDataElement = element.closest("td");
    if (!tableDataElement) {
      return null;
    }

    const tableDataElementIndex = tableDataElement.cellIndex;
    if (tableDataElementIndex < 0) {
      return null;
    }

    const parentSiblingTableRowElement = tableDataElement.closest("tr")
      ?.previousElementSibling as HTMLTableRowElement;

    return parentSiblingTableRowElement?.cells?.length > tableDataElementIndex
      ? this.getTextContentFromElement(parentSiblingTableRowElement.cells[tableDataElementIndex])
      : null;
  }

  /**
   * Check if the element's tag indicates that a transition to a new section of the
   * page is occurring. If so, we should not use the element or its children in order
   * to get autofill context for the previous element.
   * @param {HTMLElement} currentElement
   * @returns {boolean}
   * @private
   */
  private isNewSectionElement(currentElement: HTMLElement | Node): boolean {
    if (!currentElement) {
      return true;
    }

    const transitionalElementTagsSet = new Set([
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
    ]);
    return (
      "tagName" in currentElement &&
      transitionalElementTagsSet.has(currentElement.tagName.toLowerCase())
    );
  }

  /**
   * Gets the text content from a passed element, regardless of whether it is a
   * text node, an element node or an HTMLElement.
   * @param {Node | HTMLElement} element
   * @returns {string}
   * @private
   */
  private getTextContentFromElement(element: Node | HTMLElement): string {
    if (element.nodeType === Node.TEXT_NODE) {
      return this.trimAndRemoveNonPrintableText(element.nodeValue);
    }

    return this.trimAndRemoveNonPrintableText(
      element.textContent || (element as HTMLElement).innerText,
    );
  }

  /**
   * Removes non-printable characters from the passed text
   * content and trims leading and trailing whitespace.
   * @param {string} textContent
   * @returns {string}
   * @private
   */
  private trimAndRemoveNonPrintableText(textContent: string): string {
    return (textContent || "")
      .replace(/\p{C}+|\s+/gu, " ") // Strip out non-printable characters and replace multiple spaces with a single space
      .trim(); // Trim leading and trailing whitespace
  }

  /**
   * Get the text content from the previous siblings of the element. If
   * no text content is found, recursively get the text content from the
   * previous siblings of the parent element.
   * @param {FormFieldElement} element
   * @returns {string[]}
   * @private
   */
  private recursivelyGetTextFromPreviousSiblings(element: Node | HTMLElement): string[] {
    const textContentItems: string[] = [];
    let currentElement = element;
    while (currentElement && currentElement.previousSibling) {
      // Ensure we are capturing text content from nodes and elements.
      currentElement = currentElement.previousSibling;

      if (this.isNewSectionElement(currentElement)) {
        return textContentItems;
      }

      const textContent = this.getTextContentFromElement(currentElement);
      if (textContent) {
        textContentItems.push(textContent);
      }
    }

    if (!currentElement || textContentItems.length) {
      return textContentItems;
    }

    // Prioritize capturing text content from elements rather than nodes.
    currentElement = currentElement.parentElement || currentElement.parentNode;
    if (!currentElement) {
      return textContentItems;
    }

    let siblingElement = nodeIsElement(currentElement)
      ? currentElement.previousElementSibling
      : currentElement.previousSibling;
    while (siblingElement?.lastChild && !this.isNewSectionElement(siblingElement)) {
      siblingElement = siblingElement.lastChild;
    }

    if (this.isNewSectionElement(siblingElement)) {
      return textContentItems;
    }

    const textContent = this.getTextContentFromElement(siblingElement);
    if (textContent) {
      textContentItems.push(textContent);
      return textContentItems;
    }

    return this.recursivelyGetTextFromPreviousSiblings(siblingElement);
  }

  /**
   * Gets the value of the element. If the element is a checkbox, returns a checkmark if the
   * checkbox is checked, or an empty string if it is not checked. If the element is a hidden
   * input, returns the value of the input if it is less than 254 characters, or a truncated
   * value if it is longer than 254 characters.
   * @param {FormFieldElement} element
   * @returns {string}
   * @private
   */
  private getElementValue(element: FormFieldElement): string {
    if (!elementIsFillableFormField(element)) {
      const spanTextContent = element.textContent || element.innerText;
      return spanTextContent || "";
    }

    const elementValue = element.value || "";
    const elementType = String(element.type).toLowerCase();
    if ("checked" in element && elementType === "checkbox") {
      return element.checked ? "✓" : "";
    }

    if (elementType === "hidden") {
      const inputValueMaxLength = 254;

      return elementValue.length > inputValueMaxLength
        ? `${elementValue.substring(0, inputValueMaxLength)}...SNIPPED`
        : elementValue;
    }

    return elementValue;
  }

  /**
   * Captures the `data-*` attribute metadata to help with validating the autofill data.
   *
   * @param element - The form field element to capture the `data-*` attribute metadata from
   */
  private getDataSetValues(element: ElementWithOpId<FormFieldElement>): string {
    let datasetValues = "";
    const dataset = element.dataset;
    for (const key in dataset) {
      datasetValues += `${key}: ${dataset[key]}, `;
    }

    return datasetValues;
  }

  /**
   * Get the options from a select element and return them as an array
   * of arrays indicating the select element option text and value.
   * @param {HTMLSelectElement} element
   * @returns {{options: (string | null)[][]}}
   * @private
   */
  private getSelectElementOptions(element: HTMLSelectElement): { options: (string | null)[][] } {
    const options = Array.from(element.options).map((option) => {
      const optionText = option.text
        ? String(option.text)
            .toLowerCase()
            .replace(/[\s~`!@$%^&#*()\-_+=:;'"[\]|\\,<.>?]/gm, "") // Remove whitespace and punctuation
        : null;

      return [optionText, option.value];
    });

    return { options };
  }

  /**
   * Queries all potential form and field elements from the DOM and returns
   * a collection of form and field elements. Leverages the TreeWalker API
   * to deep query Shadow DOM elements.
   */
  private queryAutofillFormAndFieldElements(): {
    formElements: HTMLFormElement[];
    formFieldElements: FormFieldElement[];
  } {
    const formElements: HTMLFormElement[] = [];
    const formFieldElements: FormFieldElement[] = [];

    const queriedElements = this.domQueryService.query<HTMLElement>(
      globalThis.document.documentElement,
      `form, ${this.formFieldQueryString}`,
      (node: Node) => {
        if (nodeIsFormElement(node)) {
          formElements.push(node);
          return true;
        }

        if (this.isNodeFormFieldElement(node)) {
          formFieldElements.push(node as FormFieldElement);
          return true;
        }

        return false;
      },
      this.mutationObserver,
    );

    if (formElements.length || formFieldElements.length) {
      return { formElements, formFieldElements };
    }

    for (let index = 0; index < queriedElements.length; index++) {
      const element = queriedElements[index];
      if (elementIsFormElement(element)) {
        formElements.push(element);
        continue;
      }

      if (this.isNodeFormFieldElement(element)) {
        formFieldElements.push(element);
      }
    }

    return { formElements, formFieldElements };
  }

  /**
   * Checks if the passed node is a form field element.
   * @param {Node} node
   * @returns {boolean}
   * @private
   */
  private isNodeFormFieldElement(node: Node): boolean {
    if (!nodeIsElement(node)) {
      return false;
    }

    const nodeTagName = node.tagName.toLowerCase();

    const nodeIsSpanElementWithAutofillAttribute =
      nodeTagName === "span" && node.hasAttribute("data-bwautofill");
    if (nodeIsSpanElementWithAutofillAttribute) {
      return true;
    }

    const nodeHasBwIgnoreAttribute = node.hasAttribute("data-bwignore");
    const nodeIsValidInputElement =
      nodeTagName === "input" && !this.ignoredInputTypes.has((node as HTMLInputElement).type);
    if (nodeIsValidInputElement && !nodeHasBwIgnoreAttribute) {
      return true;
    }

    return this.nonInputFormFieldTags.has(nodeTagName) && !nodeHasBwIgnoreAttribute;
  }

  private setupInitialTopLayerListeners = () => {
    const unownedTopLayerItems = this.autofillOverlayContentService?.getUnownedTopLayerItems(true);

    if (unownedTopLayerItems?.length) {
      for (const unownedElement of unownedTopLayerItems) {
        if (this.shouldListenToTopLayerCandidate(unownedElement)) {
          this.setupTopLayerCandidateListener(unownedElement);
        }
      }
    }
  };

  /**
   * Sets up a mutation observer on the body of the document. Observes changes to
   * DOM elements to ensure we have an updated set of autofill field data.
   * @private
   */
  private setupMutationObserver() {
    this.currentLocationHref = globalThis.location.href;
    this.mutationObserver = new MutationObserver(this.handleMutationObserverMutation);
    this.mutationObserver.observe(document.documentElement, {
      attributes: true,
      childList: true,
      subtree: true,
    });
  }

  /**
   * Handles observed DOM mutations and identifies if a mutation is related to
   * an autofill element. If so, it will update the autofill element data.
   * @param {MutationRecord[]} mutations
   * @private
   */
  private handleMutationObserverMutation = (mutations: MutationRecord[]) => {
    if (this.currentLocationHref !== globalThis.location.href) {
      this.handleWindowLocationMutation();

      return;
    }

    if (!this.mutationsQueue.length) {
      requestIdleCallbackPolyfill(debounce(this.processMutations, 100), { timeout: 500 });
    }
    this.mutationsQueue.push(mutations);
  };

  /**
   * Handles a mutation to the window location. Clears the autofill elements
   * and updates the autofill elements after a timeout.
   * @private
   */
  private handleWindowLocationMutation() {
    this.currentLocationHref = globalThis.location.href;

    this.domRecentlyMutated = true;
    if (this.autofillOverlayContentService) {
      this.autofillOverlayContentService.pageDetailsUpdateRequired = true;
      this.autofillOverlayContentService.clearUserFilledFields();
      void this.sendExtensionMessage("closeAutofillInlineMenu", { forceCloseInlineMenu: true });
    }
    this.noFieldsFound = false;

    this._autofillFormElements.clear();
    this.autofillFieldElements.clear();

    this.updateAutofillElementsAfterMutation();
  }

  /**
   * Handles the processing of all mutations in the mutations queue. Will trigger
   * within an idle callback to help with performance and prevent excessive updates.
   */
  private processMutations = () => {
    // If the page contains shadow DOM, we require a page details update from the autofill service.
    // Will wait for an idle moment on main thread to execute, unless timeout has passed.
    requestIdleCallbackPolyfill(
      () => this.domQueryService.checkPageContainsShadowDom() && this.requirePageDetailsUpdate(),
      { timeout: 500 },
    );

    const queueLength = this.mutationsQueue.length;

    for (let queueIndex = 0; queueIndex < queueLength; queueIndex++) {
      const mutations = this.mutationsQueue[queueIndex];
      const processMutationRecords = () => {
        this.processMutationRecords(mutations);

        if (queueIndex === queueLength - 1 && this.domRecentlyMutated) {
          this.updateAutofillElementsAfterMutation();
        }
      };

      requestIdleCallbackPolyfill(processMutationRecords, { timeout: 500 });
    }

    this.mutationsQueue = [];
  };

  /**
   * Triggers several flags that indicate that a collection of page details should
   * occur again on a subsequent call after a mutation has been observed in the DOM.
   */
  private requirePageDetailsUpdate = () => {
    this.domRecentlyMutated = true;
    if (this.autofillOverlayContentService) {
      this.autofillOverlayContentService.pageDetailsUpdateRequired = true;
    }
    this.noFieldsFound = false;
  };

  /**
   * Processes all mutation records encountered by the mutation observer.
   *
   * @param mutations - The mutation record to process
   */
  private processMutationRecords(mutations: MutationRecord[]) {
    for (let mutationIndex = 0; mutationIndex < mutations.length; mutationIndex++) {
      const mutation: MutationRecord = mutations[mutationIndex];
      const processMutationRecord = () => this.processMutationRecord(mutation);
      requestIdleCallbackPolyfill(processMutationRecord, { timeout: 500 });
    }
  }

  /**
   * Processes a single mutation record and updates the autofill elements if necessary.
   * @param mutation
   * @private
   */
  private processMutationRecord(mutation: MutationRecord) {
    this.handleTopLayerChanges(mutation);

    if (
      mutation.type === "childList" &&
      (this.isAutofillElementNodeMutated(mutation.removedNodes, true) ||
        this.isAutofillElementNodeMutated(mutation.addedNodes))
    ) {
      this.requirePageDetailsUpdate();
      return;
    }

    if (mutation.type === "attributes") {
      this.handleAutofillElementAttributeMutation(mutation);
    }
  }

  private setupTopLayerCandidateListener = (element: Element) => {
    const ownedTags = this.autofillOverlayContentService.getOwnedInlineMenuTagNames() || [];
    this.ownedExperienceTagNames = ownedTags;

    if (!ownedTags.includes(element.tagName)) {
      element.addEventListener("toggle", (event: ToggleEvent) => {
        if (event.newState === "open") {
          // Add a slight delay (but faster than a user's reaction), to ensure the layer
          // positioning happens after any triggered toggle has completed.
          setTimeout(this.autofillOverlayContentService.refreshMenuLayerPosition, 100);
        }
      });
    }
  };

  private isPopoverAttribute = (attr: string | null) => {
    const popoverAttributes = new Set(["popover", "popovertarget", "popovertargetaction"]);

    return attr && popoverAttributes.has(attr.toLowerCase());
  };

  private shouldListenToTopLayerCandidate = (element: Element) => {
    return (
      !this.ownedExperienceTagNames.includes(element.tagName) &&
      (element.tagName === "DIALOG" ||
        Array.from(element.attributes || []).some((attribute) =>
          this.isPopoverAttribute(attribute.name),
        ))
    );
  };

  /**
   * Checks if a mutation record is related features that utilize the top layer.
   * If so, it then calls `setupTopLayerElementListener` for future event
   * listening on the relevant element.
   *
   * @param mutation - The MutationRecord to check
   */
  private handleTopLayerChanges = (mutation: MutationRecord) => {
    // Check attribute mutations
    if (mutation.type === "attributes" && this.isPopoverAttribute(mutation.attributeName)) {
      this.setupTopLayerCandidateListener(mutation.target as Element);
    }

    // Check added nodes for dialog or popover attributes
    if (mutation.type === "childList" && mutation.addedNodes?.length > 0) {
      for (const node of mutation.addedNodes) {
        const mutationElement = node as Element;

        if (this.shouldListenToTopLayerCandidate(mutationElement)) {
          this.setupTopLayerCandidateListener(mutationElement);
        }
      }
    }

    return;
  };

  /**
   * Checks if the passed nodes either contain or are autofill elements.
   *
   * @param nodes - The nodes to check
   * @param isRemovingNodes - Whether the nodes are being removed
   */
  private isAutofillElementNodeMutated(nodes: NodeList, isRemovingNodes = false): boolean {
    if (!nodes.length) {
      return false;
    }

    let isElementMutated = false;
    let mutatedElements: HTMLElement[] = [];
    for (let index = 0; index < nodes.length; index++) {
      const node = nodes[index];
      if (!nodeIsElement(node)) {
        continue;
      }

      if (nodeIsFormElement(node) || this.isNodeFormFieldElement(node)) {
        mutatedElements.push(node as HTMLElement);
      }

      const autofillElements = this.domQueryService.query<HTMLElement>(
        node,
        `form, ${this.formFieldQueryString}`,
        (walkerNode: Node) =>
          nodeIsFormElement(walkerNode) || this.isNodeFormFieldElement(walkerNode),
        this.mutationObserver,
        true,
      );

      if (autofillElements.length) {
        mutatedElements = mutatedElements.concat(autofillElements);
      }

      if (mutatedElements.length) {
        isElementMutated = true;
      }
    }

    if (isRemovingNodes) {
      for (let elementIndex = 0; elementIndex < mutatedElements.length; elementIndex++) {
        const element = mutatedElements[elementIndex];
        this.deleteCachedAutofillElement(
          element as ElementWithOpId<HTMLFormElement> | ElementWithOpId<FormFieldElement>,
        );
      }
    } else if (this.autofillOverlayContentService) {
      this.setupOverlayListenersOnMutatedElements(mutatedElements);
    }

    return isElementMutated;
  }

  /**
   * Sets up the overlay listeners on the passed mutated elements. This ensures
   * that the overlay can appear on elements that are injected into the DOM after
   * the initial page load.
   *
   * @param mutatedElements - HTML elements that have been mutated
   */
  private setupOverlayListenersOnMutatedElements(mutatedElements: Node[]) {
    for (let elementIndex = 0; elementIndex < mutatedElements.length; elementIndex++) {
      const node = mutatedElements[elementIndex];
      const buildAutofillFieldItem = () => {
        if (
          !this.isNodeFormFieldElement(node) ||
          this.autofillFieldElements.get(node as ElementWithOpId<FormFieldElement>)
        ) {
          return;
        }

        // We are setting this item to a -1 index because we do not know its position in the DOM.
        // This value should be updated with the next call to collect page details.
        void this.buildAutofillFieldItem(node as ElementWithOpId<FormFieldElement>, -1);
      };

      requestIdleCallbackPolyfill(buildAutofillFieldItem, { timeout: 1000 });
    }
  }

  /**
   * Deletes any cached autofill elements that have been
   * removed from the DOM.
   * @param {ElementWithOpId<HTMLFormElement> | ElementWithOpId<FormFieldElement>} element
   * @private
   */
  private deleteCachedAutofillElement(
    element: ElementWithOpId<HTMLFormElement> | ElementWithOpId<FormFieldElement>,
  ) {
    if (elementIsFormElement(element) && this._autofillFormElements.has(element)) {
      this._autofillFormElements.delete(element);
      return;
    }

    if (this.autofillFieldElements.has(element)) {
      this.autofillFieldElements.delete(element);
    }
  }

  /**
   * Updates the autofill elements after a DOM mutation has occurred.
   * Is debounced to prevent excessive updates.
   * @private
   */
  private updateAutofillElementsAfterMutation() {
    if (this.updateAfterMutationIdleCallback) {
      cancelIdleCallbackPolyfill(this.updateAfterMutationIdleCallback);
    }

    this.updateAfterMutationIdleCallback = requestIdleCallbackPolyfill(
      this.getPageDetails.bind(this),
      { timeout: this.updateAfterMutationTimeout },
    );
  }

  /**
   * Handles observed DOM mutations related to an autofill element attribute.
   * @param {MutationRecord} mutation
   * @private
   */
  private handleAutofillElementAttributeMutation(mutation: MutationRecord) {
    const targetElement = mutation.target;
    if (!nodeIsElement(targetElement)) {
      return;
    }

    const attributeName = mutation.attributeName?.toLowerCase();
    const autofillForm = this._autofillFormElements.get(
      targetElement as ElementWithOpId<HTMLFormElement>,
    );

    if (autofillForm) {
      this.updateAutofillFormElementData(
        attributeName,
        targetElement as ElementWithOpId<HTMLFormElement>,
        autofillForm,
      );

      return;
    }

    const autofillField = this.autofillFieldElements.get(
      targetElement as ElementWithOpId<FormFieldElement>,
    );
    if (!autofillField) {
      return;
    }

    this.updateAutofillFieldElementData(
      attributeName,
      targetElement as ElementWithOpId<FormFieldElement>,
      autofillField,
    );
  }

  /**
   * Updates the autofill form element data based on the passed attribute name.
   * @param {string} attributeName
   * @param {ElementWithOpId<HTMLFormElement>} element
   * @param {AutofillForm} dataTarget
   * @private
   */
  private updateAutofillFormElementData(
    attributeName: string,
    element: ElementWithOpId<HTMLFormElement>,
    dataTarget: AutofillForm,
  ) {
    const updateAttribute = (dataTargetKey: string) => {
      this.updateAutofillDataAttribute({ element, attributeName, dataTarget, dataTargetKey });
    };
    const updateActions: Record<string, CallableFunction> = {
      action: () => (dataTarget.htmlAction = this.getFormActionAttribute(element)),
      name: () => updateAttribute("htmlName"),
      id: () => updateAttribute("htmlID"),
      method: () => updateAttribute("htmlMethod"),
    };

    if (!updateActions[attributeName]) {
      return;
    }

    updateActions[attributeName]();
    if (this._autofillFormElements.has(element)) {
      this._autofillFormElements.set(element, dataTarget);
    }
  }

  /**
   * Updates the autofill field element data based on the passed attribute name.
   *
   * @param {string} attributeName
   * @param {ElementWithOpId<FormFieldElement>} element
   * @param {AutofillField} dataTarget
   */
  private updateAutofillFieldElementData(
    attributeName: string,
    element: ElementWithOpId<FormFieldElement>,
    dataTarget: AutofillField,
  ) {
    const updateAttribute = (dataTargetKey: string) => {
      this.updateAutofillDataAttribute({ element, attributeName, dataTarget, dataTargetKey });
    };
    const updateActions: Record<string, CallableFunction> = {
      maxlength: () => (dataTarget.maxLength = this.getAutofillFieldMaxLength(element)),
      id: () => updateAttribute("htmlID"),
      name: () => updateAttribute("htmlName"),
      class: () => updateAttribute("htmlClass"),
      tabindex: () => updateAttribute("tabindex"),
      title: () => updateAttribute("tabindex"),
      rel: () => updateAttribute("rel"),
      tagname: () => (dataTarget.tagName = this.getAttributeLowerCase(element, "tagName")),
      type: () => (dataTarget.type = this.getAttributeLowerCase(element, "type")),
      value: () => (dataTarget.value = this.getElementValue(element)),
      checked: () => (dataTarget.checked = this.getAttributeBoolean(element, "checked")),
      disabled: () => (dataTarget.disabled = this.getAttributeBoolean(element, "disabled")),
      readonly: () => (dataTarget.readonly = this.getAttributeBoolean(element, "readonly")),
      autocomplete: () => (dataTarget.autoCompleteType = this.getAutoCompleteAttribute(element)),
      "data-label": () => updateAttribute("label-data"),
      "aria-label": () => updateAttribute("label-aria"),
      "aria-hidden": () =>
        (dataTarget["aria-hidden"] = this.getAttributeBoolean(element, "aria-hidden", true)),
      "aria-disabled": () =>
        (dataTarget["aria-disabled"] = this.getAttributeBoolean(element, "aria-disabled", true)),
      "aria-haspopup": () =>
        (dataTarget["aria-haspopup"] = this.getAttributeBoolean(element, "aria-haspopup", true)),
      "data-stripe": () => updateAttribute("data-stripe"),
    };

    if (!updateActions[attributeName]) {
      return;
    }

    updateActions[attributeName]();

    if (this.autofillFieldElements.has(element)) {
      this.autofillFieldElements.set(element, dataTarget);
    }
  }

  /**
   * Gets the attribute value for the passed element, and returns it. If the dataTarget
   * and dataTargetKey are passed, it will set the value of the dataTarget[dataTargetKey].
   * @param UpdateAutofillDataAttributeParams
   * @returns {string}
   * @private
   */
  private updateAutofillDataAttribute({
    element,
    attributeName,
    dataTarget,
    dataTargetKey,
  }: UpdateAutofillDataAttributeParams) {
    const attributeValue = this.getPropertyOrAttribute(element, attributeName);
    if (dataTarget && dataTargetKey) {
      dataTarget[dataTargetKey] = attributeValue;
    }

    return attributeValue;
  }

  /**
   * Sets up an IntersectionObserver to observe found form
   * field elements that are not viewable in the viewport.
   */
  private setupIntersectionObserver() {
    this.intersectionObserver = new IntersectionObserver(this.handleFormElementIntersection, {
      root: null,
      rootMargin: "0px",
      threshold: 1.0,
    });
  }

  /**
   * Handles observed form field elements that are not viewable in the viewport.
   * Will re-evaluate the visibility of the element and set up the autofill
   * overlay listeners on the field if it is viewable.
   *
   * @param entries - The entries observed by the IntersectionObserver
   */
  private handleFormElementIntersection = async (entries: IntersectionObserverEntry[]) => {
    for (let entryIndex = 0; entryIndex < entries.length; entryIndex++) {
      const entry = entries[entryIndex];
      const formFieldElement = entry.target as ElementWithOpId<FormFieldElement>;
      if (this.elementInitializingIntersectionObserver.has(formFieldElement)) {
        this.elementInitializingIntersectionObserver.delete(formFieldElement);
        continue;
      }

      const cachedAutofillFieldElement = this.autofillFieldElements.get(formFieldElement);
      if (!cachedAutofillFieldElement) {
        this.intersectionObserver.unobserve(entry.target);
        continue;
      }

      const isViewable = await this.domElementVisibilityService.isElementViewable(formFieldElement);
      if (!isViewable) {
        continue;
      }

      cachedAutofillFieldElement.viewable = true;
      this.setupOverlayOnField(formFieldElement, cachedAutofillFieldElement);

      this.intersectionObserver?.unobserve(entry.target);
    }
  };

  /**
   * Iterates over all cached field elements and sets up the inline menu listeners on each field.
   *
   * @param pageDetails - The page details to use for the inline menu listeners
   */
  private setupOverlayListeners(pageDetails: AutofillPageDetails) {
    if (this.autofillOverlayContentService) {
      this.autofillFieldElements.forEach((autofillField, formFieldElement) => {
        this.setupOverlayOnField(formFieldElement, autofillField, pageDetails);
      });
    }
  }

  /**
   * Sets up the inline menu listener on the passed field element.
   *
   * @param formFieldElement - The form field element to set up the inline menu listener on
   * @param autofillField - The metadata for the form field
   * @param pageDetails - The page details to use for the inline menu listeners
   */
  private setupOverlayOnField(
    formFieldElement: ElementWithOpId<FormFieldElement>,
    autofillField: AutofillField,
    pageDetails?: AutofillPageDetails,
  ) {
    if (this.autofillOverlayContentService) {
      const autofillPageDetails =
        pageDetails ||
        this.getFormattedPageDetails(
          this.getFormattedAutofillFormsData(),
          this.getFormattedAutofillFieldsData(),
        );

      void this.autofillOverlayContentService.setupOverlayListeners(
        formFieldElement,
        autofillField,
        autofillPageDetails,
      );
    }
  }

  /**
   * Validates whether a password field is within the document.
   */
  isPasswordFieldWithinDocument(): boolean {
    return (
      this.domQueryService.query<HTMLInputElement>(
        globalThis.document.documentElement,
        `input[type="password"]`,
        (node: Node) => nodeIsInputElement(node) && node.type === "password",
      )?.length > 0
    );
  }

  /**
   * Destroys the CollectAutofillContentService. Clears all
   * timeouts and disconnects the mutation observer.
   */
  destroy() {
    if (this.updateAfterMutationIdleCallback) {
      cancelIdleCallbackPolyfill(this.updateAfterMutationIdleCallback);
    }
    this.mutationObserver?.disconnect();
    this.intersectionObserver?.disconnect();
  }
}
