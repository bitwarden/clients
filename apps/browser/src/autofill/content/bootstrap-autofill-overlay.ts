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

    // Bridge: handle debug calls dispatched from the page (main world)
    document.addEventListener("__bw_debug_call__", ((event: CustomEvent) => {
      const { id, method, args = [] } = event.detail;
      let value: unknown;
      let error: string | undefined;
      try {
        switch (method) {
          case "exportCurrentSession":
            value = debugService.exportCurrentSession(args[0] ?? "json");
            break;
          case "exportSummary":
            value = debugService.generateSummary(
              Array.from(debugService.sessionStore.keys())[0] ?? "",
            );
            break;
          case "startSession": {
            const sessionId = debugService.startSession(globalThis.location.href, args[0]);
            // eslint-disable-next-line no-console
            console.log(`[Bitwarden Debug] Session started: ${sessionId}`);
            value = sessionId;
            break;
          }
          case "setTracingDepth":
            debugService.setTracingDepth(args[0]);
            // eslint-disable-next-line no-console
            console.log(`[Bitwarden Debug] Tracing depth set to ${args[0]}`);
            break;
          case "getTracingDepth":
            value = debugService.getTracingDepth();
            break;
          case "getSessions":
            value = Array.from(debugService.sessionStore.keys());
            break;
        }
      } catch (e) {
        error = String(e);
      }
      document.dispatchEvent(
        new CustomEvent("__bw_debug_result__", { detail: { id, value, error } }),
      );
    }) as EventListener);

    // Inject page-side API into the main world via a script element.
    // document is shared between worlds so CustomEvents bridge the gap.
    const bridgeScript = document.createElement("script");
    bridgeScript.textContent = `(function(){
  const pending=new Map();
  document.addEventListener('__bw_debug_result__',function(e){
    const {id,value,error}=e.detail,p=pending.get(id);
    if(p){pending.delete(id);error?p.reject(new Error(error)):p.resolve(value);}
  });
  function call(method,...args){
    return new Promise((resolve,reject)=>{
      const id=Math.random().toString(36).slice(2);
      pending.set(id,{resolve,reject});
      document.dispatchEvent(new CustomEvent('__bw_debug_call__',{detail:{id,method,args}}));
    });
  }
  window.__BITWARDEN_AUTOFILL_DEBUG__={
    exportSession:(fmt)=>call('exportCurrentSession',fmt??'json'),
    exportSummary:()=>call('exportSummary'),
    startSession:(name)=>call('startSession',name),
    setTracingDepth:(depth)=>call('setTracingDepth',depth),
    getTracingDepth:()=>call('getTracingDepth'),
    getSessions:()=>call('getSessions'),
  };
})();`;
    (document.head || document.documentElement).appendChild(bridgeScript);
    bridgeScript.remove();

    /* eslint-disable no-console */
    console.log(
      "%c[Bitwarden Debug] Autofill debug mode enabled. Use window.__BITWARDEN_AUTOFILL_DEBUG__",
      "color: #175DDC; font-weight: bold; font-size: 12px",
    );
    console.log("All methods return Promises — use await:");
    console.log("  - await exportSession(format?: 'json' | 'summary' | 'console')");
    console.log("  - await exportSummary()");
    console.log("  - await startSession(name?: string)");
    console.log("  - await setTracingDepth(depth: number)");
    console.log("  - await getTracingDepth()");
    console.log("  - await getSessions()");
    /* eslint-enable no-console */
  }
})(window);
