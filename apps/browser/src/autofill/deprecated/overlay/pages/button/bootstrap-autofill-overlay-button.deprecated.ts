import { AutofillOverlayElement } from "../../../../enums/autofill-overlay.enum";

import AutofillOverlayButton from "./autofill-overlay-button.deprecated";

// FIXME: Remove when updating file. Eslint update
// eslint-disable-next-line @typescript-eslint/no-require-imports
require("./legacy-button.scss");

(function () {
  globalThis.customElements.define(AutofillOverlayElement.Button, AutofillOverlayButton);
})();
