// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import "@webcomponents/custom-elements";
import "lit/polyfill-support.js";
import { FocusableElement, tabbable } from "tabbable";

import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { EVENTS, AutofillOverlayVisibility } from "@bitwarden/common/autofill/constants";

import { FocusedFieldData } from "../../background/abstractions/overlay.background";
import { AutofillOverlayElement, RedirectFocusDirection } from "../../enums/autofill-overlay.enum";
import AutofillField from "../../models/autofill-field";
import AutofillPageDetails from "../../models/autofill-page-details";
import { AutofillOverlayContentExtensionMessageHandlers } from "../../services/abstractions/autofill-overlay-content.service";
import { AutoFillConstants } from "../../services/autofill-constants";
import { InlineMenuFieldQualificationService } from "../../services/inline-menu-field-qualification.service";
import { ElementWithOpId, FillableFormFieldElement, FormFieldElement } from "../../types";
import {
  elementIsFillableFormField,
  generateRandomCustomElementName,
  sendExtensionMessage,
  setElementStyles,
} from "../../utils";
import AutofillOverlayButtonIframe from "../overlay/iframe-content/autofill-overlay-button-iframe.deprecated";
import AutofillOverlayListIframe from "../overlay/iframe-content/autofill-overlay-list-iframe.deprecated";

import {
  LegacyAutofillOverlayContentService as LegacyAutofillOverlayContentServiceInterface,
  OpenAutofillOverlayOptions,
} from "./abstractions/autofill-overlay-content.service";

class LegacyAutofillOverlayContentService implements LegacyAutofillOverlayContentServiceInterface {
  private readonly inlineMenuFieldQualificationService: InlineMenuFieldQualificationService;
  isFieldCurrentlyFocused = false;
  isCurrentlyFilling = false;
  isOverlayCiphersPopulated = false;
  pageDetailsUpdateRequired = false;
  autofillOverlayVisibility: number;
  private isFirefoxBrowser =
    globalThis.navigator.userAgent.indexOf(" Firefox/") !== -1 ||
    globalThis.navigator.userAgent.indexOf(" Gecko/") !== -1;
  private readonly generateRandomCustomElementName = generateRandomCustomElementName;
  private readonly findTabs = tabbable;
  private readonly sendExtensionMessage = sendExtensionMessage;
  private formFieldElements: Set<ElementWithOpId<FormFieldElement>> = new Set([]);
  private ignoredFieldTypes: Set<string> = new Set(AutoFillConstants.ExcludedInlineMenuTypes);
  private userFilledFields: Record<string, FillableFormFieldElement> = {};
  private authStatus: AuthenticationStatus;
  private focusableElements: FocusableElement[] = [];
  private isOverlayButtonVisible = false;
  private isOverlayListVisible = false;
  private overlayButtonElement: HTMLElement;
  private overlayListElement: HTMLElement;
  private mostRecentlyFocusedField: ElementWithOpId<FormFieldElement>;
  private focusedFieldData: FocusedFieldData;
  private userInteractionEventTimeout: number | NodeJS.Timeout;
  private overlayElementsMutationObserver: MutationObserver;
  private bodyElementMutationObserver: MutationObserver;
  private documentElementMutationObserver: MutationObserver;
  private mutationObserverIterations = 0;
  private mutationObserverIterationsResetTimeout: number | NodeJS.Timeout;
  private eventHandlersMemo: { [key: string]: EventListener } = {};
  private readonly customElementDefaultStyles: Partial<CSSStyleDeclaration> = {
    all: "initial",
    position: "fixed",
    display: "block",
    zIndex: "2147483647",
  };

  constructor() {
    this.inlineMenuFieldQualificationService = new InlineMenuFieldQualificationService();
  }

  /**
   * Satisfy the AutofillOverlayContentService interface.
   */
  messageHandlers = {} as AutofillOverlayContentExtensionMessageHandlers;
  clearUserFilledFields() {
    // do nothing
  }

  async setupOverlayListeners(
    autofillFieldElement: ElementWithOpId<FormFieldElement>,
    autofillFieldData: AutofillField,
    pageDetails: AutofillPageDetails,
  ) {
    await this.setupAutofillOverlayListenerOnField(
      autofillFieldElement,
      autofillFieldData,
      pageDetails,
    );
  }
  async blurMostRecentlyFocusedField(_isClosingInlineMenu: boolean) {
    this.blurMostRecentOverlayField();
  }

  /**
   * Initializes the autofill overlay content service by setting up the mutation observers.
   * The observers will be instantiated on DOMContentLoaded if the page is current loading.
   */
  init() {
    if (globalThis.document.readyState === "loading") {
      globalThis.document.addEventListener(EVENTS.DOMCONTENTLOADED, this.setupGlobalEventListeners);
      return;
    }

    this.setupGlobalEventListeners();
  }

  /**
   * Sets up the autofill overlay listener on the form field element. This method is called
   * during the page details collection process.
   *
   * @param formFieldElement - Form field elements identified during the page details collection process.
   * @param autofillFieldData - Autofill field data captured from the form field element.
   * @param pageDetails - The collected page details from the tab.
   */
  async setupAutofillOverlayListenerOnField(
    formFieldElement: ElementWithOpId<FormFieldElement>,
    autofillFieldData: AutofillField,
    pageDetails: AutofillPageDetails,
  ) {
    if (
      this.formFieldElements.has(formFieldElement) ||
      this.isIgnoredField(autofillFieldData, pageDetails)
    ) {
      return;
    }

    this.formFieldElements.add(formFieldElement);

    if (!this.autofillOverlayVisibility) {
      await this.getAutofillOverlayVisibility();
    }

    this.setupFormFieldElementEventListeners(formFieldElement);

    if (this.getRootNodeActiveElement(formFieldElement) === formFieldElement) {
      await this.triggerFormFieldFocusedAction(formFieldElement);
      return;
    }

    if (!this.mostRecentlyFocusedField) {
      await this.updateMostRecentlyFocusedField(formFieldElement);
    }
  }

  /**
   * Handles opening the autofill overlay. Will conditionally open
   * the overlay based on the current autofill overlay visibility setting.
   * Allows you to optionally focus the field element when opening the overlay.
   * Will also optionally ignore the overlay visibility setting and open the
   *
   * @param options - Options for opening the autofill overlay.
   */
  openAutofillOverlay(options: OpenAutofillOverlayOptions = {}) {
    const { isFocusingFieldElement, isOpeningFullOverlay, authStatus } = options;
    if (!this.mostRecentlyFocusedField) {
      return;
    }

    if (this.pageDetailsUpdateRequired) {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.sendExtensionMessage("bgCollectPageDetails", {
        sender: "autofillOverlayContentService",
      });
      this.pageDetailsUpdateRequired = false;
    }

    if (isFocusingFieldElement && !this.recentlyFocusedFieldIsCurrentlyFocused()) {
      this.focusMostRecentOverlayField();
    }

    if (typeof authStatus !== "undefined") {
      this.authStatus = authStatus;
    }

    if (
      this.autofillOverlayVisibility === AutofillOverlayVisibility.OnButtonClick &&
      !isOpeningFullOverlay
    ) {
      this.updateOverlayButtonPosition();
      return;
    }

    this.updateOverlayElementsPosition();
  }

  /**
   * Focuses the most recently focused field element.
   */
  focusMostRecentOverlayField() {
    this.mostRecentlyFocusedField?.focus();
  }

  /**
   * Removes focus from the most recently focused field element.
   */
  blurMostRecentOverlayField() {
    this.mostRecentlyFocusedField?.blur();
  }

  /**
   * Removes the autofill overlay from the page. This will initially
   * unobserve the body element to ensure the mutation observer no
   * longer triggers.
   */
  removeAutofillOverlay = () => {
    this.removeBodyElementObserver();
    this.removeAutofillOverlayButton();
    this.removeAutofillOverlayList();
  };

  /**
   * Removes the overlay button from the DOM if it is currently present. Will
   * also remove the overlay reposition event listeners.
   */
  removeAutofillOverlayButton() {
    if (!this.overlayButtonElement) {
      return;
    }

    this.overlayButtonElement.remove();
    this.isOverlayButtonVisible = false;
    void this.sendExtensionMessage("autofillOverlayElementClosed", {
      overlayElement: AutofillOverlayElement.Button,
    });
    this.removeOverlayRepositionEventListeners();
  }

  /**
   * Removes the overlay list from the DOM if it is currently present.
   */
  removeAutofillOverlayList() {
    if (!this.overlayListElement) {
      return;
    }

    this.overlayListElement.remove();
    this.isOverlayListVisible = false;
    void this.sendExtensionMessage("autofillOverlayElementClosed", {
      overlayElement: AutofillOverlayElement.List,
    });
  }

  /**
   * Formats any found user filled fields for a login cipher and sends a message
   * to the background script to add a new cipher.
   */
  addNewVaultItem() {
    if (!this.isOverlayListVisible) {
      return;
    }

    const login = {
      username: this.userFilledFields["username"]?.value || "",
      password: this.userFilledFields["password"]?.value || "",
      uri: globalThis.document.URL,
      hostname: globalThis.document.location.hostname,
    };

    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.sendExtensionMessage("autofillOverlayAddNewVaultItem", { login });
  }

  /**
   * Redirects the keyboard focus out of the overlay, selecting the element that is
   * either previous or next in the tab order. If the direction is current, the most
   * recently focused field will be focused.
   *
   * @param direction - The direction to redirect the focus.
   */
  redirectOverlayFocusOut(direction: string) {
    if (!this.isOverlayListVisible || !this.mostRecentlyFocusedField) {
      return;
    }

    if (direction === RedirectFocusDirection.Current) {
      this.focusMostRecentOverlayField();
      setTimeout(this.removeAutofillOverlay, 100);
      return;
    }

    if (!this.focusableElements.length) {
      this.focusableElements = this.findTabs(globalThis.document.body, { getShadowRoot: true });
    }

    const focusedElementIndex = this.focusableElements.findIndex(
      (element) => element === this.mostRecentlyFocusedField,
    );

    const indexOffset = direction === RedirectFocusDirection.Previous ? -1 : 1;
    const redirectFocusElement = this.focusableElements[focusedElementIndex + indexOffset];
    redirectFocusElement?.focus();
  }

  /**
   * Sets up the event listeners that facilitate interaction with the form field elements.
   * Will clear any cached form field element handlers that are encountered when setting
   * up a form field element to the overlay.
   *
   * @param formFieldElement - The form field element to set up the event listeners for.
   */
  private setupFormFieldElementEventListeners(formFieldElement: ElementWithOpId<FormFieldElement>) {
    this.removeCachedFormFieldEventListeners(formFieldElement);

    formFieldElement.addEventListener(EVENTS.BLUR, this.handleFormFieldBlurEvent);
    formFieldElement.addEventListener(EVENTS.KEYUP, this.handleFormFieldKeyupEvent);
    formFieldElement.addEventListener(
      EVENTS.INPUT,
      this.handleFormFieldInputEvent(formFieldElement),
    );
    formFieldElement.addEventListener(
      EVENTS.CLICK,
      this.handleFormFieldClickEvent(formFieldElement),
    );
    formFieldElement.addEventListener(
      EVENTS.FOCUS,
      this.handleFormFieldFocusEvent(formFieldElement),
    );
  }

  /**
   * Removes any cached form field element handlers that are encountered
   * when setting up a form field element to present the overlay.
   *
   * @param formFieldElement - The form field element to remove the cached handlers for.
   */
  private removeCachedFormFieldEventListeners(formFieldElement: ElementWithOpId<FormFieldElement>) {
    const handlers = [EVENTS.INPUT, EVENTS.CLICK, EVENTS.FOCUS];
    for (let index = 0; index < handlers.length; index++) {
      const event = handlers[index];
      const memoIndex = this.getFormFieldHandlerMemoIndex(formFieldElement, event);
      const existingHandler = this.eventHandlersMemo[memoIndex];
      if (!existingHandler) {
        return;
      }

      formFieldElement.removeEventListener(event, existingHandler);
      delete this.eventHandlersMemo[memoIndex];
    }
  }

  /**
   * Helper method that facilitates registration of an event handler to a form field element.
   *
   * @param eventHandler - The event handler to memoize.
   * @param memoIndex - The memo index to use for the event handler.
   */
  private useEventHandlersMemo = (eventHandler: EventListener, memoIndex: string) => {
    return this.eventHandlersMemo[memoIndex] || (this.eventHandlersMemo[memoIndex] = eventHandler);
  };

  /**
   * Formats the memoIndex for the form field event handler.
   *
   * @param formFieldElement - The form field element to format the memo index for.
   * @param event - The event to format the memo index for.
   */
  private getFormFieldHandlerMemoIndex(
    formFieldElement: ElementWithOpId<FormFieldElement>,
    event: string,
  ) {
    return `${formFieldElement.opid}-${formFieldElement.id}-${event}-handler`;
  }

  /**
   * Form Field blur event handler. Updates the value identifying whether
   * the field is focused and sends a message to check if the overlay itself
   * is currently focused.
   */
  private handleFormFieldBlurEvent = () => {
    this.isFieldCurrentlyFocused = false;
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.sendExtensionMessage("checkAutofillOverlayFocused");
  };

  /**
   * Form field keyup event handler. Facilitates the ability to remove the
   * autofill overlay using the escape key, focusing the overlay list using
   * the ArrowDown key, and ensuring that the overlay is repositioned when
   * the form is submitted using the Enter key.
   *
   * @param event - The keyup event.
   */
  private handleFormFieldKeyupEvent = (event: KeyboardEvent) => {
    const eventCode = event.code;
    if (eventCode === "Escape") {
      this.removeAutofillOverlay();
      return;
    }

    if (eventCode === "Enter" && !this.isCurrentlyFilling) {
      this.handleOverlayRepositionEvent();
      return;
    }

    if (eventCode === "ArrowDown") {
      event.preventDefault();
      event.stopPropagation();

      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.focusOverlayList();
    }
  };

  /**
   * Triggers a focus of the overlay list, if it is visible. If the list is not visible,
   * the overlay will be opened and the list will be focused after a short delay. Ensures
   * that the overlay list is focused when the user presses the down arrow key.
   */
  private async focusOverlayList() {
    if (!this.isOverlayListVisible && this.mostRecentlyFocusedField) {
      await this.updateMostRecentlyFocusedField(this.mostRecentlyFocusedField);
      this.openAutofillOverlay({ isOpeningFullOverlay: true });
      setTimeout(() => this.sendExtensionMessage("focusAutofillOverlayList"), 125);
      return;
    }

    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.sendExtensionMessage("focusAutofillOverlayList");
  }

  /**
   * Sets up and memoizes the form field input event handler.
   *
   * @param formFieldElement - The form field element that triggered the input event.
   */
  private handleFormFieldInputEvent = (formFieldElement: ElementWithOpId<FormFieldElement>) => {
    return this.useEventHandlersMemo(
      () => this.triggerFormFieldInput(formFieldElement),
      this.getFormFieldHandlerMemoIndex(formFieldElement, EVENTS.INPUT),
    );
  };

  /**
   * Triggers when the form field element receives an input event. This method will
   * store the modified form element data for use when the user attempts to add a new
   * vault item. It also acts to remove the overlay list while the user is typing.
   *
   * @param formFieldElement - The form field element that triggered the input event.
   */
  private triggerFormFieldInput(formFieldElement: ElementWithOpId<FormFieldElement>) {
    if (!elementIsFillableFormField(formFieldElement)) {
      return;
    }

    this.storeModifiedFormElement(formFieldElement);

    if (formFieldElement.value && (this.isOverlayCiphersPopulated || !this.isUserAuthed())) {
      this.removeAutofillOverlayList();
      return;
    }

    this.openAutofillOverlay();
  }

  /**
   * Stores the modified form element data for use when the user attempts to add a new
   * vault item. This method will also store the most recently focused field, if it is
   * not already stored.
   *
   * @param formFieldElement
   * @private
   */
  private storeModifiedFormElement(formFieldElement: ElementWithOpId<FillableFormFieldElement>) {
    if (formFieldElement === this.mostRecentlyFocusedField) {
      this.mostRecentlyFocusedField = formFieldElement;
    }

    if (formFieldElement.type === "password") {
      this.userFilledFields.password = formFieldElement;
      return;
    }

    this.userFilledFields.username = formFieldElement;
  }

  /**
   * Sets up and memoizes the form field click event handler.
   *
   * @param formFieldElement - The form field element that triggered the click event.
   */
  private handleFormFieldClickEvent = (formFieldElement: ElementWithOpId<FormFieldElement>) => {
    return this.useEventHandlersMemo(
      () => this.triggerFormFieldClickedAction(formFieldElement),
      this.getFormFieldHandlerMemoIndex(formFieldElement, EVENTS.CLICK),
    );
  };

  /**
   * Triggers when the form field element receives a click event. This method will
   * trigger the focused action for the form field element if the overlay is not visible.
   *
   * @param formFieldElement - The form field element that triggered the click event.
   */
  private async triggerFormFieldClickedAction(formFieldElement: ElementWithOpId<FormFieldElement>) {
    if (this.isOverlayButtonVisible || this.isOverlayListVisible) {
      return;
    }

    await this.triggerFormFieldFocusedAction(formFieldElement);
  }

  /**
   * Sets up and memoizes the form field focus event handler.
   *
   * @param formFieldElement - The form field element that triggered the focus event.
   */
  private handleFormFieldFocusEvent = (formFieldElement: ElementWithOpId<FormFieldElement>) => {
    return this.useEventHandlersMemo(
      () => this.triggerFormFieldFocusedAction(formFieldElement),
      this.getFormFieldHandlerMemoIndex(formFieldElement, EVENTS.FOCUS),
    );
  };

  /**
   * Triggers when the form field element receives a focus event. This method will
   * update the most recently focused field and open the autofill overlay if the
   * autofill process is not currently active.
   *
   * @param formFieldElement - The form field element that triggered the focus event.
   */
  private async triggerFormFieldFocusedAction(formFieldElement: ElementWithOpId<FormFieldElement>) {
    if (this.isCurrentlyFilling) {
      return;
    }

    this.isFieldCurrentlyFocused = true;
    this.clearUserInteractionEventTimeout();
    const initiallyFocusedField = this.mostRecentlyFocusedField;
    await this.updateMostRecentlyFocusedField(formFieldElement);
    const formElementHasValue = Boolean((formFieldElement as HTMLInputElement).value);

    if (
      this.autofillOverlayVisibility === AutofillOverlayVisibility.OnButtonClick ||
      (formElementHasValue && initiallyFocusedField !== this.mostRecentlyFocusedField)
    ) {
      this.removeAutofillOverlayList();
    }

    if (!formElementHasValue || (!this.isOverlayCiphersPopulated && this.isUserAuthed())) {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.sendExtensionMessage("openAutofillOverlay");
      return;
    }

    this.updateOverlayButtonPosition();
  }

  /**
   * Validates whether the user is currently authenticated.
   */
  private isUserAuthed() {
    return this.authStatus === AuthenticationStatus.Unlocked;
  }

  /**
   * Validates that the most recently focused field is currently
   * focused within the root node relative to the field.
   */
  private recentlyFocusedFieldIsCurrentlyFocused() {
    return (
      this.getRootNodeActiveElement(this.mostRecentlyFocusedField) === this.mostRecentlyFocusedField
    );
  }

  /**
   * Updates the position of both the overlay button and overlay list.
   */
  private updateOverlayElementsPosition() {
    this.updateOverlayButtonPosition();
    this.updateOverlayListPosition();
  }

  /**
   * Updates the position of the overlay button.
   */
  private updateOverlayButtonPosition() {
    if (!this.overlayButtonElement) {
      this.createAutofillOverlayButton();
      this.updateCustomElementDefaultStyles(this.overlayButtonElement);
    }

    if (!this.isOverlayButtonVisible) {
      this.appendOverlayElementToBody(this.overlayButtonElement);
      this.isOverlayButtonVisible = true;
      this.setOverlayRepositionEventListeners();
    }
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.sendExtensionMessage("updateAutofillOverlayPosition", {
      overlayElement: AutofillOverlayElement.Button,
    });
  }

  /**
   * Updates the position of the overlay list.
   */
  private updateOverlayListPosition() {
    if (!this.overlayListElement) {
      this.createAutofillOverlayList();
      this.updateCustomElementDefaultStyles(this.overlayListElement);
    }

    if (!this.isOverlayListVisible) {
      this.appendOverlayElementToBody(this.overlayListElement);
      this.isOverlayListVisible = true;
    }

    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.sendExtensionMessage("updateAutofillOverlayPosition", {
      overlayElement: AutofillOverlayElement.List,
    });
  }

  /**
   * Appends the overlay element to the body element. This method will also
   * observe the body element to ensure that the overlay element is not
   * interfered with by any DOM changes.
   *
   * @param element - The overlay element to append to the body element.
   */
  private appendOverlayElementToBody(element: HTMLElement) {
    this.observeBodyElement();
    globalThis.document.body.appendChild(element);
  }

  /**
   * Sends a message that facilitates hiding the overlay elements.
   *
   * @param isHidden - Indicates if the overlay elements should be hidden.
   */
  private toggleOverlayHidden(isHidden: boolean) {
    const displayValue = isHidden ? "none" : "block";
    void this.sendExtensionMessage("updateAutofillOverlayHidden", { display: displayValue });

    this.isOverlayButtonVisible = !!this.overlayButtonElement && !isHidden;
    this.isOverlayListVisible = !!this.overlayListElement && !isHidden;
  }

  /**
   * Updates the data used to position the overlay elements in relation
   * to the most recently focused form field.
   *
   * @param formFieldElement - The form field element that triggered the focus event.
   */
  private async updateMostRecentlyFocusedField(
    formFieldElement: ElementWithOpId<FormFieldElement>,
  ) {
    this.mostRecentlyFocusedField = formFieldElement;
    const { paddingRight, paddingLeft } = globalThis.getComputedStyle(formFieldElement);
    const { width, height, top, left } =
      await this.getMostRecentlyFocusedFieldRects(formFieldElement);
    this.focusedFieldData = {
      focusedFieldStyles: { paddingRight, paddingLeft },
      focusedFieldRects: { width, height, top, left },
    };

    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.sendExtensionMessage("updateFocusedFieldData", {
      focusedFieldData: this.focusedFieldData,
    });
  }

  /**
   * Gets the bounding client rects for the most recently focused field. This method will
   * attempt to use an intersection observer to get the most recently focused field's
   * bounding client rects. If the intersection observer is not supported, or the
   * intersection observer does not return a valid bounding client rect, the form
   * field element's bounding client rect will be used.
   *
   * @param formFieldElement - The form field element that triggered the focus event.
   */
  private async getMostRecentlyFocusedFieldRects(
    formFieldElement: ElementWithOpId<FormFieldElement>,
  ) {
    const focusedFieldRects =
      await this.getBoundingClientRectFromIntersectionObserver(formFieldElement);
    if (focusedFieldRects) {
      return focusedFieldRects;
    }

    return formFieldElement.getBoundingClientRect();
  }

  /**
   * Gets the bounds of the form field element from the IntersectionObserver API.
   *
   * @param formFieldElement - The form field element that triggered the focus event.
   */
  private async getBoundingClientRectFromIntersectionObserver(
    formFieldElement: ElementWithOpId<FormFieldElement>,
  ): Promise<DOMRectReadOnly | null> {
    if (!("IntersectionObserver" in globalThis) && !("IntersectionObserverEntry" in globalThis)) {
      return null;
    }

    return new Promise((resolve) => {
      const intersectionObserver = new IntersectionObserver(
        (entries) => {
          let fieldBoundingClientRects = entries[0]?.boundingClientRect;
          if (!fieldBoundingClientRects?.width || !fieldBoundingClientRects.height) {
            fieldBoundingClientRects = null;
          }

          intersectionObserver.disconnect();
          resolve(fieldBoundingClientRects);
        },
        {
          root: globalThis.document.body,
          rootMargin: "0px",
          threshold: 0.9999, // Safari doesn't seem to function properly with a threshold of 1
        },
      );
      intersectionObserver.observe(formFieldElement);
    });
  }

  /**
   * Identifies if the field should have the autofill overlay setup on it. Currently, this is mainly
   * determined by whether the field correlates with a login cipher. This method will need to be
   * updated in the future to support other types of forms.
   *
   * @param autofillFieldData - Autofill field data captured from the form field element.
   * @param pageDetails - The collected page details from the tab.
   */
  private isIgnoredField(
    autofillFieldData: AutofillField,
    pageDetails: AutofillPageDetails,
  ): boolean {
    if (
      autofillFieldData.readonly ||
      autofillFieldData.disabled ||
      !autofillFieldData.viewable ||
      this.ignoredFieldTypes.has(autofillFieldData.type)
    ) {
      return true;
    }

    return !this.inlineMenuFieldQualificationService.isFieldForLoginForm(
      autofillFieldData,
      pageDetails,
    );
  }

  /**
   * Creates the autofill overlay button element. Will not attempt
   * to create the element if it already exists in the DOM.
   */
  private createAutofillOverlayButton() {
    if (this.overlayButtonElement) {
      return;
    }

    if (this.isFirefoxBrowser) {
      this.overlayButtonElement = globalThis.document.createElement("div");
      new AutofillOverlayButtonIframe(this.overlayButtonElement);

      return;
    }

    const customElementName = this.generateRandomCustomElementName();
    globalThis.customElements?.define(
      customElementName,
      class extends HTMLElement {
        constructor() {
          super();
          new AutofillOverlayButtonIframe(this);
        }
      },
    );
    this.overlayButtonElement = globalThis.document.createElement(customElementName);
  }

  /**
   * Creates the autofill overlay list element. Will not attempt
   * to create the element if it already exists in the DOM.
   */
  private createAutofillOverlayList() {
    if (this.overlayListElement) {
      return;
    }

    if (this.isFirefoxBrowser) {
      this.overlayListElement = globalThis.document.createElement("div");
      new AutofillOverlayListIframe(this.overlayListElement);

      return;
    }

    const customElementName = this.generateRandomCustomElementName();
    globalThis.customElements?.define(
      customElementName,
      class extends HTMLElement {
        constructor() {
          super();
          new AutofillOverlayListIframe(this);
        }
      },
    );
    this.overlayListElement = globalThis.document.createElement(customElementName);
  }

  /**
   * Updates the default styles for the custom element. This method will
   * remove any styles that are added to the custom element by other methods.
   *
   * @param element - The custom element to update the default styles for.
   */
  private updateCustomElementDefaultStyles(element: HTMLElement) {
    this.unobserveCustomElements();

    setElementStyles(element, this.customElementDefaultStyles, true);

    this.observeCustomElements();
  }

  /**
   * Queries the background script for the autofill overlay visibility setting.
   * If the setting is not found, a default value of OnFieldFocus will be used
   * @private
   */
  private async getAutofillOverlayVisibility() {
    const overlayVisibility = await this.sendExtensionMessage("getAutofillOverlayVisibility");
    this.autofillOverlayVisibility = overlayVisibility || AutofillOverlayVisibility.OnFieldFocus;
  }

  /**
   * Sets up event listeners that facilitate repositioning
   * the autofill overlay on scroll or resize.
   */
  private setOverlayRepositionEventListeners() {
    globalThis.addEventListener(EVENTS.SCROLL, this.handleOverlayRepositionEvent, {
      capture: true,
    });
    globalThis.addEventListener(EVENTS.RESIZE, this.handleOverlayRepositionEvent);
  }

  /**
   * Removes the listeners that facilitate repositioning
   * the autofill overlay on scroll or resize.
   */
  private removeOverlayRepositionEventListeners() {
    globalThis.removeEventListener(EVENTS.SCROLL, this.handleOverlayRepositionEvent, {
      capture: true,
    });
    globalThis.removeEventListener(EVENTS.RESIZE, this.handleOverlayRepositionEvent);
  }

  /**
   * Handles the resize or scroll events that enact
   * repositioning of the overlay.
   */
  private handleOverlayRepositionEvent = () => {
    if (!this.isOverlayButtonVisible && !this.isOverlayListVisible) {
      return;
    }

    this.toggleOverlayHidden(true);
    this.clearUserInteractionEventTimeout();
    this.userInteractionEventTimeout = setTimeout(
      this.triggerOverlayRepositionUpdates,
      750,
    ) as unknown as number;
  };

  /**
   * Triggers the overlay reposition updates. This method ensures that the overlay elements
   * are correctly positioned when the viewport scrolls or repositions.
   */
  private triggerOverlayRepositionUpdates = async () => {
    if (!this.recentlyFocusedFieldIsCurrentlyFocused()) {
      this.toggleOverlayHidden(false);
      this.removeAutofillOverlay();
      return;
    }

    await this.updateMostRecentlyFocusedField(this.mostRecentlyFocusedField);
    this.updateOverlayElementsPosition();
    this.toggleOverlayHidden(false);
    this.clearUserInteractionEventTimeout();

    if (
      this.focusedFieldData.focusedFieldRects?.top > 0 &&
      this.focusedFieldData.focusedFieldRects?.top < globalThis.innerHeight
    ) {
      return;
    }

    this.removeAutofillOverlay();
  };

  /**
   * Clears the user interaction event timeout. This is used to ensure that
   * the overlay is not repositioned while the user is interacting with it.
   */
  private clearUserInteractionEventTimeout() {
    if (this.userInteractionEventTimeout) {
      clearTimeout(this.userInteractionEventTimeout);
    }
  }

  /**
   * Sets up global event listeners and the mutation
   * observer to facilitate required changes to the
   * overlay elements.
   */
  private setupGlobalEventListeners = () => {
    globalThis.document.addEventListener(EVENTS.VISIBILITYCHANGE, this.handleVisibilityChangeEvent);
    globalThis.addEventListener(EVENTS.FOCUSOUT, this.handleFormFieldBlurEvent);
    this.setupMutationObserver();
  };

  /**
   * Handles the visibility change event. This method will remove the
   * autofill overlay if the document is not visible.
   */
  private handleVisibilityChangeEvent = () => {
    if (document.visibilityState === "visible") {
      return;
    }

    this.mostRecentlyFocusedField = null;
    this.removeAutofillOverlay();
  };

  /**
   * Sets up mutation observers for the overlay elements, the body element, and the
   * document element. The mutation observers are used to remove any styles that are
   * added to the overlay elements by the website. They are also used to ensure that
   * the overlay elements are always present at the bottom of the body element.
   */
  private setupMutationObserver = () => {
    this.overlayElementsMutationObserver = new MutationObserver(
      this.handleOverlayElementMutationObserverUpdate,
    );

    this.bodyElementMutationObserver = new MutationObserver(
      this.handleBodyElementMutationObserverUpdate,
    );
  };

  /**
   * Sets up mutation observers to verify that the overlay
   * elements are not modified by the website.
   */
  private observeCustomElements() {
    if (this.overlayButtonElement) {
      this.overlayElementsMutationObserver?.observe(this.overlayButtonElement, {
        attributes: true,
      });
    }

    if (this.overlayListElement) {
      this.overlayElementsMutationObserver?.observe(this.overlayListElement, { attributes: true });
    }
  }

  /**
   * Disconnects the mutation observers that are used to verify that the overlay
   * elements are not modified by the website.
   */
  private unobserveCustomElements() {
    this.overlayElementsMutationObserver?.disconnect();
  }

  /**
   * Sets up a mutation observer for the body element. The mutation observer is used
   * to ensure that the overlay elements are always present at the bottom of the body
   * element.
   */
  private observeBodyElement() {
    this.bodyElementMutationObserver?.observe(globalThis.document.body, { childList: true });
  }

  /**
   * Disconnects the mutation observer for the body element.
   */
  private removeBodyElementObserver() {
    this.bodyElementMutationObserver?.disconnect();
  }

  /**
   * Handles the mutation observer update for the overlay elements. This method will
   * remove any attributes or styles that might be added to the overlay elements by
   * a separate process within the website where this script is injected.
   *
   * @param mutationRecord - The mutation record that triggered the update.
   */
  private handleOverlayElementMutationObserverUpdate = (mutationRecord: MutationRecord[]) => {
    if (this.isTriggeringExcessiveMutationObserverIterations()) {
      return;
    }

    for (let recordIndex = 0; recordIndex < mutationRecord.length; recordIndex++) {
      const record = mutationRecord[recordIndex];
      if (record.type !== "attributes") {
        continue;
      }

      const element = record.target as HTMLElement;
      if (record.attributeName !== "style") {
        this.removeModifiedElementAttributes(element);

        continue;
      }

      element.removeAttribute("style");
      this.updateCustomElementDefaultStyles(element);
    }
  };

  /**
   * Removes all elements from a passed overlay
   * element except for the style attribute.
   *
   * @param element - The element to remove the attributes from.
   */
  private removeModifiedElementAttributes(element: HTMLElement) {
    const attributes = Array.from(element.attributes);
    for (let attributeIndex = 0; attributeIndex < attributes.length; attributeIndex++) {
      const attribute = attributes[attributeIndex];
      if (attribute.name === "style") {
        continue;
      }

      element.removeAttribute(attribute.name);
    }
  }

  /**
   * Handles the mutation observer update for the body element. This method will
   * ensure that the overlay elements are always present at the bottom of the body
   * element.
   */
  private handleBodyElementMutationObserverUpdate = () => {
    if (
      (!this.overlayButtonElement && !this.overlayListElement) ||
      this.isTriggeringExcessiveMutationObserverIterations()
    ) {
      return;
    }

    const lastChild = globalThis.document.body.lastElementChild;
    const secondToLastChild = lastChild?.previousElementSibling;
    const lastChildIsOverlayList = lastChild === this.overlayListElement;
    const lastChildIsOverlayButton = lastChild === this.overlayButtonElement;
    const secondToLastChildIsOverlayButton = secondToLastChild === this.overlayButtonElement;

    if (
      (lastChildIsOverlayList && secondToLastChildIsOverlayButton) ||
      (lastChildIsOverlayButton && !this.isOverlayListVisible)
    ) {
      return;
    }

    if (
      (lastChildIsOverlayList && !secondToLastChildIsOverlayButton) ||
      (lastChildIsOverlayButton && this.isOverlayListVisible)
    ) {
      globalThis.document.body.insertBefore(this.overlayButtonElement, this.overlayListElement);
      return;
    }

    globalThis.document.body.insertBefore(lastChild, this.overlayButtonElement);
  };

  /**
   * Identifies if the mutation observer is triggering excessive iterations.
   * Will trigger a blur of the most recently focused field and remove the
   * autofill overlay if any set mutation observer is triggering
   * excessive iterations.
   */
  private isTriggeringExcessiveMutationObserverIterations() {
    if (this.mutationObserverIterationsResetTimeout) {
      clearTimeout(this.mutationObserverIterationsResetTimeout);
    }

    this.mutationObserverIterations++;
    this.mutationObserverIterationsResetTimeout = setTimeout(
      () => (this.mutationObserverIterations = 0),
      2000,
    );

    if (this.mutationObserverIterations > 100) {
      clearTimeout(this.mutationObserverIterationsResetTimeout);
      this.mutationObserverIterations = 0;
      this.blurMostRecentOverlayField();
      this.removeAutofillOverlay();

      return true;
    }

    return false;
  }

  /**
   * Gets the root node of the passed element and returns the active element within that root node.
   *
   * @param element - The element to get the root node active element for.
   */
  private getRootNodeActiveElement(element: Element): Element {
    const documentRoot = element.getRootNode() as ShadowRoot | Document;
    return documentRoot?.activeElement;
  }

  /**
   * Destroys the autofill overlay content service. This method will
   * disconnect the mutation observers and remove all event listeners.
   */
  destroy() {
    this.documentElementMutationObserver?.disconnect();
    this.clearUserInteractionEventTimeout();
    this.formFieldElements.forEach((formFieldElement) => {
      this.removeCachedFormFieldEventListeners(formFieldElement);
      formFieldElement.removeEventListener(EVENTS.BLUR, this.handleFormFieldBlurEvent);
      formFieldElement.removeEventListener(EVENTS.KEYUP, this.handleFormFieldKeyupEvent);
      this.formFieldElements.delete(formFieldElement);
    });
    globalThis.document.removeEventListener(
      EVENTS.VISIBILITYCHANGE,
      this.handleVisibilityChangeEvent,
    );
    globalThis.removeEventListener(EVENTS.FOCUSOUT, this.handleFormFieldBlurEvent);
    this.removeAutofillOverlay();
    this.removeOverlayRepositionEventListeners();
  }
}

export default LegacyAutofillOverlayContentService;
