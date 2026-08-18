import { isAccessLeaseError, isAccessRequestError, isApprovalError } from "@bitwarden/sdk-internal";

import { type LeasingError, LeasingErrorService } from "..";

/**
 * Default {@link LeasingErrorService} — delegates to the SDK's per-client error guards. The only
 * place the wasm-backed guards are imported at runtime.
 */
export class DefaultLeasingErrorService implements LeasingErrorService {
  isLeasingError(error: unknown): error is LeasingError {
    return isAccessRequestError(error) || isApprovalError(error) || isAccessLeaseError(error);
  }
}
