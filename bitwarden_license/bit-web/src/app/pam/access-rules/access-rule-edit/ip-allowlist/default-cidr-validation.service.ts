import { is_valid_cidr } from "@bitwarden/sdk-internal";

import { CidrValidationService } from "./cidr-validation.service";

/**
 * SDK-backed {@link CidrValidationService}. Delegates to the Rust SDK's `is_valid_cidr` (backed by
 * the `ipnet` crate), which the WASM module makes synchronously available once loaded at app
 * startup — see other direct SDK free-function call sites (e.g. `import_ssh_key` in
 * `onepassword-1pux-importer.ts`) for the same convention.
 *
 * Behavior notes (see PM-37273): host bits set past the prefix are rejected (e.g. `10.0.0.1/8` is
 * invalid), the prefix is required and explicit (no bare-address fallback), and IPv6 is fully
 * parsed rather than regex-matched.
 *
 * This is the only place that imports the WASM-backed CIDR check; it is wired in `providePam()`
 * and never imported by the editor components, so those stay renderable without a booted SDK.
 */
export class DefaultCidrValidationService extends CidrValidationService {
  isValid(value: string): boolean {
    return is_valid_cidr(value);
  }
}
