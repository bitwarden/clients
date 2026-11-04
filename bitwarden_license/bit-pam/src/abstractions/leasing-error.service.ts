import type { LeasingError } from "./access-lease";

/**
 * Wraps the SDK's per-client error guards, so consumers and their tests never import the wasm
 * package.
 */
export abstract class LeasingErrorService {
  abstract isLeasingError(error: unknown): error is LeasingError;
}
