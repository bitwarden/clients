import {
  AutofillInlineMenuPageElementWindowMessage,
  AutofillInlineMenuPageElementWindowMessageHandlers,
} from "../../abstractions/autofill-inline-menu-page-element";

import { InlineMenuPageChannel } from "./inline-menu-page-channel";

export class AutofillInlineMenuPageElement extends HTMLElement {
  protected shadowDom: ShadowRoot;
  /** Non-null asserted. */
  protected translations!: Record<string, string>;
  private readonly channel = new InlineMenuPageChannel();

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
  ): Promise<HTMLLinkElement> {
    this.channel.setPortKey(portKey);

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
    this.channel.post(message);
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
    this.channel.listen(windowMessageHandlers);
  }
}
