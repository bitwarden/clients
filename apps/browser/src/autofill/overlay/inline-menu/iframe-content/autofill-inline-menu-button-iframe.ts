import { AutofillOverlayPort } from "../../../enums/autofill-overlay.enum";

import { AutofillInlineMenuIframeElement } from "./autofill-inline-menu-iframe-element";

export class AutofillInlineMenuButtonIframe extends AutofillInlineMenuIframeElement {
  constructor(element: HTMLElement) {
    super(
      element,
      AutofillOverlayPort.Button,
      {
        // A fade-in can arrive before the field position. Keep the button out of view until then.
        width: "0px",
        height: "0px",
        background: "transparent",
        border: "none",
        colorScheme: "auto",
      },
      chrome.i18n.getMessage("bitwardenOverlayButton"),
      chrome.i18n.getMessage("bitwardenOverlayMenuAvailable"),
    );
  }
}
