import { AutofillInlineMenuContentService } from "../overlay/inline-menu/content/autofill-inline-menu-content.service";
import { AutofillDebugService } from "../services/autofill-debug.service";
import { AutofillOverlayContentService } from "../services/autofill-overlay-content.service";
import DomElementVisibilityService from "../services/dom-element-visibility.service";
import { DomQueryService } from "../services/dom-query.service";
import { InlineMenuFieldQualificationService } from "../services/inline-menu-field-qualification.service";
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

    const debugService = new AutofillDebugService();
    const inlineMenuFieldQualificationService = new InlineMenuFieldQualificationService(
      debugService.isDebugEnabled() ? debugService : undefined,
    );
    if (debugService.isDebugEnabled()) {
      inlineMenuFieldQualificationService.setDebugService(debugService);
    }

    const autofillOverlayContentService = new AutofillOverlayContentService(
      domQueryService,
      domElementVisibilityService,
      inlineMenuFieldQualificationService,
      inlineMenuContentService,
      debugService.isDebugEnabled() ? debugService : undefined,
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
