/**
 * Contract for validating CIDR ranges in the IP-allowlist editor. Injected as a token so the
 * WASM-backed implementation ({@link DefaultCidrValidationService}) stays out of the component's
 * module graph — components depend only on this abstract class, which keeps the editor and its
 * host page renderable without a booted SDK (Storybook, isolated tests). The app binds the real
 * implementation in `providePam()`.
 */
export abstract class CidrValidationService {
  /** True when `value` is a valid IPv4 or IPv6 CIDR range. */
  abstract isValid(value: string): boolean;
}
