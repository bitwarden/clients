import { EVENTS } from "@bitwarden/common/autofill/constants";

import { setElementStyles } from "../../../../utils";
import {
  InitAutofillInlineMenuElementMessage,
  AutofillInlineMenuContainerWindowMessageHandlers,
  AutofillInlineMenuContainerWindowMessage,
  AutofillInlineMenuContainerPortMessage,
} from "../../abstractions/autofill-inline-menu-container";

export class AutofillInlineMenuContainer {
  private readonly setElementStyles = setElementStyles;
  private readonly extensionOriginsSet: Set<string>;
  private port: chrome.runtime.Port | null = null;
  private portName!: string;
  private inlineMenuPageIframe!: HTMLIFrameElement;
  private readonly iframeStyles: Partial<CSSStyleDeclaration> = {
    all: "initial",
    position: "fixed",
    top: "0",
    left: "0",
    width: "100%",
    height: "100%",
    display: "block",
    zIndex: "2147483647",
    lineHeight: "0",
    overflow: "hidden",
    visibility: "visible",
    clipPath: "none",
    pointerEvents: "auto",
    margin: "0",
    padding: "0",
    colorScheme: "normal",
  };
  private readonly defaultIframeAttributes: Record<string, string> = {
    src: "",
    title: "",
    sandbox: "allow-scripts",
    allowtransparency: "true",
    tabIndex: "-1",
  };
  private readonly windowMessageHandlers: AutofillInlineMenuContainerWindowMessageHandlers = {
    initAutofillInlineMenuButton: (message: InitAutofillInlineMenuElementMessage) =>
      this.handleInitInlineMenuIframe(message),
    initAutofillInlineMenuList: (message: InitAutofillInlineMenuElementMessage) =>
      this.handleInitInlineMenuIframe(message),
  };

  constructor() {
    this.extensionOriginsSet = new Set([
      chrome.runtime.getURL("").slice(0, -1).toLowerCase(), // Remove the trailing slash and normalize the extension url to lowercase
      "null",
    ]);

    globalThis.addEventListener("message", this.handleWindowMessage);
  }

  /**
   * Handles initialization of the iframe used to display the inline menu.
   *
   * @param message - The message containing the iframe url and page title.
   */
  private handleInitInlineMenuIframe(message: InitAutofillInlineMenuElementMessage) {
    this.defaultIframeAttributes.src = message.iframeUrl;
    this.defaultIframeAttributes.title = message.pageTitle;
    this.portName = message.portName;

    this.inlineMenuPageIframe = globalThis.document.createElement("iframe");
    this.setElementStyles(this.inlineMenuPageIframe, this.iframeStyles, true);
    for (const [attribute, value] of Object.entries(this.defaultIframeAttributes)) {
      this.inlineMenuPageIframe.setAttribute(attribute, value);
    }
    const handleInlineMenuPageIframeLoad = () => {
      this.inlineMenuPageIframe.removeEventListener(EVENTS.LOAD, handleInlineMenuPageIframeLoad);
      this.setupPortMessageListener(message);
    };
    this.inlineMenuPageIframe.addEventListener(EVENTS.LOAD, handleInlineMenuPageIframeLoad);

    globalThis.document.body.appendChild(this.inlineMenuPageIframe);
  }

  /**
   * Sets up the port message listener for the inline menu page.
   *
   * @param message - The message containing the port name.
   */
  private setupPortMessageListener = (message: InitAutofillInlineMenuElementMessage) => {
    this.port = chrome.runtime.connect({ name: this.portName });
    this.postMessageToInlineMenuPage(message);
  };

  /**
   * Posts a message to the inline menu page iframe.
   *
   * @param message - The message to post.
   */
  private postMessageToInlineMenuPage(message: AutofillInlineMenuContainerWindowMessage) {
    if (this.inlineMenuPageIframe?.contentWindow) {
      this.inlineMenuPageIframe.contentWindow.postMessage(message, "*");
    }
  }

  /**
   * Posts a message from the inline menu iframe to the background script.
   *
   * @param message - The message to post.
   */
  private postMessageToBackground(message: AutofillInlineMenuContainerPortMessage) {
    if (this.port) {
      this.port.postMessage(message);
    }
  }

  /**
   * Handles window messages, routing them to the appropriate handler.
   *
   * @param event - The message event.
   */
  private handleWindowMessage = (event: MessageEvent<AutofillInlineMenuContainerWindowMessage>) => {
    const message = event.data;
    if (this.isForeignWindowMessage(event)) {
      return;
    }

    if (
      this.windowMessageHandlers[
        message.command as keyof AutofillInlineMenuContainerWindowMessageHandlers
      ]
    ) {
      this.windowMessageHandlers[
        message.command as keyof AutofillInlineMenuContainerWindowMessageHandlers
      ](message);
      return;
    }

    if (this.isMessageFromParentWindow(event)) {
      this.postMessageToInlineMenuPage(message);
      return;
    }

    this.postMessageToBackground(message);
  };

  /**
   * Identifies if the message is from a foreign window. A foreign window message is
   * considered as any message that does not have a portKey, is not from the parent window,
   * or is not from the inline menu page iframe.
   *
   * @param event - The message event.
   */
  private isForeignWindowMessage(event: MessageEvent<AutofillInlineMenuContainerWindowMessage>) {
    if (!event.data?.portKey) {
      return true;
    }

    if (this.isMessageFromParentWindow(event)) {
      return false;
    }

    return !this.isMessageFromInlineMenuPageIframe(event);
  }

  /**
   * Identifies if the message is from the parent window.
   *
   * @param event - The message event.
   */
  private isMessageFromParentWindow(
    event: MessageEvent<AutofillInlineMenuContainerWindowMessage>,
  ): boolean {
    return globalThis.parent === event.source;
  }

  /**
   * Identifies if the message is from the inline menu page iframe.
   *
   * @param event - The message event.
   */
  private isMessageFromInlineMenuPageIframe(
    event: MessageEvent<AutofillInlineMenuContainerWindowMessage>,
  ): boolean {
    if (!this.inlineMenuPageIframe) {
      return false;
    }

    return (
      this.inlineMenuPageIframe.contentWindow === event.source &&
      this.extensionOriginsSet.has(event.origin.toLowerCase())
    );
  }
}
