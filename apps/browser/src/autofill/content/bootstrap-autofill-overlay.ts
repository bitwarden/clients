import { AutofillInlineMenuContentService } from "../overlay/inline-menu/content/autofill-inline-menu-content.service";
import { OverlayNotificationsContentService } from "../overlay/notifications/content/overlay-notifications-content.service";
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
    let overlayNotificationsContentService: undefined | OverlayNotificationsContentService;
    if (globalThis.self === globalThis.top) {
      inlineMenuContentService = new AutofillInlineMenuContentService();
      overlayNotificationsContentService = new OverlayNotificationsContentService();
    }

    const domQueryService = new DomQueryService();
    const domElementVisibilityService = new DomElementVisibilityService(inlineMenuContentService);

    const debugService = new AutofillDebugService();
    const inlineMenuFieldQualificationService = new InlineMenuFieldQualificationService();
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
      overlayNotificationsContentService,
    );
    setupAutofillInitDisconnectAction(windowContext);

    windowContext.bitwardenAutofillInit.init();

    // eslint-disable-next-line no-console
    console.log(
      "%c[Bitwarden AutoTriage] Active — qualification decisions will log below. Right-click any element → Bitwarden → Copy autofill debug info.",
      "color: #175DDC; font-weight: bold",
    );
  }
})(window);
