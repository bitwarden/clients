import { AutofillOverlayElement } from "../../../../enums/autofill-overlay.enum";

import { AutofillInlineMenuButton } from "./autofill-inline-menu-button";
import "./button.css";

(function () {
  globalThis.customElements.define(AutofillOverlayElement.Button, AutofillInlineMenuButton);
})();
