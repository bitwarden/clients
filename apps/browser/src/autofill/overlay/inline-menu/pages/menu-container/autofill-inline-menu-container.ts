import { EVENTS } from "@bitwarden/common/autofill/constants";

import { BrowserApi } from "../../../../../platform/browser/browser-api";
import { generateRandomChars, setElementStyles } from "../../../../utils";
import {
  InitAutofillInlineMenuElementMessage,
  AutofillInlineMenuContainerWindowMessageHandlers,
  AutofillInlineMenuContainerWindowMessage,
  AutofillInlineMenuContainerPortMessage,
} from "../../abstractions/autofill-inline-menu-container";

/**
 * Allowlist of commands that can be sent to the background script.
 */
const ALLOWED_BG_COMMANDS = new Set<string>([
  "addNewVaultItem",
  "autofillInlineMenuBlurred",
  "autofillInlineMenuButtonClicked",
  "checkAutofillInlineMenuButtonFocused",
  "checkInlineMenuButtonFocused",
  "fillAutofillInlineMenuCipher",
  "fillGeneratedPassword",
  "redirectAutofillInlineMenuFocusOut",
  "refreshGeneratedPassword",
  "refreshOverlayCiphers",
  "triggerDelayedAutofillInlineMenuClosure",
  "updateAutofillInlineMenuColorScheme",
  "updateAutofillInlineMenuListHeight",
  "unlockVault",
  "viewSelectedCipher",
]);

export class AutofillInlineMenuContainer {
  private readonly setElementStyles = setElementStyles;
  private port: chrome.runtime.Port | null = null;
  /** Non-null asserted. */
  private portName!: string;
  /** Non-null asserted. */
  private inlineMenuPageIframe!: HTMLIFrameElement;
  private token: string;
  private isInitialized: boolean = false;
  private readonly extensionOrigin: string;
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
    this.token = generateRandomChars(32);
    this.extensionOrigin = BrowserApi.getRuntimeURL("")?.slice(0, -1);
    globalThis.addEventListener("message", this.handleWindowMessage);
  }

  /**
   * Handles initialization of the iframe used to display the inline menu.
   *
   * @param message - The message containing the iframe url and page title.
   */
  private handleInitInlineMenuIframe(message: InitAutofillInlineMenuElementMessage) {
    if (this.isInitialized) {
      return;
    }

    if (!this.isExtensionUrl(message.iframeUrl)) {
      return;
    }

    if (message.styleSheetUrl && !this.isExtensionUrl(message.styleSheetUrl)) {
      return;
    }

    this.defaultIframeAttributes.src = message.iframeUrl;
    this.defaultIframeAttributes.title = message.pageTitle;
    this.portName = message.portName;
    this.isInitialized = true;

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
   * validates that a URL is from the extension origin.
   * prevents loading arbitrary URLs in the iframe.
   *
   * @param url - The URL to validate.
   */
  private isExtensionUrl(url: string): boolean {
    if (!url) {
      return false;
    }
    try {
      const urlObj = new URL(url);
      return (
        urlObj.origin === this.extensionOrigin || urlObj.href.startsWith(this.extensionOrigin + "/")
      );
    } catch {
      return false;
    }
  }

  /**
   * Sets up the port message listener for the inline menu page.
   *
   * @param message - The message containing the port name.
   */
  private setupPortMessageListener = (message: InitAutofillInlineMenuElementMessage) => {
    this.port = chrome.runtime.connect({ name: this.portName });
    const initMessage = { ...message, token: this.token };
    this.postMessageToInlineMenuPageUnsafe(initMessage);
  };

  /**
   * Posts a message to the inline menu page iframe.
   *
   * @param message - The message to post.
   */
  private postMessageToInlineMenuPage(message: AutofillInlineMenuContainerWindowMessage) {
    if (this.inlineMenuPageIframe?.contentWindow) {
      const messageWithToken = { ...message, token: this.token };
      this.postMessageToInlineMenuPageUnsafe(messageWithToken);
    }
  }

  /**
   * Posts a message to the inline menu page iframe without token validation.
   *
   * UNSAFE: Bypasses token authentication and sends raw messages. Only use internally
   * when sending trusted messages (e.g., initialization) or when token validation
   * would create circular dependencies. External callers should use postMessageToInlineMenuPage().
   *
   * @param message - The message to post.
   */
  private postMessageToInlineMenuPageUnsafe(message: Record<string, unknown>) {
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
    if (!this.port) {
      return;
    }

    if (message.command && !ALLOWED_BG_COMMANDS.has(message.command)) {
      return;
    }

    this.port.postMessage(message);
  }

  /**
   * Handles window messages, routing them to the appropriate handler.
   *
   * @param event - The message event.
   */
  private handleWindowMessage = (event: MessageEvent<AutofillInlineMenuContainerWindowMessage>) => {
    const message = event.data;
    if (!message?.command) {
      return;
    }
    if (this.isForeignWindowMessage(event)) {
      return;
    }

    if (this.windowMessageHandlers[message.command]) {
      // only accept init messages from extension origin or parent window
      if (
        (message.command === "initAutofillInlineMenuButton" ||
          message.command === "initAutofillInlineMenuList") &&
        !this.isMessageFromExtensionOrigin(event) &&
        !this.isMessageFromParentWindow(event)
      ) {
        return;
      }
      this.windowMessageHandlers[message.command](message);
      return;
    }

    if (this.isMessageFromParentWindow(event)) {
      // messages from parent window are trusted and forwarded to iframe
      this.postMessageToInlineMenuPage(message);
      return;
    }

    // messages from iframe to background require object identity verification with a contentWindow check and token auth
    if (this.isMessageFromInlineMenuPageIframe(event)) {
      if (this.isValidSessionToken(message)) {
        this.postMessageToBackground(message);
      }
      return;
    }
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
    // only trust the specific iframe we created
    return this.inlineMenuPageIframe.contentWindow === event.source;
  }

  /**
   * Validates that the message contains a valid session token.
   * The session token is generated when the container is created and is refreshed
   * every time the inline menu container is recreated.
   *
   */
  private isValidSessionToken(message: { token: string }): boolean {
    if (!this.token || !message?.token || !message?.token.length) {
      return false;
    }
    return message.token === this.token;
  }

  /**
   * Validates that a message event originates from the extension.
   *
   * @param event - The message event to validate.
   * @returns True if the message is from the extension origin.
   */
  private isMessageFromExtensionOrigin(event: MessageEvent): boolean {
    try {
      if (event.origin === "null") {
        return false;
      }
      return event.origin === this.extensionOrigin;
    } catch {
      return false;
    }
  }
}
