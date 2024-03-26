import { InlineMenuElements } from "../overlay/content/inline-menu-elements";
import AutofillOverlayContentService from "../services/autofill-overlay-content.service";
import { setupAutofillInitDisconnectAction } from "../utils";

import AutofillInit from "./autofill-init";

(function (windowContext) {
  if (!windowContext.bitwardenAutofillInit) {
    const autofillOverlayContentService = new AutofillOverlayContentService();
    let inlineMenuElements: InlineMenuElements;
    if (globalThis.self === globalThis.top) {
      inlineMenuElements = new InlineMenuElements();
    }
    windowContext.bitwardenAutofillInit = new AutofillInit(
      autofillOverlayContentService,
      inlineMenuElements,
    );
    setupAutofillInitDisconnectAction(windowContext);

    windowContext.bitwardenAutofillInit.init();
  }
})(window);
