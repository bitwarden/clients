import { AutofillOverlayElement } from "../../../../enums/autofill-overlay.enum";

import { AutofillInlineMenuButton } from "./autofill-inline-menu-button";

// FIXME: Remove when updating file. Eslint update
// eslint-disable-next-line @typescript-eslint/no-require-imports
require("./button.scss");

(function () {
  globalThis.customElements.define(AutofillOverlayElement.Button, AutofillInlineMenuButton);
})();
