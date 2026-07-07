import "@webcomponents/custom-elements";
import "lit/polyfill-support.js";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { EVENTS } from "@bitwarden/common/autofill/constants";

import { buildSvgDomElement } from "../../../../utils";
import { logoIcon, logoLockedIcon } from "../../../../utils/svg-icons";
import {
  InitAutofillInlineMenuButtonMessage,
  AutofillInlineMenuButtonMessage,
  AutofillInlineMenuButtonWindowMessageHandlers,
} from "../../abstractions/autofill-inline-menu-button";
import { AutofillInlineMenuPageElement } from "../shared/autofill-inline-menu-page-element";

export class AutofillInlineMenuButton extends AutofillInlineMenuPageElement {
  private authStatus: AuthenticationStatus = AuthenticationStatus.LoggedOut;
  private readonly buttonElement: HTMLButtonElement;
  private readonly logoIconElement: HTMLElement;
  private readonly logoLockedIconElement: HTMLElement;
  private readonly inlineMenuButtonWindowMessageHandlers: AutofillInlineMenuButtonWindowMessageHandlers =
    {
      initAutofillInlineMenuButton: ({ message }) => this.initAutofillInlineMenuButton(message),
      checkAutofillInlineMenuButtonFocused: () => this.checkButtonFocused(),
      updateAutofillInlineMenuButtonAuthStatus: ({ message }) =>
        this.updateAuthStatus(message.authStatus),
      updateAutofillInlineMenuColorScheme: ({ message }) => this.updatePageColorScheme(message),
    };

  constructor() {
    super();

    this.buttonElement = globalThis.document.createElement("button");

    this.setupGlobalListeners(this.inlineMenuButtonWindowMessageHandlers);

    this.logoIconElement = buildSvgDomElement(logoIcon);
    this.logoIconElement.classList.add("inline-menu-button-svg-icon", "logo-icon");

    this.logoLockedIconElement = buildSvgDomElement(logoLockedIcon);
    this.logoLockedIconElement.classList.add("inline-menu-button-svg-icon", "logo-locked-icon");
  }

  /**
   * Initializes the inline menu button. Facilitates ensuring that the page
   * is set up with the expected styles and translations.
   *
   * @param authStatus - The authentication status of the user
   * @param styleSheetUrl - The URL of the stylesheet to apply to the page
   * @param translations - The translations to apply to the page
   * @param portKey - Background generated key that allows the port to communicate with the background
   */
  private async initAutofillInlineMenuButton({
    authStatus,
    styleSheetUrl,
    translations,
    portKey,
  }: InitAutofillInlineMenuButtonMessage) {
    const linkElement = await this.initAutofillInlineMenuPage(
      "button",
      styleSheetUrl,
      translations,
      portKey,
    );
    this.buttonElement.tabIndex = -1;
    this.buttonElement.type = "button";
    this.buttonElement.classList.add("inline-menu-button");
    this.buttonElement.setAttribute(
      "aria-label",
      this.getTranslation("toggleBitwardenVaultOverlay"),
    );
    this.buttonElement.addEventListener(EVENTS.CLICK, this.handleButtonElementClick);
    this.postMessageToParent({ command: "updateAutofillInlineMenuColorScheme" });

    this.updateAuthStatus(authStatus);

    this.shadowDom.append(linkElement, this.buttonElement);
  }

  /**
   * Updates the authentication status of the user. This will update the icon
   * displayed on the button.
   *
   * @param authStatus - The authentication status of the user
   */
  private updateAuthStatus(authStatus: AuthenticationStatus) {
    this.authStatus = authStatus;

    this.buttonElement.innerHTML = "";
    const iconElement =
      this.authStatus === AuthenticationStatus.Unlocked
        ? this.logoIconElement
        : this.logoLockedIconElement;
    this.buttonElement.append(iconElement);
  }

  /**
   * Handles updating the page color scheme meta tag. Ensures that the button
   * does not present with a non-transparent background on dark mode pages.
   *
   * @param colorScheme - The color scheme of the iframe's parent page
   */
  private updatePageColorScheme({ colorScheme }: AutofillInlineMenuButtonMessage) {
    const colorSchemeMetaTag = globalThis.document.querySelector("meta[name='color-scheme']");

    if (colorSchemeMetaTag && colorScheme) {
      colorSchemeMetaTag.setAttribute("content", colorScheme);
    }
  }

  /**
   * Handles a click event on the button element. Posts a message to the
   * parent window indicating that the button was clicked.
   */
  private handleButtonElementClick = () => {
    this.postMessageToParent({ command: "autofillInlineMenuButtonClicked" });
  };

  /**
   * Checks if the button is focused. If it is not, then it posts a message
   * to the parent window indicating that the inline menu should be closed.
   */
  private checkButtonFocused() {
    if (globalThis.document.hasFocus()) {
      return;
    }

    if (this.isButtonHovered()) {
      globalThis.document.addEventListener(EVENTS.MOUSEOUT, this.handleMouseOutEvent);
      return;
    }

    this.postMessageToParent({ command: "triggerDelayedAutofillInlineMenuClosure" });
  }

  /**
   * Triggers a re-check of the button's focus status when the mouse leaves the button.
   */
  private handleMouseOutEvent = () => {
    globalThis.document.removeEventListener(EVENTS.MOUSEOUT, this.handleMouseOutEvent);
    this.checkButtonFocused();
  };

  /**
   * Identifies whether the button is currently hovered.
   */
  private isButtonHovered() {
    const hoveredElement = this.buttonElement?.querySelector(":hover");
    return !!(
      hoveredElement &&
      (hoveredElement === this.buttonElement || this.buttonElement.contains(hoveredElement))
    );
  }
}
