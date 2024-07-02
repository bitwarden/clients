import { AutofillOverlayElement } from "../../../../enums/autofill-overlay.enum";

import { AutofillInlineMenuList } from "./autofill-inline-menu-list";

require("./list.scss");

(function () {
  globalThis.customElements.define(AutofillOverlayElement.List, AutofillInlineMenuList);
})();
