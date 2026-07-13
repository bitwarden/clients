import { parseAllowAttribute } from "./allow-attribute-parser";
import { parseHeader } from "./header-parser";
import { ParsedPermissionsPolicy, ResolvedPermissionsPolicy } from "./types";

/**
 * Parser interface for turning raw Permissions Policy strings into the
 * structured shape the resolver consumes. This is the single seam where the
 * `structured-headers` library (or a vendored copy, or a hand-rolled parser)
 * will eventually plug in.
 *
 * Two distinct entry points because the two input contexts have slightly
 * different grammar quirks even though they share a syntax:
 *   - `parseHeader` is for the `Permissions-Policy` HTTP response header.
 *     Keywords: `*`, `self`. `self` resolves to the document's own origin.
 *   - `parseAllowAttribute` is for the iframe `allow=` attribute. It shares
 *     the same grammar, but adds the `'src'` keyword (resolves to the iframe's
 *     own origin) and treats a bare feature name (no allowlist) as `'src'`.
 *
 * Both methods are expected to return a `ParsedPermissionsPolicy` (a Map keyed
 * by feature name) with `self`/`src` already resolved to explicit origins for
 * allow-attribute parses. Header parses may keep `self` as a token because the
 * semantics layer treats `self` as matching the requesting origin (which for
 * declared headers is the document's own origin).
 *
 * The eventual real parser is also expected to handle:
 * - The "later wins" rule when a feature appears multiple times in combined
 *   header values.
 * - Origin normalization (e.g. lowercasing scheme/host via URL parsing) so the
 *   semantics layer's exact string match works.
 * - Returning an empty Map (or omitting the directive) when the input is
 *   syntactically invalid, so callers fall back to the spec defaults.
 */
export interface PermissionsPolicyParser {
  /**
   * Parses a `Permissions-Policy` HTTP response header value. Multiple
   * occurrences of the header are expected to have been concatenated with
   * `, ` by the caller (per RFC 8941 §3.1).
   */
  parseHeader(rawHeaderValue: string): ParsedPermissionsPolicy;

  /**
   * Parses an iframe `allow=` attribute. The parser resolves the `'src'`
   * keyword to `iframeOrigin` and the `'self'` keyword to `parentOrigin`
   * (i.e. the iframe element's origin) before storing — the returned policy
   * is guaranteed to contain no `{ type: "self" }` items, which is why the
   * return type is `ResolvedPermissionsPolicy`.
   */
  parseAllowAttribute(
    rawAttributeValue: string,
    iframeOrigin: string,
    parentOrigin: string,
  ): ResolvedPermissionsPolicy;
}

/**
 * No-op parser used as a placeholder while the real parser is being decided.
 *
 * Returns an empty `ParsedPermissionsPolicy` for every input. With this parser
 * wired in, the resolver falls back to spec defaults at every level:
 *   - Declared default for `publickey-credentials-*` is `*` (any origin), so
 *     no header-based deny will be enforced. This means VULN-582 stays open
 *     on every browser until the real parser is wired in.
 *   - Container default is `self` (= parent's origin), so cross-origin iframes
 *     without `allow=` are still denied. This means VULN-398's primary case
 *     (cross-origin iframe, no `allow=`) is closed even with the no-op parser.
 *
 * In short: the no-op parser is safe to ship — it doesn't introduce regressions
 * — but it doesn't deliver the full PM-38940 value until replaced.
 */
export class NoOpPermissionsPolicyParser implements PermissionsPolicyParser {
  parseHeader(): ParsedPermissionsPolicy {
    return new Map();
  }

  parseAllowAttribute(): ResolvedPermissionsPolicy {
    return new Map();
  }
}

/**
 * Default parser implementation used in production. Delegates to the hand-rolled
 * `parseHeader` (RFC 8941 dictionary/inner-list subset relevant to Permissions
 * Policy) and `parseAllowAttribute` (iframe `allow=` grammar) modules.
 */
export class DefaultPermissionsPolicyParser implements PermissionsPolicyParser {
  parseHeader(rawHeaderValue: string): ParsedPermissionsPolicy {
    return parseHeader(rawHeaderValue);
  }

  parseAllowAttribute(
    rawAttributeValue: string,
    iframeOrigin: string,
    parentOrigin: string,
  ): ResolvedPermissionsPolicy {
    return parseAllowAttribute(rawAttributeValue, iframeOrigin, parentOrigin);
  }
}
