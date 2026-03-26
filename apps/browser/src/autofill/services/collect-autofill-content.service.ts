import { AUTOFILL_ATTRIBUTES } from "@bitwarden/common/autofill/constants";
import { AutofillTargetingRuleType, FormContent } from "@bitwarden/common/autofill/types";

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
import { AutoFillConstants } from "./autofill-constants";

export class CollectAutofillContentService implements CollectAutofillContentServiceInterface {
  private readonly sendExtensionMessage = sendExtensionMessage;
  private readonly getAttributeBoolean = getAttributeBoolean;
  private readonly getPropertyOrAttribute = getPropertyOrAttribute;
  private noFieldsFound = false;
  private domRecentlyMutated = true;
  /**
   * undefined = not yet fetched, null = no rules (use heuristics),
   * [] = blocklisted (suppress autofill), [...] = use targeted fill
   */
  private pageTargetingRules: FormContent[] | null | undefined = undefined;
  private _autofillFormElements: AutofillFormElements = new Map();
  private autofillFieldElements: AutofillFieldElements = new Map();
  private autofillFieldsByOpid: Map<string, FormFieldElement> = new Map();
  private currentLocationHref = "";
  private intersectionObserver: IntersectionObserver | null = null;
  private elementInitializingIntersectionObserver: Set<Element> = new Set();
  private mutationObserver: MutationObserver | null = null;
  private mutationsQueue: MutationRecord[][] = [];
  private updateAfterMutationIdleCallback: number | NodeJS.Timeout | null = null;
  private pendingOverlaySetup: Map<Element, NodeJS.Timeout | number> = new Map();
  private readonly overlaySetupDelayMs = 100;
  private shadowDomCheckTimeout: NodeJS.Timeout | number | null = null;
  private pendingShadowDomCheck = false;
  private ownedExperienceTagNames: string[] = [];
  private readonly updateAfterMutationTimeout = 1000;
  private readonly shadowDomCheckTimeoutMs = 500;
  private readonly shadowDomCheckDebounceMs = 300;
  private lastMutationTimestamp = 0;
  private mutationBurstCount = 0;
  private readonly mutationCooldownMs = 500;
  private readonly maxMutationWaitMs = 5000;
  private readonly formFieldQueryString;
  private readonly debouncedProcessMutations = debounce(() => this.processMutations(), 100);
  private readonly nonInputFormFieldTags = new Set(["textarea", "select"]);
  private readonly ignoredInputTypes = new Set([
    "hidden",
    "submit",
    "reset",
    "button",
    "image",
    "file",
    "search",
    "url",
    "date",
    "time",
    "datetime", // Note: datetime is deprecated in HTML5; keeping here for backwards compatibility
    "datetime-local",
    "week",
    "color",
    "range",
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
    if (this.autofillOverlayContentService) {
      this.setupInitialTopLayerListeners();
    }

    // FIXME we might be able to use an alternate (less expensive) mutation observer setup when targeting rules are being used
    if (this.mutationObserver === null) {
      this.setupMutationObserver();
    }

    // FIXME should we move this logic down (e.g. allow a targeted rule to fill fields outside the viewport)?
    if (this.intersectionObserver === null) {
      this.setupIntersectionObserver();
    }

    // Check for targeting rules before running heuristic collection
    if (this.pageTargetingRules === undefined) {
      this.pageTargetingRules =
        (await this.sendExtensionMessage("getUrlAutofillTargetingRules")).result ?? null;
    }

    const targetingRules = this.pageTargetingRules;
    if (targetingRules != null) {
      if (targetingRules.length === 0) {
        // Blocklisted; return empty page details, skip heuristics
        return this.getFormattedPageDetails({}, []);
      }
      return this.getTargetedPageDetails(targetingRules);
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
    // O(1): Try dual-index lookup first
    const cachedElement = this.autofillFieldsByOpid.get(opid);
    if (cachedElement) {
      // Validate element is still in DOM (not stale)
      if (cachedElement.isConnected) {
        return cachedElement;
      }
      // Stale entry - clean it up
      this.autofillFieldElements.delete(cachedElement as ElementWithOpId<typeof cachedElement>);
      this.autofillFieldsByOpid.delete(opid);
    }

    // Fallback: No cached element or it was stale, query DOM
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
   * Builds page details using targeting rule selectors instead of heuristic
   * detection. Iterates through form definitions, resolving each field type's
   * selector array by trying each `DeepSelector` in order and stopping at the
   * first DOM match.
   */
  private getTargetedPageDetails(forms: FormContent[]): AutofillPageDetails {
    const fields: AutofillField[] = [];

    for (let formIndex = 0; formIndex < forms.length; formIndex++) {
      const form = forms[formIndex];

      for (const [fieldType, selectors] of Object.entries(form.selectors)) {
        if (!selectors?.length) {
          continue;
        }

        // FIXME location of the form tag; presently unused
        if (fieldType === "form") {
          continue;
        }

        // Try each selector in order, use the first match found
        let matchedElement: Element | null = null;
        for (const selector of selectors) {
          matchedElement = this.domQueryService.queryDeepSelector(selector);
          if (matchedElement) {
            break;
          }
        }

        if (!matchedElement) {
          continue;
        }

        const fieldId = `targeted_field_${formIndex}_${fieldType}`;
        const formFieldElement = matchedElement as ElementWithOpId<FormFieldElement>;
        formFieldElement.opid = fieldId;

        const autofillField = this.buildTargetedAutofillField(
          formFieldElement,
          fieldType as AutofillTargetingRuleType,
          fields.length,
        );

        fields.push(autofillField);
        this.autofillFieldElements.set(formFieldElement, autofillField);
      }
    }

    this.domRecentlyMutated = false;
    /**
     * @TODO check if need to utilize targeting rules for forms/submits within closed
     * shadow roots as well, in order to detect cipher additions/updates
     */
    const pageDetails = this.getFormattedPageDetails({}, fields);
    this.setupOverlayListeners(pageDetails);

    return pageDetails;
  }

  /**
   * Builds a minimal AutofillField for a targeted element, setting the
   * fieldQualifier and targeted flag so the fill pipeline can identify it.
   */
  private buildTargetedAutofillField(
    element: ElementWithOpId<FormFieldElement>,
    fieldType: AutofillTargetingRuleType,
    index: number,
  ): AutofillField {
    const field = new AutofillField();
    field.opid = element.opid;
    field.elementNumber = index;
    // Targeted fields are always treated as viewable regardless of actual
    // visibility. Targeting rules may deliberately select hidden fields
    // (e.g. tabbed forms, fields revealed by user interaction).
    field.viewable = true;
    field.htmlID = element.id || null;
    field.htmlName = (element as HTMLInputElement).name || null;
    field.htmlClass = element.className || null;
    field.tabindex = element.getAttribute("tabindex");
    field.title = element.getAttribute("title");
    field.tagName = element.tagName?.toLowerCase();
    field.type = (element as HTMLInputElement).type?.toLowerCase() || undefined;
    field.fieldQualifier = fieldType as AutofillField["fieldQualifier"];
    field.targeted = true;
    return field;
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
        htmlName: this.getPropertyOrAttribute(formElement, AUTOFILL_ATTRIBUTES.NAME),
        htmlClass: this.getPropertyOrAttribute(formElement, AUTOFILL_ATTRIBUTES.CLASS),
        htmlID: this.getPropertyOrAttribute(formElement, AUTOFILL_ATTRIBUTES.ID),
        htmlMethod: this.getPropertyOrAttribute(formElement, AUTOFILL_ATTRIBUTES.METHOD),
      } as AutofillForm);
    }

    return this.getFormattedAutofillFormsData();
  }

  /**
   * Returns the action attribute of the form element. If the action attribute
   * is a relative path, it will be converted to an absolute path.
   * @param {ElementWithOpId<HTMLFormElement>} element
   * @returns {string | null}
   * @private
   */
  private getFormActionAttribute(element: ElementWithOpId<HTMLFormElement>): string | null {
    const action = this.getPropertyOrAttribute(element, AUTOFILL_ATTRIBUTES.ACTION);
    if (action === null) {
      return null;
    }
    return new URL(action, globalThis.location.href).href;
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
    // Maximum number of form fields to process for autofill to prevent performance issues on pages with excessive fields
    const autofillFieldsLimit = 200;
    const autofillFieldElements = this.getAutofillFieldElements(
      autofillFieldsLimit,
      formFieldElements,
    );
    const autofillFieldDataPromises = autofillFieldElements.map(
      (element: FormFieldElement, i: number) =>
        this.buildAutofillFieldItem(element as ElementWithOpId<FormFieldElement>, i),
    );

    const candidates = await Promise.all(autofillFieldDataPromises);
    const autofillFields: AutofillField[] = candidates.filter(
      (field): field is AutofillField => field !== null,
    );
    return autofillFields;
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
        this.mutationObserver ?? undefined,
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

      const fieldType = this.getPropertyOrAttribute(
        element,
        AUTOFILL_ATTRIBUTES.TYPE,
      )?.toLowerCase();
      if (fieldType !== undefined && unimportantFieldTypesSet.has(fieldType)) {
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

    const autofillFieldBase: AutofillField = {
      opid: element.opid,
      elementNumber: index,
      maxLength: this.getAutofillFieldMaxLength(element),
      viewable: await this.domElementVisibilityService.isElementViewable(element),
      htmlID: this.getPropertyOrAttribute(element, AUTOFILL_ATTRIBUTES.ID),
      htmlName: this.getPropertyOrAttribute(element, AUTOFILL_ATTRIBUTES.NAME),
      htmlClass: this.getPropertyOrAttribute(element, AUTOFILL_ATTRIBUTES.CLASS),
      tabindex: this.getPropertyOrAttribute(element, AUTOFILL_ATTRIBUTES.TABINDEX),
      title: this.getPropertyOrAttribute(element, AUTOFILL_ATTRIBUTES.TITLE),
      tagName: this.getAttributeLowerCase(element, "tagName"),
      dataSetValues: this.getDataSetValues(element),
    };

    if (!autofillFieldBase.viewable) {
      this.elementInitializingIntersectionObserver.add(element);
      if (this.intersectionObserver !== null) {
        this.intersectionObserver.observe(element);
      }
    }

    if (elementIsSpanElement(element)) {
      this.cacheAutofillFieldElement(index, element, autofillFieldBase);
      return autofillFieldBase;
    }

    let autofillFieldLabels = {};
    const elementType = this.getAttributeLowerCase(element, AUTOFILL_ATTRIBUTES.TYPE);
    if (elementType !== "hidden") {
      autofillFieldLabels = {
        "label-tag": this.createAutofillFieldLabelTag(element as FillableFormFieldElement),
        "label-data": this.getPropertyOrAttribute(element, AUTOFILL_ATTRIBUTES.DATA_LABEL),
        "label-aria": this.getPropertyOrAttribute(element, AUTOFILL_ATTRIBUTES.ARIA_LABEL),
        "label-top": this.createAutofillFieldTopLabel(element),
        "label-right": this.createAutofillFieldRightLabel(element),
        "label-left": this.createAutofillFieldLeftLabel(element),
        placeholder: this.getPropertyOrAttribute(element, AUTOFILL_ATTRIBUTES.PLACEHOLDER),
      };
    }

    const fieldFormElement = (element as ElementWithOpId<FillableFormFieldElement>).form;
    const autofillField: AutofillField = {
      ...autofillFieldBase,
      ...autofillFieldLabels,
      rel: this.getPropertyOrAttribute(element, AUTOFILL_ATTRIBUTES.REL),
      type: elementType,
      value: this.getElementValue(element),
      checked: this.getAttributeBoolean(element, AUTOFILL_ATTRIBUTES.CHECKED),
      autoCompleteType: this.getAutoCompleteAttribute(element),
      disabled: this.getAttributeBoolean(element, AUTOFILL_ATTRIBUTES.DISABLED),
      readonly: this.getAttributeBoolean(element, AUTOFILL_ATTRIBUTES.READONLY),
      selectInfo: elementIsSelectElement(element)
        ? this.getSelectElementOptions(element as HTMLSelectElement)
        : null,
      form: fieldFormElement ? this.getPropertyOrAttribute(fieldFormElement, "opid") : null,
      "aria-hidden": this.getAttributeBoolean(element, AUTOFILL_ATTRIBUTES.ARIA_HIDDEN, true),
      "aria-disabled": this.getAttributeBoolean(element, AUTOFILL_ATTRIBUTES.ARIA_DISABLED, true),
      "aria-haspopup": this.getAttributeBoolean(element, AUTOFILL_ATTRIBUTES.ARIA_HASPOPUP, true),
      "data-stripe": this.getPropertyOrAttribute(element, AUTOFILL_ATTRIBUTES.DATA_STRIPE),
    };

    this.cacheAutofillFieldElement(index, element, autofillField);
    return autofillField;
  };

  /**
   * Caches the autofill field element and its data.
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
    const opid = autofillFieldData.opid;

    // Remove old element with same opid if it exists
    const oldElement = this.autofillFieldsByOpid.get(opid);
    if (oldElement && oldElement !== element) {
      this.autofillFieldElements.delete(oldElement as ElementWithOpId<typeof oldElement>);
    }

    // Always cache the element, even if index is -1 (for dynamically added fields)
    this.autofillFieldElements.set(element, autofillFieldData);
    this.autofillFieldsByOpid.set(opid, element);
  }

  /**
   * Identifies the autocomplete attribute associated with an element and returns
   * the value of the attribute if it is not set to "off".
   * @param {ElementWithOpId<FormFieldElement>} element
   * @returns {string | null}
   * @private
   */
  private getAutoCompleteAttribute(element: ElementWithOpId<FormFieldElement>): string | null {
    return (
      this.getPropertyOrAttribute(element, AUTOFILL_ATTRIBUTES.AUTOCOMPLETE) ||
      this.getPropertyOrAttribute(element, AUTOFILL_ATTRIBUTES.X_AUTOCOMPLETE_TYPE) ||
      this.getPropertyOrAttribute(element, AUTOFILL_ATTRIBUTES.AUTOCOMPLETE_TYPE)
    );
  }

  /**
   * Returns the attribute of an element as a lowercase value.
   * @param {ElementWithOpId<FormFieldElement>} element
   * @param {string} attributeName
   * @returns {string | undefined}
   * @private
   */
  private getAttributeLowerCase(
    element: ElementWithOpId<FormFieldElement>,
    attributeName: string,
  ): string | undefined {
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

    const labelElements = this.queryElementLabels(element);
    if (labelElements?.length) {
      for (const label of labelElements) {
        labelElementsSet.add(label);
      }
    }

    let currentElement: HTMLElement | null = element;
    while (currentElement !== null && currentElement !== document.documentElement) {
      if (elementIsLabelElement(currentElement)) {
        labelElementsSet.add(currentElement);
      }
      currentElement = currentElement.parentElement?.closest("label") ?? null;
    }

    const parentElement = element.parentElement;
    if (
      !labelElementsSet.size &&
      parentElement !== null &&
      elementIsDescriptionDetailsElement(parentElement)
    ) {
      const prevSibling = parentElement.previousElementSibling;
      if (prevSibling instanceof HTMLElement && elementIsDescriptionTermElement(prevSibling)) {
        labelElementsSet.add(prevSibling);
      }
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

      if (this.containsChildField(currentElement)) {
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
   * Checks whether any of an element's descendants are form fields.
   */
  private containsChildField(element: Node): boolean {
    if (nodeIsElement(element)) {
      const fields = AutoFillConstants.FieldElements.join(", ");
      return !!element.querySelector(fields);
    } else {
      return false;
    }
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
  private getTextContentFromElement(element: Node | HTMLElement): string | null {
    if (element.nodeType === Node.TEXT_NODE) {
      const nodeValue = element.nodeValue;
      if (nodeValue === null) {
        return null;
      }
      return this.trimAndRemoveNonPrintableText(nodeValue);
    }

    const textContentOrInnerText = element.textContent || (element as HTMLElement).innerText;
    if (textContentOrInnerText === null) {
      return null;
    }
    return this.trimAndRemoveNonPrintableText(textContentOrInnerText);
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
    let currentElement: Node | HTMLElement | null = element;
    while (currentElement !== null && currentElement.previousSibling !== null) {
      // Ensure we are capturing text content from nodes and elements.
      currentElement = currentElement.previousSibling;

      if (this.isNewSectionElement(currentElement)) {
        return textContentItems;
      }

      if (this.containsChildField(currentElement)) {
        return textContentItems;
      }

      const textContent = this.getTextContentFromElement(currentElement);
      if (textContent) {
        textContentItems.push(textContent);
      }
    }

    if (currentElement === null || textContentItems.length > 0) {
      return textContentItems;
    }

    // Prioritize capturing text content from elements rather than nodes.
    const parent =
      currentElement.parentElement !== null
        ? currentElement.parentElement
        : currentElement.parentNode;
    if (parent === null) {
      return textContentItems;
    }
    currentElement = parent;

    let siblingElement: ChildNode | Element | null = nodeIsElement(currentElement)
      ? currentElement.previousElementSibling
      : currentElement.previousSibling;
    while (
      siblingElement !== null &&
      siblingElement.lastChild !== null &&
      !this.isNewSectionElement(siblingElement as Node) &&
      !this.containsChildField(siblingElement)
    ) {
      siblingElement = siblingElement.lastChild;
    }

    if (
      siblingElement === null ||
      this.isNewSectionElement(siblingElement) ||
      this.containsChildField(siblingElement)
    ) {
      return textContentItems;
    }

    const siblingTextContent = this.getTextContentFromElement(siblingElement);
    if (siblingTextContent) {
      textContentItems.push(siblingTextContent);
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
      this.mutationObserver ?? undefined,
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
      /** Mutations to node attributes NOT on this list will not be observed! */
      attributeFilter: Object.values(AUTOFILL_ATTRIBUTES),
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

    const hasMutationsInShadowRoot = this.domQueryService.checkMutationsInShadowRoots(mutations);

    if (hasMutationsInShadowRoot) {
      this.debouncedRequirePageDetailsUpdate();
    }

    if (!this.pendingShadowDomCheck) {
      this.pendingShadowDomCheck = true;

      if (this.shadowDomCheckTimeout) {
        clearTimeout(this.shadowDomCheckTimeout);
      }

      this.shadowDomCheckTimeout = setTimeout(() => {
        this.handleNewShadowRoots();
        this.pendingShadowDomCheck = false;
      }, this.shadowDomCheckTimeoutMs);
    }

    if (!this.mutationsQueue.length) {
      requestIdleCallbackPolyfill(this.debouncedProcessMutations, { timeout: 500 });
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
    this.autofillFieldsByOpid.clear();

    // Reset shadow root tracking on navigation
    this.domQueryService.resetObservedShadowRoots();

    this.updateAutofillElementsAfterMutation();
  }

  /**
   * Handles the processing of all mutations in the mutations queue. Will trigger
   * within an idle callback to help with performance and prevent excessive updates.
   */
  private processMutations = () => {
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
  private requirePageDetailsUpdate() {
    this.domRecentlyMutated = true;
    if (this.autofillOverlayContentService) {
      this.autofillOverlayContentService.pageDetailsUpdateRequired = true;
    }
    this.noFieldsFound = false;
    this.updateAutofillElementsAfterMutation();
  }

  /**
   * Debounced version of requirePageDetailsUpdate to prevent excessive updates
   */
  private debouncedRequirePageDetailsUpdate = debounce(() => {
    this.requirePageDetailsUpdate();
  }, this.shadowDomCheckDebounceMs);

  /**
   * Detects new shadow roots and schedules a page details update if any are found.
   * This is called periodically to catch shadow roots added after initial page load.
   * The update is debounced to prevent excessive collection triggers.
   * @private
   */
  private handleNewShadowRoots = () => {
    const hasNewShadowRoots = this.domQueryService.checkForNewShadowRoots();
    if (hasNewShadowRoots) {
      this.debouncedRequirePageDetailsUpdate();
    }
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
    const overlayService = this.autofillOverlayContentService;
    if (overlayService !== undefined) {
      const ownedTags = overlayService.getOwnedInlineMenuTagNames() || [];
      this.ownedExperienceTagNames = ownedTags;

      if (!ownedTags.includes(element.tagName)) {
        const toggleListener = (event: Event) => {
          if ((event as ToggleEvent).newState === "open") {
            // Add a slight delay (but faster than a user's reaction), to ensure the layer
            // positioning happens after any triggered toggle has completed.
            setTimeout(() => {
              overlayService.refreshMenuLayerPosition();
            }, 100);
          }
        };
        element.addEventListener("toggle", toggleListener);

        overlayService.refreshMenuLayerPosition();
      }
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
        this.mutationObserver ?? undefined,
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
      const buildAutofillFieldItem = async () => {
        if (
          !this.isNodeFormFieldElement(node) ||
          this.autofillFieldElements.get(node as ElementWithOpId<FormFieldElement>)
        ) {
          return;
        }

        // We are setting this item to a -1 index because we do not know its position in the DOM.
        // This value should be updated with the next call to collect page details.
        const formFieldElement = node as ElementWithOpId<FormFieldElement>;
        const autofillField = await this.buildAutofillFieldItem(formFieldElement, -1);

        // Set up overlay listeners for the new field if we have the overlay service
        if (autofillField && this.autofillOverlayContentService) {
          this.setupOverlayOnField(formFieldElement, autofillField);

          if (this.domRecentlyMutated) {
            this.updateAutofillElementsAfterMutation();
          }
        }
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
      const autofillFieldData = this.autofillFieldElements.get(element);
      this.autofillFieldElements.delete(element);
      // Also remove from opid reverse index
      if (autofillFieldData?.opid) {
        this.autofillFieldsByOpid.delete(autofillFieldData.opid);
      }
    }

    // Clear pending overlay setup timeout to prevent memory leak
    const pendingTimeout = this.pendingOverlaySetup.get(element);
    if (pendingTimeout) {
      globalThis.clearTimeout(pendingTimeout);
      this.pendingOverlaySetup.delete(element);
    }
  }

  /**
   * Updates the autofill elements after a DOM mutation has occurred.
   * Uses adaptive debouncing - extends timeout if DOM is "hot" (rapid mutations).
   * This prevents premature collection during loading spinners or SPA transitions.
   * @private
   */
  private updateAutofillElementsAfterMutation() {
    if (this.updateAfterMutationIdleCallback !== null) {
      cancelIdleCallbackPolyfill(this.updateAfterMutationIdleCallback);
      this.updateAfterMutationIdleCallback = null;
    }

    const now = Date.now();
    const timeSinceLastMutation = now - this.lastMutationTimestamp;
    this.lastMutationTimestamp = now;

    // Check if mutations are occurring rapidly (DOM is still "hot")
    if (timeSinceLastMutation < this.mutationCooldownMs) {
      this.mutationBurstCount++;
    } else {
      this.mutationBurstCount = 0;
    }

    // Calculate adaptive timeout based on mutation frequency
    // If DOM is "hot" (mutations occurring rapidly), extend the wait time
    let adaptiveTimeout = this.updateAfterMutationTimeout;
    if (this.mutationBurstCount > 0) {
      // Extend timeout proportionally to mutation frequency, up to max wait time
      const extensionMs = Math.min(
        this.mutationBurstCount * this.mutationCooldownMs,
        this.maxMutationWaitMs - this.updateAfterMutationTimeout,
      );
      adaptiveTimeout = this.updateAfterMutationTimeout + extensionMs;
    }

    this.updateAfterMutationIdleCallback = requestIdleCallbackPolyfill(
      this.getPageDetails.bind(this),
      { timeout: adaptiveTimeout },
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
    if (attributeName === undefined) {
      return;
    }
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
      action: () => {
        const actionUrl = this.getFormActionAttribute(element);
        if (actionUrl !== null) {
          dataTarget.htmlAction = actionUrl;
        }
      },
      name: () => updateAttribute("htmlName"),
      id: () => updateAttribute("htmlID"),
      class: () => updateAttribute("htmlClass"),
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
      "aria-describedby": () => updateAttribute(AUTOFILL_ATTRIBUTES.ARIA_DESCRIBEDBY),
      "aria-label": () => updateAttribute("label-aria"),
      "aria-labelledby": () => updateAttribute(AUTOFILL_ATTRIBUTES.ARIA_LABELLEDBY),
      "aria-hidden": () =>
        (dataTarget["aria-hidden"] = this.getAttributeBoolean(
          element,
          AUTOFILL_ATTRIBUTES.ARIA_HIDDEN,
          true,
        )),
      "aria-disabled": () =>
        (dataTarget["aria-disabled"] = this.getAttributeBoolean(
          element,
          AUTOFILL_ATTRIBUTES.ARIA_DISABLED,
          true,
        )),
      "aria-haspopup": () =>
        (dataTarget["aria-haspopup"] = this.getAttributeBoolean(
          element,
          AUTOFILL_ATTRIBUTES.ARIA_HASPOPUP,
          true,
        )),
      autocomplete: () => (dataTarget.autoCompleteType = this.getAutoCompleteAttribute(element)),
      autocompletetype: () =>
        (dataTarget.autoCompleteType = this.getAutoCompleteAttribute(element)),
      "x-autocompletetype": () =>
        (dataTarget.autoCompleteType = this.getAutoCompleteAttribute(element)),
      class: () => updateAttribute("htmlClass"),
      checked: () =>
        (dataTarget.checked = this.getAttributeBoolean(element, AUTOFILL_ATTRIBUTES.CHECKED)),
      "data-label": () => updateAttribute("label-data"),
      "data-stripe": () => updateAttribute(AUTOFILL_ATTRIBUTES.DATA_STRIPE),
      disabled: () =>
        (dataTarget.disabled = this.getAttributeBoolean(element, AUTOFILL_ATTRIBUTES.DISABLED)),
      id: () => updateAttribute("htmlID"),
      maxlength: () => (dataTarget.maxLength = this.getAutofillFieldMaxLength(element)),
      name: () => updateAttribute("htmlName"),
      placeholder: () => updateAttribute(AUTOFILL_ATTRIBUTES.PLACEHOLDER),
      readonly: () =>
        (dataTarget.readonly = this.getAttributeBoolean(element, AUTOFILL_ATTRIBUTES.READONLY)),
      rel: () => updateAttribute(AUTOFILL_ATTRIBUTES.REL),
      tabindex: () => updateAttribute(AUTOFILL_ATTRIBUTES.TABINDEX),
      title: () => updateAttribute(AUTOFILL_ATTRIBUTES.TITLE),
      type: () => (dataTarget.type = this.getAttributeLowerCase(element, AUTOFILL_ATTRIBUTES.TYPE)),
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
      threshold: 0.9999, // Safari doesn't seem to function properly with a threshold of 1,
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
        if (this.intersectionObserver !== null) {
          this.intersectionObserver.unobserve(entry.target);
        }
        continue;
      }

      const isViewable = await this.domElementVisibilityService.isElementViewable(formFieldElement);
      if (!isViewable) {
        continue;
      }

      cachedAutofillFieldElement.viewable = true;
      this.setupOverlayOnField(formFieldElement, cachedAutofillFieldElement);

      if (this.intersectionObserver !== null) {
        this.intersectionObserver.unobserve(entry.target);
      }
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
   * Debounced per-element to prevent excessive setup/teardown during rapid DOM changes.
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
    if (!this.autofillOverlayContentService) {
      return;
    }

    // Check if there's already a pending debounce for this element
    const existingTimeout = this.pendingOverlaySetup.get(formFieldElement);
    const shouldExecuteImmediately = !existingTimeout;

    // Cancel any pending setup for this element
    if (existingTimeout) {
      globalThis.clearTimeout(existingTimeout);
    }

    // Execute immediately on first call (leading edge), then debounce subsequent calls
    if (shouldExecuteImmediately) {
      this.executeOverlaySetup(formFieldElement, autofillField, pageDetails);
    }

    // Set up debounce timeout that clears the tracking after the delay
    // This allows the next call after the delay to execute immediately again
    const timeoutId = globalThis.setTimeout(() => {
      this.pendingOverlaySetup.delete(formFieldElement);
    }, this.overlaySetupDelayMs);

    this.pendingOverlaySetup.set(formFieldElement, timeoutId);
  }

  /**
   * Executes the overlay setup for a form field element.
   *
   * @param formFieldElement - The form field element to set up the inline menu listener on
   * @param autofillField - The metadata for the form field
   * @param pageDetails - The page details to use for the inline menu listeners
   */
  private executeOverlaySetup(
    formFieldElement: ElementWithOpId<FormFieldElement>,
    autofillField: AutofillField,
    pageDetails?: AutofillPageDetails,
  ) {
    // Verify the field is still in the DOM and cached before setup
    if (
      !formFieldElement.isConnected ||
      !this.autofillFieldElements.has(formFieldElement) ||
      !this.autofillOverlayContentService
    ) {
      return;
    }

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
    if (this.updateAfterMutationIdleCallback !== null) {
      cancelIdleCallbackPolyfill(this.updateAfterMutationIdleCallback);
      this.updateAfterMutationIdleCallback = null;
    }
    if (this.shadowDomCheckTimeout) {
      clearTimeout(this.shadowDomCheckTimeout);
    }
    this.pendingOverlaySetup.forEach((timeout) => globalThis.clearTimeout(timeout));
    this.pendingOverlaySetup.clear();
    if (this.mutationObserver !== null) {
      this.mutationObserver.disconnect();
      this.mutationObserver = null;
    }
    if (this.intersectionObserver !== null) {
      this.intersectionObserver.disconnect();
      this.intersectionObserver = null;
    }
  }
}
