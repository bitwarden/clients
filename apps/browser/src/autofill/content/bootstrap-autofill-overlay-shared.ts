import { AutofillInlineMenuContentService } from "../overlay/inline-menu/content/autofill-inline-menu-content.service";
import { OverlayNotificationsContentService } from "../overlay/notifications/content/overlay-notifications-content.service";
import { AutofillOverlayContentService } from "../services/autofill-overlay-content.service";
import DomElementVisibilityService from "../services/dom-element-visibility.service";
import { DomQueryService } from "../services/dom-query.service";
import { logEngineSelection, resolveEngineId } from "../services/qualification/engine-registry";
import { buildQualificationStack } from "../services/qualification/qualification-service.factory";
import { setupAutofillInitDisconnectAction } from "../utils";

import AutofillInit from "./autofill-init";

/**
 * Which of the two top-frame-only overlay surfaces this content script carries.
 *
 * The three overlay bootstraps are the same script three times over; the only
 * thing that ever differed between them is this pair of booleans. Keeping the
 * shared body here means a change to the service graph — the qualification
 * stack wiring was the most recent — is made once instead of three times, and
 * can't land in two entry points and miss the third.
 */
export type OverlaySurfaces = {
  inlineMenu: boolean;
  notifications: boolean;
};

/**
 * Builds the autofill content-script service graph and starts it.
 *
 * Idempotent per window: a second call while `bitwardenAutofillInit` is already
 * set returns without building anything, which is what keeps a re-injected
 * script from running two overlays against one page.
 *
 * Both top-frame-only services are constructed only in the top frame. An iframe
 * gets the collection and fill machinery but no menu and no notification bar —
 * those belong to the page, not to each of its frames.
 */
export function bootstrapAutofillOverlay(
  windowContext: Window,
  surfaces: OverlaySurfaces,
  logContext: string,
): void {
  if (windowContext.bitwardenAutofillInit) {
    return;
  }

  const isTopFrame = globalThis.self === globalThis.top;
  const inlineMenuContentService =
    surfaces.inlineMenu && isTopFrame ? new AutofillInlineMenuContentService() : undefined;
  const overlayNotificationsContentService =
    surfaces.notifications && isTopFrame ? new OverlayNotificationsContentService() : undefined;

  const domQueryService = new DomQueryService();
  const domElementVisibilityService = new DomElementVisibilityService(inlineMenuContentService);

  // A content script can't read the feature flag, so it builds at whatever
  // `resolveEngineId` can answer synchronously — the dev flag, or the default —
  // and `AutofillInit` corrects it from the background. See
  // `qualification/engine-selection.design.md`.
  const qualificationStack = buildQualificationStack(resolveEngineId());
  logEngineSelection(qualificationStack.engine, logContext);

  const autofillOverlayContentService = new AutofillOverlayContentService(
    domQueryService,
    domElementVisibilityService,
    qualificationStack.service,
    inlineMenuContentService,
  );

  windowContext.bitwardenAutofillInit = new AutofillInit(
    domQueryService,
    domElementVisibilityService,
    autofillOverlayContentService,
    inlineMenuContentService,
    overlayNotificationsContentService,
    qualificationStack.swap,
  );
  setupAutofillInitDisconnectAction(windowContext);

  windowContext.bitwardenAutofillInit.init();
}
