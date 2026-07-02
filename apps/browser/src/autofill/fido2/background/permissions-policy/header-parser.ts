import { AllowlistItem, ParsedPermissionsPolicy, PermissionsPolicyDirective } from "./types";

/**
 * Parses a `Permissions-Policy` HTTP response header value.
 *
 * The header syntax is RFC 8941 Structured Field Values — specifically a
 * Dictionary whose values are either bare items or inner-lists. We handle the
 * subset relevant to Permissions Policy allowlists:
 *   - Dictionary of `feature-name = value` pairs, comma-separated.
 *   - Values that are bare tokens (`*`, `self`), bare strings (`"origin"`),
 *     or inner-lists `(item item …)` containing those.
 *   - Empty inner-lists `()` — the "deny everywhere" case.
 *   - Parameters (`;key=value` on items) are parsed and discarded.
 *   - When the same feature appears more than once, the last occurrence wins.
 *
 * Types we don't model as allowlist items (integers, decimals, booleans, byte
 * sequences, dates) are still lexed correctly so we advance past them, but the
 * directives whose values are those types are omitted from the result — the
 * resolver will fall back to the spec default for that feature.
 *
 * Multiple `Permissions-Policy` header instances should be pre-combined with
 * `, ` by the caller (per RFC 8941 §3.1); the header cache already does this.
 *
 * On parse failure, returns an empty Map — the resolver falls back to spec
 * defaults, which for `publickey-credentials-*` is `*`. Failing open here is
 * consistent with browser behavior (a malformed header is ignored).
 */
export function parseHeader(rawHeaderValue: string): ParsedPermissionsPolicy {
  const result = new Map<string, PermissionsPolicyDirective>();
  if (rawHeaderValue == null || rawHeaderValue.length === 0) {
    return result;
  }

  const parser = new HeaderParser(rawHeaderValue);
  try {
    parser.parseIntoDictionary(result);
  } catch {
    return new Map();
  }
  return result;
}

// Internal token shapes produced by lexing bare items. `unknown` covers types
// we lex-through-but-don't-preserve (integers, decimals, booleans, etc.).
type LexedItem =
  | { readonly kind: "token"; readonly value: string }
  | { readonly kind: "string"; readonly value: string }
  | { readonly kind: "unknown" };

class HeaderParser {
  private pos = 0;

  constructor(private readonly input: string) {}

  parseIntoDictionary(result: Map<string, PermissionsPolicyDirective>): void {
    this.skipSpTab();
    if (this.atEnd()) {
      return;
    }

    while (true) {
      const member = this.parseDictMember();
      if (member != null) {
        // Later-wins per RFC 8941 §4.2.2 step 4.
        result.set(member.feature, member);
      }

      this.skipOws();
      if (this.atEnd()) {
        return;
      }
      if (this.input[this.pos] !== ",") {
        // Unexpected input after a member — bail with what we have so far.
        throw new Error("expected `,` between dictionary members");
      }
      this.pos++; // consume ','
      this.skipOws();
      if (this.atEnd()) {
        // Trailing comma is an error per RFC 8941.
        throw new Error("trailing comma");
      }
    }
  }

  private parseDictMember(): PermissionsPolicyDirective | null {
    const key = this.parseKey();
    if (key == null) {
      throw new Error("expected member key");
    }

    let allowlist: AllowlistItem[] | null;
    if (!this.atEnd() && this.input[this.pos] === "=") {
      this.pos++; // consume '='
      allowlist = this.parseMemberValueAsAllowlist();
    } else {
      // Missing `=value` — RFC 8941 says the value is the boolean True. We
      // don't model boolean directives, so we drop them from the result.
      allowlist = null;
    }

    this.skipParameters();

    if (allowlist == null) {
      return null;
    }
    return { feature: key, allowlist };
  }

  private parseMemberValueAsAllowlist(): AllowlistItem[] | null {
    if (this.atEnd()) {
      throw new Error("expected member value");
    }

    if (this.input[this.pos] === "(") {
      const items = this.parseInnerList();
      return items.map(itemToAllowlist).filter((x): x is AllowlistItem => x != null);
    }

    const item = this.parseBareItem();
    this.skipItemParameters();
    const allowlistItem = itemToAllowlist(item);
    // Bare item that isn't a recognizable allowlist token (`*`, `self`) or a
    // parseable origin string → drop the directive entirely. Returning `[]`
    // would incorrectly signal "deny everywhere"; returning `null` signals
    // "let spec defaults apply for this feature".
    return allowlistItem == null ? null : [allowlistItem];
  }

  private parseInnerList(): LexedItem[] {
    if (this.input[this.pos] !== "(") {
      throw new Error("expected `(`");
    }
    this.pos++; // consume '('

    const items: LexedItem[] = [];
    while (true) {
      this.skipSp();
      if (this.atEnd()) {
        throw new Error("unterminated inner list");
      }
      if (this.input[this.pos] === ")") {
        this.pos++; // consume ')'
        return items;
      }

      items.push(this.parseBareItem());
      this.skipItemParameters();

      if (this.atEnd()) {
        throw new Error("unterminated inner list");
      }
      const next = this.input[this.pos];
      if (next !== " " && next !== ")") {
        throw new Error("expected space or `)` between inner-list items");
      }
    }
  }

  private parseBareItem(): LexedItem {
    if (this.atEnd()) {
      throw new Error("expected bare item");
    }
    const c = this.input[this.pos];
    if (c === '"') {
      return this.parseString();
    }
    if (c === "*" || isAlpha(c)) {
      return this.parseToken();
    }
    // Numbers, booleans, byte sequences, dates, display strings — lex past,
    // but treat as unknown so they don't produce allowlist entries.
    return this.lexUnknownBareItem();
  }

  private parseString(): LexedItem {
    if (this.input[this.pos] !== '"') {
      throw new Error('expected `"`');
    }
    this.pos++;
    let value = "";
    while (!this.atEnd()) {
      const c = this.input[this.pos];
      this.pos++;
      if (c === '"') {
        return { kind: "string", value };
      }
      if (c === "\\") {
        if (this.atEnd()) {
          throw new Error("dangling backslash in string");
        }
        const esc = this.input[this.pos];
        this.pos++;
        if (esc !== '"' && esc !== "\\") {
          throw new Error("invalid string escape");
        }
        value += esc;
        continue;
      }
      const code = c.charCodeAt(0);
      if (code < 0x20 || code > 0x7e) {
        throw new Error("invalid character in string");
      }
      value += c;
    }
    throw new Error("unterminated string");
  }

  private parseToken(): LexedItem {
    const start = this.pos;
    // Token start: ALPHA / "*"
    this.pos++;
    while (!this.atEnd() && isTChar(this.input[this.pos])) {
      this.pos++;
    }
    return { kind: "token", value: this.input.substring(start, this.pos) };
  }

  private lexUnknownBareItem(): LexedItem {
    // Consume until we hit a boundary character. This handles integers,
    // decimals, booleans (`?0`, `?1`), byte sequences (`:...:`), dates
    // (`@...`), display strings (`%"..."`). We don't validate the internal
    // shape — just move the cursor past the item so the outer parser can
    // continue.
    while (!this.atEnd()) {
      const c = this.input[this.pos];
      if (c === "," || c === ";" || c === ")" || c === " " || c === "\t") {
        break;
      }
      this.pos++;
    }
    return { kind: "unknown" };
  }

  private parseKey(): string | null {
    if (this.atEnd()) {
      return null;
    }
    const first = this.input[this.pos];
    if (!isKeyStart(first)) {
      return null;
    }
    const start = this.pos;
    this.pos++;
    while (!this.atEnd() && isKeyChar(this.input[this.pos])) {
      this.pos++;
    }
    return this.input.substring(start, this.pos);
  }

  private skipParameters(): void {
    while (!this.atEnd() && this.input[this.pos] === ";") {
      this.pos++;
      this.skipSpTab();
      const key = this.parseKey();
      if (key == null) {
        break;
      }
      if (!this.atEnd() && this.input[this.pos] === "=") {
        this.pos++;
        this.parseBareItem();
      }
    }
  }

  private skipItemParameters(): void {
    this.skipParameters();
  }

  private skipOws(): void {
    while (!this.atEnd()) {
      const c = this.input[this.pos];
      if (c === " " || c === "\t") {
        this.pos++;
      } else {
        break;
      }
    }
  }

  private skipSp(): void {
    while (!this.atEnd() && this.input[this.pos] === " ") {
      this.pos++;
    }
  }

  private skipSpTab(): void {
    this.skipOws();
  }

  private atEnd(): boolean {
    return this.pos >= this.input.length;
  }
}

function itemToAllowlist(item: LexedItem): AllowlistItem | null {
  if (item.kind === "token") {
    if (item.value === "*") {
      return { type: "wildcard" };
    }
    if (item.value === "self") {
      return { type: "self" };
    }
    return null;
  }
  if (item.kind === "string") {
    try {
      return { type: "origin", value: new URL(item.value).origin };
    } catch {
      return null;
    }
  }
  return null;
}

function isAlpha(c: string): boolean {
  return (c >= "a" && c <= "z") || (c >= "A" && c <= "Z");
}

function isDigit(c: string): boolean {
  return c >= "0" && c <= "9";
}

// RFC 8941 §3.9: key = ( lcalpha / "*" ) *( lcalpha / DIGIT / "_" / "-" / "." / "*" )
function isKeyStart(c: string): boolean {
  return (c >= "a" && c <= "z") || c === "*";
}

function isKeyChar(c: string): boolean {
  return (c >= "a" && c <= "z") || isDigit(c) || c === "_" || c === "-" || c === "." || c === "*";
}

// RFC 7230 tchar plus RFC 8941 addition of ":" and "/".
function isTChar(c: string): boolean {
  return isAlpha(c) || isDigit(c) || "!#$%&'*+-.^_`|~:/".includes(c);
}
