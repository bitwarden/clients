import { setupAutofillInitDisconnectAction } from "../../utils";
import LegacyAutofillOverlayContentService from "../services/autofill-overlay-content.service.deprecated";

import LegacyAutofillInit from "./autofill-init.deprecated";

(function (windowContext) {
  if (!windowContext.bitwardenAutofillInit) {
    const autofillOverlayContentService = new LegacyAutofillOverlayContentService();
    windowContext.bitwardenAutofillInit = new LegacyAutofillInit(autofillOverlayContentService);
    setupAutofillInitDisconnectAction(windowContext);

    windowContext.bitwardenAutofillInit.init();
  }
})(window);
