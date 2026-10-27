import { isAccessLeaseError, isAccessRequestError, isApprovalError } from "@bitwarden/sdk-internal";

import { type LeasingError } from "../abstractions/access-lease";
import { LeasingErrorService } from "../abstractions/leasing-error.service";

/** The only place the wasm-backed error guards are imported at runtime. */
export class DefaultLeasingErrorService implements LeasingErrorService {
  isLeasingError(error: unknown): error is LeasingError {
    return isAccessRequestError(error) || isApprovalError(error) || isAccessLeaseError(error);
  }
}
