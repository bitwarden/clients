import { is_valid_cidr } from "@bitwarden/sdk-internal";

/**
 * The SDK's `is_valid_cidr`, the same check the server applies: it needs a prefix and rejects
 * host bits set past it, such as `10.0.0.1/8`. It is synchronous once the wasm module is loaded,
 * which the CLI does at startup. Kept in the CLI package so `bit-common` loads no wasm in specs.
 */
export function isValidCidr(value: string): boolean {
  return is_valid_cidr(value);
}
