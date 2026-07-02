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
 * A single Permissions Policy directive: a feature name and the allowlist that
 * applies to it. An empty `allowlist` means the feature is disallowed everywhere
 * (the `()` form, e.g. `publickey-credentials-create=()`).
 */
export type PermissionsPolicyDirective = {
  readonly feature: string;
  readonly allowlist: readonly AllowlistItem[];
};

/**
 * A parsed `Permissions-Policy` header value, keyed by feature name. When the
 * same feature appears multiple times across combined headers, the parser is
 * expected to apply the spec's "later wins" rule; consumers can rely on at most
 * one directive per feature here.
 */
export type ParsedPermissionsPolicy = ReadonlyMap<string, PermissionsPolicyDirective>;

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
