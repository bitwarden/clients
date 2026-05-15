import { AutofillInlineMenuContentService } from "../overlay/inline-menu/content/autofill-inline-menu-content.service";
import { AutofillOverlayContentService } from "../services/autofill-overlay-content.service";
import DomElementVisibilityService from "../services/dom-element-visibility.service";
import { DomQueryService } from "../services/dom-query.service";
import { createInlineMenuFieldQualificationService } from "../services/qualification/qualification-service.factory";
import { setupAutofillInitDisconnectAction } from "../utils";

import AutofillInit from "./autofill-init";

(function (windowContext) {
  if (!windowContext.bitwardenAutofillInit) {
    let inlineMenuContentService: undefined | AutofillInlineMenuContentService;
    if (globalThis.self === globalThis.top) {
      inlineMenuContentService = new AutofillInlineMenuContentService();
    }

    const domQueryService = new DomQueryService();
    const domElementVisibilityService = new DomElementVisibilityService(inlineMenuContentService);
    const inlineMenuFieldQualificationService = createInlineMenuFieldQualificationService(false);
    const autofillOverlayContentService = new AutofillOverlayContentService(
      domQueryService,
      domElementVisibilityService,
      inlineMenuFieldQualificationService,
      inlineMenuContentService,
    );

    windowContext.bitwardenAutofillInit = new AutofillInit(
      domQueryService,
      domElementVisibilityService,
      autofillOverlayContentService,
      inlineMenuContentService,
    );
    setupAutofillInitDisconnectAction(windowContext);

    windowContext.bitwardenAutofillInit.init();
  }
})(window);
