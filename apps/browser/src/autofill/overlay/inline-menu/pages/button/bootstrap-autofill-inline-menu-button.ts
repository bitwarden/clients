import { AutofillOverlayElement } from "../../../../enums/autofill-overlay.enum";

import { AutofillInlineMenuButton } from "./autofill-inline-menu-button";

require("./button.scss");

(function () {
  globalThis.customElements.define(AutofillOverlayElement.Button, AutofillInlineMenuButton);
})();
