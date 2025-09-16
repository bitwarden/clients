// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import "@webcomponents/custom-elements";
import "lit/polyfill-support.js";
import { FocusableElement, tabbable } from "tabbable";

import {
  EVENTS,
  AUTOFILL_OVERLAY_HANDLE_REPOSITION,
  AUTOFILL_TRIGGER_FORM_FIELD_SUBMIT,
  AUTOFILL_OVERLAY_HANDLE_SCROLL,
} from "@bitwarden/common/autofill/constants";
import { CipherType } from "@bitwarden/common/vault/enums";

import { ModifyLoginCipherFormData } from "../background/abstractions/overlay-notifications.background";
import {
  FocusedFieldData,
  NewCardCipherData,
  NewIdentityCipherData,
  NewLoginCipherData,
  SubFrameOffsetData,
} from "../background/abstractions/overlay.background";
import { AutofillExtensionMessage } from "../content/abstractions/autofill-init";
import { AutofillFieldQualifier, AutofillFieldQualifierType } from "../enums/autofill-field.enums";
import {
  AutofillOverlayElement,
  InlineMenuAccountCreationFieldType,
  InlineMenuFillTypes,
  MAX_SUB_FRAME_DEPTH,
  RedirectFocusDirection,
} from "../enums/autofill-overlay.enum";
import AutofillField from "../models/autofill-field";
import AutofillPageDetails from "../models/autofill-page-details";
import { AutofillInlineMenuContentService } from "../overlay/inline-menu/abstractions/autofill-inline-menu-content.service";
import { ElementWithOpId, FillableFormFieldElement, FormFieldElement } from "../types";
import {
  currentlyInSandboxedIframe,
  debounce,
  elementIsFillableFormField,
  elementIsSelectElement,
  getAttributeBoolean,
  nodeIsAnchorElement,
  nodeIsButtonElement,
  nodeIsTypeSubmitElement,
  sendExtensionMessage,
  throttle,
} from "../utils";

import {
  AutofillOverlayContentExtensionMessageHandlers,
  AutofillOverlayContentService as AutofillOverlayContentServiceInterface,
  SubFrameDataFromWindowMessage,
} from "./abstractions/autofill-overlay-content.service";
import { DomElementVisibilityService } from "./abstractions/dom-element-visibility.service";
import { DomQueryService } from "./abstractions/dom-query.service";
import { InlineMenuFieldQualificationService } from "./abstractions/inline-menu-field-qualifications.service";
import { AutoFillConstants } from "./autofill-constants";

export class AutofillOverlayContentService implements AutofillOverlayContentServiceInterface {
  pageDetailsUpdateRequired = false;
  private showInlineMenuIdentities: boolean;
  private showInlineMenuCards: boolean;
  private readonly findTabs = tabbable;
  private readonly sendExtensionMessage = sendExtensionMessage;
  private formFieldElements: Map<ElementWithOpId<FormFieldElement>, AutofillField> = new Map();
  private hiddenFormFieldElements: WeakMap<ElementWithOpId<FormFieldElement>, AutofillField> =
    new WeakMap();
  private formElements: Set<HTMLFormElement> = new Set();
  private submitElements: Set<HTMLElement> = new Set();
  private fieldsWithSubmitElements: WeakMap<FillableFormFieldElement, HTMLElement> = new WeakMap();
  private ignoredFieldTypes: Set<string> = new Set(AutoFillConstants.ExcludedInlineMenuTypes);
  private userFilledFields: Record<string, FillableFormFieldElement> = {};
  private focusableElements: FocusableElement[] = [];
  private mostRecentlyFocusedField: ElementWithOpId<FormFieldElement>;
  private focusedFieldData: FocusedFieldData;
  private closeInlineMenuOnRedirectTimeout: number | NodeJS.Timeout;
  private focusInlineMenuListTimeout: number | NodeJS.Timeout;
  private eventHandlersMemo: { [key: string]: EventListener } = {};
  private readonly extensionMessageHandlers: AutofillOverlayContentExtensionMessageHandlers = {
    addNewVaultItemFromOverlay: ({ message }) => this.addNewVaultItem(message),
    focusMostRecentlyFocusedField: () => this.focusMostRecentlyFocusedField(),
    blurMostRecentlyFocusedField: () => this.blurMostRecentlyFocusedField(),
    unsetMostRecentlyFocusedField: () => this.unsetMostRecentlyFocusedField(),
    checkIsMostRecentlyFocusedFieldWithinViewport: () =>
      this.checkIsMostRecentlyFocusedFieldWithinViewport(),
    bgVaultItemRepromptPopoutOpened: () => this.blurMostRecentlyFocusedField(true),
    bgUnlockPopoutOpened: () => this.blurMostRecentlyFocusedField(true),
    redirectAutofillInlineMenuFocusOut: ({ message }) =>
      this.redirectInlineMenuFocusOut(message?.data?.direction),
    getSubFrameOffsets: ({ message }) => this.getSubFrameOffsets(message),
    getSubFrameOffsetsFromWindowMessage: ({ message }) =>
      this.getSubFrameOffsetsFromWindowMessage(message),
    checkMostRecentlyFocusedFieldHasValue: () => this.mostRecentlyFocusedFieldHasValue(),
    setupRebuildSubFrameOffsetsListeners: () => this.setupRebuildSubFrameOffsetsListeners(),
    destroyAutofillInlineMenuListeners: () => this.destroy(),
    getInlineMenuFormFieldData: ({ message }) =>
      this.handleGetInlineMenuFormFieldDataMessage(message),
    generatedPasswordModifyLogin: () => this.sendGeneratedPasswordModifyLogin(),
  };
  private readonly loginFieldQualifiers: Record<string, CallableFunction> = {
    [AutofillFieldQualifier.username]: this.inlineMenuFieldQualificationService.isUsernameField,
    [AutofillFieldQualifier.password]:
      this.inlineMenuFieldQualificationService.isCurrentPasswordField,
  };
  private readonly accountCreationFieldQualifiers: Record<string, CallableFunction> = {
    [AutofillFieldQualifier.username]: this.inlineMenuFieldQualificationService.isUsernameField,
    [AutofillFieldQualifier.newPassword]:
      this.inlineMenuFieldQualificationService.isNewPasswordField,
  };
  private readonly cardFieldQualifiers: Record<string, CallableFunction> = {
    [AutofillFieldQualifier.cardholderName]:
      this.inlineMenuFieldQualificationService.isFieldForCardholderName,
    [AutofillFieldQualifier.cardNumber]:
      this.inlineMenuFieldQualificationService.isFieldForCardNumber,
    [AutofillFieldQualifier.cardExpirationMonth]:
      this.inlineMenuFieldQualificationService.isFieldForCardExpirationMonth,
    [AutofillFieldQualifier.cardExpirationYear]:
      this.inlineMenuFieldQualificationService.isFieldForCardExpirationYear,
    [AutofillFieldQualifier.cardExpirationDate]:
      this.inlineMenuFieldQualificationService.isFieldForCardExpirationDate,
    [AutofillFieldQualifier.cardCvv]: this.inlineMenuFieldQualificationService.isFieldForCardCvv,
  };
  private readonly identityFieldQualifiers: Record<string, CallableFunction> = {
    [AutofillFieldQualifier.identityTitle]:
      this.inlineMenuFieldQualificationService.isFieldForIdentityTitle,
    [AutofillFieldQualifier.identityFirstName]:
      this.inlineMenuFieldQualificationService.isFieldForIdentityFirstName,
    [AutofillFieldQualifier.identityMiddleName]:
      this.inlineMenuFieldQualificationService.isFieldForIdentityMiddleName,
    [AutofillFieldQualifier.identityLastName]:
      this.inlineMenuFieldQualificationService.isFieldForIdentityLastName,
    [AutofillFieldQualifier.identityFullName]:
      this.inlineMenuFieldQualificationService.isFieldForIdentityFullName,
    [AutofillFieldQualifier.identityAddress1]:
      this.inlineMenuFieldQualificationService.isFieldForIdentityAddress1,
    [AutofillFieldQualifier.identityAddress2]:
      this.inlineMenuFieldQualificationService.isFieldForIdentityAddress2,
    [AutofillFieldQualifier.identityAddress3]:
      this.inlineMenuFieldQualificationService.isFieldForIdentityAddress3,
    [AutofillFieldQualifier.identityCity]:
      this.inlineMenuFieldQualificationService.isFieldForIdentityCity,
    [AutofillFieldQualifier.identityState]:
      this.inlineMenuFieldQualificationService.isFieldForIdentityState,
    [AutofillFieldQualifier.identityPostalCode]:
      this.inlineMenuFieldQualificationService.isFieldForIdentityPostalCode,
    [AutofillFieldQualifier.identityCountry]:
      this.inlineMenuFieldQualificationService.isFieldForIdentityCountry,
    [AutofillFieldQualifier.identityCompany]:
      this.inlineMenuFieldQualificationService.isFieldForIdentityCompany,
    [AutofillFieldQualifier.identityPhone]:
      this.inlineMenuFieldQualificationService.isFieldForIdentityPhone,
    [AutofillFieldQualifier.identityEmail]:
      this.inlineMenuFieldQualificationService.isFieldForIdentityEmail,
    [AutofillFieldQualifier.identityUsername]:
      this.inlineMenuFieldQualificationService.isFieldForIdentityUsername,
  };

  constructor(
    private domQueryService: DomQueryService,
    private domElementVisibilityService: DomElementVisibilityService,
    private inlineMenuFieldQualificationService: InlineMenuFieldQualificationService,
    private inlineMenuContentService?: AutofillInlineMenuContentService,
  ) {}

  /**
   * Initializes the autofill overlay content service by setting up the mutation observers.
   * The observers will be instantiated on DOMContentLoaded if the page is current loading.
   */
  init() {
    void this.getInlineMenuCardsVisibility();
    void this.getInlineMenuIdentitiesVisibility();

    if (globalThis.document.readyState === "loading") {
      globalThis.document.addEventListener(EVENTS.DOMCONTENTLOADED, this.setupGlobalEventListeners);
      return;
    }

    this.setupGlobalEventListeners();
  }

  /**
   * Getter used to access the extension message handlers associated
   * with the autofill overlay content service.
   */
  get messageHandlers(): AutofillOverlayContentExtensionMessageHandlers {
    return this.extensionMessageHandlers;
  }

  /**
   * Sets up the autofill inline menu listener on the form field element. This method is called
   * during the page details collection process.
   *
   * @param formFieldElement - Form field elements identified during the page details collection process.
   * @param autofillFieldData - Autofill field data captured from the form field element.
   * @param pageDetails - The collected page details from the tab.
   */
  async setupOverlayListeners(
    formFieldElement: ElementWithOpId<FormFieldElement>,
    autofillFieldData: AutofillField,
    pageDetails: AutofillPageDetails,
  ) {
    // eslint-disable-next-line no-console
    console.log("Field", formFieldElement, this.isIgnoredField(autofillFieldData, pageDetails));
    if (
      currentlyInSandboxedIframe() ||
      this.formFieldElements.has(formFieldElement) ||
      this.isIgnoredField(autofillFieldData, pageDetails).result
    ) {
      return;
    }
    // eslint-disable-next-line no-console
    console.log("Field Was not ignored.");
    if (this.isHiddenField(formFieldElement, autofillFieldData)) {
      return;
    }
    // eslint-disable-next-line no-console
    console.log("Field was not hidden.");
    await this.setupOverlayListenersOnQualifiedField(formFieldElement, autofillFieldData);
  }

  /**
   * Removes focus from the most recently focused field element.
   */
  async blurMostRecentlyFocusedField(isClosingInlineMenu: boolean = false) {
    this.mostRecentlyFocusedField?.blur();

    if (isClosingInlineMenu) {
      await this.sendExtensionMessage("closeAutofillInlineMenu", { forceCloseInlineMenu: true });
    }
  }

  refreshMenuLayerPosition = () => this.inlineMenuContentService?.refreshTopLayerPosition();

  getOwnedInlineMenuTagNames = () => this.inlineMenuContentService?.getOwnedTagNames() || [];

  getUnownedTopLayerItems = (includeCandidates?: boolean) =>
    this.inlineMenuContentService?.getUnownedTopLayerItems(includeCandidates);

  /**
   * Clears all cached user filled fields.
   */
  clearUserFilledFields() {
    Object.keys(this.userFilledFields).forEach((key) => {
      if (this.userFilledFields[key]) {
        delete this.userFilledFields[key];
      }
    });
  }

  /**
   * On password generation, send form field data i.e. modified login data
   */
  sendGeneratedPasswordModifyLogin = async () => {
    await this.sendExtensionMessage("generatedPasswordFilled", this.getFormFieldData());
  };

  /**
   * Formats any found user filled fields for a login cipher and sends a message
   * to the background script to add a new cipher.
   */
  private async addNewVaultItem({ addNewCipherType }: AutofillExtensionMessage) {
    const command = "autofillOverlayAddNewVaultItem";
    const password =
      this.userFilledFields["newPassword"]?.value || this.userFilledFields["password"]?.value;

    if (addNewCipherType === CipherType.Login) {
      const login: NewLoginCipherData = {
        username: this.userFilledFields["username"]?.value || "",
        password: password || "",
        uri: globalThis.document.URL,
        hostname: globalThis.document.location.hostname,
      };

      await this.sendExtensionMessage(command, { addNewCipherType, login });

      return;
    }

    if (addNewCipherType === CipherType.Card) {
      const card: NewCardCipherData = {
        cardholderName: this.userFilledFields["cardholderName"]?.value || "",
        number: this.userFilledFields["cardNumber"]?.value || "",
        expirationMonth: this.userFilledFields["cardExpirationMonth"]?.value || "",
        expirationYear: this.userFilledFields["cardExpirationYear"]?.value || "",
        expirationDate: this.userFilledFields["cardExpirationDate"]?.value || "",
        cvv: this.userFilledFields["cardCvv"]?.value || "",
      };

      await this.sendExtensionMessage(command, { addNewCipherType, card });

      return;
    }

    if (addNewCipherType === CipherType.Identity) {
      const identity: NewIdentityCipherData = {
        title: this.userFilledFields["identityTitle"]?.value || "",
        firstName: this.userFilledFields["identityFirstName"]?.value || "",
        middleName: this.userFilledFields["identityMiddleName"]?.value || "",
        lastName: this.userFilledFields["identityLastName"]?.value || "",
        fullName: this.userFilledFields["identityFullName"]?.value || "",
        address1: this.userFilledFields["identityAddress1"]?.value || "",
        address2: this.userFilledFields["identityAddress2"]?.value || "",
        address3: this.userFilledFields["identityAddress3"]?.value || "",
        city: this.userFilledFields["identityCity"]?.value || "",
        state: this.userFilledFields["identityState"]?.value || "",
        postalCode: this.userFilledFields["identityPostalCode"]?.value || "",
        country: this.userFilledFields["identityCountry"]?.value || "",
        company: this.userFilledFields["identityCompany"]?.value || "",
        phone: this.userFilledFields["identityPhone"]?.value || "",
        email: this.userFilledFields["identityEmail"]?.value || "",
        username: this.userFilledFields["identityUsername"]?.value || "",
      };

      await this.sendExtensionMessage(command, { addNewCipherType, identity });
    }
  }

  /**
   * Focuses the most recently focused field element.
   */
  private focusMostRecentlyFocusedField() {
    this.mostRecentlyFocusedField?.focus();
  }

  /**
   * Sets the most recently focused field within the current frame to a `null` value.
   */
  private unsetMostRecentlyFocusedField() {
    this.mostRecentlyFocusedField = null;
  }

  /**
   * Redirects the keyboard focus out of the inline menu, selecting the element that is
   * either previous or next in the tab order. If the direction is current, the most
   * recently focused field will be focused.
   *
   * @param direction - The direction to redirect the focus out.
   */
  private async redirectInlineMenuFocusOut(direction?: string) {
    if (!direction || !this.mostRecentlyFocusedField || !(await this.isInlineMenuListVisible())) {
      return;
    }

    if (direction === RedirectFocusDirection.Current) {
      this.focusMostRecentlyFocusedField();
      this.closeInlineMenuOnRedirectTimeout = globalThis.setTimeout(
        () => void this.sendExtensionMessage("closeAutofillInlineMenu"),
        100,
      );
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
    if (redirectFocusElement) {
      redirectFocusElement.focus();
      return;
    }

    this.focusMostRecentlyFocusedField();
  }

  /**
   * Sets up the event listeners that facilitate interaction with the form field elements.
   * Will clear any cached form field element handlers that are encountered when setting
   * up a form field element.
   *
   * @param formFieldElement - The form field element to set up the event listeners for.
   */
  private setupFormFieldElementEventListeners(formFieldElement: ElementWithOpId<FormFieldElement>) {
    this.removeCachedFormFieldEventListeners(formFieldElement);

    formFieldElement.addEventListener(
      EVENTS.INPUT,
      this.handleFormFieldInputEvent(formFieldElement),
    );
    formFieldElement.addEventListener(
      EVENTS.FOCUS,
      this.handleFormFieldFocusEvent(formFieldElement),
    );

    if (elementIsSelectElement(formFieldElement)) {
      return;
    }

    formFieldElement.addEventListener(EVENTS.BLUR, this.handleFormFieldBlurEvent);
    formFieldElement.addEventListener(EVENTS.KEYUP, this.handleFormFieldKeyupEvent);
    formFieldElement.addEventListener(
      EVENTS.CLICK,
      this.handleFormFieldClickEvent(formFieldElement),
    );
  }

  /**
   * Removes any cached form field element handlers that are encountered
   * when setting up a form field element to present the inline menu.
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
   * Sets up listeners on the submit button that triggers a submission of the field's form.
   *
   * @param formFieldElement - The form field element to set up the submit button listeners for.
   * @param autofillFieldData - Autofill field data captured from the form field element.
   */
  private async setupFormSubmissionEventListeners(
    formFieldElement: ElementWithOpId<FormFieldElement>,
    autofillFieldData: AutofillField,
  ) {
    if (
      !elementIsFillableFormField(formFieldElement) ||
      autofillFieldData.inlineMenuFillType === CipherType.Card
    ) {
      return;
    }

    if (autofillFieldData.form) {
      await this.setupSubmitListenerOnFieldWithForms(formFieldElement);
      return;
    }

    await this.setupSubmitListenerOnFormlessField(formFieldElement);
    return;
  }

  /**
   * Sets up the submit listener on the form field element that contains a form element.
   * Will establish on submit event listeners on the form element and click listeners on
   * the submit button element that triggers the submission of the form.
   *
   * @param formFieldElement - The form field element to set up the submit listener for.
   */
  private async setupSubmitListenerOnFieldWithForms(formFieldElement: FillableFormFieldElement) {
    const formElement = formFieldElement.form;
    if (formElement && !this.formElements.has(formElement)) {
      this.formElements.add(formElement);
      formElement.addEventListener(EVENTS.SUBMIT, this.handleFormFieldSubmitEvent);

      const closestSubmitButton = await this.findSubmitButton(formElement);

      // If we cannot find a submit button within the form, check for a submit button outside the form.
      if (!closestSubmitButton) {
        await this.setupSubmitListenerOnFormlessField(formFieldElement);
        return;
      }

      this.setupSubmitButtonEventListeners(closestSubmitButton);
      return;
    }
  }

  /**
   * Sets up the submit listener on the form field element that does not contain a form element.
   * Will establish a submit button event listener on the closest formless submit button element.
   *
   * @param formFieldElement - The form field element to set up the submit listener for.
   */
  private async setupSubmitListenerOnFormlessField(formFieldElement: FillableFormFieldElement) {
    if (formFieldElement && !this.fieldsWithSubmitElements.has(formFieldElement)) {
      const closestSubmitButton = await this.findClosestFormlessSubmitButton(formFieldElement);

      this.setupSubmitButtonEventListeners(closestSubmitButton);
    }
    return;
  }

  /**
   * Finds the closest formless submit button element to the form field element.
   *
   * @param formFieldElement - The form field element to find the closest formless submit button for.
   */
  private async findClosestFormlessSubmitButton(
    formFieldElement: FillableFormFieldElement,
  ): Promise<HTMLElement | null> {
    let currentElement: HTMLElement = formFieldElement;

    while (currentElement && currentElement.tagName !== "HTML") {
      const submitButton = await this.findSubmitButton(currentElement);
      if (submitButton) {
        this.formFieldElements.forEach((_, element) => {
          if (currentElement.contains(element)) {
            this.fieldsWithSubmitElements.set(element as FillableFormFieldElement, submitButton);
          }
        });

        return submitButton;
      }

      if (!currentElement.parentElement && currentElement.getRootNode() instanceof ShadowRoot) {
        currentElement = (currentElement.getRootNode() as ShadowRoot).host as any;
        continue;
      }

      currentElement = currentElement.parentElement;
    }

    return null;
  }

  /**
   * Finds the submit button element within the provided element. Will attempt to find a generic
   * submit element before attempting to find a button or button-like element.
   *
   * @param element - The element to find the submit button within.
   */
  private async findSubmitButton(element: HTMLElement): Promise<HTMLElement | null> {
    const genericSubmitElement = await this.querySubmitButtonElement(
      element,
      "[type='submit']",
      (node: Node) => nodeIsTypeSubmitElement(node),
    );
    if (genericSubmitElement) {
      return genericSubmitElement;
    }

    const submitButtonElement = await this.querySubmitButtonElement(
      element,
      "button, [type='button']",
      (node: Node) => nodeIsButtonElement(node),
    );
    if (submitButtonElement) {
      return submitButtonElement;
    }

    // If the submit button is not a traditional button element, check for an anchor element that contains submission keywords.
    const submitAnchorElement = await this.querySubmitButtonElement(element, "a", (node: Node) =>
      nodeIsAnchorElement(node),
    );
    if (submitAnchorElement) {
      return submitAnchorElement;
    }
  }

  /**
   * Queries the provided element for a submit button element using the provided selector.
   *
   * @param element - The element to query for a submit button.
   * @param selector - The selector to use to query the element for a submit button.
   * @param treeWalkerFilter - The tree walker filter to use when querying the element.
   */
  private async querySubmitButtonElement(
    element: HTMLElement,
    selector: string,
    treeWalkerFilter: CallableFunction,
  ) {
    const submitButtonElements = this.domQueryService.query<HTMLButtonElement>(
      element,
      selector,
      treeWalkerFilter,
    );
    for (let index = 0; index < submitButtonElements.length; index++) {
      const submitElement = submitButtonElements[index];
      if (
        this.isElementSubmitButton(submitElement) &&
        (await this.domElementVisibilityService.isElementViewable(submitElement))
      ) {
        return submitElement;
      }
    }
  }

  /**
   * Determines if the provided element is a submit button element.
   *
   * @param element - The element to determine if it is a submit button.
   */
  private isElementSubmitButton(element: HTMLElement) {
    return (
      this.inlineMenuFieldQualificationService.isElementLoginSubmitButton(element) ||
      this.inlineMenuFieldQualificationService.isElementChangePasswordSubmitButton(element)
    );
  }

  /**
   * Sets up the event listeners that trigger an indication that a form has been submitted.
   *
   * @param submitButton - The submit button element to set up the event listeners for.
   */
  private setupSubmitButtonEventListeners = (submitButton: HTMLElement) => {
    if (!submitButton || this.submitElements.has(submitButton)) {
      return;
    }

    this.submitElements.add(submitButton);

    const handler = this.useEventHandlersMemo(
      throttle(this.handleSubmitButtonInteraction, 150),
      AUTOFILL_TRIGGER_FORM_FIELD_SUBMIT,
    );
    submitButton.addEventListener(EVENTS.KEYUP, handler);
    globalThis.document.addEventListener(EVENTS.CLICK, handler);
    globalThis.document.addEventListener(EVENTS.MOUSEUP, handler);
  };

  /**
   * Handles click and keyup events that trigger behavior for a submit button element.
   *
   * @param event - The event that triggered the submit button interaction.
   */
  private handleSubmitButtonInteraction = (event: PointerEvent) => {
    if (
      !this.submitElements.has(event.target as HTMLElement) ||
      (event.type === "keyup" &&
        !["Enter", "Space"].includes((event as unknown as KeyboardEvent).code))
    ) {
      return;
    }

    this.handleFormFieldSubmitEvent();
  };

  /**
   * Handles the repositioning of the autofill overlay when the form is submitted.
   */
  private handleFormFieldSubmitEvent = () => {
    void this.sendExtensionMessage("formFieldSubmitted", this.getFormFieldData());
  };

  /**
   * Handles capturing the form field data for a notification message. Will not trigger this behavior
   * in the case where the user is still typing in the field unless the focus is ignored.
   */
  private handleGetInlineMenuFormFieldDataMessage = async ({
    ignoreFieldFocus,
  }: AutofillExtensionMessage) => {
    if (!ignoreFieldFocus && (await this.isFieldCurrentlyFocused())) {
      return;
    }

    return this.getFormFieldData();
  };

  /**
   * Returns the form field data used for add login and change password notifications.
   */
  private getFormFieldData = (): ModifyLoginCipherFormData => {
    return {
      uri: globalThis.document.URL,
      username: this.userFilledFields["username"]?.value || "",
      password: this.userFilledFields["password"]?.value || "",
      newPassword: this.userFilledFields["newPassword"]?.value || "",
    };
  };

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
   * the field is focused and sends a message to check if the inline menu itself
   * is currently focused.
   */
  private handleFormFieldBlurEvent = () => {
    void this.updateIsFieldCurrentlyFocused(false);
    void this.sendExtensionMessage("checkAutofillInlineMenuFocused");
  };

  /**
   * Form field keyup event handler. Facilitates the ability to remove the
   * autofill inline menu using the escape key, focusing the inline menu list using
   * the ArrowDown key, and ensuring that the inline menu is repositioned when
   * the form is submitted using the Enter key.
   *
   * @param event - The keyup event.
   */
  private handleFormFieldKeyupEvent = async (event: globalThis.KeyboardEvent) => {
    const eventCode = event.code;
    if (eventCode === "Escape") {
      void this.sendExtensionMessage("closeAutofillInlineMenu", {
        forceCloseInlineMenu: true,
      });
      return;
    }

    if (eventCode === "Enter" && !(await this.isFieldCurrentlyFilling())) {
      void this.handleOverlayRepositionEvent();
      return;
    }

    if (eventCode === "ArrowDown") {
      event.preventDefault();
      event.stopPropagation();

      void this.focusInlineMenuList();
    }
  };

  /**
   * Triggers a focus of the inline menu list, if it is visible. If the list is not visible,
   * the inline menu will be opened and the list will be focused after a short delay. Ensures
   * that the inline menu list is focused when the user presses the down arrow key.
   */
  private async focusInlineMenuList() {
    if (this.mostRecentlyFocusedField && !(await this.isInlineMenuListVisible())) {
      this.clearFocusInlineMenuListTimeout();
      await this.updateMostRecentlyFocusedField(this.mostRecentlyFocusedField);
      await this.sendExtensionMessage("openAutofillInlineMenu", { isOpeningFullInlineMenu: true });
      this.focusInlineMenuListTimeout = globalThis.setTimeout(
        () => this.sendExtensionMessage("focusAutofillInlineMenuList"),
        125,
      );
      return;
    }

    void this.sendExtensionMessage("focusAutofillInlineMenuList");
  }

  /**
   * Sets up and memoizes the form field input event handler.
   *
   * @param formFieldElement - The form field element that triggered the input event.
   */
  private handleFormFieldInputEvent = (formFieldElement: ElementWithOpId<FormFieldElement>) => {
    return this.useEventHandlersMemo(
      debounce(() => this.triggerFormFieldInput(formFieldElement), 100, true),
      this.getFormFieldHandlerMemoIndex(formFieldElement, EVENTS.INPUT),
    );
  };

  /**
   * Triggers when the form field element receives an input event. This method will
   * store the modified form element data for use when the user attempts to add a new
   * vault item. It also acts to remove the inline menu list while the user is typing.
   *
   * @param formFieldElement - The form field element that triggered the input event.
   */
  private async triggerFormFieldInput(formFieldElement: ElementWithOpId<FormFieldElement>) {
    if (!elementIsFillableFormField(formFieldElement)) {
      return;
    }

    this.storeModifiedFormElement(formFieldElement);
    if (elementIsSelectElement(formFieldElement)) {
      return;
    }

    await this.sendExtensionMessage("closeAutofillInlineMenu", {
      overlayElement: AutofillOverlayElement.List,
      forceCloseInlineMenu: true,
    });

    if (!formFieldElement?.value) {
      await this.sendExtensionMessage("openAutofillInlineMenu");
    }
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
    if (formFieldElement !== this.mostRecentlyFocusedField) {
      void this.updateMostRecentlyFocusedField(formFieldElement);
    }

    const autofillFieldData = this.formFieldElements.get(formFieldElement);
    if (!autofillFieldData) {
      return;
    }

    if (!autofillFieldData.fieldQualifier) {
      switch (autofillFieldData.inlineMenuFillType) {
        case CipherType.Login:
        case InlineMenuFillTypes.CurrentPasswordUpdate:
          this.qualifyUserFilledField(autofillFieldData, this.loginFieldQualifiers);
          break;
        case InlineMenuFillTypes.AccountCreationUsername:
        case InlineMenuFillTypes.PasswordGeneration:
          this.qualifyUserFilledField(autofillFieldData, this.accountCreationFieldQualifiers);
          break;
        case CipherType.Card:
          this.qualifyUserFilledField(autofillFieldData, this.cardFieldQualifiers);
          break;
        case CipherType.Identity:
          this.qualifyUserFilledField(autofillFieldData, this.identityFieldQualifiers);
          break;
      }
    }

    this.storeQualifiedUserFilledField(formFieldElement, autofillFieldData);
  }

  /**
   * Handles qualification of the user filled field based on the field qualifiers provided.
   *
   * @param autofillFieldData - Autofill field data captured from the form field element.
   * @param qualifiers - The field qualifiers to use when qualifying the user filled field.
   */
  private qualifyUserFilledField = (
    autofillFieldData: AutofillField,
    qualifiers: Record<string, CallableFunction>,
  ) => {
    for (const [fieldQualifier, fieldQualifierFunction] of Object.entries(qualifiers)) {
      if (fieldQualifierFunction(autofillFieldData)) {
        autofillFieldData.fieldQualifier = fieldQualifier as AutofillFieldQualifierType;
        return;
      }
    }
  };

  /**
   * Stores the qualified user filled filed to allow for referencing its value when adding a new vault item.
   *
   * @param formFieldElement - The form field element that triggered the input event.
   * @param autofillFieldData - Autofill field data captured from the form field element.
   */
  private storeQualifiedUserFilledField(
    formFieldElement: ElementWithOpId<FillableFormFieldElement>,
    autofillFieldData: AutofillField,
  ) {
    if (!autofillFieldData.fieldQualifier) {
      return;
    }

    const clonedNode = formFieldElement.cloneNode(true) as FillableFormFieldElement;
    const identityLoginFields: AutofillFieldQualifierType[] = [
      AutofillFieldQualifier.identityUsername,
      AutofillFieldQualifier.identityEmail,
    ];
    if (identityLoginFields.includes(autofillFieldData.fieldQualifier)) {
      this.userFilledFields[AutofillFieldQualifier.username] = clonedNode;
    }

    this.userFilledFields[autofillFieldData.fieldQualifier] = clonedNode;
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
   * trigger the focused action for the form field element if the inline menu is not visible.
   *
   * @param formFieldElement - The form field element that triggered the click event.
   */
  private async triggerFormFieldClickedAction(formFieldElement: ElementWithOpId<FormFieldElement>) {
    if ((await this.isInlineMenuButtonVisible()) || (await this.isInlineMenuListVisible())) {
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
   * update the most recently focused field and open the autofill inline menu if the
   * autofill process is not currently active.
   *
   * @param formFieldElement - The form field element that triggered the focus event.
   */
  private async triggerFormFieldFocusedAction(formFieldElement: ElementWithOpId<FormFieldElement>) {
    if (await this.isFieldCurrentlyFilling()) {
      return;
    }

    if (this.pageDetailsUpdateRequired) {
      await this.sendExtensionMessage("bgCollectPageDetails", {
        sender: "autofillOverlayContentService",
      });
      this.pageDetailsUpdateRequired = false;
    }

    if (elementIsSelectElement(formFieldElement)) {
      await this.sendExtensionMessage("closeAutofillInlineMenu", {
        forceCloseInlineMenu: true,
      });
      return;
    }

    await this.updateIsFieldCurrentlyFocused(true);
    await this.updateMostRecentlyFocusedField(formFieldElement);
    await this.sendExtensionMessage("openAutofillInlineMenu");
  }

  /**
   * Triggers an update in the background script focused status of the form field element.
   *
   * @param isFieldCurrentlyFocused - The focused status of the form field element.
   */
  private updateIsFieldCurrentlyFocused = async (isFieldCurrentlyFocused: boolean) => {
    await this.sendExtensionMessage("updateIsFieldCurrentlyFocused", { isFieldCurrentlyFocused });
  };

  /**
   * Updates the data used to position the inline menu elements in relation
   * to the most recently focused form field.
   *
   * @param formFieldElement - The form field element that triggered the focus event.
   */
  private async updateMostRecentlyFocusedField(
    formFieldElement: ElementWithOpId<FormFieldElement>,
  ) {
    if (
      !formFieldElement ||
      !elementIsFillableFormField(formFieldElement) ||
      elementIsSelectElement(formFieldElement)
    ) {
      return;
    }

    this.mostRecentlyFocusedField = formFieldElement;
    const { paddingRight, paddingLeft } = globalThis.getComputedStyle(formFieldElement);
    const { width, height, top, left } =
      await this.getMostRecentlyFocusedFieldRects(formFieldElement);
    const autofillFieldData = this.formFieldElements.get(formFieldElement);

    this.focusedFieldData = {
      focusedFieldStyles: { paddingRight, paddingLeft },
      focusedFieldRects: { width, height, top, left },
      inlineMenuFillType: autofillFieldData?.inlineMenuFillType,
      showPasskeys: !!autofillFieldData?.showPasskeys,
      accountCreationFieldType: autofillFieldData?.accountCreationFieldType,
    };

    const allFields = this.formFieldElements;
    const allFieldsRect = [];

    for (const key of allFields.keys()) {
      const rect = await this.getMostRecentlyFocusedFieldRects(key);
      allFieldsRect.push({ ...allFields.get(key), rect }); // Add the combined result to the array
    }

    await this.sendExtensionMessage("updateFocusedFieldData", {
      focusedFieldData: this.focusedFieldData,
      allFieldsRect,
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
   * Identifies if the field should have the autofill inline menu setup on it. Currently, this is mainly
   * determined by whether the field correlates with a login cipher. This method will need to be
   * updated in the future to support other types of forms.
   *
   * @param autofillFieldData - Autofill field data captured from the form field element.
   * @param pageDetails - The collected page details from the tab.
   */
  private isIgnoredField(
    autofillFieldData: AutofillField,
    pageDetails: AutofillPageDetails,
  ): { result: boolean; message: string } {
    const ns = "isIgnoredField";

    const field = autofillFieldData;
    if (field.domainMatch && field.domainMatch.fieldType === AutofillFieldQualifier.password) {
      return { result: false, message: `${ns} Matched domain specific setting.` };
    }

    const ignoredTypeResult = Array.from(this.ignoredFieldTypes).find(
      (v) => v === autofillFieldData.type,
    );
    if (ignoredTypeResult) {
      return {
        result: true,
        message: `${ns} // field type is ignored type: ${ignoredTypeResult}`,
      };
    }

    if (
      this.inlineMenuFieldQualificationService.isFieldForLoginForm(autofillFieldData, pageDetails)
    ) {
      void this.setQualifiedLoginFillType(autofillFieldData);
      return { result: false, message: `${ns} // field is for login form` };
    }

    if (
      this.showInlineMenuCards &&
      this.inlineMenuFieldQualificationService.isFieldForCreditCardForm(
        autofillFieldData,
        pageDetails,
      )
    ) {
      autofillFieldData.inlineMenuFillType = CipherType.Card;
      return {
        result: false,
        message: `${ns} // field is for credit card form & inline menu cards shown`,
      };
    }

    if (
      this.inlineMenuFieldQualificationService.isFieldForAccountCreationForm(
        autofillFieldData,
        pageDetails,
      )
    ) {
      this.setQualifiedAccountCreationFillType(autofillFieldData);
      return { result: false, message: `${ns} // field is for account creation form` };
    }

    if (
      this.showInlineMenuIdentities &&
      this.inlineMenuFieldQualificationService.isFieldForIdentityForm(
        autofillFieldData,
        pageDetails,
      )
    ) {
      autofillFieldData.inlineMenuFillType = CipherType.Identity;
      return {
        result: false,
        message: `${ns} // field is for identity form & inline menu identities shown`,
      };
    }

    return {
      result: true,
      message: `${ns} // field ignored by default — not in any unignorable condition`,
    };
  }

  /**
   * Sets the autofill field data that indicates this field is part of a login form
   *
   * @param autofillFieldData - Autofill field data captured from the form field element.
   */
  private async setQualifiedLoginFillType(autofillFieldData: AutofillField) {
    autofillFieldData.inlineMenuFillType = CipherType.Login;
    autofillFieldData.showPasskeys = autofillFieldData.autoCompleteType.includes("webauthn");

    this.qualifyAccountCreationFieldType(autofillFieldData);
  }

  /**
   * Sets the autofill field data that indicates this field is part of an account creation or update form.
   *
   * @param autofillFieldData - Autofill field data captured from the form field element.
   */
  private setQualifiedAccountCreationFillType(autofillFieldData: AutofillField) {
    if (this.inlineMenuFieldQualificationService.isNewPasswordField(autofillFieldData)) {
      autofillFieldData.inlineMenuFillType = InlineMenuFillTypes.PasswordGeneration;
      this.qualifyAccountCreationFieldType(autofillFieldData);
      return;
    }

    if (this.inlineMenuFieldQualificationService.isUpdateCurrentPasswordField(autofillFieldData)) {
      autofillFieldData.inlineMenuFillType = InlineMenuFillTypes.CurrentPasswordUpdate;
      return;
    }

    if (this.inlineMenuFieldQualificationService.isUsernameField(autofillFieldData)) {
      autofillFieldData.inlineMenuFillType = InlineMenuFillTypes.AccountCreationUsername;
      this.qualifyAccountCreationFieldType(autofillFieldData);
    }
  }

  /**
   * Sets the account creation field type for the autofill field data based on the field's attributes.
   *
   * @param autofillFieldData - Autofill field data captured from the form field element.
   */
  private qualifyAccountCreationFieldType(autofillFieldData: AutofillField) {
    if (this.inlineMenuFieldQualificationService.isTotpField(autofillFieldData)) {
      autofillFieldData.accountCreationFieldType = InlineMenuAccountCreationFieldType.Totp;
      return;
    }

    if (!this.inlineMenuFieldQualificationService.isUsernameField(autofillFieldData)) {
      autofillFieldData.accountCreationFieldType = InlineMenuAccountCreationFieldType.Password;
      return;
    }

    if (!this.showInlineMenuIdentities) {
      return;
    }

    if (this.inlineMenuFieldQualificationService.isEmailField(autofillFieldData)) {
      autofillFieldData.accountCreationFieldType = InlineMenuAccountCreationFieldType.Email;
      return;
    }

    autofillFieldData.accountCreationFieldType = InlineMenuAccountCreationFieldType.Text;
  }

  /**
   * Validates whether a field is considered to be "hidden" based on the field's attributes.
   * If the field is hidden, a fallback listener will be set up to ensure that the
   * field will have the inline menu set up on it when it becomes visible.
   *
   * @param formFieldElement - The form field element that triggered the focus event.
   * @param autofillFieldData - Autofill field data captured from the form field element.
   */
  private isHiddenField(
    formFieldElement: ElementWithOpId<FormFieldElement>,
    autofillFieldData: AutofillField,
  ): boolean {
    if (!autofillFieldData.readonly && !autofillFieldData.disabled && autofillFieldData.viewable) {
      this.removeHiddenFieldFallbackListener(formFieldElement);
      return false;
    }

    this.setupHiddenFieldFallbackListener(formFieldElement, autofillFieldData);
    return true;
  }

  /**
   * Sets up a fallback listener that will facilitate setting up the
   * inline menu on the field when it becomes visible and focused.
   *
   * @param formFieldElement - The form field element that triggered the focus event.
   * @param autofillFieldData - Autofill field data captured from the form field element.
   */
  private setupHiddenFieldFallbackListener(
    formFieldElement: ElementWithOpId<FormFieldElement>,
    autofillFieldData: AutofillField,
  ) {
    this.hiddenFormFieldElements.set(formFieldElement, autofillFieldData);
    formFieldElement.addEventListener(EVENTS.FOCUS, this.handleHiddenFieldFocusEvent);
    formFieldElement.addEventListener(EVENTS.INPUT, this.handleHiddenFieldInputEvent);
  }

  /**
   * Removes the fallback listener that facilitates setting up the inline
   *  menu on the field when it becomes visible and focused.
   *
   * @param formFieldElement - The form field element that triggered the focus event.
   */
  private removeHiddenFieldFallbackListener(formFieldElement: ElementWithOpId<FormFieldElement>) {
    formFieldElement.removeEventListener(EVENTS.FOCUS, this.handleHiddenFieldFocusEvent);
    formFieldElement.removeEventListener(EVENTS.INPUT, this.handleHiddenFieldInputEvent);
    this.hiddenFormFieldElements.delete(formFieldElement);
  }

  /**
   * Handles the focus event on a hidden field. When
   * triggered, the inline menu is set up on the field.
   *
   * @param event - The focus event.
   */
  private handleHiddenFieldFocusEvent = (event: FocusEvent) => {
    const formFieldElement = event.target as ElementWithOpId<FormFieldElement>;
    this.handleHiddenElementFallbackEvent(formFieldElement);
  };

  /**
   * Handles an input event on a hidden field. When triggered, the inline menu is set up on the
   * field. We also capture the input value for the field to facilitate presentation of the value
   * for the field in the notification bar.
   *
   * @param event - The input event.
   */
  private handleHiddenFieldInputEvent = async (event: InputEvent) => {
    const formFieldElement = event.target as ElementWithOpId<FormFieldElement>;
    this.handleHiddenElementFallbackEvent(formFieldElement);
    await this.triggerFormFieldInput(formFieldElement);
  };

  /**
   * Handles updating the hidden element when a fallback event is triggered.
   *
   * @param formFieldElement - The form field element that triggered the focus event.
   */
  private handleHiddenElementFallbackEvent = (
    formFieldElement: ElementWithOpId<FormFieldElement>,
  ) => {
    const autofillFieldData = this.hiddenFormFieldElements.get(formFieldElement);
    if (autofillFieldData) {
      autofillFieldData.readonly = getAttributeBoolean(formFieldElement, "disabled");
      autofillFieldData.disabled = getAttributeBoolean(formFieldElement, "disabled");
      autofillFieldData.viewable = true;

      void this.setupOverlayListenersOnQualifiedField(formFieldElement, autofillFieldData);
    }

    this.removeHiddenFieldFallbackListener(formFieldElement);
  };

  /**
   * Sets up the inline menu on a qualified form field element.
   *
   * @param formFieldElement - The form field element to set up the inline menu on.
   * @param autofillFieldData - Autofill field data captured from the form field element.
   */
  private async setupOverlayListenersOnQualifiedField(
    formFieldElement: ElementWithOpId<FormFieldElement>,
    autofillFieldData: AutofillField,
  ) {
    this.formFieldElements.set(formFieldElement, autofillFieldData);

    if (elementIsFillableFormField(formFieldElement) && !!formFieldElement.value) {
      this.storeModifiedFormElement(formFieldElement);
    }

    this.setupFormFieldElementEventListeners(formFieldElement);
    await this.setupFormSubmissionEventListeners(formFieldElement, autofillFieldData);

    if (
      globalThis.document.hasFocus() &&
      this.getRootNodeActiveElement(formFieldElement) === formFieldElement
    ) {
      await this.triggerFormFieldFocusedAction(formFieldElement);
    }
  }

  /**
   * Queries the background script for the autofill inline menu's Cards visibility setting.
   * If the setting is not found, a default value of true will be used
   * @private
   */
  private async getInlineMenuCardsVisibility() {
    const inlineMenuCardsVisibility = await this.sendExtensionMessage(
      "getInlineMenuCardsVisibility",
    );
    this.showInlineMenuCards = inlineMenuCardsVisibility ?? true;
  }

  /**
   * Queries the background script for the autofill inline menu's Identities visibility setting.
   * If the setting is not found, a default value of true will be used
   * @private
   */
  private async getInlineMenuIdentitiesVisibility() {
    const inlineMenuIdentitiesVisibility = await this.sendExtensionMessage(
      "getInlineMenuIdentitiesVisibility",
    );
    this.showInlineMenuIdentities = inlineMenuIdentitiesVisibility ?? true;
  }

  /**
   * Indicates whether the most recently focused field has a value.
   */
  private mostRecentlyFocusedFieldHasValue() {
    return Boolean((this.mostRecentlyFocusedField as FillableFormFieldElement)?.value);
  }

  /**
   * Checks if a field is currently filling within an frame in the tab.
   */
  private async isFieldCurrentlyFilling() {
    return (await this.sendExtensionMessage("checkIsFieldCurrentlyFilling")) === true;
  }

  /**
   * Checks if the inline menu button is visible at the top frame.
   */
  private async isInlineMenuButtonVisible() {
    return (await this.sendExtensionMessage("checkIsAutofillInlineMenuButtonVisible")) === true;
  }

  /**
   * Checks if the inline menu list if visible at the top frame.
   */
  private async isInlineMenuListVisible() {
    return (await this.sendExtensionMessage("checkIsAutofillInlineMenuListVisible")) === true;
  }

  /**
   * Checks if the field is currently focused within the top frame.
   */
  private async isFieldCurrentlyFocused() {
    return (await this.sendExtensionMessage("checkIsFieldCurrentlyFocused")) === true;
  }

  /**
   * Gets the root node of the passed element and returns the active element within that root node.
   *
   * @param element - The element to get the root node active element for.
   */
  private getRootNodeActiveElement(element: Element): Element {
    if (!element) {
      return null;
    }

    const documentRoot = element.getRootNode() as ShadowRoot | Document;
    return documentRoot?.activeElement;
  }

  /**
   * Queries all iframe elements within the document and returns the
   * sub frame offsets for each iframe element.
   *
   * @param message - The message object from the extension.
   */
  private async getSubFrameOffsets(
    message: AutofillExtensionMessage,
  ): Promise<SubFrameOffsetData | null> {
    const { subFrameUrl } = message;

    const subFrameUrlVariations = this.getSubFrameUrlVariations(subFrameUrl);
    if (!subFrameUrlVariations) {
      return null;
    }

    let iframeElement: HTMLIFrameElement | null = null;
    const iframeElements = globalThis.document.getElementsByTagName("iframe");

    for (let iframeIndex = 0; iframeIndex < iframeElements.length; iframeIndex++) {
      const iframe = iframeElements[iframeIndex];
      if (!subFrameUrlVariations.has(iframe.src)) {
        continue;
      }

      if (iframeElement) {
        return null;
      }

      iframeElement = iframe;
    }

    if (!iframeElement) {
      return null;
    }

    return this.calculateSubFrameOffsets(iframeElement, subFrameUrl);
  }

  /**
   * Returns a set of all possible URL variations for the sub frame URL.
   *
   * @param subFrameUrl - The URL of the sub frame.
   */
  private getSubFrameUrlVariations(subFrameUrl: string) {
    try {
      const url = new URL(subFrameUrl, globalThis.location.href);
      const pathAndHash = url.pathname + url.hash;
      const pathAndSearch = url.pathname + url.search;
      const pathSearchAndHash = pathAndSearch + url.hash;
      const pathNameWithoutTrailingSlash = url.pathname.replace(/\/$/, "");
      const pathWithoutTrailingSlashAndHash = pathNameWithoutTrailingSlash + url.hash;
      const pathWithoutTrailingSlashAndSearch = pathNameWithoutTrailingSlash + url.search;
      const pathWithoutTrailingSlashSearchAndHash = pathWithoutTrailingSlashAndSearch + url.hash;

      return new Set([
        url.href,
        url.href.replace(/\/$/, ""),
        url.pathname,
        pathAndHash,
        pathAndSearch,
        pathSearchAndHash,
        pathNameWithoutTrailingSlash,
        pathWithoutTrailingSlashAndHash,
        pathWithoutTrailingSlashAndSearch,
        pathWithoutTrailingSlashSearchAndHash,
        url.hostname + url.pathname,
        url.hostname + pathAndHash,
        url.hostname + pathAndSearch,
        url.hostname + pathSearchAndHash,
        url.hostname + pathNameWithoutTrailingSlash,
        url.hostname + pathWithoutTrailingSlashAndHash,
        url.hostname + pathWithoutTrailingSlashAndSearch,
        url.hostname + pathWithoutTrailingSlashSearchAndHash,
        url.origin + url.pathname,
        url.origin + pathAndHash,
        url.origin + pathAndSearch,
        url.origin + pathSearchAndHash,
        url.origin + pathNameWithoutTrailingSlash,
        url.origin + pathWithoutTrailingSlashAndHash,
        url.origin + pathWithoutTrailingSlashAndSearch,
        url.origin + pathWithoutTrailingSlashSearchAndHash,
      ]);
      // FIXME: Remove when updating file. Eslint update
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_error) {
      return null;
    }
  }

  /**
   * Posts a message to the parent frame to calculate the sub frame offset of the current frame.
   *
   * @param message - The message object from the extension.
   */
  private getSubFrameOffsetsFromWindowMessage(message: any) {
    globalThis.parent.postMessage(
      {
        command: "calculateSubFramePositioning",
        subFrameData: {
          url: window.location.href,
          frameId: message.subFrameId,
          left: 0,
          top: 0,
          parentFrameIds: [0],
          subFrameDepth: 0,
        } as SubFrameDataFromWindowMessage,
      },
      "*",
    );
  }

  /**
   * Calculates the bounding rect for the queried frame and returns the
   * offset data for the sub frame.
   *
   * @param iframeElement - The iframe element to calculate the sub frame offsets for.
   * @param subFrameUrl - The URL of the sub frame.
   * @param frameId - The frame ID of the sub frame.
   */
  private calculateSubFrameOffsets(
    iframeElement: HTMLIFrameElement,
    subFrameUrl?: string,
    frameId?: number,
  ): SubFrameOffsetData {
    const iframeRect = iframeElement.getBoundingClientRect();
    const iframeStyles = globalThis.getComputedStyle(iframeElement);
    const paddingLeft = parseInt(iframeStyles.getPropertyValue("padding-left")) || 0;
    const paddingTop = parseInt(iframeStyles.getPropertyValue("padding-top")) || 0;
    const borderWidthLeft = parseInt(iframeStyles.getPropertyValue("border-left-width")) || 0;
    const borderWidthTop = parseInt(iframeStyles.getPropertyValue("border-top-width")) || 0;

    return {
      url: subFrameUrl,
      frameId,
      top: iframeRect.top + paddingTop + borderWidthTop,
      left: iframeRect.left + paddingLeft + borderWidthLeft,
    };
  }

  /**
   * Calculates the sub frame positioning for the current frame
   * through all parent frames until the top frame is reached.
   *
   * @param event - The message event.
   */
  private calculateSubFramePositioning = async (event: MessageEvent) => {
    const subFrameData: SubFrameDataFromWindowMessage = event.data.subFrameData;

    subFrameData.subFrameDepth++;
    if (subFrameData.subFrameDepth >= MAX_SUB_FRAME_DEPTH) {
      void this.sendExtensionMessage("destroyAutofillInlineMenuListeners", { subFrameData });
      return;
    }

    let subFrameOffsets: SubFrameOffsetData;
    const iframes = globalThis.document.querySelectorAll("iframe");
    for (let i = 0; i < iframes.length; i++) {
      if (iframes[i].contentWindow === event.source) {
        const iframeElement = iframes[i];
        subFrameOffsets = this.calculateSubFrameOffsets(
          iframeElement,
          subFrameData.url,
          subFrameData.frameId,
        );

        subFrameData.top += subFrameOffsets.top;
        subFrameData.left += subFrameOffsets.left;

        const parentFrameId = await this.sendExtensionMessage("getCurrentTabFrameId");
        if (typeof parentFrameId !== "undefined") {
          subFrameData.parentFrameIds.push(parentFrameId);
        }

        break;
      }
    }

    if (globalThis.window.self !== globalThis.window.top) {
      globalThis.parent.postMessage({ command: "calculateSubFramePositioning", subFrameData }, "*");
      return;
    }

    void this.sendExtensionMessage("updateSubFrameData", { subFrameData });
  };

  /**
   * Sets up global event listeners and the mutation
   * observer to facilitate required changes to the
   * overlay elements.
   */
  private setupGlobalEventListeners = () => {
    globalThis.addEventListener(EVENTS.MESSAGE, this.handleWindowMessageEvent);
    globalThis.document.addEventListener(EVENTS.VISIBILITYCHANGE, this.handleVisibilityChangeEvent);
    globalThis.addEventListener(EVENTS.FOCUSOUT, this.handleWindowFocusOutEvent);
    this.setOverlayRepositionEventListeners();
  };

  /**
   * Handles window messages that are sent to the current frame. Will trigger a
   * calculation of the sub frame offsets through the parent frame.
   *
   * @param event - The message event.
   */
  private handleWindowMessageEvent = (event: MessageEvent) => {
    if (event.data?.command === "calculateSubFramePositioning") {
      void this.calculateSubFramePositioning(event);
    }
  };

  /**
   * Handles the window focus out event, triggering a focus check on the
   * inline menu if the document has focus and a closure of the inline
   * menu if it does not have focus.
   */
  private handleWindowFocusOutEvent = () => {
    if (document.hasFocus()) {
      this.handleFormFieldBlurEvent();
      return;
    }

    void this.sendExtensionMessage("closeAutofillInlineMenu", {
      forceCloseInlineMenu: true,
    });
  };

  /**
   * Handles the visibility change event. This method will remove the
   * autofill overlay if the document is not visible.
   */
  private handleVisibilityChangeEvent = () => {
    if (globalThis.document.visibilityState === "hidden") {
      void this.sendExtensionMessage("closeAutofillInlineMenu", {
        forceCloseInlineMenu: true,
      });
    }

    if (this.mostRecentlyFocusedField) {
      this.unsetMostRecentlyFocusedField();
    }
  };

  /**
   * Sets up event listeners that facilitate repositioning
   * the overlay elements on scroll or resize.
   */
  private setOverlayRepositionEventListeners() {
    let currentScrollY = globalThis.scrollY;
    let currentScrollX = globalThis.scrollX;
    let mostRecentTargetScrollY = 0;
    const repositionHandler = this.useEventHandlersMemo(
      throttle(this.handleOverlayRepositionEvent, 250),
      AUTOFILL_OVERLAY_HANDLE_REPOSITION,
    );

    const eventTargetContainsFocusedField = (eventTarget: Element) => {
      if (typeof eventTarget.contains !== "function") {
        return false;
      }

      const targetScrollY = eventTarget.scrollTop;
      if (targetScrollY === mostRecentTargetScrollY) {
        return false;
      }

      if (
        eventTarget === this.mostRecentlyFocusedField ||
        eventTarget.contains(this.mostRecentlyFocusedField)
      ) {
        mostRecentTargetScrollY = targetScrollY;
        return true;
      }

      return false;
    };
    const scrollHandler = this.useEventHandlersMemo(
      throttle(async (event) => {
        if (
          currentScrollY !== globalThis.scrollY ||
          currentScrollX !== globalThis.scrollX ||
          eventTargetContainsFocusedField(event.target)
        ) {
          repositionHandler(event);
        }

        currentScrollY = globalThis.scrollY;
        currentScrollX = globalThis.scrollX;
      }, 50),
      AUTOFILL_OVERLAY_HANDLE_SCROLL,
    );

    globalThis.addEventListener(EVENTS.SCROLL, scrollHandler, {
      capture: true,
      passive: true,
    });
    globalThis.addEventListener(EVENTS.RESIZE, repositionHandler);
  }

  private shouldRepositionSubFrameInlineMenuOnScroll = async () => {
    return await this.sendExtensionMessage("shouldRepositionSubFrameInlineMenuOnScroll");
  };

  /**
   * Removes the listeners that facilitate repositioning
   * the overlay elements on scroll or resize.
   */
  private removeOverlayRepositionEventListeners() {
    globalThis.removeEventListener(
      EVENTS.SCROLL,
      this.eventHandlersMemo[AUTOFILL_OVERLAY_HANDLE_SCROLL],
      {
        capture: true,
      },
    );
    globalThis.removeEventListener(
      EVENTS.RESIZE,
      this.eventHandlersMemo[AUTOFILL_OVERLAY_HANDLE_REPOSITION],
    );

    delete this.eventHandlersMemo[AUTOFILL_OVERLAY_HANDLE_SCROLL];
    delete this.eventHandlersMemo[AUTOFILL_OVERLAY_HANDLE_REPOSITION];
  }

  /**
   * Handles the resize or scroll events that enact
   * repositioning of existing overlay elements.
   */
  private handleOverlayRepositionEvent = async () => {
    await this.sendExtensionMessage("triggerAutofillOverlayReposition");
  };

  /**
   * Sets up listeners that facilitate a rebuild of the sub frame offsets
   * when a user interacts or focuses an element within the frame.
   */
  private setupRebuildSubFrameOffsetsListeners = () => {
    if (globalThis.window.top === globalThis.window || this.formFieldElements.size < 1) {
      return;
    }
    this.removeSubFrameFocusOutListeners();

    globalThis.addEventListener(EVENTS.FOCUS, this.handleSubFrameFocusInEvent);
    globalThis.document.body.addEventListener(EVENTS.MOUSEENTER, this.handleSubFrameFocusInEvent);
  };

  /**
   * Removes the listeners that facilitate a rebuild of the sub frame offsets.
   */
  private removeRebuildSubFrameOffsetsListeners = () => {
    globalThis.removeEventListener(EVENTS.FOCUS, this.handleSubFrameFocusInEvent);
    globalThis.document.body.removeEventListener(
      EVENTS.MOUSEENTER,
      this.handleSubFrameFocusInEvent,
    );
  };

  /**
   * Re-establishes listeners that handle the sub frame offsets rebuild of the frame
   * based on user interaction with the sub frame.
   */
  private setupSubFrameFocusOutListeners = () => {
    globalThis.addEventListener(EVENTS.BLUR, this.setupRebuildSubFrameOffsetsListeners);
    globalThis.document.body.addEventListener(
      EVENTS.MOUSELEAVE,
      this.setupRebuildSubFrameOffsetsListeners,
    );
  };

  /**
   * Removes the listeners that trigger when a user focuses away from the sub frame.
   */
  private removeSubFrameFocusOutListeners = () => {
    globalThis.removeEventListener(EVENTS.BLUR, this.setupRebuildSubFrameOffsetsListeners);
    globalThis.document.body.removeEventListener(
      EVENTS.MOUSELEAVE,
      this.setupRebuildSubFrameOffsetsListeners,
    );
  };

  /**
   * Sends a message to the background script to trigger a rebuild of the sub frame
   * offsets. Will deregister the listeners to ensure that other focus and mouse
   * events do not unnecessarily re-trigger a sub frame rebuild.
   */
  private handleSubFrameFocusInEvent = () => {
    void this.sendExtensionMessage("triggerSubFrameFocusInRebuild");

    this.removeRebuildSubFrameOffsetsListeners();
    this.setupSubFrameFocusOutListeners();
  };

  /**
   * Triggers an update in the most recently focused field's data and returns
   * whether the field is within the viewport bounds. If not within the bounds
   * of the viewport, the inline menu will be closed.
   */
  private async checkIsMostRecentlyFocusedFieldWithinViewport() {
    await this.updateMostRecentlyFocusedField(this.mostRecentlyFocusedField);

    const focusedFieldRectsTop = this.focusedFieldData?.focusedFieldRects?.top;
    const focusedFieldRectsBottom =
      focusedFieldRectsTop + this.focusedFieldData?.focusedFieldRects?.height;
    const viewportHeight = globalThis.innerHeight + globalThis.scrollY;
    return (
      !globalThis.isNaN(focusedFieldRectsTop) &&
      focusedFieldRectsTop >= 0 &&
      focusedFieldRectsTop < viewportHeight &&
      focusedFieldRectsBottom <= viewportHeight
    );
  }

  /**
   * Clears the timeout that triggers a debounced focus of the inline menu list.
   */
  private clearFocusInlineMenuListTimeout() {
    if (this.focusInlineMenuListTimeout) {
      globalThis.clearTimeout(this.focusInlineMenuListTimeout);
    }
  }

  /**
   * Clears the timeout that triggers the closing of the inline menu on a focus redirection.
   */
  private clearCloseInlineMenuOnRedirectTimeout() {
    if (this.closeInlineMenuOnRedirectTimeout) {
      globalThis.clearTimeout(this.closeInlineMenuOnRedirectTimeout);
    }
  }

  /**
   * Destroys the autofill overlay content service. This method will
   * disconnect the mutation observers and remove all event listeners.
   */
  destroy() {
    this.clearFocusInlineMenuListTimeout();
    this.clearCloseInlineMenuOnRedirectTimeout();
    this.formFieldElements.forEach((_autofillField, formFieldElement) => {
      this.removeCachedFormFieldEventListeners(formFieldElement);
      formFieldElement.removeEventListener(EVENTS.BLUR, this.handleFormFieldBlurEvent);
      formFieldElement.removeEventListener(EVENTS.KEYUP, this.handleFormFieldKeyupEvent);
      this.formFieldElements.delete(formFieldElement);
    });
    this.clearUserFilledFields();
    this.userFilledFields = null;
    globalThis.removeEventListener(EVENTS.MESSAGE, this.handleWindowMessageEvent);
    globalThis.document.removeEventListener(
      EVENTS.VISIBILITYCHANGE,
      this.handleVisibilityChangeEvent,
    );
    globalThis.removeEventListener(EVENTS.FOCUSOUT, this.handleFormFieldBlurEvent);
    this.removeOverlayRepositionEventListeners();
    this.removeRebuildSubFrameOffsetsListeners();
    this.removeSubFrameFocusOutListeners();
  }
}
