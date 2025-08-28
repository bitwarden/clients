// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
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

const TopLayerRefreshBackoffThresholds = { countLimit: 5, timeSpanLimit: 3000 };

export class AutofillInlineMenuContentService implements AutofillInlineMenuContentServiceInterface {
  private readonly sendExtensionMessage = sendExtensionMessage;
  private readonly generateRandomCustomElementName = generateRandomCustomElementName;
  private readonly setElementStyles = setElementStyles;
  private isFirefoxBrowser =
    globalThis.navigator.userAgent.indexOf(" Firefox/") !== -1 ||
    globalThis.navigator.userAgent.indexOf(" Gecko/") !== -1;
  private buttonElement?: HTMLElement;
  private listElement?: HTMLElement;
  private htmlMutationObserver: MutationObserver;
  private bodyMutationObserver: MutationObserver;
  private inlineMenuElementsMutationObserver: MutationObserver;
  private containerElementMutationObserver: MutationObserver;
  private topLayerRefreshCountWithinTimeThreshold: number = 0;
  private lastTrackedTopLayerRefreshTimestamp = Date.now();
  // Distinct from preventing inline menu script injection, this is for cases where the page
  // is subsequently determined to be risky.
  private inlineMenuEnabled = true;
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
   * unobserve the menu container to ensure the mutation observer no
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

    this.unobserveContainerElement();
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
      this.appendInlineMenuElementToDom(this.buttonElement);
      this.updateInlineMenuElementIsVisibleStatus(AutofillOverlayElement.Button, true);
      this.buttonElement.showPopover();
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
      this.appendInlineMenuElementToDom(this.listElement);
      this.updateInlineMenuElementIsVisibleStatus(AutofillOverlayElement.List, true);
      this.listElement.showPopover();
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
   * Appends the inline menu element to the menu container. This method will also
   * observe the menu container to ensure that the inline menu element is not
   * interfered with by any DOM changes.
   *
   * @param element - The inline menu element to append to the menu container.
   */
  private appendInlineMenuElementToDom(element: HTMLElement) {
    const parentDialogElement = globalThis.document.activeElement?.closest("dialog");
    if (parentDialogElement?.open && parentDialogElement.matches(":modal")) {
      this.observeContainerElement(parentDialogElement);
      parentDialogElement.appendChild(element);
      return;
    }

    this.observeContainerElement(globalThis.document.body);
    globalThis.document.body.appendChild(element);
  }

  /**
   * Creates the autofill inline menu button element. Will not attempt
   * to create the element if it already exists in the DOM.
   */
  private createButtonElement() {
    if (this.isFirefoxBrowser) {
      this.buttonElement = globalThis.document.createElement("div");
      this.buttonElement.setAttribute("popover", "manual");
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
    this.buttonElement.setAttribute("popover", "manual");

    this.createInternalStyleNode(this.buttonElement);
  }

  /**
   * Creates the autofill inline menu list element. Will not attempt
   * to create the element if it already exists in the DOM.
   */
  private createListElement() {
    if (this.isFirefoxBrowser) {
      this.listElement = globalThis.document.createElement("div");
      this.listElement.setAttribute("popover", "manual");
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
    this.listElement.setAttribute("popover", "manual");

    this.createInternalStyleNode(this.listElement);
  }

  /**
   * Builds and prepends an internal stylesheet to the container node with rules
   * to prevent targeting by the host's global styling rules. This should only be
   * used for pseudo elements such as `::backdrop` or `::before`. All other
   * styles should be applied inline upon the parent container itself.
   */
  private createInternalStyleNode(parent: HTMLElement) {
    const css = document.createTextNode(`
      ${parent.tagName}::backdrop {
        background: none !important;
        pointer-events: none !important;
      }
      ${parent.tagName}::before, ${parent.tagName}::after {
        content:"" !important;
      }
    `);
    const style = globalThis.document.createElement("style");
    style.setAttribute("type", "text/css");
    style.appendChild(css);
    parent.prepend(style);
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
   * Sets up mutation observers for the inline menu elements, the menu container, and
   * the document element. The mutation observers are used to remove any styles that
   * are added to the inline menu elements by the website. They are also used to ensure
   * that the inline menu elements are always present at the bottom of the menu container.
   */
  private setupMutationObserver = () => {
    this.htmlMutationObserver = new MutationObserver(this.handlePageMutations);
    this.bodyMutationObserver = new MutationObserver(this.handlePageMutations);

    this.inlineMenuElementsMutationObserver = new MutationObserver(
      this.handleInlineMenuElementMutationObserverUpdate,
    );

    this.containerElementMutationObserver = new MutationObserver(
      this.handleContainerElementMutationObserverUpdate,
    );

    this.observePageAttributes();
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
   * Sets up mutation observers to verify that the page `html` and `body` attributes
   * are not altered in a way that would impact safe display of the inline menu.
   */
  private observePageAttributes() {
    if (document.documentElement) {
      this.htmlMutationObserver?.observe(document.documentElement, { attributes: true });
    }

    if (document.body) {
      this.bodyMutationObserver?.observe(document.body, { attributes: true });
    }
  }

  private unobservePageAttributes() {
    this.htmlMutationObserver?.disconnect();
    this.bodyMutationObserver?.disconnect();
  }

  /**
   * Disconnects the mutation observers that are used to verify that the inline menu
   * elements are not modified by the website.
   */
  private unobserveCustomElements() {
    this.inlineMenuElementsMutationObserver?.disconnect();
  }

  /**
   * Sets up a mutation observer for the element which contains the inline menu.
   */
  private observeContainerElement(element: HTMLElement) {
    this.containerElementMutationObserver?.observe(element, { childList: true });
  }

  /**
   * Disconnects the mutation observer for the element which contains the inline menu.
   */
  private unobserveContainerElement() {
    this.containerElementMutationObserver?.disconnect();
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
   * Handles the mutation observer update for the element that contains the inline menu.
   * This method will ensure that the inline menu elements are always present at the
   * bottom of the container.
   */
  private handleContainerElementMutationObserverUpdate = (mutations: MutationRecord[]) => {
    if (
      (!this.buttonElement && !this.listElement) ||
      this.isTriggeringExcessiveMutationObserverIterations()
    ) {
      return;
    }

    const containerElement = mutations[0].target as HTMLElement;
    requestIdleCallbackPolyfill(() => this.processContainerElementMutation(containerElement), {
      timeout: 500,
    });
  };

  private checkPageRisks = async () => {
    const pageIsOpaque = await this.getPageIsOpaque();

    const risksFound = !pageIsOpaque || !this.inlineMenuEnabled;

    if (risksFound) {
      this.closeInlineMenu();
    }

    return risksFound;
  };

  /*
   * Checks for known risks at the page level
   */
  private handlePageMutations = async (mutations: MutationRecord[]) => {
    if (mutations.some(({ type }) => type === "attributes")) {
      await this.checkPageRisks();
    }
  };

  /**
   * Returns the name of the generated container tags for usage internally to avoid
   * unintentional targeting of the owned experience.
   */
  getOwnedTagNames = (): string[] => {
    return [
      ...(this.buttonElement?.tagName ? [this.buttonElement.tagName] : []),
      ...(this.listElement?.tagName ? [this.listElement.tagName] : []),
    ];
  };

  /**
   * Queries and return elements (excluding those of the inline menu) that exist in the
   * top-layer via popover or dialog
   * @param {boolean} [includeCandidates=false] indicate whether top-layer candidate (which
   * may or may not be active) should be included in the query
   */
  getUnownedTopLayerItems = (includeCandidates = false) => {
    const inlineMenuTagExclusions = [
      ...(this.buttonElement?.tagName ? [`:not(${this.buttonElement.tagName})`] : []),
      ...(this.listElement?.tagName ? [`:not(${this.listElement.tagName})`] : []),
      ":popover-open",
    ].join("");
    const selector = [
      ":modal",
      inlineMenuTagExclusions,
      ...(includeCandidates ? ["[popover], dialog"] : []),
    ].join(",");
    const otherTopLayeritems = globalThis.document.querySelectorAll(selector);

    return otherTopLayeritems;
  };

  checkAndUpdateTopLayerRefreshCount = () => {
    const { countLimit, timeSpanLimit } = TopLayerRefreshBackoffThresholds;
    const now = Date.now();
    const timeSinceLastTrackedRefresh = now - this.lastTrackedTopLayerRefreshTimestamp;
    const currentlyWithinTimeThreshold = timeSinceLastTrackedRefresh <= timeSpanLimit;
    const withinCountThreshold = this.topLayerRefreshCountWithinTimeThreshold <= countLimit;

    if (currentlyWithinTimeThreshold) {
      if (withinCountThreshold) {
        this.topLayerRefreshCountWithinTimeThreshold++;
      } else {
        // Set inline menu to be off; page is aggressively trying to take top position of top layer
        this.inlineMenuEnabled = false;
        void this.checkPageRisks();
      }
    } else {
      this.lastTrackedTopLayerRefreshTimestamp = now;
      this.topLayerRefreshCountWithinTimeThreshold = 0;
    }
  };

  refreshTopLayerPosition = () => {
    if (!this.inlineMenuEnabled) {
      return;
    }

    const otherTopLayerItems = this.getUnownedTopLayerItems();

    // No need to refresh if there are no other top-layer items
    if (!otherTopLayerItems.length) {
      return;
    }

    const buttonInDocument =
      this.buttonElement &&
      (globalThis.document.getElementsByTagName(this.buttonElement.tagName)[0] as HTMLElement);
    const listInDocument =
      this.listElement &&
      (globalThis.document.getElementsByTagName(this.listElement.tagName)[0] as HTMLElement);

    if (buttonInDocument) {
      buttonInDocument.hidePopover();
      buttonInDocument.showPopover();
    }

    if (listInDocument) {
      listInDocument.hidePopover();
      listInDocument.showPopover();
    }

    if (buttonInDocument || listInDocument) {
      this.checkAndUpdateTopLayerRefreshCount();
    }
  };

  /**
   * Checks the opacity of the page body and body parent, since the inline menu experience
   * will inherit the opacity, despite being otherwise encapsulated from styling changes
   * of parents below the body. Assumes the target element will be a direct child of the page
   * `body` (enforced elsewhere).
   */
  private getPageIsOpaque = () => {
    // These are computed style values, so we don't need to worry about non-float values
    // for `opacity`, here
    // @TODO for definitive checks, traverse up the node tree from the inline menu container;
    // nodes can exist between `html` and `body`
    const htmlElement = globalThis.document.querySelector("html");
    const bodyElement = globalThis.document.querySelector("body");

    if (!htmlElement || !bodyElement) {
      return false;
    }

    const htmlOpacity = globalThis.window.getComputedStyle(htmlElement)?.opacity || "0";
    const bodyOpacity = globalThis.window.getComputedStyle(bodyElement)?.opacity || "0";

    // Any value above this is considered "opaque" for our purposes
    const opacityThreshold = 0.6;

    return parseFloat(htmlOpacity) > opacityThreshold && parseFloat(bodyOpacity) > opacityThreshold;
  };

  /**
   * Processes the mutation of the element that contains the inline menu. Will trigger when an
   * idle moment in the execution of the main thread is detected.
   */
  private processContainerElementMutation = async (containerElement: HTMLElement) => {
    // If the page contains risks, tear down and prevent building the inline menu experience.
    const pageRisksFound = await this.checkPageRisks();
    if (pageRisksFound) {
      return;
    }

    const lastChild = containerElement.lastElementChild;
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
      containerElement.insertBefore(this.buttonElement, this.listElement);
      return;
    }

    containerElement.insertBefore(lastChild, this.buttonElement);
  };

  /**
   * Handles the behavior of a persistent child element that is forcing itself to
   * the bottom of the menu container. This method will ensure that the inline menu
   * elements are not obscured by the persistent child element.
   *
   * @param lastChild - The last child of the menu container.
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
   * Verifies if the last child of the menu container is overlaying the inline menu elements.
   * This is triggered when the last child of the menu container is being forced by some
   * script to be an element other than the inline menu elements.
   *
   * @param lastChild - The last child of the menu container.
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
   * Clears the timeout that is used to verify that the last child of the menu container
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
    this.unobservePageAttributes();
  }
}
