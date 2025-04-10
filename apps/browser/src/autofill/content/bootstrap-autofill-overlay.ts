// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { AutofillInlineMenuContentService } from "../overlay/inline-menu/content/autofill-inline-menu-content.service";
import { OverlayNotificationsContentService } from "../overlay/notifications/content/overlay-notifications-content.service";
import { AutofillOverlayContentService } from "../services/autofill-overlay-content.service";
import DomElementVisibilityService from "../services/dom-element-visibility.service";
import { DomQueryService } from "../services/dom-query.service";
import { InlineMenuFieldQualificationService } from "../services/inline-menu-field-qualification.service";
import { setupAutofillInitDisconnectAction } from "../utils";

import AutofillInit from "./autofill-init";

(function (windowContext) {
  if (!windowContext.bitwardenAutofillInit) {
    let inlineMenuContentService: AutofillInlineMenuContentService;
    let overlayNotificationsContentService: OverlayNotificationsContentService;
    if (globalThis.self === globalThis.top) {
      inlineMenuContentService = new AutofillInlineMenuContentService();
      overlayNotificationsContentService = new OverlayNotificationsContentService();
    }

    const domQueryService = new DomQueryService();
    const domElementVisibilityService = new DomElementVisibilityService(inlineMenuContentService);
    const inlineMenuFieldQualificationService = new InlineMenuFieldQualificationService();
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
      overlayNotificationsContentService,
    );
    setupAutofillInitDisconnectAction(windowContext);

    windowContext.bitwardenAutofillInit.init();
  }
})(window);
