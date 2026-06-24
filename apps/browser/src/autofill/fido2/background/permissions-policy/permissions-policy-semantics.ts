import { AllowlistItem, ParsedPermissionsPolicy, PermissionsPolicyDirective } from "./types";

/**
 * Default allowlist for `publickey-credentials-*` features when no directive is
 * present in the document's Permissions Policy: `self`. This matches the spec's
 * declared default allowlist for these features (Permissions Policy §default-allowlist).
 */
const DEFAULT_ALLOWLIST_FOR_WEBAUTHN: readonly AllowlistItem[] = Object.freeze([
  { type: "self" } as const,
]);

/**
 * Returns whether a Permissions Policy permits the given WebAuthn feature for
 * the requesting origin.
 *
 * `policy` is the document's effective Permissions Policy — i.e. the result of
 * combining response headers with the iframe's `allow=` attribute (the
 * delegation algorithm lives in layer 4 and is the caller's responsibility).
 * When the directive is absent from `policy`, the spec's default allowlist for
 * `publickey-credentials-*` (`self`) is applied here.
 *
 * @param policy           The document's resolved Permissions Policy.
 * @param feature          Feature name, e.g. `publickey-credentials-get`.
 * @param requestingOrigin The origin asking to use the feature. For WebAuthn
 *                         ceremonies this is the requesting document's origin
 *                         (which is also what `self` in the policy refers to).
 */
export function isFeatureAllowedByPolicy(
  policy: ParsedPermissionsPolicy,
  feature: string,
  requestingOrigin: string,
): boolean {
  const allowlist = getEffectiveAllowlist(policy, feature);
  return allowlistMatches(allowlist, requestingOrigin);
}

/**
 * Returns the allowlist that applies to a feature in this policy, falling back
 * to the default allowlist for WebAuthn features when the directive is absent.
 * Exposed for tests and for callers that want to inspect the allowlist without
 * running the match step.
 */
export function getEffectiveAllowlist(
  policy: ParsedPermissionsPolicy,
  feature: string,
): readonly AllowlistItem[] {
  const directive: PermissionsPolicyDirective | undefined = policy.get(feature);
  if (directive == null) {
    return DEFAULT_ALLOWLIST_FOR_WEBAUTHN;
  }
  return directive.allowlist;
}

/**
 * Returns whether the given allowlist permits the requesting origin.
 *
 * Matching rules per the spec:
 * - An empty allowlist (`()`) denies everything.
 * - The `*` token matches any origin.
 * - The `self` token matches if the requesting origin equals the policy-defining
 *   document's origin. For WebAuthn ceremonies the policy applies to the
 *   requesting document, so the requesting origin and `self` refer to the same
 *   thing — a `self` token always matches in this case.
 * - An explicit origin matches on exact string equality. Allowlist origins are
 *   expected to be already-normalized ASCII origin serializations (the parser's
 *   responsibility).
 */
export function allowlistMatches(
  allowlist: readonly AllowlistItem[],
  requestingOrigin: string,
): boolean {
  if (allowlist.length === 0) {
    return false;
  }
  for (const item of allowlist) {
    if (item.type === "wildcard") {
      return true;
    }
    if (item.type === "self") {
      return true;
    }
    if (item.type === "origin" && item.value === requestingOrigin) {
      return true;
    }
  }
  return false;
}
