import { ParsedPermissionsPolicy, ResolvedAllowlistItem, ResolvedPermissionsPolicy } from "./types";

/**
 * Default allowlist for `publickey-credentials-*` features when no directive is
 * present in the document's Permissions Policy: `*` (any origin). This matches
 * the MDN-documented defaults for both `publickey-credentials-create` and
 * `publickey-credentials-get`, and matches observable Chromium behavior — a
 * top-level page with no header allows WebAuthn in same-origin and properly
 * delegated cross-origin iframes alike.
 *
 * Note that this default applies to the **document's own** Permissions Policy
 * (i.e. its response header). The default for an iframe's **container** policy
 * (the parent's `allow=` attribute on this iframe element) is `self` — that's
 * where VULN-398's "cross-origin iframe without `allow=` is denied" property
 * comes from, and it's enforced by the frame-chain delegation algorithm rather
 * than by this default.
 */
const DEFAULT_ALLOWLIST_FOR_WEBAUTHN: readonly ResolvedAllowlistItem[] = Object.freeze([
  { type: "wildcard" } as const,
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
  policy: ResolvedPermissionsPolicy,
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
  policy: ResolvedPermissionsPolicy,
  feature: string,
): readonly ResolvedAllowlistItem[] {
  const directive = policy.get(feature);
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
/**
 * Rewrites a policy so every `{ type: "self" }` allowlist item is replaced by
 * `{ type: "origin", value: ownerOrigin }`. Intended to be called on a frame's
 * DECLARED policy after parsing, where `self` denotes the declaring document's
 * own origin.
 *
 * Why: the delegation algorithm evaluates ancestor policies against the
 * ORIGINAL requesting origin (a descendant's). Without resolution, a `self`
 * token in an ancestor's declared policy would be interpreted as matching the
 * descendant's origin — leaking through what should be a same-origin
 * restriction. Resolving to explicit origins at build time keeps the resolver
 * semantics uniform: `self` never crosses a frame boundary.
 *
 * Container policies (from the iframe `allow=` attribute) are already
 * pre-resolved by the allow-attribute parser (which knows both origins), so
 * this helper doesn't need to be applied to them.
 */
export function resolveSelfInPolicy(
  policy: ParsedPermissionsPolicy,
  ownerOrigin: string,
): ResolvedPermissionsPolicy {
  const result = new Map<
    string,
    { readonly feature: string; readonly allowlist: readonly ResolvedAllowlistItem[] }
  >();
  for (const [feature, directive] of policy) {
    const resolved: ResolvedAllowlistItem[] = directive.allowlist.map((item) =>
      item.type === "self" ? { type: "origin", value: ownerOrigin } : item,
    );
    result.set(feature, { feature, allowlist: resolved });
  }
  return result;
}

export function allowlistMatches(
  allowlist: readonly ResolvedAllowlistItem[],
  requestingOrigin: string,
): boolean {
  if (allowlist.length === 0) {
    return false;
  }
  for (const item of allowlist) {
    if (item.type === "wildcard") {
      return true;
    }
    if (item.type === "origin" && item.value === requestingOrigin) {
      return true;
    }
  }
  return false;
}
