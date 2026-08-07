import { isLeasingError } from "@bitwarden/sdk-internal";

import { type LeasingError, LeasingErrorService } from "..";

/**
 * Default {@link LeasingErrorService} — delegates to the SDK's `isLeasingError`
 * type guard. The only place the wasm-backed guard is imported at runtime.
 */
export class DefaultLeasingErrorService implements LeasingErrorService {
  isLeasingError(error: unknown): error is LeasingError {
    return isLeasingError(error);
  }
}
