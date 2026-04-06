import { InjectionToken } from "@angular/core";

import { SingleNudgeService } from "./default-single-nudge.service";

/**
 * Injection tokens for client specific nudge services.
 *
 * These services require platform-specific features and must be explicitly
 * provided by each client that supports them. If not provided, NudgesService
 * falls back to NoOpNudgeService.
 *
 * Client specific services should use constructor injection (not inject())
 * to maintain safeProvider type safety.
 *
 * Universal services use @Injectable({ providedIn: "root" }) and can use inject().
 */

/** Browser: Requires BrowserApi  */
export const AUTOFILL_NUDGE_SERVICE = new InjectionToken<SingleNudgeService>(
  "AutofillNudgeService",
);

/** Browser: Requires AutomaticUserConfirmationService */
export const AUTO_CONFIRM_NUDGE_SERVICE = new InjectionToken<SingleNudgeService>(
  "AutoConfirmNudgeService",
);
