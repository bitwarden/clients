import type { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import type { FillResult } from "../../types";
import { AUTOFILL_INVALID } from "../../utils";

/** The reason a phase gives when the request lacks what the phase's sub-plan calls for. */
export const REQUEST_MISMATCH = "the request does not carry what the plan calls for";

/**
 * The result that ends a fill when something it depends on cannot be established, such as when the
 * browser does not name a document or the request lacks what the plan calls for. Logs `reason` as a
 * warning; `reason` must not name a URL, document, or account.
 *
 * Phases end a fill this way so that each logs and reports it alike.
 */
export function invalid(log: LogService, reason: string): FillResult {
  log.warning(`Autofill attempt invalid: ${reason}.`);
  return AUTOFILL_INVALID;
}
