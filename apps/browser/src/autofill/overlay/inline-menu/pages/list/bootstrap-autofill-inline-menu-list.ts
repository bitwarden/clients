import { AutofillOverlayElement } from "../../../../enums/autofill-overlay.enum";

import { AutofillInlineMenuList } from "./autofill-inline-menu-list";

// SCSS compiles once to CSS custom properties; list.css consumes var(--token)
// eslint-disable-next-line @typescript-eslint/no-require-imports
require("../../../../shared/styles/theme.scss");
// eslint-disable-next-line @typescript-eslint/no-require-imports
require("./list.css");

(function () {
  globalThis.customElements.define(AutofillOverlayElement.List, AutofillInlineMenuList);
})();
