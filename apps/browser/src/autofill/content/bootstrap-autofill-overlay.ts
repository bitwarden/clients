import { devFlagEnabled } from "../../platform/flags";
import { DebugExportFormat } from "../models/autofill-debug-data";
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

    if (devFlagEnabled("autofillDebugMode")) {
      (windowContext as any).__BITWARDEN_AUTOFILL_DEBUG__ = {
        exportSession: (format: DebugExportFormat = "json") => {
          return debugService.exportCurrentSession(format);
        },
        exportSummary: () => {
          return debugService.generateSummary(
            Array.from(debugService.sessionStore.keys())[0] || "",
          );
        },
        startSession: (name?: string) => {
          const sessionId = debugService.startSession(globalThis.location.href, name);
          // eslint-disable-next-line no-console
          console.log(`[Bitwarden Debug] Session started: ${sessionId}`);
          return sessionId;
        },
        setTracingDepth: (depth: number) => {
          debugService.setTracingDepth(depth);
          // eslint-disable-next-line no-console
          console.log(`[Bitwarden Debug] Precondition tracing depth set to ${depth}`);
        },
        getTracingDepth: () => {
          return debugService.getTracingDepth();
        },
        getSessions: () => {
          return Array.from(debugService.sessionStore.keys());
        },
      };

      /* eslint-disable no-console */
      console.log(
        "%c[Bitwarden Debug] Autofill debug mode enabled. Use window.__BITWARDEN_AUTOFILL_DEBUG__",
        "color: #175DDC; font-weight: bold; font-size: 12px",
      );
      console.log("Available methods:");
      console.log("  - exportSession(format?: 'json' | 'summary' | 'console')");
      console.log("  - exportSummary()");
      console.log("  - startSession(name?: string)  — named sessions are diffable across deploys");
      console.log("  - setTracingDepth(depth: number)");
      console.log("  - getTracingDepth()");
      console.log("  - getSessions()");
      /* eslint-enable no-console */
    }
  }
})(window);
