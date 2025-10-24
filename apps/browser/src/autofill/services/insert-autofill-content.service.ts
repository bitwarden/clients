// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { EVENTS, TYPE_CHECK } from "@bitwarden/common/autofill/constants";
import { AutofillFieldQualifierType } from "@bitwarden/common/autofill/types";

import AutofillScript, { AutofillInsertActions, FillScript } from "../models/autofill-script";
import { FormFieldElement } from "../types";
import {
  currentlyInSandboxedIframe,
  elementIsFillableFormField,
  elementIsInputElement,
  elementIsSelectElement,
  elementIsTextAreaElement,
} from "../utils";

import { DomElementVisibilityService } from "./abstractions/dom-element-visibility.service";
import { InsertAutofillContentService as InsertAutofillContentServiceInterface } from "./abstractions/insert-autofill-content.service";
import { CollectAutofillContentService } from "./collect-autofill-content.service";

class InsertAutofillContentService implements InsertAutofillContentServiceInterface {
  private readonly autofillInsertActions: AutofillInsertActions = {
    fill_by_opid: ({ opid, value }) => this.handleFillFieldByOpidAction(opid, value),
    click_on_opid: ({ opid }) => this.handleClickOnFieldByOpidAction(opid),
    focus_by_opid: ({ opid }) => this.handleFocusOnFieldByOpidAction(opid),
    fill_by_targeted_field_type: ({ fieldType, value }) =>
      this.handleFillFieldByTargetedFieldTypeAction(fieldType, value),
    click_on_targeted_field_type: ({ fieldType }) =>
      this.handleClickOnFieldByTargetedFieldTypeAction(fieldType),
    focus_by_targeted_field_type: ({ fieldType }) =>
      this.handleFocusOnFieldByTargetedFieldTypeAction(fieldType),
  };

  /**
   * InsertAutofillContentService constructor. Instantiates the
   * DomElementVisibilityService and CollectAutofillContentService classes.
   */
  constructor(
    private domElementVisibilityService: DomElementVisibilityService,
    private collectAutofillContentService: CollectAutofillContentService,
  ) {}

  /**
   * Handles autofill of the forms on the current page based on the
   * data within the passed fill script object.
   * @param {AutofillScript} fillScript
   * @returns {Promise<void>}
   * @public
   */
  async fillForm(fillScript: AutofillScript) {
    if (
      !fillScript.script?.length ||
      currentlyInSandboxedIframe() ||
      this.userCancelledInsecureUrlAutofill(fillScript.savedUrls) ||
      this.userCancelledUntrustedIframeAutofill(fillScript)
    ) {
      return;
    }

    for (let index = 0; index < fillScript.script.length; index++) {
      await this.runFillScriptAction(fillScript.script[index], index);
    }
  }

  /**
   * Checks if the autofill is occurring on a page that can be considered secure. If the page is not secure,
   * the user is prompted to confirm that they want to autofill on the page.
   * @param {string[] | null} savedUrls
   * @returns {boolean}
   * @private
   */
  private userCancelledInsecureUrlAutofill(savedUrls?: string[] | null): boolean {
    if (
      !savedUrls?.some((url) => url.startsWith(`https://${globalThis.location.hostname}`)) ||
      globalThis.location.protocol !== "http:" ||
      !this.isPasswordFieldWithinDocument()
    ) {
      return false;
    }

    const confirmationWarning = [
      chrome.i18n.getMessage("insecurePageWarning"),
      chrome.i18n.getMessage("insecurePageWarningFillPrompt", [globalThis.location.hostname]),
    ].join("\n\n");

    return !globalThis.confirm(confirmationWarning);
  }

  /**
   * Checks if there is a password field within the current document. Includes
   * password fields that are present within the shadow DOM.
   * @returns {boolean}
   * @private
   */
  private isPasswordFieldWithinDocument(): boolean {
    return this.collectAutofillContentService.isPasswordFieldWithinDocument();
  }

  /**
   * Checking if the autofill is occurring within an untrusted iframe. If the page is within an untrusted iframe,
   * the user is prompted to confirm that they want to autofill on the page. If the user cancels the autofill,
   * the script will not continue.
   *
   * Note: confirm() is blocked by sandboxed iframes, but we don't want to fill sandboxed iframes anyway.
   * If this occurs, confirm() returns false without displaying the dialog box, and autofill will be aborted.
   * The browser may print a message to the console, but this is not a standard error that we can handle.
   * @param {AutofillScript} fillScript
   * @returns {boolean}
   * @private
   */
  private userCancelledUntrustedIframeAutofill(fillScript: AutofillScript): boolean {
    if (!fillScript.untrustedIframe) {
      return false;
    }

    const confirmationWarning = [
      chrome.i18n.getMessage("autofillIframeWarning"),
      chrome.i18n.getMessage("autofillIframeWarningTip", [globalThis.location.hostname]),
    ].join("\n\n");

    return !globalThis.confirm(confirmationWarning);
  }

  /**
   * Runs the autofill action based on the action type and the opid.
   * Each action is subsequently delayed by 20 milliseconds.
   * @param {"click_on_opid" | "focus_by_opid" | "fill_by_opid"} action
   * @param {string} opid
   * @param {string} value
   * @param {number} actionIndex
   * @returns {Promise<void>}
   * @private
   */
  private runFillScriptAction = (
    [action, actionTarget, value]: FillScript,
    actionIndex: number,
  ): Promise<void> => {
    if (!actionTarget || !this.autofillInsertActions[action]) {
      return;
    }

    const delayActionsInMilliseconds = 20;
    return new Promise((resolve) =>
      setTimeout(() => {
        switch (action) {
          case "fill_by_targeted_field_type":
            this.autofillInsertActions[action]({
              fieldType: actionTarget as AutofillFieldQualifierType,
              value,
            });
            break;
          case "click_on_targeted_field_type":
          case "focus_by_targeted_field_type":
            this.autofillInsertActions[action]({
              fieldType: actionTarget as AutofillFieldQualifierType,
            });
            break;
          case "fill_by_opid":
            this.autofillInsertActions[action]({ opid: actionTarget, value });
            break;
          case "click_on_opid":
          case "focus_by_opid":
            this.autofillInsertActions[action]({ opid: actionTarget });
            break;
          default:
            break;
        }

        resolve();
      }, delayActionsInMilliseconds * actionIndex),
    );
  };

  /**
   * Queries the DOM for an element by opid and inserts the passed value into the element.
   * @param {string} opid
   * @param {string} value
   * @private
   */
  private handleFillFieldByOpidAction(opid: string, value: string) {
    const element = this.collectAutofillContentService.getAutofillFieldElementByOpid(opid);
    this.insertValueIntoField(element, value);
  }

  /**
   * Handles finding an element by opid and triggering a click event on the element.
   * @param {string} opid
   * @private
   */
  private handleClickOnFieldByOpidAction(opid: string) {
    const element = this.collectAutofillContentService.getAutofillFieldElementByOpid(opid);
    this.triggerClickOnElement(element);
  }

  /**
   * Handles finding an element by opid and triggering click and focus events on the element.
   * To ensure that we trigger a blur event correctly on a filled field, we first check if the
   * element is already focused. If it is, we blur the element before focusing on it again.
   *
   * @param {string} opid - The opid of the element to focus on.
   */
  private handleFocusOnFieldByOpidAction(opid: string) {
    const element = this.collectAutofillContentService.getAutofillFieldElementByOpid(opid);

    if (document.activeElement === element) {
      element.blur();
    }

    this.simulateUserMouseClickAndFocusEventInteractions(element, true);
  }

  /**
   * Handles finding an element by targeted field type and inserts the passed value into the element.
   * @param {AutofillFieldQualifierType} fieldType
   * @param {string} value
   * @private
   */
  private handleFillFieldByTargetedFieldTypeAction(
    fieldType: AutofillFieldQualifierType,
    value: string,
  ) {
    const targetedElement = this.getElementByTargetedFieldType(fieldType);

    if (targetedElement) {
      this.insertValueIntoField(targetedElement, value);
    }
  }

  /**
   * Handles finding an element by targeted field type and triggering a click event on the element.
   * @param {AutofillFieldQualifierType} fieldType
   * @private
   */
  private handleClickOnFieldByTargetedFieldTypeAction(fieldType: AutofillFieldQualifierType) {
    const targetedElement = this.getElementByTargetedFieldType(fieldType);

    if (targetedElement) {
      this.triggerClickOnElement(targetedElement);
    }
  }

  /**
   * Handles finding an element by targeted field type and triggering click and focus events on the element.
   * To ensure that we trigger a blur event correctly on a filled field, we first check if the
   * element is already focused. If it is, we blur the element before focusing on it again.
   *
   * @param {AutofillFieldQualifierType} fieldType
   */
  private handleFocusOnFieldByTargetedFieldTypeAction(fieldType: AutofillFieldQualifierType) {
    const targetedElement = this.getElementByTargetedFieldType(fieldType);

    if (targetedElement) {
      if (document.activeElement === targetedElement) {
        targetedElement.blur();
      }

      this.simulateUserMouseClickAndFocusEventInteractions(targetedElement, true);
    }
  }

  private getElementByTargetedFieldType(fieldType: AutofillFieldQualifierType) {
    const targetedElements = this.collectAutofillContentService.getTargetedFields();

    return (targetedElements[fieldType] as HTMLElement) || null;
  }

  /**
   * Identifies the type of element passed and inserts the value into the element.
   * Will trigger simulated events on the element to ensure that the element is
   * properly updated.
   * @param {FormFieldElement | null} element
   * @param {string} value
   * @private
   */
  private insertValueIntoField(element: FormFieldElement | null, value: string) {
    const elementCanBeReadonly =
      elementIsInputElement(element) || elementIsTextAreaElement(element);
    const elementCanBeFilled = elementCanBeReadonly || elementIsSelectElement(element);
    const elementValue = (element as HTMLInputElement)?.value || element?.innerText || "";

    const elementAlreadyHasTheValue = !!(elementValue?.length && elementValue === value);

    if (
      !element ||
      !value ||
      elementAlreadyHasTheValue ||
      (elementCanBeReadonly && element.readOnly) ||
      (elementCanBeFilled && element.disabled)
    ) {
      return;
    }

    if (!elementIsFillableFormField(element)) {
      this.handleInsertValueAndTriggerSimulatedEvents(element, () => (element.innerText = value));
      return;
    }

    const isFillableCheckboxOrRadioElement =
      elementIsInputElement(element) &&
      new Set(["checkbox", "radio"]).has(element.type) &&
      new Set(["true", "y", "1", "yes", "✓"]).has(String(value).toLowerCase());
    if (isFillableCheckboxOrRadioElement) {
      this.handleInsertValueAndTriggerSimulatedEvents(element, () => (element.checked = true));
      return;
    }

    this.handleInsertValueAndTriggerSimulatedEvents(element, () => (element.value = value));
  }

  /**
   * Simulates pre- and post-insert events on the element meant to mimic user interactions
   * while inserting the autofill value into the element.
   * @param {FormFieldElement} element
   * @param {Function} valueChangeCallback
   * @private
   */
  private handleInsertValueAndTriggerSimulatedEvents(
    element: FormFieldElement,
    valueChangeCallback: CallableFunction,
  ): void {
    this.triggerPreInsertEventsOnElement(element);
    valueChangeCallback();
    this.triggerPostInsertEventsOnElement(element);
    this.triggerFillAnimationOnElement(element);
  }

  /**
   * Simulates a mouse click event on the element, including focusing the event, and
   * the triggers a simulated keyboard event on the element. Will attempt to ensure
   * that the initial element value is not arbitrarily changed by the simulated events.
   * @param {FormFieldElement} element
   * @private
   */
  private triggerPreInsertEventsOnElement(element: FormFieldElement): void {
    const initialElementValue = "value" in element ? element.value : "";

    this.simulateUserMouseClickAndFocusEventInteractions(element);
    this.simulateUserKeyboardEventInteractions(element);

    if ("value" in element && initialElementValue !== element.value) {
      element.value = initialElementValue;
    }
  }

  /**
   * Simulates a keyboard event on the element before assigning the autofilled value to the element, and then
   * simulates an input change event on the element to trigger expected events after autofill occurs.
   * @param {FormFieldElement} element
   * @private
   */
  private triggerPostInsertEventsOnElement(element: FormFieldElement): void {
    const autofilledValue = "value" in element ? element.value : "";
    this.simulateUserKeyboardEventInteractions(element);

    if ("value" in element && autofilledValue !== element.value) {
      element.value = autofilledValue;
    }

    this.simulateInputElementChangedEvent(element);
  }

  /**
   * Identifies if a passed element can be animated and sets a class on the element
   * to trigger a CSS animation. The animation is removed after a short delay.
   * @param {FormFieldElement} element
   * @private
   */
  private triggerFillAnimationOnElement(element: FormFieldElement): void {
    const skipAnimatingElement =
      elementIsFillableFormField(element) &&
      !new Set(["email", "text", "password", "number", "tel", "url"]).has(element?.type);

    if (this.domElementVisibilityService.isElementHiddenByCss(element) || skipAnimatingElement) {
      return;
    }

    element.classList.add("com-bitwarden-browser-animated-fill");
    setTimeout(() => element.classList.remove("com-bitwarden-browser-animated-fill"), 200);
  }

  /**
   * Simulates a click  event on the element.
   * @param {HTMLElement} element
   * @private
   */
  private triggerClickOnElement(element?: HTMLElement): void {
    if (typeof element?.click !== TYPE_CHECK.FUNCTION) {
      return;
    }

    element.click();
  }

  /**
   * Simulates a focus event on the element. Will optionally reset the value of the element
   * if the element has a value property.
   * @param {HTMLElement | undefined} element
   * @param {boolean} shouldResetValue
   * @private
   */
  private triggerFocusOnElement(element: HTMLElement | undefined, shouldResetValue = false): void {
    if (typeof element?.focus !== TYPE_CHECK.FUNCTION) {
      return;
    }

    let initialValue = "";
    if (shouldResetValue && "value" in element) {
      initialValue = String(element.value);
    }

    element.focus();

    if (initialValue && "value" in element) {
      element.value = initialValue;
    }
  }

  /**
   * Simulates a mouse click and focus event on the element.
   * @param {FormFieldElement} element
   * @param {boolean} shouldResetValue
   * @private
   */
  private simulateUserMouseClickAndFocusEventInteractions(
    element: FormFieldElement,
    shouldResetValue = false,
  ): void {
    this.triggerClickOnElement(element);
    this.triggerFocusOnElement(element, shouldResetValue);
  }

  /**
   * Simulates several keyboard events on the element, mocking a user interaction with the element.
   * @param {FormFieldElement} element
   * @private
   */
  private simulateUserKeyboardEventInteractions(element: FormFieldElement): void {
    const simulatedKeyboardEvents = [EVENTS.KEYDOWN, EVENTS.KEYPRESS, EVENTS.KEYUP];
    for (let index = 0; index < simulatedKeyboardEvents.length; index++) {
      element.dispatchEvent(new KeyboardEvent(simulatedKeyboardEvents[index], { bubbles: true }));
    }
  }

  /**
   * Simulates an input change event on the element, mocking behavior that would occur if a user
   * manually changed a value for the element.
   * @param {FormFieldElement} element
   * @private
   */
  private simulateInputElementChangedEvent(element: FormFieldElement): void {
    const simulatedInputEvents = [EVENTS.INPUT, EVENTS.CHANGE];
    for (let index = 0; index < simulatedInputEvents.length; index++) {
      element.dispatchEvent(new Event(simulatedInputEvents[index], { bubbles: true }));
    }
  }
}

export default InsertAutofillContentService;
