import type { LeasingError } from "./access-lease";

/**
 * Injectable seam over the SDK's per-client error guards (`isAccessRequestError`,
 * `isApprovalError`, `isAccessLeaseError`). Wrapping them behind a service keeps the wasm SDK
 * import out of consumers and lets unit tests stub leasing-error detection instead of resolving
 * the wasm package.
 */
export abstract class LeasingErrorService {
  abstract isLeasingError(error: unknown): error is LeasingError;
}
