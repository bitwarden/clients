import {
  PermissionsPolicyDirective,
  ResolvedAllowlistItem,
  ResolvedPermissionsPolicy,
} from "./types";

/**
 * Parses an iframe `allow=` attribute into the structured form the resolver
 * consumes.
 *
 * Grammar (per the iframe `allow` attribute syntax — distinct from the
 * RFC 8941 syntax of the `Permissions-Policy` HTTP response header):
 *
 *   allow         = directive *( ";" directive )
 *   directive     = feature-name *( WSP allowlist-item )
 *   allowlist-item = "*" | "'self'" | "'src'" | "'none'" | ASCII-origin
 *
 * Semantics:
 *   - When a directive has no allowlist items, the default is `'src'` —
 *     the iframe's own loaded origin.
 *   - `'self'` resolves to the iframe element's origin (= the parent's
 *     origin). Rarely meaningful in cross-origin iframes since it doesn't
 *     include the iframe's own origin.
 *   - `'src'` resolves to the iframe's loaded origin.
 *   - `'none'` is an explicit deny; the directive's allowlist becomes
 *     empty regardless of other items in the same directive.
 *   - `*` matches any origin (wildcard).
 *   - Anything else is treated as an ASCII origin and normalized via URL
 *     parsing; malformed values are dropped.
 *
 * Tolerant of whitespace and trailing semicolons. When the same feature
 * appears more than once, the last occurrence wins (matches the spec).
 *
 * @param rawAttributeValue Raw `allow=` attribute string.
 * @param iframeOrigin     Origin of the iframe's loaded document — used
 *                         to resolve `'src'` and the default-no-items case.
 * @param parentOrigin     Origin of the iframe element's owning document
 *                         — used to resolve `'self'`.
 */
export function parseAllowAttribute(
  rawAttributeValue: string,
  iframeOrigin: string,
  parentOrigin: string,
): ResolvedPermissionsPolicy {
  const result = new Map<string, PermissionsPolicyDirective<ResolvedAllowlistItem>>();

  if (rawAttributeValue == null || rawAttributeValue.length === 0) {
    return result;
  }

  for (const raw of rawAttributeValue.split(";")) {
    const directive = parseDirective(raw, iframeOrigin, parentOrigin);
    if (directive != null) {
      // Later wins when the same feature appears multiple times
      result.set(directive.feature, directive);
    }
  }

  return result;
}

function parseDirective(
  rawDirective: string,
  iframeOrigin: string,
  parentOrigin: string,
): PermissionsPolicyDirective<ResolvedAllowlistItem> | null {
  const trimmed = rawDirective.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const tokens = trimmed.split(/\s+/);
  const feature = tokens[0].toLowerCase();
  if (!isValidFeatureName(feature)) {
    return null;
  }

  const items = tokens.slice(1);

  // No allowlist items → default is `'src'` (the iframe's own origin)
  if (items.length === 0) {
    return {
      feature,
      allowlist: [{ type: "origin", value: iframeOrigin }],
    };
  }

  // `'none'` anywhere in the allowlist means the directive denies all origins
  if (items.includes("'none'")) {
    return { feature, allowlist: [] };
  }

  const allowlist: ResolvedAllowlistItem[] = [];
  for (const item of items) {
    const parsed = parseAllowlistItem(item, iframeOrigin, parentOrigin);
    if (parsed != null) {
      allowlist.push(parsed);
    }
  }

  return { feature, allowlist };
}

function parseAllowlistItem(
  token: string,
  iframeOrigin: string,
  parentOrigin: string,
): ResolvedAllowlistItem | null {
  if (token === "*") {
    return { type: "wildcard" };
  }
  if (token === "'self'") {
    return { type: "origin", value: parentOrigin };
  }
  if (token === "'src'") {
    return { type: "origin", value: iframeOrigin };
  }
  if (token === "'none'") {
    // Handled at the directive level (forces an empty allowlist).
    return null;
  }

  // Anything else: treat as an ASCII origin string and normalize via the
  // URL parser. Malformed values are dropped silently.
  try {
    return { type: "origin", value: new URL(token).origin };
  } catch {
    return null;
  }
}

function isValidFeatureName(name: string): boolean {
  // Feature names are HTTP tokens per RFC 7230. The set we encounter in
  // practice is `[a-z][a-z0-9-]*`; this is permissive enough to accept any
  // current or near-future Permissions Policy feature without admitting
  // obvious garbage.
  return /^[a-z][a-z0-9-]*$/.test(name);
}
