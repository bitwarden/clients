import { AutofillOverlayElement } from "../../../../enums/autofill-overlay.enum";

import AutofillOverlayButton from "./autofill-overlay-button.deprecated";

require("./legacy-button.scss");

(function () {
  globalThis.customElements.define(AutofillOverlayElement.Button, AutofillOverlayButton);
})();
