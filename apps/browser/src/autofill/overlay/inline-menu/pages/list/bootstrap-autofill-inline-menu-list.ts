import { AutofillOverlayElement } from "../../../../enums/autofill-overlay.enum";

import { AutofillInlineMenuList } from "./autofill-inline-menu-list";

// FIXME: Remove when updating file. Eslint update
// eslint-disable-next-line @typescript-eslint/no-require-imports
require("./list.scss");

(function () {
  globalThis.customElements.define(AutofillOverlayElement.List, AutofillInlineMenuList);
})();
