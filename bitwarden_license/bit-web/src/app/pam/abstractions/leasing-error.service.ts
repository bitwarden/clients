import type { LeasingError } from "./access-lease";

/**
 * Injectable seam over the SDK's `isLeasingError` type guard. Wrapping the guard
 * behind a service keeps the wasm SDK import out of consumers and lets unit tests
 * stub leasing-error detection instead of resolving the wasm package.
 */
export abstract class LeasingErrorService {
  abstract isLeasingError(error: unknown): error is LeasingError;
}
