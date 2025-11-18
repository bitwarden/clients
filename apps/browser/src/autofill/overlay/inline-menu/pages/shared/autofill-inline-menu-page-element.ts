import { EVENTS } from "@bitwarden/common/autofill/constants";

import { RedirectFocusDirection } from "../../../../enums/autofill-overlay.enum";
import {
  AutofillInlineMenuPageElementWindowMessage,
  AutofillInlineMenuPageElementWindowMessageHandlers,
} from "../../abstractions/autofill-inline-menu-page-element";

export class AutofillInlineMenuPageElement extends HTMLElement {
  protected shadowDom: ShadowRoot;
  /** Non-null asserted. */
  protected messageOrigin!: string;
  /** Non-null asserted. */
  protected translations!: Record<string, string>;
  /** Non-null asserted. */
  private portKey!: string;
  /** Non-null asserted. */
  protected windowMessageHandlers!: AutofillInlineMenuPageElementWindowMessageHandlers;
  private token?: string;

  constructor() {
    super();

    this.shadowDom = this.attachShadow({ mode: "closed" });
  }

  /**
   * Initializes the inline menu page element. Facilitates ensuring that the page
   * is set up with the expected styles and translations.
   *
   * @param elementName - The name of the element, e.g. "button" or "list"
   * @param styleSheetUrl - The URL of the stylesheet to apply to the page
   * @param translations - The translations to apply to the page
   * @param portKey - Background generated key that allows the port to communicate with the background
   */
  protected async initAutofillInlineMenuPage(
    elementName: "button" | "list",
    styleSheetUrl: string,
    translations: Record<string, string>,
    portKey: string,
    token?: string,
  ): Promise<HTMLLinkElement> {
    this.portKey = portKey;
    if (token) {
      this.token = token;
    }

    this.translations = translations;
    globalThis.document.documentElement.setAttribute("lang", this.getTranslation("locale"));
    globalThis.document.head.title = this.getTranslation(`${elementName}PageTitle`);

    this.shadowDom.innerHTML = "";
    const linkElement = globalThis.document.createElement("link");
    linkElement.setAttribute("rel", "stylesheet");
    linkElement.setAttribute("href", styleSheetUrl);

    return linkElement;
  }

  /**
   * Posts a window message to the parent window.
   *
   * @param message - The message to post
   */
  protected postMessageToParent(message: AutofillInlineMenuPageElementWindowMessage) {
    const messageWithAuth: Record<string, unknown> = {
      portKey: this.portKey,
      ...message,
      token: this.token,
    };
    globalThis.parent.postMessage(messageWithAuth, "*");
  }

  /**
   * Gets a translation from the translations object.
   *
   * @param key - The key of the translation to get
   */
  protected getTranslation(key: string): string {
    return this.translations[key] || "";
  }

  /**
   * Sets up global listeners for the window message, window blur, and
   * document keydown events.
   *
   * @param windowMessageHandlers - The window message handlers to use
   */
  protected setupGlobalListeners(
    windowMessageHandlers: AutofillInlineMenuPageElementWindowMessageHandlers,
  ) {
    this.windowMessageHandlers = windowMessageHandlers;

    globalThis.addEventListener(EVENTS.MESSAGE, this.handleWindowMessage);
    globalThis.addEventListener(EVENTS.BLUR, this.handleWindowBlurEvent);
    globalThis.document.addEventListener(EVENTS.KEYDOWN, this.handleDocumentKeyDownEvent);
  }

  /**
   * Handles window messages from the parent window.
   *
   * @param event - The window message event
   */
  private handleWindowMessage = (event: MessageEvent) => {
    if (!this.windowMessageHandlers) {
      return;
    }

    if (event.source !== globalThis.parent) {
      return;
    }

    if (!this.messageOrigin) {
      this.messageOrigin = event.origin;
    }

    if (event.origin !== this.messageOrigin) {
      return;
    }

    const message = event?.data;

    if (!message?.command) {
      return;
    }

    const isInitCommand =
      message.command === "initAutofillInlineMenuButton" ||
      message.command === "initAutofillInlineMenuList";

    if (isInitCommand) {
      if (!message?.token) {
        return;
      }
      this.token = message.token;
    } else {
      if (message?.token !== this.token) {
        return;
      }
    }

    const handler = this.windowMessageHandlers[message?.command];
    if (!handler) {
      return;
    }

    handler({ message });
  };

  /**
   * Handles the window blur event.
   */
  private handleWindowBlurEvent = () => {
    this.postMessageToParent({ command: "autofillInlineMenuBlurred" });
  };

  /**
   * Handles the document keydown event. Facilitates redirecting the
   * user focus in the right direction out of the inline menu. Also facilitates
   * closing the inline menu when the user presses the Escape key.
   *
   * @param event - The document keydown event
   */
  private handleDocumentKeyDownEvent = (event: KeyboardEvent) => {
    const listenedForKeys = new Set(["Tab", "Escape", "ArrowUp", "ArrowDown"]);
    if (!listenedForKeys.has(event.code)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (event.code === "Tab") {
      this.sendRedirectFocusOutMessage(
        event.shiftKey ? RedirectFocusDirection.Previous : RedirectFocusDirection.Next,
      );
      return;
    }

    if (event.code === "Escape") {
      this.sendRedirectFocusOutMessage(RedirectFocusDirection.Current);
    }
  };

  /**
   * Redirects the inline menu focus out to the previous element on KeyDown of the `Tab+Shift` keys.
   * Redirects the inline menu focus out to the next element on KeyDown of the `Tab` key.
   * Redirects the inline menu focus out to the current element on KeyDown of the `Escape` key.
   *
   * @param direction - The direction to redirect the focus out
   */
  private sendRedirectFocusOutMessage(direction: string) {
    this.postMessageToParent({ command: "redirectAutofillInlineMenuFocusOut", direction });
  }
}
