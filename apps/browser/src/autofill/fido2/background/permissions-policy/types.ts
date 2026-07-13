/**
 * Boundary types for the Permissions Policy machinery.
 *
 * These shapes are the contract between the parser (layer 2) and everything that
 * consumes parsed policy data (semantics, delegation, the FIDO2 gate). The parser
 * implementation — whether `structured-headers`, a vendored copy, or a hand-rolled
 * parser — must produce these shapes. Nothing downstream of the parser imports
 * library-native types, so the parser is a single-file swap.
 */

/**
 * A single entry in a Permissions Policy directive's allowlist.
 *
 * Mirrors the three forms the spec recognizes:
 * - `self`     — the document's own origin
 * - `*`        — any origin (wildcard)
 * - "https://example.com" — a specific origin (always serialized as an ASCII
 *                origin string; the parser is responsible for normalizing).
 */
export type AllowlistItem =
  | { readonly type: "self" }
  | { readonly type: "wildcard" }
  | { readonly type: "origin"; readonly value: string };

/**
 * Allowlist items after `self`-resolution has been applied. Everything
 * downstream of parsing (the semantics layer, the resolver, the frame-policy
 * evaluator) consumes this narrower shape so the compiler catches any code
 * path that would let an unresolved `self` token cross a frame boundary —
 * the invariant that closed the ancestor-recursion bypass.
 */
export type ResolvedAllowlistItem = Exclude<AllowlistItem, { readonly type: "self" }>;

/**
 * A single Permissions Policy directive: a feature name and the allowlist that
 * applies to it. An empty `allowlist` means the feature is disallowed everywhere
 * (the `()` form, e.g. `publickey-credentials-create=()`).
 *
 * Parameterized by item type so directives can flow through the pipeline with
 * their `self`-resolution state preserved in the type system:
 *   - `PermissionsPolicyDirective` — raw parser output; may contain `self`.
 *   - `PermissionsPolicyDirective<ResolvedAllowlistItem>` — after resolution;
 *     no `self` items.
 */
export type PermissionsPolicyDirective<Item extends AllowlistItem = AllowlistItem> = {
  readonly feature: string;
  readonly allowlist: readonly Item[];
};

/**
 * A parsed `Permissions-Policy` header value, keyed by feature name. When the
 * same feature appears multiple times across combined headers, the parser is
 * expected to apply the spec's "later wins" rule; consumers can rely on at most
 * one directive per feature here.
 *
 * Parser output — may contain `{ type: "self" }` items. Must pass through
 * `resolveSelfInPolicy` before reaching the resolver.
 */
export type ParsedPermissionsPolicy = ReadonlyMap<string, PermissionsPolicyDirective>;

/**
 * A Permissions Policy whose `self` tokens have been resolved to explicit
 * origins. This is the shape the delegation algorithm and the semantics
 * layer consume — the type system enforces that consumers can't accidentally
 * evaluate `self` against a descendant's origin.
 */
export type ResolvedPermissionsPolicy = ReadonlyMap<
  string,
  PermissionsPolicyDirective<ResolvedAllowlistItem>
>;

/**
 * Features the FIDO2 gate cares about, by their Permissions Policy spec names.
 * Kept here so both the parser tests and the semantics layer share a single
 * source of truth.
 */
export const WebAuthnPermissionsPolicyFeature = Object.freeze({
  Create: "publickey-credentials-create",
  Get: "publickey-credentials-get",
} as const);

export type WebAuthnPermissionsPolicyFeature =
  (typeof WebAuthnPermissionsPolicyFeature)[keyof typeof WebAuthnPermissionsPolicyFeature];
