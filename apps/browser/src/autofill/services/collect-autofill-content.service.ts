import AutofillField from "../models/autofill-field";
import AutofillForm from "../models/autofill-form";
import AutofillPageDetails from "../models/autofill-page-details";
import {
  ElementWithOpId,
  FillableFormFieldElement,
  FormFieldElement,
  FormElementWithAttribute,
} from "../types";
import {
  elementIsDescriptionDetailsElement,
  elementIsDescriptionTermElement,
  elementIsFillableFormField,
  elementIsFormElement,
  elementIsLabelElement,
  elementIsSelectElement,
  elementIsSpanElement,
  nodeIsFormElement,
  nodeIsElement,
  elementIsInputElement,
  elementIsTextAreaElement,
} from "../utils";

import { AutofillOverlayContentService } from "./abstractions/autofill-overlay-content.service";
import {
  UpdateAutofillDataAttributeParams,
  AutofillFieldElements,
  AutofillFormElements,
  CollectAutofillContentService as CollectAutofillContentServiceInterface,
} from "./abstractions/collect-autofill-content.service";
import { DomElementVisibilityService } from "./abstractions/dom-element-visibility.service";

class CollectAutofillContentService implements CollectAutofillContentServiceInterface {
  private readonly domElementVisibilityService: DomElementVisibilityService;
  private readonly autofillOverlayContentService: AutofillOverlayContentService;
  private noFieldsFound = false;
  private domRecentlyMutated = true;
  private autofillFormElements: AutofillFormElements = new Map();
  private autofillFieldElements: AutofillFieldElements = new Map();
  private currentLocationHref = "";
  private mutationObserver: MutationObserver;
  private updateAutofillElementsAfterMutationTimeout: NodeJS.Timeout;
  private readonly updateAfterMutationTimeoutDelay = 1000;
  private readonly ignoredInputTypes = new Set([
    "hidden",
    "submit",
    "reset",
    "button",
    "image",
    "file",
  ]);

  constructor(
    domElementVisibilityService: DomElementVisibilityService,
    autofillOverlayContentService?: AutofillOverlayContentService,
  ) {
    this.domElementVisibilityService = domElementVisibilityService;
    this.autofillOverlayContentService = autofillOverlayContentService;
  }

  /**
   * Builds the data for all forms and fields found within the page DOM.
   * Sets up a mutation observer to verify DOM changes and returns early
   * with cached data if no changes are detected.
   * @returns {Promise<AutofillPageDetails>}
   * @public
   */
  async getPageDetails(): Promise<AutofillPageDetails> {
    if (!this.mutationObserver) {
      this.setupMutationObserver();
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
    const autofillFieldsData: AutofillField[] = await this.buildAutofillFieldsData(
      formFieldElements as FormFieldElement[],
    );
    this.sortAutofillFieldElementsMap();

    if (!autofillFieldsData.length) {
      this.noFieldsFound = true;
    }

    this.domRecentlyMutated = false;
    return this.getFormattedPageDetails(autofillFormsData, autofillFieldsData);
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
   * Queries the DOM for all the nodes that match the given filter callback
   * and returns a collection of nodes.
   * @param {Node} rootNode
   * @param {Function} filterCallback
   * @param {boolean} isObservingShadowRoot
   * @returns {Node[]}
   */
  queryAllTreeWalkerNodes(
    rootNode: Node,
    filterCallback: CallableFunction,
    isObservingShadowRoot = true,
  ): Node[] {
    const treeWalkerQueryResults: Node[] = [];

    this.buildTreeWalkerNodesQueryResults(
      rootNode,
      treeWalkerQueryResults,
      filterCallback,
      isObservingShadowRoot,
    );

    return treeWalkerQueryResults;
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
      url: (document.defaultView || window).location.href,
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
    this.autofillFieldElements.forEach(
      async (autofillField, element) =>
        (autofillField.viewable =
          await this.domElementVisibilityService.isFormFieldViewable(element)),
    );
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

      const existingAutofillForm = this.autofillFormElements.get(formElement);
      if (existingAutofillForm) {
        existingAutofillForm.opid = formElement.opid;
        this.autofillFormElements.set(formElement, existingAutofillForm);
        continue;
      }

      this.autofillFormElements.set(formElement, {
        opid: formElement.opid,
        htmlAction: this.getFormActionAttribute(formElement),
        htmlName: this.getPropertyOrAttribute(formElement, "name"),
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
    return new URL(this.getPropertyOrAttribute(element, "action"), window.location.href).href;
  }

  /**
   * Iterates over all known form elements and returns an AutofillForm object
   * containing a key value pair of the form element's opid and the form data.
   * @returns {Record<string, AutofillForm>}
   * @private
   */
  private getFormattedAutofillFormsData(): Record<string, AutofillForm> {
    const autofillForms: Record<string, AutofillForm> = {};
    const autofillFormElements = Array.from(this.autofillFormElements);
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
    const formFieldElements =
      previouslyFoundFormFieldElements ||
      (this.queryAllTreeWalkerNodes(document.documentElement, (node: Node) =>
        this.isNodeFormFieldElement(node),
      ) as FormFieldElement[]);

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
   * @param {ElementWithOpId<FormFieldElement>} element
   * @param {number} index
   * @returns {Promise<AutofillField>}
   * @private
   */
  private buildAutofillFieldItem = async (
    element: ElementWithOpId<FormFieldElement>,
    index: number,
  ): Promise<AutofillField> => {
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
      viewable: await this.domElementVisibilityService.isFormFieldViewable(element),
      htmlID: this.getPropertyOrAttribute(element, "id"),
      htmlName: this.getPropertyOrAttribute(element, "name"),
      htmlClass: this.getPropertyOrAttribute(element, "class"),
      tabindex: this.getPropertyOrAttribute(element, "tabindex"),
      title: this.getPropertyOrAttribute(element, "title"),
      tagName: this.getAttributeLowerCase(element, "tagName"),
    };

    if (elementIsSpanElement(element)) {
      this.cacheAutofillFieldElement(index, element, autofillFieldBase);
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.autofillOverlayContentService?.setupAutofillOverlayListenerOnField(
        element,
        autofillFieldBase,
      );
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
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.autofillOverlayContentService?.setupAutofillOverlayListenerOnField(element, autofillField);
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
    const autoCompleteType =
      this.getPropertyOrAttribute(element, "x-autocompletetype") ||
      this.getPropertyOrAttribute(element, "autocompletetype") ||
      this.getPropertyOrAttribute(element, "autocomplete");
    return autoCompleteType !== "off" ? autoCompleteType : null;
  }

  /**
   * Returns a boolean representing the attribute value of an element.
   * @param {ElementWithOpId<FormFieldElement>} element
   * @param {string} attributeName
   * @param {boolean} checkString
   * @returns {boolean}
   * @private
   */
  private getAttributeBoolean(
    element: ElementWithOpId<FormFieldElement>,
    attributeName: string,
    checkString = false,
  ): boolean {
    if (checkString) {
      return this.getPropertyOrAttribute(element, attributeName) === "true";
    }

    return Boolean(this.getPropertyOrAttribute(element, attributeName));
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
      .replace(/[^\x20-\x7E]+|\s+/g, " ") // Strip out non-primitive characters and replace multiple spaces with a single space
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
   * Get the value of a property or attribute from a FormFieldElement.
   * @param {HTMLElement} element
   * @param {string} attributeName
   * @returns {string | null}
   * @private
   */
  private getPropertyOrAttribute(element: HTMLElement, attributeName: string): string | null {
    if (attributeName in element) {
      return (element as FormElementWithAttribute)[attributeName];
    }

    return element.getAttribute(attributeName);
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
   * @returns {{formElements: Node[], formFieldElements: Node[]}}
   * @private
   */
  private queryAutofillFormAndFieldElements(): {
    formElements: Node[];
    formFieldElements: Node[];
  } {
    const formElements: Node[] = [];
    const formFieldElements: Node[] = [];
    this.queryAllTreeWalkerNodes(document.documentElement, (node: Node) => {
      if (nodeIsFormElement(node)) {
        formElements.push(node);
        return true;
      }

      if (this.isNodeFormFieldElement(node)) {
        formFieldElements.push(node);
        return true;
      }

      return false;
    });

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

    return ["textarea", "select"].includes(nodeTagName) && !nodeHasBwIgnoreAttribute;
  }

  /**
   * Attempts to get the ShadowRoot of the passed node. If support for the
   * extension based openOrClosedShadowRoot API is available, it will be used.
   * Will return null if the node is not an HTMLElement or if the node has
   * child nodes.
   *
   * @param {Node} node
   */
  private getShadowRoot(node: Node): ShadowRoot | null {
    if (!nodeIsElement(node) || node.childNodes.length !== 0) {
      return null;
    }

    if (node.shadowRoot) {
      return node.shadowRoot;
    }

    if ((chrome as any).dom?.openOrClosedShadowRoot) {
      try {
        return (chrome as any).dom.openOrClosedShadowRoot(node);
      } catch (error) {
        return null;
      }
    }

    return (node as any).openOrClosedShadowRoot;
  }

  /**
   * Recursively builds a collection of nodes that match the given filter callback.
   * If a node has a ShadowRoot, it will be observed for mutations.
   * @param {Node} rootNode
   * @param {Node[]} treeWalkerQueryResults
   * @param {Function} filterCallback
   * @param {boolean} isObservingShadowRoot
   * @private
   */
  private buildTreeWalkerNodesQueryResults(
    rootNode: Node,
    treeWalkerQueryResults: Node[],
    filterCallback: CallableFunction,
    isObservingShadowRoot: boolean,
  ) {
    const treeWalker = document?.createTreeWalker(rootNode, NodeFilter.SHOW_ELEMENT);
    let currentNode = treeWalker?.currentNode;

    while (currentNode) {
      if (filterCallback(currentNode)) {
        treeWalkerQueryResults.push(currentNode);
      }

      const nodeShadowRoot = this.getShadowRoot(currentNode);
      if (nodeShadowRoot) {
        if (isObservingShadowRoot) {
          this.mutationObserver.observe(nodeShadowRoot, {
            attributes: true,
            childList: true,
            subtree: true,
          });
        }

        this.buildTreeWalkerNodesQueryResults(
          nodeShadowRoot,
          treeWalkerQueryResults,
          filterCallback,
          isObservingShadowRoot,
        );
      }

      currentNode = treeWalker?.nextNode();
    }
  }

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

    for (let mutationsIndex = 0; mutationsIndex < mutations.length; mutationsIndex++) {
      const mutation = mutations[mutationsIndex];
      if (
        mutation.type === "childList" &&
        (this.isAutofillElementNodeMutated(mutation.removedNodes, true) ||
          this.isAutofillElementNodeMutated(mutation.addedNodes))
      ) {
        this.domRecentlyMutated = true;
        if (this.autofillOverlayContentService) {
          this.autofillOverlayContentService.pageDetailsUpdateRequired = true;
        }
        this.noFieldsFound = false;
        continue;
      }

      if (mutation.type === "attributes") {
        this.handleAutofillElementAttributeMutation(mutation);
      }
    }

    if (this.domRecentlyMutated) {
      this.updateAutofillElementsAfterMutation();
    }
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
    }
    this.noFieldsFound = false;

    this.autofillFormElements.clear();
    this.autofillFieldElements.clear();

    this.updateAutofillElementsAfterMutation();
  }

  /**
   * Checks if the passed nodes either contain or are autofill elements.
   * @param {NodeList} nodes
   * @param {boolean} isRemovingNodes
   * @returns {boolean}
   * @private
   */
  private isAutofillElementNodeMutated(nodes: NodeList, isRemovingNodes = false): boolean {
    if (!nodes.length) {
      return false;
    }

    let isElementMutated = false;
    const mutatedElements: Node[] = [];
    for (let index = 0; index < nodes.length; index++) {
      const node = nodes[index];
      if (!nodeIsElement(node)) {
        continue;
      }

      const autofillElementNodes = this.queryAllTreeWalkerNodes(
        node,
        (walkerNode: Node) =>
          nodeIsFormElement(walkerNode) || this.isNodeFormFieldElement(walkerNode),
      ) as HTMLElement[];

      if (autofillElementNodes.length) {
        isElementMutated = true;
        mutatedElements.push(...autofillElementNodes);
      }
    }

    if (isRemovingNodes) {
      for (let elementIndex = 0; elementIndex < mutatedElements.length; elementIndex++) {
        const node = mutatedElements[elementIndex];
        this.deleteCachedAutofillElement(
          node as ElementWithOpId<HTMLFormElement> | ElementWithOpId<FormFieldElement>,
        );
      }
    } else if (this.autofillOverlayContentService) {
      setTimeout(() => this.setupOverlayListenersOnMutatedElements(mutatedElements), 1000);
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
      if (
        this.isNodeFormFieldElement(node) &&
        !this.autofillFieldElements.get(node as ElementWithOpId<FormFieldElement>)
      ) {
        // We are setting this item to a -1 index because we do not know its position in the DOM.
        // This value should be updated with the next call to collect page details.
        // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.buildAutofillFieldItem(node as ElementWithOpId<FormFieldElement>, -1);
      }
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
    if (elementIsFormElement(element) && this.autofillFormElements.has(element)) {
      this.autofillFormElements.delete(element);
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
    if (this.updateAutofillElementsAfterMutationTimeout) {
      clearTimeout(this.updateAutofillElementsAfterMutationTimeout);
    }

    this.updateAutofillElementsAfterMutationTimeout = setTimeout(
      this.getPageDetails.bind(this),
      this.updateAfterMutationTimeoutDelay,
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
    const autofillForm = this.autofillFormElements.get(
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

    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
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
    if (this.autofillFormElements.has(element)) {
      this.autofillFormElements.set(element, dataTarget);
    }
  }

  /**
   * Updates the autofill field element data based on the passed attribute name.
   * @param {string} attributeName
   * @param {ElementWithOpId<FormFieldElement>} element
   * @param {AutofillField} dataTarget
   * @returns {Promise<void>}
   * @private
   */
  private async updateAutofillFieldElementData(
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
   * Destroys the CollectAutofillContentService. Clears all
   * timeouts and disconnects the mutation observer.
   */
  destroy() {
    if (this.updateAutofillElementsAfterMutationTimeout) {
      clearTimeout(this.updateAutofillElementsAfterMutationTimeout);
    }
    this.mutationObserver?.disconnect();
  }
}

export default CollectAutofillContentService;
