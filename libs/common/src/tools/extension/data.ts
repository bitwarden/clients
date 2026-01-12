/** well-known name for a feature extensible through an extension. */
export const Site = Object.freeze({
  forwarder: "forwarder",
} as const);

/** well-known name for a field surfaced from an extension site to a vendor. */
export const Field = Object.freeze({
  token: "token",
  baseUrl: "baseUrl",
  domain: "domain",
  prefix: "prefix",
} as const);

/** Permission levels for metadata. */
export const Permission = Object.freeze({
  /** unless a rule denies access, allow it. If a permission is `null`
   * or `undefined` it should be treated as `Permission.default`.
   */
  default: "default",
  /** unless a rule allows access, deny it. */
  none: "none",
  /** access is explicitly granted to use an extension. */
  allow: "allow",
  /** access is explicitly prohibited for this extension. This rule overrides allow rules. */
  deny: "deny",
} as const);
