import { AutofillOverlayElement } from "../../../../enums/autofill-overlay.enum";

import AutofillOverlayList from "./autofill-overlay-list.deprecated";

// FIXME: Remove when updating file. Eslint update
// eslint-disable-next-line @typescript-eslint/no-require-imports
require("./legacy-list.scss");

(function () {
  globalThis.customElements.define(AutofillOverlayElement.List, AutofillOverlayList);
})();
