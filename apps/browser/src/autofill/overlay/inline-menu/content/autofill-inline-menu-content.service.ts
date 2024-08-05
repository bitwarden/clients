import {
  InlineMenuElementPosition,
  InlineMenuPosition,
} from "../../../background/abstractions/overlay.background";
import { AutofillExtensionMessage } from "../../../content/abstractions/autofill-init";
import {
  AutofillOverlayElement,
  AutofillOverlayElementType,
} from "../../../enums/autofill-overlay.enum";
import {
  sendExtensionMessage,
  generateRandomCustomElementName,
  setElementStyles,
  requestIdleCallbackPolyfill,
} from "../../../utils";
import {
  InlineMenuExtensionMessageHandlers,
  AutofillInlineMenuContentService as AutofillInlineMenuContentServiceInterface,
} from "../abstractions/autofill-inline-menu-content.service";
import { AutofillInlineMenuButtonIframe } from "../iframe-content/autofill-inline-menu-button-iframe";
import { AutofillInlineMenuListIframe } from "../iframe-content/autofill-inline-menu-list-iframe";

export class AutofillInlineMenuContentService implements AutofillInlineMenuContentServiceInterface {
  private readonly sendExtensionMessage = sendExtensionMessage;
  private readonly generateRandomCustomElementName = generateRandomCustomElementName;
  private readonly setElementStyles = setElementStyles;
  private isFirefoxBrowser =
    globalThis.navigator.userAgent.indexOf(" Firefox/") !== -1 ||
    globalThis.navigator.userAgent.indexOf(" Gecko/") !== -1;
  private buttonElement: HTMLElement;
  private listElement: HTMLElement;
  private inlineMenuElementsMutationObserver: MutationObserver;
  private bodyElementMutationObserver: MutationObserver;
  private mutationObserverIterations = 0;
  private mutationObserverIterationsResetTimeout: number | NodeJS.Timeout;
  private handlePersistentLastChildOverrideTimeout: number | NodeJS.Timeout;
  private lastElementOverrides: WeakMap<Element, number> = new WeakMap();
  private readonly customElementDefaultStyles: Partial<CSSStyleDeclaration> = {
    all: "initial",
    position: "fixed",
    display: "block",
    zIndex: "2147483647",
  };
  private readonly extensionMessageHandlers: InlineMenuExtensionMessageHandlers = {
    closeAutofillInlineMenu: ({ message }) => this.closeInlineMenu(message),
    appendAutofillInlineMenuToDom: ({ message }) => this.appendInlineMenuElements(message),
  };

  constructor() {
    this.setupMutationObserver();
  }

  /**
   * Returns the message handlers for the autofill inline menu content service.
   */
  get messageHandlers() {
    return this.extensionMessageHandlers;
  }

  /**
   * Identifies if the passed element corresponds to the inline menu button or list.
   *
   * @param element  - The element being checked
   */
  isElementInlineMenu(element: HTMLElement) {
    return element === this.buttonElement || element === this.listElement;
  }

  /**
   * Checks if the inline menu button is visible at the top frame.
   */
  private async isInlineMenuButtonVisible() {
    return (
      !!this.buttonElement &&
      (await this.sendExtensionMessage("checkIsAutofillInlineMenuButtonVisible")) === true
    );
  }

  /**
   * Checks if the inline menu list if visible at the top frame.
   */
  private async isInlineMenuListVisible() {
    return (
      !!this.listElement &&
      (await this.sendExtensionMessage("checkIsAutofillInlineMenuListVisible")) === true
    );
  }

  /**
   * Removes the autofill inline menu from the page. This will initially
   * unobserve the body element to ensure the mutation observer no
   * longer triggers.
   */
  private closeInlineMenu = (message?: AutofillExtensionMessage) => {
    if (message?.overlayElement === AutofillOverlayElement.Button) {
      this.closeInlineMenuButton();
      return;
    }

    if (message?.overlayElement === AutofillOverlayElement.List) {
      this.closeInlineMenuList();
      return;
    }

    this.unobserveBodyElement();
    this.closeInlineMenuButton();
    this.closeInlineMenuList();
  };

  /**
   * Removes the inline menu button from the DOM if it is currently present. Will
   * also remove the inline menu reposition event listeners.
   */
  private closeInlineMenuButton() {
    if (this.buttonElement) {
      this.buttonElement.remove();
      void this.sendExtensionMessage("autofillOverlayElementClosed", {
        overlayElement: AutofillOverlayElement.Button,
      });
    }
  }

  /**
   * Removes the inline menu list from the DOM if it is currently present.
   */
  private closeInlineMenuList() {
    if (this.listElement) {
      this.listElement.remove();
      void this.sendExtensionMessage("autofillOverlayElementClosed", {
        overlayElement: AutofillOverlayElement.List,
      });
    }
  }

  /**
   * Updates the position of both the inline menu button and inline menu list.
   */
  private async appendInlineMenuElements({ overlayElement }: AutofillExtensionMessage) {
    if (overlayElement === AutofillOverlayElement.Button) {
      return this.appendButtonElement();
    }

    return this.appendListElement();
  }

  /**
   * Updates the position of the inline menu button.
   */
  private async appendButtonElement(): Promise<void> {
    if (!this.buttonElement) {
      this.createButtonElement();
      this.updateCustomElementDefaultStyles(this.buttonElement);
    }

    if (!(await this.isInlineMenuButtonVisible())) {
      this.appendInlineMenuElementToBody(this.buttonElement);
      this.updateInlineMenuElementIsVisibleStatus(AutofillOverlayElement.Button, true);
    }
  }

  /**
   * Updates the position of the inline menu list.
   */
  private async appendListElement(): Promise<void> {
    if (!this.listElement) {
      this.createListElement();
      this.updateCustomElementDefaultStyles(this.listElement);
    }

    if (!(await this.isInlineMenuListVisible())) {
      this.appendInlineMenuElementToBody(this.listElement);
      this.updateInlineMenuElementIsVisibleStatus(AutofillOverlayElement.List, true);
    }
  }

  /**
   * Updates the visibility status of the inline menu element within the background script.
   *
   * @param overlayElement - The inline menu element to update the visibility status for.
   * @param isVisible - The visibility status to update the inline menu element to.
   */
  private updateInlineMenuElementIsVisibleStatus(
    overlayElement: AutofillOverlayElementType,
    isVisible: boolean,
  ) {
    void this.sendExtensionMessage("updateAutofillInlineMenuElementIsVisibleStatus", {
      overlayElement,
      isVisible,
    });
  }

  /**
   * Appends the inline menu element to the body element. This method will also
   * observe the body element to ensure that the inline menu element is not
   * interfered with by any DOM changes.
   *
   * @param element - The inline menu element to append to the body element.
   */
  private appendInlineMenuElementToBody(element: HTMLElement) {
    this.observeBodyElement();
    globalThis.document.body.appendChild(element);
  }

  /**
   * Creates the autofill inline menu button element. Will not attempt
   * to create the element if it already exists in the DOM.
   */
  private createButtonElement() {
    if (this.isFirefoxBrowser) {
      this.buttonElement = globalThis.document.createElement("div");
      new AutofillInlineMenuButtonIframe(this.buttonElement);

      return;
    }

    const customElementName = this.generateRandomCustomElementName();
    globalThis.customElements?.define(
      customElementName,
      class extends HTMLElement {
        constructor() {
          super();
          new AutofillInlineMenuButtonIframe(this);
        }
      },
    );
    this.buttonElement = globalThis.document.createElement(customElementName);
  }

  /**
   * Creates the autofill inline menu list element. Will not attempt
   * to create the element if it already exists in the DOM.
   */
  private createListElement() {
    if (this.isFirefoxBrowser) {
      this.listElement = globalThis.document.createElement("div");
      new AutofillInlineMenuListIframe(this.listElement);

      return;
    }

    const customElementName = this.generateRandomCustomElementName();
    globalThis.customElements?.define(
      customElementName,
      class extends HTMLElement {
        constructor() {
          super();
          new AutofillInlineMenuListIframe(this);
        }
      },
    );
    this.listElement = globalThis.document.createElement(customElementName);
  }

  /**
   * Updates the default styles for the custom element. This method will
   * remove any styles that are added to the custom element by other methods.
   *
   * @param element - The custom element to update the default styles for.
   */
  private updateCustomElementDefaultStyles(element: HTMLElement) {
    this.unobserveCustomElements();

    this.setElementStyles(element, this.customElementDefaultStyles, true);

    this.observeCustomElements();
  }

  /**
   * Sets up mutation observers for the inline menu elements, the body element, and
   * the document element. The mutation observers are used to remove any styles that
   * are added to the inline menu elements by the website. They are also used to ensure
   * that the inline menu elements are always present at the bottom of the body element.
   */
  private setupMutationObserver = () => {
    this.inlineMenuElementsMutationObserver = new MutationObserver(
      this.handleInlineMenuElementMutationObserverUpdate,
    );

    this.bodyElementMutationObserver = new MutationObserver(
      this.handleBodyElementMutationObserverUpdate,
    );
  };

  /**
   * Sets up mutation observers to verify that the inline menu
   * elements are not modified by the website.
   */
  private observeCustomElements() {
    if (this.buttonElement) {
      this.inlineMenuElementsMutationObserver?.observe(this.buttonElement, {
        attributes: true,
      });
    }

    if (this.listElement) {
      this.inlineMenuElementsMutationObserver?.observe(this.listElement, { attributes: true });
    }
  }

  /**
   * Disconnects the mutation observers that are used to verify that the inline menu
   * elements are not modified by the website.
   */
  private unobserveCustomElements() {
    this.inlineMenuElementsMutationObserver?.disconnect();
  }

  /**
   * Sets up a mutation observer for the body element. The mutation observer is used
   * to ensure that the inline menu elements are always present at the bottom of the
   * body element.
   */
  private observeBodyElement() {
    this.bodyElementMutationObserver?.observe(globalThis.document.body, { childList: true });
  }

  /**
   * Disconnects the mutation observer for the body element.
   */
  private unobserveBodyElement() {
    this.bodyElementMutationObserver?.disconnect();
  }

  /**
   * Handles the mutation observer update for the inline menu elements. This method will
   * remove any attributes or styles that might be added to the inline menu elements by
   * a separate process within the website where this script is injected.
   *
   * @param mutationRecord - The mutation record that triggered the update.
   */
  private handleInlineMenuElementMutationObserverUpdate = (mutationRecord: MutationRecord[]) => {
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
   * Removes all elements from a passed inline menu
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
   * ensure that the inline menu elements are always present at the bottom of the
   * body element.
   */
  private handleBodyElementMutationObserverUpdate = () => {
    if (
      (!this.buttonElement && !this.listElement) ||
      this.isTriggeringExcessiveMutationObserverIterations()
    ) {
      return;
    }

    requestIdleCallbackPolyfill(this.processBodyElementMutation, { timeout: 500 });
  };

  /**
   * Processes the mutation of the body element. Will trigger when an
   * idle moment in the execution of the main thread is detected.
   */
  private processBodyElementMutation = async () => {
    const lastChild = globalThis.document.body.lastElementChild;
    const secondToLastChild = lastChild?.previousElementSibling;
    const lastChildIsInlineMenuList = lastChild === this.listElement;
    const lastChildIsInlineMenuButton = lastChild === this.buttonElement;
    const secondToLastChildIsInlineMenuButton = secondToLastChild === this.buttonElement;

    if (!lastChild) {
      return;
    }

    const lastChildEncounterCount = this.lastElementOverrides.get(lastChild) || 0;
    if (!lastChildIsInlineMenuList && !lastChildIsInlineMenuButton && lastChildEncounterCount < 3) {
      this.lastElementOverrides.set(lastChild, lastChildEncounterCount + 1);
    }

    if (this.lastElementOverrides.get(lastChild) >= 3) {
      this.handlePersistentLastChildOverride(lastChild);

      return;
    }

    const isInlineMenuListVisible = await this.isInlineMenuListVisible();
    if (
      !lastChild ||
      (lastChildIsInlineMenuList && secondToLastChildIsInlineMenuButton) ||
      (lastChildIsInlineMenuButton && !isInlineMenuListVisible)
    ) {
      return;
    }

    if (
      (lastChildIsInlineMenuList && !secondToLastChildIsInlineMenuButton) ||
      (lastChildIsInlineMenuButton && isInlineMenuListVisible)
    ) {
      globalThis.document.body.insertBefore(this.buttonElement, this.listElement);
      return;
    }

    globalThis.document.body.insertBefore(lastChild, this.buttonElement);
  };

  /**
   * Handles the behavior of a persistent child element that is forcing itself to
   * the bottom of the body element. This method will ensure that the inline menu
   * elements are not obscured by the persistent child element.
   *
   * @param lastChild - The last child of the body element.
   */
  private handlePersistentLastChildOverride(lastChild: Element) {
    const lastChildZIndex = parseInt((lastChild as HTMLElement).style.zIndex);
    if (lastChildZIndex >= 2147483647) {
      (lastChild as HTMLElement).style.zIndex = "2147483646";
    }

    this.clearPersistentLastChildOverrideTimeout();
    this.handlePersistentLastChildOverrideTimeout = globalThis.setTimeout(
      () => this.verifyInlineMenuIsNotObscured(lastChild),
      500,
    );
  }

  /**
   * Verifies if the last child of the body element is overlaying the inline menu elements.
   * This is triggered when the last child of the body is being forced by some script to
   * be an element other than the inline menu elements.
   *
   * @param lastChild - The last child of the body element.
   */
  private verifyInlineMenuIsNotObscured = async (lastChild: Element) => {
    const inlineMenuPosition: InlineMenuPosition = await this.sendExtensionMessage(
      "getAutofillInlineMenuPosition",
    );
    const { button, list } = inlineMenuPosition;

    if (!!button && this.elementAtCenterOfInlineMenuPosition(button) === lastChild) {
      this.closeInlineMenu();
      return;
    }

    if (!!list && this.elementAtCenterOfInlineMenuPosition(list) === lastChild) {
      this.closeInlineMenu();
    }
  };

  /**
   * Returns the element present at the center of the inline menu position.
   *
   * @param position - The position of the inline menu element.
   */
  private elementAtCenterOfInlineMenuPosition(position: InlineMenuElementPosition): Element | null {
    return globalThis.document.elementFromPoint(
      position.left + position.width / 2,
      position.top + position.height / 2,
    );
  }

  /**
   * Clears the timeout that is used to verify that the last child of the body element
   * is not overlaying the inline menu elements.
   */
  private clearPersistentLastChildOverrideTimeout() {
    if (this.handlePersistentLastChildOverrideTimeout) {
      globalThis.clearTimeout(this.handlePersistentLastChildOverrideTimeout);
    }
  }

  /**
   * Identifies if the mutation observer is triggering excessive iterations.
   * Will trigger a blur of the most recently focused field and remove the
   * autofill inline menu if any set mutation observer is triggering
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
      this.closeInlineMenu();

      return true;
    }

    return false;
  }

  /**
   * Disconnects the mutation observers and removes the inline menu elements from the DOM.
   */
  destroy() {
    this.closeInlineMenu();
    this.clearPersistentLastChildOverrideTimeout();
  }
}
