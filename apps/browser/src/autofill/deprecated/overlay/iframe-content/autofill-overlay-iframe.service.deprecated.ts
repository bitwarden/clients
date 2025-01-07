// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { EVENTS } from "@bitwarden/common/autofill/constants";
import { ThemeTypes } from "@bitwarden/common/platform/enums";

import { setElementStyles } from "../../../utils";
import {
  BackgroundPortMessageHandlers,
  AutofillOverlayIframeService as AutofillOverlayIframeServiceInterface,
  AutofillOverlayIframeExtensionMessage,
  AutofillOverlayIframeWindowMessageHandlers,
} from "../abstractions/autofill-overlay-iframe.service.deprecated";

class AutofillOverlayIframeService implements AutofillOverlayIframeServiceInterface {
  private port: chrome.runtime.Port | null = null;
  private extensionOriginsSet: Set<string>;
  private iframeMutationObserver: MutationObserver;
  private iframe: HTMLIFrameElement;
  private ariaAlertElement: HTMLDivElement;
  private ariaAlertTimeout: number | NodeJS.Timeout;
  private iframeStyles: Partial<CSSStyleDeclaration> = {
    all: "initial",
    position: "fixed",
    display: "block",
    zIndex: "2147483647",
    lineHeight: "0",
    overflow: "hidden",
    transition: "opacity 125ms ease-out 0s",
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
    sandbox: "allow-scripts",
    allowtransparency: "true",
    tabIndex: "-1",
  };
  private foreignMutationsCount = 0;
  private mutationObserverIterations = 0;
  private mutationObserverIterationsResetTimeout: number | NodeJS.Timeout;
  private readonly windowMessageHandlers: AutofillOverlayIframeWindowMessageHandlers = {
    updateAutofillOverlayListHeight: (message) =>
      this.updateElementStyles(this.iframe, message.styles),
    getPageColorScheme: () => this.updateOverlayPageColorScheme(),
  };
  private readonly backgroundPortMessageHandlers: BackgroundPortMessageHandlers = {
    initAutofillOverlayList: ({ message }) => this.initAutofillOverlayList(message),
    updateIframePosition: ({ message }) => this.updateIframePosition(message.styles),
    updateOverlayHidden: ({ message }) => this.updateElementStyles(this.iframe, message.styles),
  };

  constructor(
    private iframePath: string,
    private portName: string,
    private shadow: ShadowRoot,
  ) {
    this.extensionOriginsSet = new Set([
      chrome.runtime.getURL("").slice(0, -1).toLowerCase(), // Remove the trailing slash and normalize the extension url to lowercase
      "null",
    ]);

    this.iframeMutationObserver = new MutationObserver(this.handleMutations);
  }

  /**
   * Handles initialization of the iframe which includes applying initial styles
   * to the iframe, setting the source, and adding listener that connects the
   * iframe to the background script each time it loads. Can conditionally
   * create an aria alert element to announce to screen readers when the iframe
   * is loaded. The end result is append to the shadowDOM of the custom element
   * that is declared.
   *
   *
   * @param initStyles - Initial styles to apply to the iframe
   * @param iframeTitle - Title to apply to the iframe
   * @param ariaAlert - Text to announce to screen readers when the iframe is loaded
   */
  initOverlayIframe(
    initStyles: Partial<CSSStyleDeclaration>,
    iframeTitle: string,
    ariaAlert?: string,
  ) {
    this.defaultIframeAttributes.src = chrome.runtime.getURL(this.iframePath);
    this.defaultIframeAttributes.title = iframeTitle;

    this.iframe = globalThis.document.createElement("iframe");
    this.updateElementStyles(this.iframe, { ...this.iframeStyles, ...initStyles });
    for (const [attribute, value] of Object.entries(this.defaultIframeAttributes)) {
      this.iframe.setAttribute(attribute, value);
    }
    this.iframe.addEventListener(EVENTS.LOAD, this.setupPortMessageListener);

    if (ariaAlert) {
      this.createAriaAlertElement(ariaAlert);
    }

    this.shadow.appendChild(this.iframe);
  }

  /**
   * Creates an aria alert element that is used to announce to screen readers
   * when the iframe is loaded.
   *
   * @param ariaAlertText - Text to announce to screen readers when the iframe is loaded
   */
  private createAriaAlertElement(ariaAlertText: string) {
    this.ariaAlertElement = globalThis.document.createElement("div");
    this.ariaAlertElement.setAttribute("role", "status");
    this.ariaAlertElement.setAttribute("aria-live", "polite");
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
    this.ariaAlertElement.textContent = ariaAlertText;
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
    globalThis.addEventListener(EVENTS.MESSAGE, this.handleWindowMessage);

    this.announceAriaAlert();
  };

  /**
   * Announces the aria alert element to screen readers when the iframe is loaded.
   */
  private announceAriaAlert() {
    if (!this.ariaAlertElement) {
      return;
    }

    this.ariaAlertElement.remove();
    if (this.ariaAlertTimeout) {
      clearTimeout(this.ariaAlertTimeout);
    }

    this.ariaAlertTimeout = setTimeout(() => this.shadow.appendChild(this.ariaAlertElement), 2000);
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

    this.updateElementStyles(this.iframe, { opacity: "0", height: "0px", display: "block" });
    globalThis.removeEventListener("message", this.handleWindowMessage);
    this.unobserveIframe();
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
    message: AutofillOverlayIframeExtensionMessage,
    port: chrome.runtime.Port,
  ) => {
    if (port.name !== this.portName) {
      return;
    }

    if (this.backgroundPortMessageHandlers[message.command]) {
      this.backgroundPortMessageHandlers[message.command]({ message, port });
      return;
    }

    this.iframe.contentWindow?.postMessage(message, "*");
  };

  /**
   * Handles messages sent from the iframe to the extension background script.
   * Will adjust the border element to fit the user's set theme.
   *
   * @param message - The message sent from the iframe
   */
  private initAutofillOverlayList(message: AutofillOverlayIframeExtensionMessage) {
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
    if (theme === ThemeTypes.Nord) {
      borderColor = "#2E3440";
    }
    if (theme === ThemeTypes.SolarizedDark) {
      borderColor = "#073642";
    }
    if (borderColor) {
      this.updateElementStyles(this.iframe, { borderColor });
    }

    message.theme = verifiedTheme;
    this.iframe.contentWindow?.postMessage(message, "*");
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

    this.updateElementStyles(this.iframe, position);
    setTimeout(() => this.updateElementStyles(this.iframe, { opacity: "1" }), 0);
    this.announceAriaAlert();
  }

  /**
   * Gets the page color scheme meta tag and sends a message to the iframe
   * to update its color scheme. Will default to "normal" if the meta tag
   * does not exist.
   */
  private updateOverlayPageColorScheme() {
    const colorSchemeValue = globalThis.document
      .querySelector("meta[name='color-scheme']")
      ?.getAttribute("content");

    this.iframe.contentWindow?.postMessage(
      { command: "updateOverlayPageColorScheme", colorScheme: colorSchemeValue || "normal" },
      "*",
    );
  }

  /**
   * Handles messages sent from the iframe. If the message does not have a
   * specified handler set, it passes the message to the background script.
   *
   * @param event - The message event
   */
  private handleWindowMessage = (event: MessageEvent) => {
    if (
      !this.port ||
      event.source !== this.iframe.contentWindow ||
      !this.isFromExtensionOrigin(event.origin.toLowerCase())
    ) {
      return;
    }

    const message = event.data;
    if (this.windowMessageHandlers[message.command]) {
      this.windowMessageHandlers[message.command](message);
      return;
    }

    this.port.postMessage(event.data);
  };

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

    setElementStyles(customElement, styles, true);
    this.iframeStyles = { ...this.iframeStyles, ...styles };

    this.observeIframe();
  }

  /**
   * Chrome returns null for any sandboxed iframe sources.
   * Firefox references the extension URI as its origin.
   * Any other origin value is a security risk.
   *
   * @param messageOrigin - The origin of the window message
   */
  private isFromExtensionOrigin(messageOrigin: string): boolean {
    return this.extensionOriginsSet.has(messageOrigin);
  }

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
        this.port?.postMessage({ command: "forceCloseAutofillOverlay" });
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
   * Will remove the autofill overlay if any set mutation observer is
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
    this.mutationObserverIterationsResetTimeout = setTimeout(() => resetCounters(), 2000);

    if (this.mutationObserverIterations > 20) {
      clearTimeout(this.mutationObserverIterationsResetTimeout);
      resetCounters();
      this.port?.postMessage({ command: "forceCloseAutofillOverlay" });

      return true;
    }

    return false;
  }
}

export default AutofillOverlayIframeService;
