import { InjectionToken } from "@angular/core";

import { SingleNudgeService } from "./default-single-nudge.service";

export const AUTOFILL_NUDGE_SERVICE = new InjectionToken<SingleNudgeService>(
  "AutofillNudgeService",
);
