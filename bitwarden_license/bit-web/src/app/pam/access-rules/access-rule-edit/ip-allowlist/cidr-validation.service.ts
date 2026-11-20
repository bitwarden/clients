/**
 * Injected as a token to keep the WASM-backed {@link DefaultCidrValidationService} out of the
 * editor's module graph, so the editor renders without a booted SDK.
 */
export abstract class CidrValidationService {
  /** True when `value` is a valid IPv4 or IPv6 CIDR range. */
  abstract isValid(value: string): boolean;
}
