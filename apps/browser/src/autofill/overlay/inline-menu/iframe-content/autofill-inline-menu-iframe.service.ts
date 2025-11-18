// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { EVENTS } from "@bitwarden/common/autofill/constants";
import { ThemeTypes } from "@bitwarden/common/platform/enums";

import { sendExtensionMessage, setElementStyles } from "../../../utils";
import {
  BackgroundPortMessageHandlers,
  AutofillInlineMenuIframeService as AutofillInlineMenuIframeServiceInterface,
  AutofillInlineMenuIframeExtensionMessage,
} from "../abstractions/autofill-inline-menu-iframe.service";

export class AutofillInlineMenuIframeService implements AutofillInlineMenuIframeServiceInterface {
  private readonly setElementStyles = setElementStyles;
  private readonly sendExtensionMessage = sendExtensionMessage;
  private port: chrome.runtime.Port | null = null;
  private portKey: string;
  private iframeMutationObserver: MutationObserver;
  private iframe: HTMLIFrameElement;
  private ariaAlertElement: HTMLDivElement;
  private ariaAlertTimeout: number | NodeJS.Timeout;
  private delayedCloseTimeout: number | NodeJS.Timeout;
  private fadeInTimeout: number | NodeJS.Timeout;
  private readonly fadeInOpacityTransition = "opacity 125ms ease-out 0s";
  private readonly fadeOutOpacityTransition = "opacity 65ms ease-out 0s";
  private iframeStyles: Partial<CSSStyleDeclaration> = {
    all: "initial",
    position: "fixed",
    display: "block",
    zIndex: "2147483647",
    lineHeight: "0",
    overflow: "hidden",
    transition: this.fadeInOpacityTransition,
    visibility: "visible",
    clipPath: "none",
    pointerEvents: "auto",
    margin: "0",
    padding: "0",
    colorScheme: "normal",
    opacity: "0",
  };
  private defaultIframeAttributes: Record<string, string> = {
    src: "",
    title: "",
    allowtransparency: "true",
    tabIndex: "-1",
    scrolling: "no",
  };
  private foreignMutationsCount = 0;
  private mutationObserverIterations = 0;
  private mutationObserverIterationsResetTimeout: number | NodeJS.Timeout;
  private readonly backgroundPortMessageHandlers: BackgroundPortMessageHandlers = {
    initAutofillInlineMenuButton: ({ message }) => this.initAutofillInlineMenu(message),
    initAutofillInlineMenuList: ({ message }) => this.initAutofillInlineMenu(message),
    updateAutofillInlineMenuPosition: ({ message }) => this.updateIframePosition(message.styles),
    toggleAutofillInlineMenuHidden: ({ message }) =>
      this.updateElementStyles(this.iframe, message.styles),
    updateAutofillInlineMenuColorScheme: () => this.updateAutofillInlineMenuColorScheme(),
    triggerDelayedAutofillInlineMenuClosure: () => this.handleDelayedAutofillInlineMenuClosure(),
    fadeInAutofillInlineMenuIframe: () => this.handleFadeInInlineMenuIframe(),
    updateAutofillInlineMenuGeneratedPassword: ({ message }) =>
      this.handleUpdateGeneratedPassword(message),
  };

  constructor(
    private shadow: ShadowRoot,
    private portName: string,
    private initStyles: Partial<CSSStyleDeclaration>,
    private iframeTitle: string,
    private ariaAlert?: string,
  ) {
    this.iframeMutationObserver = new MutationObserver(this.handleMutations);
  }

  /**
   * Handles initialization of the iframe which includes applying initial styles
   * to the iframe, setting the source, and adding listener that connects the
   * iframe to the background script each time it loads. Can conditionally
   * create an aria alert element to announce to screen readers when the iframe
   * is loaded. The end result is append to the shadowDOM of the custom element
   * that is declared.
   */
  initMenuIframe() {
    // this lint isn't valid in the context of an iframe
    // eslint-disable-next-line @bitwarden/platform/no-page-script-url-leakage
    this.defaultIframeAttributes.src = chrome.runtime.getURL("overlay/menu.html");
    this.defaultIframeAttributes.title = this.iframeTitle;

    this.iframe = globalThis.document.createElement("iframe");
    for (const [attribute, value] of Object.entries(this.defaultIframeAttributes)) {
      this.iframe.setAttribute(attribute, value);
    }
    this.iframeStyles = { ...this.iframeStyles, ...this.initStyles };
    this.setElementStyles(this.iframe, this.iframeStyles, true);
    this.iframe.addEventListener(EVENTS.LOAD, this.setupPortMessageListener);

    if (this.ariaAlert) {
      this.createAriaAlertElement();
    }

    this.shadow.appendChild(this.iframe);
    this.observeIframe();
  }

  /**
   * Creates an aria alert element that is used to announce to screen readers
   * when the iframe is loaded.
   */
  private createAriaAlertElement(assertive = false) {
    this.ariaAlertElement = globalThis.document.createElement("div");
    this.ariaAlertElement.setAttribute("role", "alert");
    this.ariaAlertElement.setAttribute("aria-live", assertive ? "assertive" : "polite");
    this.ariaAlertElement.setAttribute("aria-atomic", "true");
    this.updateElementStyles(this.ariaAlertElement, {
      position: "absolute",
      top: "-9999px",
      left: "-9999px",
      width: "1px",
      height: "1px",
      overflow: "hidden",
      opacity: "0",
      pointerEvents: "none",
    });
  }

  /**
   * Sets up the port message listener to the extension background script. This
   * listener is used to communicate between the iframe and the background script.
   * This also facilitates announcing to screen readers when the iframe is loaded.
   */
  private setupPortMessageListener = () => {
    this.port = chrome.runtime.connect({ name: this.portName });
    this.port.onDisconnect.addListener(this.handlePortDisconnect);
    this.port.onMessage.addListener(this.handlePortMessage);

    this.announceAriaAlert(this.ariaAlert, 2000);
  };

  /**
   * Announces the aria alert element to screen readers when the iframe is loaded.
   *
   * @param textContent - The text content to announce
   * @param delay - The delay before announcing the text content
   * @param triggeredByUser - Identifies whether we should present the alert regardless of field focus
   */
  private announceAriaAlert(textContent: string, delay: number, triggeredByUser = false) {
    if (!this.ariaAlertElement || !textContent) {
      return;
    }

    this.ariaAlertElement.remove();
    this.ariaAlertElement.textContent = textContent;
    this.clearAriaAlert();

    this.ariaAlertTimeout = globalThis.setTimeout(async () => {
      const isFieldFocused = await this.sendExtensionMessage("checkIsFieldCurrentlyFocused");
      if (isFieldFocused || triggeredByUser) {
        this.shadow.appendChild(this.ariaAlertElement);
      }
      this.ariaAlertTimeout = null;
    }, delay);
  }

  /**
   * Clears any existing aria alert that could be announced.
   */
  clearAriaAlert() {
    if (this.ariaAlertTimeout) {
      clearTimeout(this.ariaAlertTimeout);
      this.ariaAlertTimeout = null;
    }
  }

  /**
   * Handles disconnecting the port message listener from the extension background
   * script. This also removes the listener that facilitates announcing to screen
   * readers when the iframe is loaded.
   *
   * @param port - The port that is disconnected
   */
  private handlePortDisconnect = (port: chrome.runtime.Port) => {
    if (port.name !== this.portName) {
      return;
    }

    this.updateElementStyles(this.iframe, { opacity: "0", height: "0px" });
    this.unobserveIframe();
    this.clearAriaAlert();
    this.port?.onMessage.removeListener(this.handlePortMessage);
    this.port?.onDisconnect.removeListener(this.handlePortDisconnect);
    this.port?.disconnect();
    this.port = null;
  };

  /**
   * Handles messages sent from the extension background script to the iframe.
   * Triggers behavior within the iframe as well as on the custom element that
   * contains the iframe element.
   *
   * @param message
   * @param port
   */
  private handlePortMessage = (
    message: AutofillInlineMenuIframeExtensionMessage,
    port: chrome.runtime.Port,
  ) => {
    if (port.name !== this.portName) {
      return;
    }

    if (this.backgroundPortMessageHandlers[message.command]) {
      this.backgroundPortMessageHandlers[message.command]({ message, port });
      return;
    }

    this.postMessageToIFrame(message);
  };

  /**
   * Handles the initialization of the autofill inline menu. This includes setting
   * the port key and sending a message to the iframe to initialize the inline menu.
   *
   * @param message
   * @private
   */
  private initAutofillInlineMenu(message: AutofillInlineMenuIframeExtensionMessage) {
    this.portKey = message.portKey;
    if (message.command === "initAutofillInlineMenuList") {
      this.initAutofillInlineMenuList(message);
      return;
    }

    this.postMessageToIFrame(message);
  }

  /**
   * Handles initialization of the autofill inline menu list. This includes setting
   * the theme and sending a message to the iframe to initialize the inline menu.
   *
   * @param message - The message sent from the iframe
   */
  private initAutofillInlineMenuList(message: AutofillInlineMenuIframeExtensionMessage) {
    const { theme } = message;
    let borderColor: string;
    let verifiedTheme = theme;
    if (verifiedTheme === ThemeTypes.System) {
      verifiedTheme = globalThis.matchMedia("(prefers-color-scheme: dark)").matches
        ? ThemeTypes.Dark
        : ThemeTypes.Light;
    }

    if (verifiedTheme === ThemeTypes.Dark) {
      borderColor = "#4c525f";
    }
    if (borderColor) {
      this.updateElementStyles(this.iframe, { borderColor });
    }

    message.theme = verifiedTheme;
    this.postMessageToIFrame(message);
  }

  private postMessageToIFrame(message: any) {
    this.iframe.contentWindow?.postMessage({ portKey: this.portKey, ...message }, "*");
  }

  /**
   * Updates the position of the iframe element. Will also announce
   * to screen readers that the iframe is open.
   *
   * @param position - The position styles to apply to the iframe
   */
  private updateIframePosition(position: Partial<CSSStyleDeclaration>) {
    if (!globalThis.document.hasFocus()) {
      return;
    }

    const styles = this.fadeInTimeout ? Object.assign(position, { opacity: "0" }) : position;
    this.updateElementStyles(this.iframe, styles);

    if (this.fadeInTimeout) {
      this.handleFadeInInlineMenuIframe();
    }

    this.announceAriaAlert(this.ariaAlert, 2000);
  }

  /**
   * Gets the page color scheme meta tag and sends a message to the iframe
   * to update its color scheme. Will default to "normal" if the meta tag
   * does not exist.
   */
  private updateAutofillInlineMenuColorScheme() {
    const colorSchemeValue = globalThis.document
      .querySelector("meta[name='color-scheme']")
      ?.getAttribute("content");

    this.postMessageToIFrame({
      command: "updateAutofillInlineMenuColorScheme",
      colorScheme: colorSchemeValue || "normal",
    });
  }

  /**
   * Accepts an element and updates the styles for that element. This method
   * will also unobserve the element if it is the iframe element. This is
   * done to ensure that we do not trigger the mutation observer when we
   * update the styles for the iframe.
   *
   * @param customElement - The element to update the styles for
   * @param styles - The styles to apply to the element
   */
  private updateElementStyles(customElement: HTMLElement, styles: Partial<CSSStyleDeclaration>) {
    if (!customElement) {
      return;
    }

    this.unobserveIframe();

    this.setElementStyles(customElement, styles, true);
    if (customElement === this.iframe) {
      this.iframeStyles = { ...this.iframeStyles, ...styles };
    }

    this.observeIframe();
  }

  /**
   * Triggers a forced closure of the autofill inline menu. This is used when the
   * mutation observer is triggered excessively.
   */
  private forceCloseInlineMenu() {
    void this.sendExtensionMessage("closeAutofillInlineMenu", { forceCloseInlineMenu: true });
  }

  /**
   * Triggers a fade in effect for the inline menu iframe. Initialized by the background context.
   */
  private handleFadeInInlineMenuIframe() {
    this.clearFadeInTimeout();
    this.fadeInTimeout = globalThis.setTimeout(() => {
      this.updateElementStyles(this.iframe, { display: "block", opacity: "1" });
      this.clearFadeInTimeout();
    }, 10);
  }

  /**
   * Clears the fade in timeout for the inline menu iframe.
   */
  private clearFadeInTimeout() {
    if (this.fadeInTimeout) {
      clearTimeout(this.fadeInTimeout);
      this.fadeInTimeout = null;
    }
  }

  /**
   * Triggers a delayed closure of the inline menu to ensure that click events are
   * caught if focus is programmatically redirected away from the inline menu.
   */
  private handleDelayedAutofillInlineMenuClosure() {
    if (this.delayedCloseTimeout) {
      clearTimeout(this.delayedCloseTimeout);
    }

    this.updateElementStyles(this.iframe, {
      transition: this.fadeOutOpacityTransition,
      opacity: "0",
    });

    this.delayedCloseTimeout = globalThis.setTimeout(() => {
      this.updateElementStyles(this.iframe, { transition: this.fadeInOpacityTransition });
      this.port?.disconnect();
      this.port = null;
      this.forceCloseInlineMenu();
    }, 100);
  }

  /**
   * Handles updating the generated password in the inline menu iframe. Triggers
   * an aria alert if the user initiated the password regeneration.
   *
   * @param message - The message sent from the iframe
   */
  private handleUpdateGeneratedPassword = (message: AutofillInlineMenuIframeExtensionMessage) => {
    this.postMessageToIFrame(message);

    if (message.refreshPassword) {
      this.clearAriaAlert();
      this.createAriaAlertElement(true);
      this.announceAriaAlert(chrome.i18n.getMessage("passwordRegenerated"), 500, true);
    }
  };

  /**
   * Handles mutations to the iframe element. The ensures that the iframe
   * element's styles are not modified by a third party source.
   *
   * @param mutations - The mutations to the iframe element
   */
  private handleMutations = (mutations: MutationRecord[]) => {
    if (this.isTriggeringExcessiveMutationObserverIterations()) {
      return;
    }

    for (let index = 0; index < mutations.length; index++) {
      const mutation = mutations[index];
      if (mutation.type !== "attributes") {
        continue;
      }

      const element = mutation.target as HTMLElement;
      if (mutation.attributeName !== "style") {
        this.handleElementAttributeMutation(element);

        continue;
      }

      this.iframe.removeAttribute("style");
      this.updateElementStyles(this.iframe, this.iframeStyles);
    }
  };

  /**
   * Handles mutations to the iframe element's attributes. This ensures that
   * the iframe element's attributes are not modified by a third party source.
   *
   * @param element - The element to handle attribute mutations for
   */
  private handleElementAttributeMutation(element: HTMLElement) {
    const attributes = Array.from(element.attributes);
    for (let attributeIndex = 0; attributeIndex < attributes.length; attributeIndex++) {
      const attribute = attributes[attributeIndex];
      if (attribute.name === "style") {
        continue;
      }

      if (this.foreignMutationsCount >= 10) {
        this.forceCloseInlineMenu();
        break;
      }

      const defaultIframeAttribute = this.defaultIframeAttributes[attribute.name];
      if (!defaultIframeAttribute) {
        this.iframe.removeAttribute(attribute.name);
        this.foreignMutationsCount++;
        continue;
      }

      if (attribute.value === defaultIframeAttribute) {
        continue;
      }

      this.iframe.setAttribute(attribute.name, defaultIframeAttribute);
      this.foreignMutationsCount++;
    }
  }

  /**
   * Observes the iframe element for mutations to its style attribute.
   */
  private observeIframe() {
    this.iframeMutationObserver.observe(this.iframe, { attributes: true });
  }

  /**
   * Unobserves the iframe element for mutations to its style attribute.
   */
  private unobserveIframe() {
    this.iframeMutationObserver?.disconnect();
  }

  /**
   * Identifies if the mutation observer is triggering excessive iterations.
   * Will remove the autofill inline menu if any set mutation observer is
   * triggering excessive iterations.
   */
  private isTriggeringExcessiveMutationObserverIterations() {
    const resetCounters = () => {
      this.mutationObserverIterations = 0;
      this.foreignMutationsCount = 0;
    };

    if (this.mutationObserverIterationsResetTimeout) {
      clearTimeout(this.mutationObserverIterationsResetTimeout);
    }

    this.mutationObserverIterations++;
    this.mutationObserverIterationsResetTimeout = globalThis.setTimeout(
      () => resetCounters(),
      2000,
    );

    if (this.mutationObserverIterations > 20) {
      clearTimeout(this.mutationObserverIterationsResetTimeout);
      resetCounters();
      this.forceCloseInlineMenu();

      return true;
    }

    return false;
  }
}
