import DomElementVisibilityService from "../services/dom-element-visibility.service";
import { DomQueryService } from "../services/dom-query.service";
import { setupAutofillInitDisconnectAction } from "../utils";

import AutofillInit from "./autofill-init";
import { enableInstrumentation, useTimeoutForFlush } from "./performance";

(function (windowContext) {
  if (!windowContext.bitwardenAutofillInit) {
    if (process.env.BW_INCLUDE_CONTENT_SCRIPT_MEASUREMENTS) {
      enableInstrumentation();
      useTimeoutForFlush();
    }

    const domQueryService = new DomQueryService();
    const domElementVisibilityService = new DomElementVisibilityService();
    windowContext.bitwardenAutofillInit = new AutofillInit(
      domQueryService,
      domElementVisibilityService,
    );
    setupAutofillInitDisconnectAction(windowContext);

    windowContext.bitwardenAutofillInit.init();
  }
})(window);
