// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import "@webcomponents/custom-elements";
import "lit/polyfill-support.js";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { EVENTS } from "@bitwarden/common/autofill/constants";

import { buildSvgDomElement } from "../../../../utils";
import { logoIcon, logoLockedIcon } from "../../../../utils/svg-icons";
import {
  InitAutofillOverlayButtonMessage,
  OverlayButtonMessage,
  OverlayButtonWindowMessageHandlers,
} from "../../abstractions/autofill-overlay-button.deprecated";
import AutofillOverlayPageElement from "../shared/autofill-overlay-page-element.deprecated";

class AutofillOverlayButton extends AutofillOverlayPageElement {
  private authStatus: AuthenticationStatus = AuthenticationStatus.LoggedOut;
  private readonly buttonElement: HTMLButtonElement;
  private readonly logoIconElement: HTMLElement;
  private readonly logoLockedIconElement: HTMLElement;
  private readonly overlayButtonWindowMessageHandlers: OverlayButtonWindowMessageHandlers = {
    initAutofillOverlayButton: ({ message }) => this.initAutofillOverlayButton(message),
    checkAutofillOverlayButtonFocused: () => this.checkButtonFocused(),
    updateAutofillOverlayButtonAuthStatus: ({ message }) =>
      this.updateAuthStatus(message.authStatus),
    updateOverlayPageColorScheme: ({ message }) => this.updatePageColorScheme(message),
  };

  constructor() {
    super();

    this.buttonElement = globalThis.document.createElement("button");

    this.setupGlobalListeners(this.overlayButtonWindowMessageHandlers);

    this.logoIconElement = buildSvgDomElement(logoIcon);
    this.logoIconElement.classList.add("overlay-button-svg-icon", "logo-icon");

    this.logoLockedIconElement = buildSvgDomElement(logoLockedIcon);
    this.logoLockedIconElement.classList.add("overlay-button-svg-icon", "logo-locked-icon");
  }

  /**
   * Initializes the overlay button. Facilitates ensuring that the page
   * is set up with the expected styles and translations.
   *
   * @param authStatus - The authentication status of the user
   * @param styleSheetUrl - The URL of the stylesheet to apply to the page
   * @param translations - The translations to apply to the page
   * @private
   */
  private async initAutofillOverlayButton({
    authStatus,
    styleSheetUrl,
    translations,
  }: InitAutofillOverlayButtonMessage) {
    const linkElement = this.initOverlayPage("button", styleSheetUrl, translations);

    this.buttonElement.tabIndex = -1;
    this.buttonElement.type = "button";
    this.buttonElement.classList.add("overlay-button");
    this.buttonElement.setAttribute(
      "aria-label",
      this.getTranslation("toggleBitwardenVaultOverlay"),
    );
    this.buttonElement.addEventListener(EVENTS.CLICK, this.handleButtonElementClick);
    this.postMessageToParent({ command: "getPageColorScheme" });

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
  private updatePageColorScheme({ colorScheme }: OverlayButtonMessage) {
    const colorSchemeMetaTag = globalThis.document.querySelector("meta[name='color-scheme']");
    colorSchemeMetaTag?.setAttribute("content", colorScheme);
  }

  /**
   * Handles a click event on the button element. Posts a message to the
   * parent window indicating that the button was clicked.
   */
  private handleButtonElementClick = () => {
    this.postMessageToParent({ command: "overlayButtonClicked" });
  };

  /**
   * Checks if the button is focused. If it is not, then it posts a message
   * to the parent window indicating that the overlay should be closed.
   */
  private checkButtonFocused() {
    if (globalThis.document.hasFocus()) {
      return;
    }

    this.postMessageToParent({ command: "closeAutofillOverlay" });
  }
}

export default AutofillOverlayButton;
