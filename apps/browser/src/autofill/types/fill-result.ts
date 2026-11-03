// The fill result is owned by `orchestration`. Code under `autofill/` imports it from there. These
// aliases remain for the modules outside `autofill/` that still import it from this path, and name
// each symbol such a module uses. They import from `orchestration`'s own files and not its barrel,
// so a module that imports a fill result does not take on the orchestrator.
import type { FillResult as OrchestrationFillResult } from "../orchestration/types";
import {
  AUTOFILL_DENIED as ORCHESTRATION_AUTOFILL_DENIED,
  didFillOccur as orchestrationDidFillOccur,
  shouldAutoCopyTotp as orchestrationShouldAutoCopyTotp,
} from "../orchestration/utils";

/** @deprecated Import `FillResult` from the `orchestration` module under `autofill`. */
export type FillResult = OrchestrationFillResult;

/** @deprecated Import `AUTOFILL_DENIED` from the `orchestration` module under `autofill`. */
export const AUTOFILL_DENIED = ORCHESTRATION_AUTOFILL_DENIED;

/** @deprecated Import `didFillOccur` from the `orchestration` module under `autofill`. */
export const didFillOccur = orchestrationDidFillOccur;

/** @deprecated Import `shouldAutoCopyTotp` from the `orchestration` module under `autofill`. */
export const shouldAutoCopyTotp = orchestrationShouldAutoCopyTotp;
